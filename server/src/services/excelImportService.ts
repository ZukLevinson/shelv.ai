import xlsx from 'xlsx';
import { db } from '../db/database.js';

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
  uploaded_at: string;
  total_rows: number;
  inserted_count: number;
  updated_count: number;
  active_items_count: number;
}

export function importOfficialInventoryFromExcel(buffer: Buffer, originalFilename: string = 'inventory.xlsx'): ImportResult {
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json<any>(worksheet);

  let insertedCount = 0;
  let updatedCount = 0;
  const errors: string[] = [];

  const importId = 'import-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);

  const insertImportRecord = db.prepare(`
    INSERT INTO excel_imports (id, filename, uploaded_at, total_rows, inserted_count, updated_count)
    VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?)
  `);

  const updateImportRecord = db.prepare(`
    UPDATE excel_imports
    SET inserted_count = ?, updated_count = ?
    WHERE id = ?
  `);

  const findHolderByName = db.prepare('SELECT id, name, personal_number FROM inventory_holders WHERE name = ? COLLATE NOCASE');
  const insertHolder = db.prepare('INSERT INTO inventory_holders (id, name, personal_number) VALUES (?, ?, ?)');
  const updateHolderPN = db.prepare('UPDATE inventory_holders SET personal_number = ? WHERE id = ?');
  
  const findRoomForHolder = db.prepare('SELECT id FROM rooms WHERE holder_id = ? LIMIT 1');

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

  const upsertMasha = db.prepare(`
    INSERT INTO masha_registry (masha, category, description, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(masha) DO UPDATE SET
      category = CASE WHEN excluded.category != 'Regular Workstation' THEN excluded.category ELSE masha_registry.category END,
      description = CASE WHEN excluded.description != '' AND excluded.description != 'ציוד' THEN excluded.description ELSE masha_registry.description END,
      updated_at = CURRENT_TIMESTAMP
  `);

  const runTransaction = db.transaction(() => {
    insertImportRecord.run(importId, originalFilename, rows.length, 0, 0);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowIdx = i + 2;

      const masha = String(
        row['Masha'] ||
        row['מסח"א'] ||
        row['Catalog #'] ||
        row['Catalog'] ||
        row['מק"ט'] ||
        row['מקט'] ||
        row['מספר קטלוגי'] ||
        row['קוד פריט'] ||
        row['סוג חומר'] ||
        ''
      ).trim();

      const rawSn = String(
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
        ''
      ).trim().toUpperCase();
      const sn = rawSn !== '' ? rawSn : null;

      const description = String(
        row['Description'] ||
        row['תיאור'] ||
        row['Product'] ||
        row['שם פריט'] ||
        row['תיאור פריט'] ||
        row['תיאור מסח"א'] ||
        row['שם מוצר'] ||
        'ציוד'
      ).trim();

      let category = String(
        row['Category'] ||
        row['קטגוריה'] ||
        row['סוג'] ||
        row['סוג פריט'] ||
        'Regular Workstation'
      ).trim();
      if (category.toLowerCase() === 'pc') {
        category = 'Regular Workstation';
      }

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

      // Resolve or auto-register inventory holder
      let holderRecord = findHolderByName.get(holderName) as any;
      let holderId: string;
      if (holderRecord) {
        holderId = holderRecord.id;
        if (personalNumber && !holderRecord.personal_number) {
          updateHolderPN.run(personalNumber, holderId);
        }
      } else {
        holderId = 'holder-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
        insertHolder.run(holderId, holderName, personalNumber || null);
      }

      // Associate with holder's room if configured in the system, otherwise null
      const holderRoom = findRoomForHolder.get(holderId) as any;
      const roomId = holderRoom?.id || null;

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
        // No explicit S/N provided -> insert signature items with NULL serial_number (NO synthetic S/N)
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

  return { importId, filename: originalFilename, insertedCount, updatedCount, errors };
}

export function getExcelImports(): ExcelImportRecord[] {
  return db.prepare(`
    SELECT e.*,
           (SELECT COUNT(*) FROM official_inventory o WHERE o.import_id = e.id) as active_items_count
    FROM excel_imports e
    ORDER BY e.uploaded_at DESC
  `).all() as ExcelImportRecord[];
}

export function deleteExcelImport(importId: string) {
  const existing = db.prepare('SELECT * FROM excel_imports WHERE id = ?').get(importId) as any;
  if (!existing) {
    throw new Error('רשומת אקסל לא נמצאה');
  }

  const deleteItems = db.prepare('DELETE FROM official_inventory WHERE import_id = ?');
  const deleteImport = db.prepare('DELETE FROM excel_imports WHERE id = ?');

  let deletedItemsCount = 0;
  const runTransaction = db.transaction(() => {
    const itemsRes = deleteItems.run(importId);
    deletedItemsCount = itemsRes.changes;
    deleteImport.run(importId);
  });

  runTransaction();

  return {
    success: true,
    deletedImportId: importId,
    filename: existing.filename,
    deletedItemsCount
  };
}

export function resetAllOfficialInventory() {
  let deletedItemsCount = 0;
  let deletedImportsCount = 0;

  const runTransaction = db.transaction(() => {
    const itemsRes = db.prepare('DELETE FROM official_inventory').run();
    deletedItemsCount = itemsRes.changes;
    const importsRes = db.prepare('DELETE FROM excel_imports').run();
    deletedImportsCount = importsRes.changes;
  });

  runTransaction();

  return {
    success: true,
    deletedItemsCount,
    deletedImportsCount
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