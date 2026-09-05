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

}