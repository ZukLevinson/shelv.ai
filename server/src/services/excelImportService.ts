import xlsx from 'xlsx';
import { db, syncPendingHoldersCoupling } from '../db/database.js';
import { parseMashaString, normalizeMashaCode, cleanSerialNumber } from '../utils/mashaUtils.js';

export interface ImportResult {
  importId: string;
  filename: string;
  insertedCount: number;
  updatedCount: number;
  errors: string[];
}

export interface ExcelImportRecord {
  id: string;
  filename: string;
  import_type: 'signatures' | 'scans';
  uploaded_at: string;
  total_rows: number;
  inserted_count: number;
  updated_count: number;
  active_items_count: number;
}

function normalizeCategory(rawCat: any): string {
  const cat = String(rawCat || '').trim();
  const lower = cat.toLowerCase();
  if (lower.includes('מחשב') || lower === 'pc' || lower.includes('workstation')) {
    return 'Regular Workstation';
  }
  if (lower.includes('מסך') || lower.includes('screen') || lower.includes('monitor')) {
    return 'Screen';
  }
  if (lower.includes('סוויץ') || lower.includes('switch') || lower.includes('מתג') || lower.includes('kvm') || lower.includes('ממתג')) {
    return 'Network Switch';
  }
  if (lower.includes('מדפסת') || lower.includes('printer')) {
    return 'Printer';
  }
  return cat || 'Regular Workstation';
}

export function importOfficialInventoryFromExcel(buffer: Buffer, originalFilename: string = 'inventory.xlsx'): ImportResult {
  const workbook = xlsx.read(buffer, { type: 'buffer' });

  let insertedCount = 0;
  let updatedCount = 0;
  const errors: string[] = [];

  const importId = 'import-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);

  const insertImportRecord = db.prepare(`
    INSERT INTO excel_imports (id, filename, import_type, uploaded_at, total_rows, inserted_count, updated_count)
    VALUES (?, ?, 'signatures', CURRENT_TIMESTAMP, ?, ?, ?)
  `);

  const updateImportRecord = db.prepare(`
    UPDATE excel_imports
    SET inserted_count = ?, updated_count = ?
    WHERE id = ?
  `);

  const findHolderByName = db.prepare('SELECT id, name, personal_number FROM inventory_holders WHERE name = ? COLLATE NOCASE');
  const insertHolder = db.prepare('INSERT INTO inventory_holders (id, name, personal_number, import_id) VALUES (?, ?, ?, ?)');
  const updateHolderPN = db.prepare('UPDATE inventory_holders SET personal_number = ? WHERE id = ?');
  
  const findRoomForHolder = db.prepare('SELECT id FROM rooms WHERE holder_id = ? LIMIT 1');
  const findRoomByCode = db.prepare('SELECT id, holder_id FROM rooms WHERE code = ? LIMIT 1');

  const findItemBySN = db.prepare('SELECT id FROM official_inventory WHERE serial_number = ?');
  const insertItem = db.prepare(`
    INSERT INTO official_inventory (id, masha, serial_number, description, category, room_id, holder_id, import_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateItem = db.prepare(`
    UPDATE official_inventory 
    SET masha = ?, description = ?, category = ?, room_id = ?, holder_id = ?, import_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE serial_number = ?
  `);
  const updateItemSN = db.prepare(`
    UPDATE official_inventory
    SET serial_number = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  const upsertMasha = db.prepare(`
    INSERT INTO masha_registry (masha, category, description, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(masha) DO UPDATE SET
      category = CASE WHEN excluded.category != 'Regular Workstation' THEN excluded.category ELSE masha_registry.category END,
      description = CASE WHEN excluded.description != '' AND excluded.description != 'ציוד' THEN excluded.description ELSE masha_registry.description END,
      updated_at = CURRENT_TIMESTAMP
  `);

  const resolveHolder = (holderName: string, personalNumber?: string) => {
    let holderRecord = findHolderByName.get(holderName) as any;
    let holderId: string;
    if (holderRecord) {
      holderId = holderRecord.id;
      if (personalNumber && !holderRecord.personal_number) {
        updateHolderPN.run(personalNumber, holderId);
      }
    } else {
      holderId = 'holder-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
      insertHolder.run(holderId, holderName, personalNumber || null, importId);
    }
    const holderRoom = findRoomForHolder.get(holderId) as any;
    return { holderId, roomId: holderRoom?.id || null };
  };

  // 1. Sheet discovery: analyze all sheets to find matrix sheets, flat sheets, and individual portfolio sheets
  let matrixSheetName: string | null = null;
  let flatSheetName: string | null = null;
  const individualSheets: Array<{ sheetName: string; holderName: string; headerRowIdx: number }> = [];

  for (const sName of workbook.SheetNames) {
    const normSheet = sName.trim().toLowerCase();
    // Skip sheets that are clearly Google Forms scans/surveys
    if (normSheet.includes('form responses') || normSheet.includes('תגובות לטופס')) {
      continue;
    }

    const ws = workbook.Sheets[sName];
    const rawRows = xlsx.utils.sheet_to_json<any[]>(ws, { header: 1 });
    if (!rawRows || rawRows.length === 0) continue;

    let headerRowIdx = 0;
    for (let r = 0; r < Math.min(5, rawRows.length); r++) {
      const row = rawRows[r];
      if (row && row.some((c: any) => typeof c === 'string' && (c.includes('מק"ט') || c.includes('מקט') || c.includes('מסח"א') || c.includes('בעל מצאי')))) {
        headerRowIdx = r;
        break;
      }
    }

    const headers = rawRows[headerRowIdx] || [];
    const matrixCols = headers.filter((k: any) => typeof k === 'string' && (/^כמות\s+(?:בתיק|אצל|של)\s+/i.test(k) || /^תיק\s+/i.test(k)));
    const flatHolderCol = headers.find((k: any) => typeof k === 'string' && (k.includes('בעל מצאי') || k.includes('שם מחזיק') || k.includes('מחזיק') || k.includes('אחראי') || k.includes('Inventory Holder')));

    if (matrixCols.length > 0) {
      matrixSheetName = sName;
    } else if (flatHolderCol) {
      flatSheetName = sName;
    } else {
      const indMatch = sName.match(/^תיק\s*(?:\d+)?\s*[-–]\s*(.+)$/i);
      if (indMatch) {
        individualSheets.push({ sheetName: sName, holderName: indMatch[1].trim(), headerRowIdx });
      }
    }
  }

  // 2. Execute import transaction
  const runTransaction = db.transaction(() => {
    // Case A: Matrix sheet detected (e.g. 'תיק אחוד')
    if (matrixSheetName) {
      const ws = workbook.Sheets[matrixSheetName];
      const rows = xlsx.utils.sheet_to_json<Record<string, any>>(ws);
      insertImportRecord.run(importId, originalFilename, rows.length, 0, 0);

      const firstRow = rows[0] || {};
      const holderCols = Object.keys(firstRow).filter(k => /^כמות\s+(?:בתיק|אצל|של)\s+/i.test(k) || /^תיק\s+/i.test(k));

      // Track unassigned NULL-SN item IDs: Map<"holderId::cleanMasha", string[]>
      const unassignedItemIds = new Map<string, string[]>();

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rawMasha = row['מק"ט'] || row['מקט'] || row['מסח"א'] || row['Catalog #'] || row['Catalog'] || row['קוד פריט'];
        const rawDesc = row['תיאור מוצר'] || row['חמנייה פורחת'] || row['תיאור'] || row['Description'] || row['Product'];
        const { masha, description } = parseMashaString(rawMasha, rawDesc);
        const category = normalizeCategory(row['סוג'] || row['קטגוריה'] || row['Category']);

        if (!masha) continue;

        try {
          upsertMasha.run(masha, category, description);
        } catch {}

        for (const col of holderCols) {
          const holderName = col.replace(/^כמות\s+(?:בתיק|אצל|של)\s+/i, '').replace(/^תיק\s+/i, '').trim();
          const qty = parseInt(row[col], 10) || 0;
          if (qty <= 0) continue;

          const { holderId, roomId } = resolveHolder(holderName);
          const key = `${holderId}::${masha}`;
          if (!unassignedItemIds.has(key)) {
            unassignedItemIds.set(key, []);
          }

          for (let q = 0; q < qty; q++) {
            const itemId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}-${q}`;
            insertItem.run(itemId, masha, null, description || 'ציוד', category, roomId, holderId, importId);
            unassignedItemIds.get(key)!.push(itemId);
            insertedCount++;
          }
        }
      }

      // Enrich with individual portfolio sheets (e.g. 'תיק 39 - צוק')
      for (const ind of individualSheets) {
        const ws = workbook.Sheets[ind.sheetName];
        const raw = xlsx.utils.sheet_to_json<any[]>(ws, { header: 1 });
        const headers = raw[ind.headerRowIdx] || [];
        const mashaColIdx = headers.findIndex((h: any) => typeof h === 'string' && (h.includes('מק"ט') || h.includes('מקט') || h.includes('מסח"א')));
        const snColIdx = headers.findIndex((h: any) => typeof h === 'string' && (h.includes('מזהה ייחודי') || h.includes('סידורי') || h.includes('סריאלי') || h.includes('s/n')));
        const roomColIdx = headers.findIndex((h: any) => typeof h === 'string' && (h.includes('חדר') || h.includes('room')));

        if (mashaColIdx === -1 || snColIdx === -1) continue;

        const { holderId, roomId: defaultRoomId } = resolveHolder(ind.holderName);

        for (let r = ind.headerRowIdx + 1; r < raw.length; r++) {
          const row = raw[r];
          if (!row || row.length === 0) continue;
          const cleanMasha = normalizeMashaCode(row[mashaColIdx]);
          const rawSn = row[snColIdx];
          const { serialNumber: sn } = cleanSerialNumber(rawSn);

          if (!cleanMasha || !sn) continue;

          let itemRoomId = defaultRoomId;
          if (roomColIdx !== -1 && row[roomColIdx]) {
            const roomCode = String(row[roomColIdx]).trim();
            const rRec = findRoomByCode.get(roomCode) as any;
            if (rRec?.id) {
              itemRoomId = rRec.id;
            }
          }

          // Check if this SN already exists anywhere in official_inventory to avoid UNIQUE constraint violation
          const existingItemWithSn = findItemBySN.get(sn) as any;
          if (existingItemWithSn) {
            updateItem.run(cleanMasha, 'ציוד', 'Regular Workstation', itemRoomId, holderId, importId, sn);
            updatedCount++;
            continue;
          }

          const key = `${holderId}::${cleanMasha}`;
          const availableIds = unassignedItemIds.get(key);
          if (availableIds && availableIds.length > 0) {
            const itemId = availableIds.shift()!;
            updateItemSN.run(sn, itemId);
            updatedCount++;
          } else {
            const itemId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
            insertItem.run(itemId, cleanMasha, sn, 'ציוד', 'Regular Workstation', itemRoomId, holderId, importId);
            insertedCount++;
          }
        }
      }

      updateImportRecord.run(insertedCount, updatedCount, importId);
      return;
    }

    // Case B: Flat sheet or fallback to sheet 0
    const targetSheetName = flatSheetName || (workbook.SheetNames.length > 0 ? workbook.SheetNames[0] : null);
    if (!targetSheetName) {
      throw new Error('הקובץ אינו מכיל גליונות נתונים');
    }

    const worksheet = workbook.Sheets[targetSheetName];
    const rows = xlsx.utils.sheet_to_json<any>(worksheet);

    insertImportRecord.run(importId, originalFilename, rows.length, 0, 0);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowIdx = i + 2;

      const rawMasha = row['Masha'] ||
        row['מסח"א'] ||
        row['Catalog #'] ||
        row['Catalog'] ||
        row['מק"ט'] ||
        row['מקט'] ||
        row['מספר קטלוגי'] ||
        row['קוד פריט'] ||
        row['סוג חומר'] ||
        '';

      const rawDesc = row['Description'] ||
        row['תיאור'] ||
        row['Product'] ||
        row['שם פריט'] ||
        row['תיאור פריט'] ||
        row['תיאור מסח"א'] ||
        row['שם מוצר'] ||
        'ציוד';

      const { masha, description } = parseMashaString(rawMasha, rawDesc);

      const { serialNumber: sn } = cleanSerialNumber(
        row['Serial Number'] ||
        row['Serial No'] ||
        row['Serial No.'] ||
        row['Serial #'] ||
        row['S/N'] ||
        row['SN'] ||
        row['מספר סידורי'] ||
        row['מס"ד'] ||
        row["מס'ד"] ||
        row['מסד'] ||
        row['סריאלי'] ||
        row['Serial'] ||
        row['מספר מכשיר'] ||
        row['מזהה ייחודי'] ||
        ''
      );

      const category = normalizeCategory(
        row['Category'] ||
        row['קטגוריה'] ||
        row['סוג'] ||
        row['סוג פריט']
      );

      const holderName = String(
        row['Inventory Holder'] ||
        row['בעל מצאי'] ||
        row['Holder'] ||
        row['שם בעל מצאי'] ||
        row['מחזיק'] ||
        row['שם מחזיק'] ||
        row['אחראי'] ||
        row['שם אחראי'] ||
        row['שם חותם'] ||
        row['חותם'] ||
        ''
      ).trim();

      const personalNumber = String(
        row['Personal Number'] ||
        row['מספר אישי'] ||
        row['מ"א'] ||
        row["מ'א"] ||
        row['מא'] ||
        row['ת"ז'] ||
        row['תעודת זהות'] ||
        ''
      ).trim();
      
      const rawQty = row['Quantity'] || row['כמות'] || row['Count'] || row['Qty'] || row['כמות במצאי'] || row['כמות רשומה'];
      const parsedQty = rawQty !== undefined && rawQty !== null && String(rawQty).trim() !== '' ? parseInt(String(rawQty).trim(), 10) : 1;
      const quantity = isNaN(parsedQty) || parsedQty < 1 ? 1 : parsedQty;

      if (!masha) {
        errors.push(`שורה ${rowIdx}: חסר מספר קטלוגי / מסח"א`);
        continue;
      }

      if (!holderName) {
        errors.push(`שורה ${rowIdx}: חסר שם בעל מצאי (בעל המצאי שמחזיק במסח"א)`);
        continue;
      }

      // Sync Masha metadata into masha_registry
      try {
        upsertMasha.run(masha, category, description);
      } catch {
        // Ignore non-fatal registry error
      }

      const { holderId, roomId } = resolveHolder(holderName, personalNumber);

      if (sn) {
        // Explicit Serial Number provided in Excel
        const existing = findItemBySN.get(sn) as any;
        if (existing) {
          updateItem.run(masha, description, category, roomId, holderId, importId, sn);
          updatedCount++;
        } else {
          const itemId = 'item-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
          insertItem.run(itemId, masha, sn, description, category, roomId, holderId, importId);
          insertedCount++;
        }
      } else {
        // No explicit S/N provided -> insert signature items with NULL serial_number
        for (let q = 0; q < quantity; q++) {
          const itemId = 'item-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6) + '-' + q;
          insertItem.run(itemId, masha, null, description, category, roomId, holderId, importId);
          insertedCount++;
        }
      }
    }

    updateImportRecord.run(insertedCount, updatedCount, importId);
  });

  runTransaction();

  // Automatically couple any logged-in users whose personal_number matches newly imported holders
  try {
    syncPendingHoldersCoupling();
  } catch (err) {
    console.error('[Excel Import] Error syncing pending holder couplings:', err);
  }

  return { importId, filename: originalFilename, insertedCount, updatedCount, errors };
}

export function getExcelImports(type?: string): ExcelImportRecord[] {
  let query = `
    SELECT e.*,
           CASE 
             WHEN e.import_type = 'scans' THEN (SELECT COUNT(*) FROM sweep_observations s WHERE s.import_id = e.id)
             ELSE (SELECT COUNT(*) FROM official_inventory o WHERE o.import_id = e.id)
           END as active_items_count
    FROM excel_imports e
  `;
  const params: any[] = [];
  if (type) {
    query += ` WHERE e.import_type = ?`;
    params.push(type);
  }
  query += ` ORDER BY e.uploaded_at DESC`;
  return db.prepare(query).all(...params) as ExcelImportRecord[];
}

export function deleteExcelImport(importId: string) {
  const existing = db.prepare('SELECT * FROM excel_imports WHERE id = ?').get(importId) as any;
  if (!existing) {
    throw new Error('רשומת אקסל לא נמצאה');
  }

  let deletedItemsCount = 0;
  let deletedHoldersCount = 0;

  const runTransaction = db.transaction(() => {
    if (existing.import_type === 'scans') {
      const scansRes = db.prepare('DELETE FROM sweep_observations WHERE import_id = ?').run(importId);
      deletedItemsCount = scansRes.changes;
    } else {
      // 1. Delete official inventory items for this import
      const itemsRes = db.prepare('DELETE FROM official_inventory WHERE import_id = ?').run(importId);
      deletedItemsCount = itemsRes.changes;

      // 2. Clean up any holders created specifically by this import that now have no remaining items, no rooms, no scans, and no coupled user
      const importHolders = db.prepare('SELECT id, name FROM inventory_holders WHERE import_id = ?').all(importId) as Array<{ id: string; name: string }>;
      
      const checkItems = db.prepare('SELECT COUNT(*) as c FROM official_inventory WHERE holder_id = ?');
      const checkRooms = db.prepare('SELECT COUNT(*) as c FROM rooms WHERE holder_id = ?');
      const checkUsers = db.prepare('SELECT COUNT(*) as c FROM users WHERE holder_id = ?');
      const checkScans = db.prepare(`
        SELECT COUNT(*) as c 
        FROM sweep_observations o 
        JOIN rooms r ON o.room_id = r.id 
        WHERE r.holder_id = ?
      `);
      const deleteHolder = db.prepare('DELETE FROM inventory_holders WHERE id = ?');

      for (const h of importHolders) {
        const itemsCount = (checkItems.get(h.id) as any).c;
        const roomsCount = (checkRooms.get(h.id) as any).c;
        const usersCount = (checkUsers.get(h.id) as any).c;
        const scansCount = (checkScans.get(h.id) as any).c;

        if (itemsCount === 0 && roomsCount === 0 && usersCount === 0 && scansCount === 0) {
          deleteHolder.run(h.id);
          deletedHoldersCount++;
        }
      }
    }

    // Delete the import record itself
    db.prepare('DELETE FROM excel_imports WHERE id = ?').run(importId);
  });

  runTransaction();

  return {
    success: true,
    deletedImportId: importId,
    filename: existing.filename,
    importType: existing.import_type || 'signatures',
    deletedItemsCount,
    deletedHoldersCount
  };
}

export function resetAllOfficialInventory() {
  let deletedItemsCount = 0;
  let deletedImportsCount = 0;
  let deletedHoldersCount = 0;

  const runTransaction = db.transaction(() => {
    const itemsRes = db.prepare('DELETE FROM official_inventory').run();
    deletedItemsCount = itemsRes.changes;
    const importsRes = db.prepare("DELETE FROM excel_imports WHERE import_type = 'signatures'").run();
    deletedImportsCount = importsRes.changes;

    // Clean up holders that now have no items, no rooms, no users, and no scans
    const holders = db.prepare('SELECT id FROM inventory_holders').all() as Array<{ id: string }>;
    const checkRooms = db.prepare('SELECT COUNT(*) as c FROM rooms WHERE holder_id = ?');
    const checkUsers = db.prepare('SELECT COUNT(*) as c FROM users WHERE holder_id = ?');
    const checkScans = db.prepare(`
      SELECT COUNT(*) as c 
      FROM sweep_observations o 
      JOIN rooms r ON o.room_id = r.id 
      WHERE r.holder_id = ?
    `);
    const deleteHolder = db.prepare('DELETE FROM inventory_holders WHERE id = ?');

    for (const h of holders) {
      const roomsCount = (checkRooms.get(h.id) as any).c;
      const usersCount = (checkUsers.get(h.id) as any).c;
      const scansCount = (checkScans.get(h.id) as any).c;
      if (roomsCount === 0 && usersCount === 0 && scansCount === 0) {
        deleteHolder.run(h.id);
        deletedHoldersCount++;
      }
    }
  });

  runTransaction();

  return {
    success: true,
    deletedItemsCount,
    deletedImportsCount,
    deletedHoldersCount
  };
}

export function generateSampleExcelBuffer(): Buffer {
  const sampleData = [
    {
      'Catalog #': '943121160',
      'Inventory Holder': 'ניסים כהן',
      'Quantity': 5,
      'Description': 'HP EliteDesk 800 G3 SFF Tower Business PC',
      'Category': 'Tower PC',
      'Serial Number': ''
    },
    {
      'Catalog #': '943123265',
      'Inventory Holder': 'ניסים כהן',
      'Quantity': 3,
      'Description': 'HP Elite Mini 800 G9 i712700 8GB/256',
      'Category': 'Mini Workstation',
      'Serial Number': '2UA4192N4X'
    },
    {
      'Catalog #': '943116103',
      'Inventory Holder': 'ניסים כהן',
      'Quantity': 2,
      'Description': 'HP ProDesk 400 Workstation i7-10700 16GB/512GB',
      'Category': 'Regular Workstation',
      'Serial Number': ''
    },
    {
      'Catalog #': '943188334',
      'Inventory Holder': 'שלום מזרחי',
      'Quantity': 1,
      'Description': 'Lenovo ThinkPad P16s G2',
      'Category': 'Laptop',
      'Serial Number': '5CD931889M'
    }
  ];

  const ws = xlsx.utils.json_to_sheet(sampleData);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Official_Inventory');
  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
}