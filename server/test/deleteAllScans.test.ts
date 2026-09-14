import assert from 'node:assert';
import { db, initDatabase } from '../src/db/database.js';

console.log('--- Starting Delete All Scans Verification Test ---');

initDatabase();

const testSuffix = `${Date.now()}`;
const roomId = `room-test-allscans-${testSuffix}`;
const holderId = `holder-test-allscans-${testSuffix}`;

// 1. Setup mock holder, room, and signature import (should NOT be deleted)
db.prepare('INSERT OR IGNORE INTO inventory_holders (id, name) VALUES (?, ?)').run(holderId, 'מחזיק בדיקה קבוע');
db.prepare('INSERT OR IGNORE INTO rooms (id, name, code, holder_id) VALUES (?, ?, ?, ?)').run(roomId, 'חדר בדיקה מחיקת סריקות', `CODE-${testSuffix}`, holderId);

// Add signature import to make sure signature imports are PRESERVED
const sigImportId = `import-sig-keep-${testSuffix}`;
db.prepare("INSERT INTO excel_imports (id, filename, total_rows, inserted_count, import_type) VALUES (?, ?, ?, ?, 'signatures')")
  .run(sigImportId, 'signatures_preserve.xlsx', 10, 10);

// 2. Add mock scan observations, sessions, and scan import
const scanImportId = `import-scan-del-${testSuffix}`;
db.prepare("INSERT INTO excel_imports (id, filename, total_rows, inserted_count, import_type) VALUES (?, ?, ?, ?, 'scans')")
  .run(scanImportId, 'scans_to_delete.xlsx', 5, 5);

const sessionId = `session-del-${testSuffix}`;
db.prepare("INSERT INTO sweep_sessions (id, room_id, swept_by, status) VALUES (?, ?, ?, 'active')")
  .run(sessionId, roomId, 'בודק אוטומטי');

db.prepare(`
  INSERT INTO sweep_observations (id, sweep_id, room_id, masha, serial_number, scanned_by, import_id)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`).run(`obs-1-${testSuffix}`, sessionId, roomId, '7001001', `SN-1-${testSuffix}`, 'בודק אוטומטי', scanImportId);

db.prepare(`
  INSERT INTO sweep_observations (id, sweep_id, room_id, masha, serial_number, scanned_by, import_id)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`).run(`obs-2-${testSuffix}`, sessionId, roomId, '7001002', `SN-2-${testSuffix}`, 'בודק אוטומטי', scanImportId);

// Verify inserted
const obsBefore = (db.prepare('SELECT COUNT(*) as c FROM sweep_observations').get() as any).c;
const sessBefore = (db.prepare('SELECT COUNT(*) as c FROM sweep_sessions').get() as any).c;
const scanImpBefore = (db.prepare("SELECT COUNT(*) as c FROM excel_imports WHERE import_type = 'scans'").get() as any).c;
assert(obsBefore >= 2, 'Expected at least 2 observations before cleanup');
assert(sessBefore >= 1, 'Expected at least 1 session before cleanup');
assert(scanImpBefore >= 1, 'Expected at least 1 scan import before cleanup');

console.log(`Inserted test scans. Observations: ${obsBefore}, Sessions: ${sessBefore}, Scan Imports: ${scanImpBefore}`);

// 3. Perform clear of all scans (same logic as endpoint)
db.prepare('DELETE FROM sweep_observations').run();
db.prepare('DELETE FROM sweep_sessions').run();
db.prepare("DELETE FROM excel_imports WHERE import_type = 'scans'").run();

// 4. Verify all scans are wiped out
const obsAfter = (db.prepare('SELECT COUNT(*) as c FROM sweep_observations').get() as any).c;
const sessAfter = (db.prepare('SELECT COUNT(*) as c FROM sweep_sessions').get() as any).c;
const scanImpAfter = (db.prepare("SELECT COUNT(*) as c FROM excel_imports WHERE import_type = 'scans'").get() as any).c;

assert.strictEqual(obsAfter, 0, 'All sweep_observations must be 0 after delete all');
assert.strictEqual(sessAfter, 0, 'All sweep_sessions must be 0 after delete all');
assert.strictEqual(scanImpAfter, 0, 'All scan excel_imports must be 0 after delete all');

// 5. Verify signature import is NOT deleted
const sigImpAfter = db.prepare('SELECT id FROM excel_imports WHERE id = ?').get(sigImportId);
assert(sigImpAfter, 'Signatures import must NOT be deleted');

// Cleanup fixtures
db.prepare('DELETE FROM excel_imports WHERE id = ?').run(sigImportId);
db.prepare('DELETE FROM rooms WHERE id = ?').run(roomId);
db.prepare('DELETE FROM inventory_holders WHERE id = ?').run(holderId);

console.log('✓ All scans deletion test passed successfully!');
