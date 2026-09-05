import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../shelv.db');
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory_holders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      personal_number TEXT,
      email TEXT,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      holder_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (holder_id) REFERENCES inventory_holders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS official_inventory (
      id TEXT PRIMARY KEY,
      masha TEXT NOT NULL,
      serial_number TEXT UNIQUE NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      room_id TEXT NOT NULL,
      holder_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (holder_id) REFERENCES inventory_holders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sweep_sessions (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      swept_by TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sweep_observations (
      id TEXT PRIMARY KEY,
      sweep_id TEXT,
      room_id TEXT NOT NULL,
      serial_number TEXT NOT NULL,
      masha TEXT,
      scanned_by TEXT NOT NULL,
      sticker_owner_text TEXT,
      product_name_detected TEXT,
      scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sweep_id) REFERENCES sweep_sessions(id) ON DELETE SET NULL,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS anomaly_resolutions (
      id TEXT PRIMARY KEY,
      serial_number TEXT NOT NULL,
      type TEXT NOT NULL,
      from_room_id TEXT,
      to_room_id TEXT,
      from_holder_id TEXT,
      to_holder_id TEXT,
      resolved_by TEXT NOT NULL,
      resolved_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS masha_registry (
      masha TEXT PRIMARY KEY,
      name TEXT,
      category TEXT DEFAULT 'PC',
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Ensure personal_number column exists for existing databases
  try {
    const tableInfo = db.prepare("PRAGMA table_info(inventory_holders)").all() as Array<{ name: string }>;
    if (!tableInfo.some(col => col.name === 'personal_number')) {
      db.exec("ALTER TABLE inventory_holders ADD COLUMN personal_number TEXT");
    }
  } catch (err) {
    console.error('[DB] Migration error for personal_number:', err);
  }

  seedDefaultDataIfEmpty();
}

function seedDefaultDataIfEmpty() {
  const holderCount = db.prepare('SELECT count(*) as count FROM inventory_holders').get() as { count: number };
  if (holderCount.count === 0) {
    console.log('[DB] Seeding initial holders, rooms, and official inventory...');

    const insertHolder = db.prepare('INSERT INTO inventory_holders (id, name, personal_number, phone) VALUES (?, ?, ?, ?)');
    insertHolder.run('holder-1', 'ניסים כהן', '8123456', '050-1234567');
    insertHolder.run('holder-2', 'שלום מזרחי', '8234567', '052-7654321');
    insertHolder.run('holder-3', 'דוד אג"ן', '8345678', '054-9988776');

    const insertRoom = db.prepare('INSERT INTO rooms (id, name, code, holder_id) VALUES (?, ?, ?, ?)');
    insertRoom.run('room-101', 'חדר מחשבים 101', 'R-101', 'holder-1');
    insertRoom.run('room-102', 'מעבדת חומרה 102', 'R-102', 'holder-1');
    insertRoom.run('room-201', 'משרד הנהלה 201', 'R-201', 'holder-2');
    insertRoom.run('room-301', 'חדר תקשורת 301', 'R-301', 'holder-3');

    const insertItem = db.prepare(`
      INSERT INTO official_inventory (id, masha, serial_number, description, category, room_id, holder_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertItem.run('item-1', '943121160', '2UA80920XS', 'HP EliteDesk 800 G3 SFF Business PC', 'PC', 'room-101', 'holder-1');
    insertItem.run('item-2', '943123265', '2UA4192N4X', 'HP Elite Mini 800 G9 i712700 8GB/256', 'PC', 'room-101', 'holder-1');
    insertItem.run('item-3', '943116103', '3CQ7290K11', 'HP EliteDesk 800 G6 DM i7-10700 16GB/512GB', 'PC', 'room-101', 'holder-1');
    insertItem.run('item-4', '943155882', 'CN47921980', 'HP LaserJet Pro M404dn', 'Printer', 'room-101', 'holder-1');
    insertItem.run('item-5', '943166200', '6CM84201PL', 'Dell UltraSharp 27 4K Screen', 'Screen', 'room-101', 'holder-1');
    insertItem.run('item-6', '943177119', '2UA11929BB', 'HP EliteDesk 800 G5 Tower', 'PC', 'room-102', 'holder-1');
    insertItem.run('item-7', '943188334', '5CD931889M', 'Lenovo ThinkPad P16s G2', 'Laptop', 'room-201', 'holder-2');
    insertItem.run('item-8', '943199441', '8CC110992K', 'Dell 24 Display Switch P2419H', 'Screen', 'room-201', 'holder-2');

    console.log('[DB] Seeding completed.');
  }
}