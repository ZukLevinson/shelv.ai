import assert from 'node:assert';
import xlsx from 'xlsx';
import { db, initDatabase } from '../src/db/database.js';
import {
  importOfficialInventoryFromExcel,
  getExcelImports,
  deleteExcelImport
} from '../src/services/excelImportService.js';
import {
  importScansToDatabase,
  ParsedScanRow
} from '../src/services/scanExcelImportService.js';

console.log('--- Starting deleteExcelImport & Origin Tracking Tests ---');

// 1. Initialize DB in test environment
initDatabase();

// 2. Prepare mock signatures Excel file
console.log('1. Testing Signatures Excel Import with Holder & Origin Tracking...');
const runSuffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
const holderName = `יוסי אחראי ${runSuffix}`;
const sn1 = `SN-TEST-SIG-${runSuffix}-1`;
const sn2 = `SN-TEST-SIG-${runSuffix}-2`;

const signatureWorkbook = xlsx.utils.book_new();
const signatureData = [
  ['מסח"א', 'מספר סידורי', 'תיאור פריט', 'חדר', 'קוד חדר', 'אחראי חדר', 'בעל מצאי', 'מספר אישי'],
  ['7001001', sn1, 'מחשב נייד בדיקה', 'חדר 999', '999', holderName, holderName, '1111111'],
  ['7001002', sn2, 'מסך מחשב בדיקה', 'חדר 999', '999', holderName, holderName, '1111111']
];
const sigSheet = xlsx.utils.aoa_to_sheet(signatureData);
xlsx.utils.book_append_sheet(signatureWorkbook, sigSheet, 'Sheet1');
const sigBuffer = xlsx.write(signatureWorkbook, { type: 'buffer', bookType: 'xlsx' });

// Import signatures
const sigImportResult = importOfficialInventoryFromExcel(sigBuffer, `test_signatures_${runSuffix}.xlsx`);
console.log('Signature import result:', sigImportResult);
assert(sigImportResult.importId, 'Expected importId from signature import');
assert.strictEqual(sigImportResult.insertedCount, 2, 'Expected 2 items inserted');

// Check that official_inventory items have the import_id
const importedItems = db.prepare('SELECT id, serial_number, import_id FROM official_inventory WHERE import_id = ?').all(sigImportResult.importId) as any[];
assert.strictEqual(importedItems.length, 2, 'Expected 2 items with the import_id in official_inventory');

// Check that holder was created with import_id
const createdHolder = db.prepare('SELECT id, name, import_id FROM inventory_holders WHERE name = ?').get(holderName) as any;
assert(createdHolder, `Expected holder "${holderName}" to exist`);
assert.strictEqual(createdHolder.import_id, sigImportResult.importId, 'Holder should have import_id set');

// Check getExcelImports
const sigImports = getExcelImports('signatures');
const foundSigImport = sigImports.find(imp => imp.id === sigImportResult.importId);
assert(foundSigImport, 'Expected signature import to be listed in getExcelImports');
assert.strictEqual(foundSigImport.import_type, 'signatures');
assert.strictEqual(foundSigImport.active_items_count, 2);

console.log('✓ Signature import & origin tracking verified!');

// 3. Test Scans Import with Origin Tracking
console.log('2. Testing Scans Import with Origin Tracking...');
// Ensure a room exists for the scan with an independent holder
const testRoomCode = 'TEST-DEL-999';
let testRoom = db.prepare('SELECT id, name, code FROM rooms WHERE code = ?').get(testRoomCode) as any;
if (!testRoom) {
  const permHolderId = 'holder-perm-test';
  db.prepare('INSERT OR IGNORE INTO inventory_holders (id, name) VALUES (?, ?)').run(permHolderId, 'מחזיק חדר קבוע');
  const roomId = 'room-test-del-999';
  db.prepare('INSERT INTO rooms (id, name, code, holder_id) VALUES (?, ?, ?, ?)').run(roomId, 'חדר בדיקה למחיקה', testRoomCode, permHolderId);
  testRoom = { id: roomId, name: 'חדר בדיקה למחיקה', code: testRoomCode };
}

const mockScanRows: ParsedScanRow[] = [
  {
    rowNumber: 2,
    timestamp: '2026-09-14 10:00:00',
    rawRoom: testRoomCode,
    roomName: testRoom.name,
    roomId: testRoom.id,
    masha: '1234567',
    rawSerialNumber: 'SN-SCAN-1',
    serialNumber: 'SN-SCAN-1',
    isIrrelevantSN: false,
    willImport: true
  },
  {
    rowNumber: 3,
    timestamp: '2026-09-14 10:05:00',
    rawRoom: testRoomCode,
    roomName: testRoom.name,
    roomId: testRoom.id,
    masha: '1234568',
    rawSerialNumber: 'SN-SCAN-2',
    serialNumber: 'SN-SCAN-2',
    isIrrelevantSN: false,
    willImport: true
  }
];

const scanImportResult = importScansToDatabase(mockScanRows, 'test_scans_import.xlsx');
console.log('Scan import result:', scanImportResult);
assert(scanImportResult.importId, 'Expected importId from scan import');
assert.strictEqual(scanImportResult.insertedCount, 2, 'Expected 2 scans inserted');

// Check that sweep_observations rows have import_id
const importedScans = db.prepare('SELECT id, serial_number, import_id FROM sweep_observations WHERE import_id = ?').all(scanImportResult.importId) as any[];
assert.strictEqual(importedScans.length, 2, 'Expected 2 scans with import_id in sweep_observations');

// Check getExcelImports for scans
const scanImports = getExcelImports('scans');
const foundScanImport = scanImports.find(imp => imp.id === scanImportResult.importId);
assert(foundScanImport, 'Expected scan import to be listed in getExcelImports');
assert.strictEqual(foundScanImport.import_type, 'scans');
assert.strictEqual(foundScanImport.active_items_count, 2);

console.log('✓ Scans import & origin tracking verified!');

// 4. Test Deleting Signatures Import & Orphan Holder Cleanup
console.log('3. Testing Deletion of Signatures Import & Orphan Holder Cleanup...');
const deleteSigResult = deleteExcelImport(sigImportResult.importId);
console.log('Delete signature result:', deleteSigResult);
assert.strictEqual(deleteSigResult.deletedItemsCount, 2);
assert.strictEqual(deleteSigResult.deletedHoldersCount, 1, 'Expected orphan holder to be cleaned up');

// Verify items are gone
const remainingItems = db.prepare('SELECT COUNT(*) as c FROM official_inventory WHERE import_id = ?').get(sigImportResult.importId) as any;
assert.strictEqual(remainingItems.c, 0, 'All items from deleted import must be removed');

// Verify holder was cleaned up because it was created by this import and now has 0 items and 0 rooms
const checkHolder = db.prepare('SELECT id FROM inventory_holders WHERE name = ?').get(holderName);
assert(!checkHolder, 'Orphan holder should be removed after import deletion');

// Verify excel_imports record is gone
const checkSigImport = db.prepare('SELECT id FROM excel_imports WHERE id = ?').get(sigImportResult.importId);
assert(!checkSigImport, 'excel_imports record must be deleted');

console.log('✓ Signatures deletion and orphan holder cleanup verified!');

// 5. Test Deleting Scans Import
console.log('4. Testing Deletion of Scans Import...');
const deleteScanResult = deleteExcelImport(scanImportResult.importId);
console.log('Delete scan result:', deleteScanResult);
assert.strictEqual(deleteScanResult.deletedItemsCount, 2);

// Verify scans are gone
const remainingScans = db.prepare('SELECT COUNT(*) as c FROM sweep_observations WHERE import_id = ?').get(scanImportResult.importId) as any;
assert.strictEqual(remainingScans.c, 0, 'All scans from deleted import must be removed');

// Verify excel_imports record is gone
const checkScanImport = db.prepare('SELECT id FROM excel_imports WHERE id = ?').get(scanImportResult.importId);
assert(!checkScanImport, 'excel_imports record must be deleted');

// Clean up test room and fixture holder
db.prepare('DELETE FROM rooms WHERE code = ?').run(testRoomCode);
db.prepare('DELETE FROM inventory_holders WHERE id = ?').run('holder-perm-test');

console.log('✓ Scans import deletion verified!');

console.log('--- ALL deleteExcelImport & Origin Tracking Tests PASSED! ---');
