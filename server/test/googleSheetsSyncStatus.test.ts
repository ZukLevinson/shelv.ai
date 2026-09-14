import assert from 'node:assert';
import { db, initDatabase } from '../src/db/database.js';
import {
  DEFAULT_SPREADSHEET_ID,
  getSpreadsheetId,
} from '../src/services/googleSheetsService.js';

console.log('--- Starting Google Sheets Status Change Verification Test ---');

initDatabase();

assert.strictEqual(getSpreadsheetId(), DEFAULT_SPREADSHEET_ID, 'Expected default spreadsheet ID to match');

const testSuffix = String(Date.now());
const roomA = 'room-a-' + testSuffix;
const roomB = 'room-b-' + testSuffix;
const holderA = 'holder-a-' + testSuffix;
const holderB = 'holder-b-' + testSuffix;

db.prepare('INSERT OR IGNORE INTO inventory_holders (id, name) VALUES (?, ?)').run(holderA, 'בעל מצאי א');
db.prepare('INSERT OR IGNORE INTO inventory_holders (id, name) VALUES (?, ?)').run(holderB, 'בעל מצאי ב');

db.prepare('INSERT OR IGNORE INTO rooms (id, name, code, holder_id) VALUES (?, ?, ?, ?)').run(roomA, 'חדר א', 'R-A-' + testSuffix, holderA);
db.prepare('INSERT OR IGNORE INTO rooms (id, name, code, holder_id) VALUES (?, ?, ?, ?)').run(roomB, 'חדר ב', 'R-B-' + testSuffix, holderB);

const testSN = 'SN-STATUS-' + testSuffix;
const testMasha = '7009999';
const obsId = 'obs-test-status-' + testSuffix;

// 1. Initial state: item scanned in Room A, but not yet in official inventory -> Status: 'לא רשום באקסל'
db.prepare(`
  INSERT INTO sweep_observations (id, room_id, masha, serial_number, scanned_by)
  VALUES (?, ?, ?, ?, ?)
`).run(obsId, roomA, testMasha, testSN, 'בודק אוטומטי');

const queryScanStatus = (observationId: string) => {
  return db.prepare(`
    SELECT 
      CASE
        WHEN i.id IS NULL THEN 'לא רשום באקסל'
        WHEN i.holder_id != r.holder_id THEN 'חריגת מיקום / חתימה'
        ELSE 'תואם חתימה'
      END as scanStatus,
      off_r.name as officialRoomName,
      off_h.name as officialHolderName
    FROM sweep_observations o
    JOIN rooms r ON o.room_id = r.id
    LEFT JOIN official_inventory i ON i.serial_number = o.serial_number
    LEFT JOIN rooms off_r ON i.room_id = off_r.id
    LEFT JOIN inventory_holders off_h ON i.holder_id = off_h.id
    WHERE o.id = ?
  `).get(observationId) as any;
};

let status = queryScanStatus(obsId);
assert.strictEqual(status.scanStatus, 'לא רשום באקסל', 'Expected status to be unlisted before official inventory exists');
console.log('✓ Initial unlisted status verified:', status.scanStatus);

// 2. Official baseline added, but signed to Room B (Holder B) -> Status becomes 'חריגת מיקום / חתימה'
const officialItemId = 'off-item-' + testSuffix;
db.prepare(`
  INSERT INTO official_inventory (id, masha, serial_number, description, category, room_id, holder_id)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`).run(officialItemId, testMasha, testSN, 'מחשב בדיקה', 'Regular Workstation', roomB, holderB);

status = queryScanStatus(obsId);
assert.strictEqual(status.scanStatus, 'חריגת מיקום / חתימה', 'Expected status to change to mismatch when room holder differs');
assert.strictEqual(status.officialRoomName, 'חדר ב');
assert.strictEqual(status.officialHolderName, 'בעל מצאי ב');
console.log('✓ Status change to mismatch verified:', status.scanStatus, 'Official Room:', status.officialRoomName);

// 3. Transfer approved / physical move to Room A (Holder A) -> Status becomes 'תואם חתימה'
db.prepare(`
  UPDATE official_inventory
  SET room_id = ?, holder_id = ?
  WHERE id = ?
`).run(roomA, holderA, officialItemId);

status = queryScanStatus(obsId);
assert.strictEqual(status.scanStatus, 'תואם חתימה', 'Expected status to change to matched after transfer approval');
assert.strictEqual(status.officialRoomName, 'חדר א');
assert.strictEqual(status.officialHolderName, 'בעל מצאי א');
console.log('✓ Status change to matched verified:', status.scanStatus, 'Official Room:', status.officialRoomName);

// 4. Deletion of scan observation (cancel scan)
db.prepare('DELETE FROM sweep_observations WHERE id = ?').run(obsId);
status = queryScanStatus(obsId);
assert.strictEqual(status, undefined, 'Expected scan observation to be completely removed upon cancellation');
console.log('✓ Scan cancellation/deletion removal verified');

// 5. Test Action History representation in Google Sheets
const { ACTION_HEADERS, HEADERS: SHEET_HEADERS, formatActionTypeHebrew, formatActionRow } = await import('../src/services/googleSheetsService.js');
assert.strictEqual(SHEET_HEADERS.length, 16, 'Expected HEADERS to contain 16 columns including lastAction');
assert.strictEqual(SHEET_HEADERS[15], 'פעולה אחרונה', 'Expected 16th column to be פעולה אחרונה');
assert.strictEqual(ACTION_HEADERS.length, 10, 'Expected ACTION_HEADERS to have 10 columns');
assert.strictEqual(formatActionTypeHebrew('scan_created'), 'סריקת פריט');
assert.strictEqual(formatActionTypeHebrew('scan_deleted'), 'ביטול / מחיקת סריקה');
assert.strictEqual(formatActionTypeHebrew('transfer_approved'), 'אישור העברה');

const sampleActionRow = formatActionRow({
  id: 'act-sample-123',
  performed_at: new Date().toISOString(),
  action_type: 'scan_created',
  description: 'סריקת פריט בדיקה',
  entity_type: 'scan',
  entity_id: 'obs-123',
  performed_by: 'בודק מערכת',
});
assert.strictEqual(sampleActionRow.length, 10, 'Expected formatted action row to have 10 elements');
assert.strictEqual(sampleActionRow[0], 'act-sample-123');
assert.strictEqual(sampleActionRow[2], 'סריקת פריט');
assert.strictEqual(sampleActionRow[7], 'פעיל');
console.log('✓ Action history representation and formatting for Google Sheets verified');

// Clean up remaining test records
db.prepare('DELETE FROM official_inventory WHERE id = ?').run(officialItemId);
db.prepare('DELETE FROM rooms WHERE id IN (?, ?)').run(roomA, roomB);
db.prepare('DELETE FROM inventory_holders WHERE id IN (?, ?)').run(holderA, holderB);

console.log('✨ All status change, deletion, action history, and Google Sheets sync calculations verified successfully!');
