import xlsx from 'xlsx';
import assert from 'node:assert';
import {
  cleanSerialNumber,
  resolveRoom,
  parseScanTimestamp,
  parseScansExcel,
  RoomRecord
} from '../src/services/scanExcelImportService.js';
import { db, initDatabase } from '../src/db/database.js';

console.log('--- Starting scanExcelImportService Verification Tests ---');

// 1. Test cleanSerialNumber
console.log('1. Testing cleanSerialNumber...');

const testCases = [
  { input: 'המסך האמצעי של ישי', expectedSN: null, expectedIrrelevant: true },
  { input: 'מתחת למדבקה', expectedSN: null, expectedIrrelevant: true },
  { input: 'המסך האמצעי ', expectedSN: null, expectedIrrelevant: true },
  { input: 'מסך עצום ליד אוראל', expectedSN: null, expectedIrrelevant: true },
  { input: 'ללא', expectedSN: null, expectedIrrelevant: true },
  { input: 'אין מדבקה', expectedSN: null, expectedIrrelevant: true },
  { input: 'N/A', expectedSN: null, expectedIrrelevant: true },
  { input: '   ', expectedSN: null, expectedIrrelevant: false },
  { input: null, expectedSN: null, expectedIrrelevant: false },
  { input: 'CN482910', expectedSN: 'CN482910', expectedIrrelevant: false },
  { input: '  ab-12345  ', expectedSN: 'AB-12345', expectedIrrelevant: false },
];

for (const tc of testCases) {
  const res = cleanSerialNumber(tc.input);
  assert.strictEqual(
    res.serialNumber,
    tc.expectedSN,
    `Failed for input: "${tc.input}" - expected SN ${tc.expectedSN}, got ${res.serialNumber}`
  );
  assert.strictEqual(
    res.isIrrelevant,
    tc.expectedIrrelevant,
    `Failed isIrrelevant for input: "${tc.input}"`
  );
  if (tc.expectedIrrelevant && tc.input && !['N/A', 'ללא'].includes(tc.input.trim())) {
    assert.strictEqual(res.note, tc.input.trim(), `Failed note preservation for: "${tc.input}"`);
  }
}
console.log('✓ cleanSerialNumber tests passed!');

// 2. Test resolveRoom
console.log('2. Testing resolveRoom...');

const mockRooms: RoomRecord[] = [
  { id: 'room-101', name: 'חדר דיונים ראשי', code: '101', holder_id: 'holder-1' },
  { id: 'room-102', name: 'מעבדת אלקטרוניקה', code: 'LAB-A', holder_id: 'holder-2' },
  { id: 'room-103', name: 'חמ"ל מבצעים', code: 'WAR-ROOM', holder_id: 'holder-3' },
  { id: 'room-1', name: 'משרד מפקד', code: '1', holder_id: 'holder-4' },
];

const roomTestCases = [
  { input: '101 - חדר דיונים ראשי קומה 2', expectedId: 'room-101' },
  { input: 'חדר דיונים ראשי (101)', expectedId: 'room-101' },
  { input: 'מעבדה LAB-A ליד המעלית', expectedId: 'room-102' },
  { input: 'room-103 - כניסה אחורית', expectedId: 'room-103' },
  { input: '1 - משרד מפקד', expectedId: 'room-1' },
  { input: '101', expectedId: 'room-101' }, // Ensure '101' doesn't match '1'
  { input: 'חדר לא קיים בשום מקום', expectedId: null },
];

for (const tc of roomTestCases) {
  const matched = resolveRoom(tc.input, mockRooms);
  if (tc.expectedId === null) {
    assert.strictEqual(matched, null, `Expected null for "${tc.input}", got ${matched?.id}`);
  } else {
    assert.ok(matched, `Expected match for "${tc.input}"`);
    assert.strictEqual(matched?.id, tc.expectedId, `Expected ${tc.expectedId} for "${tc.input}", got ${matched?.id}`);
  }
}
console.log('✓ resolveRoom tests passed!');

// 3. Test parseScanTimestamp
console.log('3. Testing parseScanTimestamp...');
const ts1 = parseScanTimestamp('25/10/2023 14:30:00');
assert.ok(ts1.startsWith('2023-10-25'), `Failed parsing 25/10/2023, got ${ts1}`);
const ts2 = parseScanTimestamp('2024-05-12T08:00:00.000Z');
assert.strictEqual(ts2, '2024-05-12T08:00:00.000Z');
console.log('✓ parseScanTimestamp tests passed!');

// 4. Test full Excel parsing with "Form Responses 1", duplicates, and irrelevant S/Ns
console.log('4. Testing parseScansExcel with mock workbook...');

// Initialize DB schema for test
initDatabase();

// Ensure test holder and rooms exist in database
db.prepare(`
  INSERT OR REPLACE INTO inventory_holders (id, name)
  VALUES ('test-holder', 'מחזיק בדיקה')
`).run();

const insertRoom = db.prepare(`
  INSERT OR REPLACE INTO rooms (id, name, code, holder_id)
  VALUES (?, ?, ?, 'test-holder')
`);
insertRoom.run('room-alpha', 'חדר אלפא', 'A101');
insertRoom.run('room-beta', 'חדר בתא', 'B202');

// Build an in-memory workbook mimicking Google Form responses
const wb = xlsx.utils.book_new();

const sampleData = [
  {
    'timestamp': '12/03/2024 10:15:00',
    'חדר': 'A101 - חדר אלפא מחשוב',
    'מסח"א': 'MASHA-100',
    'מספר סיריאלי': 'SN-ALPHA-01'
  },
  {
    // Irrelevant Hebrew note: "המסך האמצעי של ישי"
    'timestamp': '12/03/2024 10:16:00',
    'חדר': 'A101 - חדר אלפא מחשוב',
    'מסח"א': 'MASHA-100',
    'מספר סיריאלי': 'המסך האמצעי של ישי'
  },
  {
    // Irrelevant Hebrew note: "מתחת למדבקה"
    'timestamp': '12/03/2024 10:17:00',
    'חדר': 'B202 (חדר בתא)',
    'מסח"א': 'MASHA-200',
    'מספר סיריאלי': 'מתחת למדבקה'
  },
  {
    // Valid item in Room B202
    'timestamp': '12/03/2024 10:18:00',
    'חדר': 'B202',
    'מסח"א': 'MASHA-300',
    'מספר סיריאלי': 'SN-BETA-02'
  },
  {
    // Duplicate of Row 2: Same Masha (MASHA-100) and same S/N (SN-ALPHA-01)!
    'timestamp': '12/03/2024 10:19:00',
    'חדר': 'A101 - חדר אלפא מחשוב',
    'מסח"א': 'MASHA-100',
    'מספר סיריאלי': 'SN-ALPHA-01'
  },
  {
    // Unrecognized room error
    'timestamp': '12/03/2024 10:20:00',
    'חדר': 'חדר 999 לא קיים',
    'מסח"א': 'MASHA-400',
    'מספר סיריאלי': 'SN-UNKNOWN-01'
  }
];

const ws = xlsx.utils.json_to_sheet(sampleData);
xlsx.utils.book_append_sheet(wb, ws, 'Form Responses 1');

const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

const result = parseScansExcel(buffer, 'test_google_form.xlsx');

console.log('Result Summary:', {
  sheetName: result.sheetName,
  totalRows: result.totalRows,
  validRowsCount: result.validRowsCount,
  duplicatesCount: result.duplicatesCount,
  emptySnCount: result.emptySnCount,
  errorsCount: result.errorsCount
});

// Assertions on parsed results
assert.strictEqual(result.sheetName, 'Form Responses 1', 'Should use Form Responses 1 sheet');
assert.strictEqual(result.totalRows, 6, 'Should parse all 6 rows');

// Row 1: Valid
assert.strictEqual(result.rows[0].willImport, true);
assert.strictEqual(result.rows[0].roomId, 'room-alpha');
assert.strictEqual(result.rows[0].serialNumber, 'SN-ALPHA-01');

// Row 2: Irrelevant Hebrew note "המסך האמצעי של ישי" -> empty S/N (null)
assert.strictEqual(result.rows[1].willImport, true);
assert.strictEqual(result.rows[1].serialNumber, null);
assert.strictEqual(result.rows[1].isIrrelevantSN, true);
assert.strictEqual(result.rows[1].snNote, 'המסך האמצעי של ישי');

// Row 3: Irrelevant Hebrew note "מתחת למדבקה" -> empty S/N (null)
assert.strictEqual(result.rows[2].willImport, true);
assert.strictEqual(result.rows[2].serialNumber, null);
assert.strictEqual(result.rows[2].isIrrelevantSN, true);
assert.strictEqual(result.rows[2].snNote, 'מתחת למדבקה');

// Row 4: Valid
assert.strictEqual(result.rows[3].willImport, true);
assert.strictEqual(result.rows[3].roomId, 'room-beta');
assert.strictEqual(result.rows[3].serialNumber, 'SN-BETA-02');

// Row 5: Duplicate of Row 1 (MASHA-100 + SN-ALPHA-01) -> filtered out!
assert.strictEqual(result.rows[4].isDuplicate, true);
assert.strictEqual(result.rows[4].willImport, false);
assert.strictEqual(result.rows[4].duplicateOfRow, 2); // Row 1 is rowIdx 2 in 1-based Excel

// Row 6: Unrecognized room -> Error, will not import
assert.strictEqual(result.rows[5].hasError, true);
assert.strictEqual(result.rows[5].willImport, false);

// Check totals
assert.strictEqual(result.duplicatesCount, 1, 'Should find 1 duplicate');
assert.strictEqual(result.errorsCount, 1, 'Should find 1 error');
assert.strictEqual(result.validRowsCount, 4, 'Should have 4 valid rows to import');
assert.strictEqual(result.emptySnCount, 2, 'Should count 2 empty S/Ns from Hebrew notes');

console.log('✓ parseScansExcel tests passed completely!');

// 5. Test importScansToDatabase
console.log('5. Testing importScansToDatabase...');
import { importScansToDatabase } from '../src/services/scanExcelImportService.js';

const importRes = importScansToDatabase(result.rows, 'טסטר אוטומטי', 'test_google_form.xlsx');
assert.strictEqual(importRes.success, true);
assert.strictEqual(importRes.insertedCount, 4, 'Should insert exactly the 4 valid non-duplicate rows');

// Verify observations in DB
const insertedObs = db.prepare('SELECT * FROM sweep_observations WHERE scanned_by = ?').all('טסטר אוטומטי') as any[];
assert.strictEqual(insertedObs.length, 4, 'Should find 4 inserted records in DB');

// Verify that note was saved for the irrelevant Hebrew S/N
const noteObs = insertedObs.find(o => o.sticker_owner_text && o.sticker_owner_text.includes('המסך האמצעי של ישי'));
assert.ok(noteObs, 'Should find observation with preserved Hebrew note');
assert.strictEqual(noteObs.serial_number, null, 'S/N should be null for irrelevant Hebrew note');

console.log('✓ importScansToDatabase tests passed completely!');
console.log('--- All Verification Tests Passed Successfully! ---');
