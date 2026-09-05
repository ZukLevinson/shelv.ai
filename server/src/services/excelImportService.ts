import xlsx from 'xlsx';
import { db } from '../db/database.js';

export interface ImportResult {
  insertedCount: number;
  updatedCount: number;
  errors: string[];
}

export function importOfficialInventoryFromExcel(buffer: Buffer): ImportResult {
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json<any>(worksheet);

  let insertedCount = 0;
  let updatedCount = 0;
  const errors: string[] = [];

  const findHolderByName = db.prepare('SELECT id FROM inventory_holders WHERE name = ? COLLATE NOCASE');
  const insertHolder = db.prepare('INSERT INTO inventory_holders (id, name) VALUES (?, ?)');
  
  const findRoomByNameOrCode = db.prepare('SELECT id, holder_id FROM rooms WHERE name = ? COLLATE NOCASE OR code = ? COLLATE NOCASE');

  const findItemBySN = db.prepare('SELECT id FROM official_inventory WHERE serial_number = ?');
  const insertItem = db.prepare(`
    INSERT INTO official_inventory (id, masha, serial_number, description, category, room_id, holder_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const updateItem = db.prepare(`
    UPDATE official_inventory 
    SET masha = ?, description = ?, category = ?, room_id = ?, holder_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE serial_number = ?
  `);

  const runTransaction = db.transaction(() => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowIdx = i + 2;

      const masha = String(row['Masha'] || row['מסח"א'] || row['Catalog #'] || row['Catalog'] || '').trim();
      const sn = String(row['Serial Number'] || row['S/N'] || row['מספר סידורי'] || row['Serial'] || '').trim().toUpperCase();
      const description = String(row['Description'] || row['תיאור'] || row['Product'] || row['שם פריט'] || 'Equipment').trim();
      const category = String(row['Category'] || row['קטגוריה'] || 'PC').trim();
      const roomName = String(row['Room'] || row['חדר'] || row['מיקום'] || '').trim();
      const holderName = String(row['Inventory Holder'] || row['בעל מצאי'] || row['Holder'] || '').trim();

      if (!sn) {
        errors.push(`Row ${rowIdx}: Missing Serial Number`);
        continue;
      }
      if (!masha) {
        errors.push(`Row ${rowIdx}: Missing Masha / Catalog #`);
        continue;
      }
      if (!roomName) {
        errors.push(`Row ${rowIdx}: Missing Room for S/N: ${sn}`);
        continue;
      }

      // Room must be created in the dashboard beforehand, not via Excel
      const roomRecord = findRoomByNameOrCode.get(roomName, roomName) as any;
      if (!roomRecord) {
        errors.push(`שורה ${rowIdx}: החדר "${roomName}" אינו קיים במערכת. יש להגדיר חדרים בדשבורד לפני ייבוא אקסל.`);
        continue;
      }

      const roomId = roomRecord.id;
      let holderId = roomRecord.holder_id;

      if (holderName) {
        const holderRecord = findHolderByName.get(holderName) as any;
        if (holderRecord) {
          holderId = holderRecord.id;
        } else {
          holderId = 'holder-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
          insertHolder.run(holderId, holderName);
        }
      }

      const existing = findItemBySN.get(sn) as any;
      if (existing) {
        updateItem.run(masha, description, category, roomId, holderId, sn);
        updatedCount++;
      } else {
        const itemId = 'item-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
        insertItem.run(itemId, masha, sn, description, category, roomId, holderId);
        insertedCount++;
      }
    }
  });

  runTransaction();

  return { insertedCount, updatedCount, errors };
}

export function generateSampleExcelBuffer(): Buffer {
  const sampleData = [
    {
      'Catalog #': '943121160',
      'Serial Number': '2UA80920XS',
      'Description': 'HP EliteDesk 800 G3 SFF Business PC',
      'Category': 'PC',
      'Room': 'חדר מחשבים 101',
      'Inventory Holder': 'ניסים כהן'
    },
    {
      'Catalog #': '943123265',
      'Serial Number': '2UA4192N4X',
      'Description': 'HP Elite Mini 800 G9 i712700 8GB/256',
      'Category': 'PC',
      'Room': 'חדר מחשבים 101',
      'Inventory Holder': 'ניסים כהן'
    },
    {
      'Catalog #': '943116103',
      'Serial Number': '3CQ7290K11',
      'Description': 'HP EliteDesk 800 G6 DM i7-10700 16GB/512GB',
      'Category': 'PC',
      'Room': 'מעבדת חומרה 102',
      'Inventory Holder': 'ניסים כהן'
    },
    {
      'Catalog #': '943188334',
      'Serial Number': '5CD931889M',
      'Description': 'Lenovo ThinkPad P16s G2',
      'Category': 'Laptop',
      'Room': 'משרד הנהלה 201',
      'Inventory Holder': 'שלום מזרחי'
    }
  ];

  const ws = xlsx.utils.json_to_sheet(sampleData);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Official_Inventory');
  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
}