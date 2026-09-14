import xlsx from 'xlsx';
import { PDFParse } from 'pdf-parse';
import { db } from '../db/database.js';
import { detectAnomalies } from './anomalyService.js';
import { broadcast } from '../sockets/socketServer.js';
import { logAction } from './actionService.js';
import { scheduleDebouncedBackup } from './gcsStorageService.js';
import { extractTableFromPdfWithGemini } from './geminiVisionService.js';
import { parseMashaString, normalizeMashaCode } from '../utils/mashaUtils.js';

export interface ParsedScanRow {
  rowIdx: number;
  timestamp: string; // ISO string
  rawTimestamp: string;
  rawRoom: string;
  roomId: string | null;
  roomCode: string | null;
  roomName: string | null;
  masha: string;
  rawSerialNumber: string;
  serialNumber: string | null;
  isIrrelevantSN: boolean;
  snNote: string | null;
  isDuplicate: boolean;
  duplicateOfRow?: number;
  duplicateReason?: string;
  hasError: boolean;
  errorMessage?: string;
  willImport: boolean;
}

export interface ParseExcelScansResult {
  filename: string;
  sheetName: string;
  totalRows: number;
  validRowsCount: number;
  duplicatesCount: number;
  emptySnCount: number;
  errorsCount: number;
  errors: string[];
  duplicates: Array<{
    rowIdx: number;
    masha: string;
    serialNumber: string | null;
    duplicateOfRow: number;
    reason: string;
  }>;
  irrelevantSnRows: Array<{
    rowIdx: number;
    originalText: string;
  }>;
  rows: ParsedScanRow[];
}

export interface RoomRecord {
  id: string;
  name: string;
  code: string;
  holder_id: string;
}

export interface RawScanRowInput {
  timestamp: any;
  room: any;
  masha: any;
  serialNumber: any;
}

/**
 * Normalizes and checks if a serial number is an irrelevant descriptive Hebrew text or placeholder.
 * If irrelevant, returns serialNumber: null and isIrrelevant: true with note.
 */
export function cleanSerialNumber(rawSn: any): { serialNumber: string | null; isIrrelevant: boolean; note: string | null } {
  if (rawSn === undefined || rawSn === null) {
    return { serialNumber: null, isIrrelevant: false, note: null };
  }

  const str = String(rawSn).trim();
  if (!str) {
    return { serialNumber: null, isIrrelevant: false, note: null };
  }

  // Check for Hebrew characters (U+0590 to U+05FF)
  const hasHebrew = /[\u0590-\u05FF]/.test(str);

  // Common placeholder values
  const upper = str.toUpperCase();
  const placeholders = [
    'N/A', 'NA', 'NONE', 'NULL', 'NO S/N', 'NO-SN', 'NO_SN',
    'UNKNOWN', 'UNDEFINED', '-', '--', '?', 'ללא', 'אין',
    'אין סריאלי', 'בלי סריאלי', 'אין מדבקה', 'בלי מדבקה',
    'לא ידוע', 'ללא מספר', 'אין מספר'
  ];

  const isPlaceholder = placeholders.includes(upper) || /^0+$/.test(str) || /^[-_?.]+$/.test(str);

  if (hasHebrew || isPlaceholder) {
    return {
      serialNumber: null,
      isIrrelevant: true,
      note: str
    };
  }

  // Valid alphanumeric serial number
  return {
    serialNumber: str.toUpperCase(),
    isIrrelevant: false,
    note: null
  };
}

/**
 * Robustly matches room string containing room id/code/name to an existing room in DB.
 * The raw text includes the room id but also irrelevant text.
 */
export function resolveRoom(rawRoom: string, existingRooms: RoomRecord[]): RoomRecord | null {
  if (!rawRoom || !rawRoom.trim()) return null;
  const clean = rawRoom.trim();
  const lowerClean = clean.toLowerCase();

  // 1. Exact match on room ID or Code
  for (const r of existingRooms) {
    if (r.id.toLowerCase() === lowerClean || r.code.toLowerCase() === lowerClean) {
      return r;
    }
  }

  // 2. Room ID contained within string (case-insensitive)
  for (const r of existingRooms) {
    if (r.id && lowerClean.includes(r.id.toLowerCase())) {
      return r;
    }
  }

  // 3. Room Code contained within string (with word boundaries / token matching)
  // Sort rooms by code length descending to match "101" before "1"
  const sortedByCodeLength = [...existingRooms].sort((a, b) => b.code.length - a.code.length);
  
  // Split rawRoom into alphanumeric/Hebrew tokens
  const tokens = clean.split(/[^a-zA-Z0-9\u0590-\u05FF]+/).filter(Boolean);
  for (const r of sortedByCodeLength) {
    if (tokens.some(t => t.toLowerCase() === r.code.toLowerCase())) {
      return r;
    }
  }

  // Boundary regex for code: non-alphanumeric boundary around code
  for (const r of sortedByCodeLength) {
    const escapedCode = r.code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|[^a-zA-Z0-9\u0590-\u05FF])${escapedCode}($|[^a-zA-Z0-9\u0590-\u05FF])`, 'i');
    if (regex.test(clean)) {
      return r;
    }
  }

  // 4. Room Name match (exact or contained)
  const sortedByNameLength = [...existingRooms].sort((a, b) => b.name.length - a.name.length);
  for (const r of sortedByNameLength) {
    if (r.name && (lowerClean.includes(r.name.toLowerCase()) || r.name.toLowerCase().includes(lowerClean))) {
      return r;
    }
  }

  return null;
}

/**
 * Parses timestamp from Google Form / Excel / PDF into standard ISO string
 */
export function parseScanTimestamp(rawVal: any): string {
  if (!rawVal) {
    return new Date().toISOString();
  }

  // If already a JS Date
  if (rawVal instanceof Date && !isNaN(rawVal.getTime())) {
    return rawVal.toISOString();
  }

  // If Excel serial number (e.g. 45220.5)
  if (typeof rawVal === 'number') {
    try {
      const parsedDate = xlsx.SSF.parse_date_code(rawVal);
      if (parsedDate) {
        const d = new Date(Date.UTC(
          parsedDate.y,
          parsedDate.m - 1,
          parsedDate.d,
          parsedDate.H || 0,
          parsedDate.M || 0,
          Math.floor(parsedDate.S || 0)
        ));
        if (!isNaN(d.getTime())) return d.toISOString();
      }
    } catch {
      // fallback below
    }
  }

  const str = String(rawVal).trim();
  if (!str) return new Date().toISOString();

  // Try parsing DD/MM/YYYY HH:mm:ss or DD/MM/YYYY (Google Forms in Hebrew/Israel)
  const dmyMatch = str.match(/^(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2000;
    const hours = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 12;
    const minutes = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const seconds = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;

    const d = new Date(year, month, day, hours, minutes, seconds);
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
  }

  // Try standard Date parsing
  const stdDate = new Date(str);
  if (!isNaN(stdDate.getTime())) {
    return stdDate.toISOString();
  }

  return new Date().toISOString();
}

/**
 * Common normalization, duplicate detection, and verification pipeline for extracted scan rows
 */
export function processRawScanRows(
  rawRows: RawScanRowInput[],
  sheetName: string,
  filename: string
): ParseExcelScansResult {
  if (rawRows.length === 0) {
    return {
      filename,
      sheetName,
      totalRows: 0,
      validRowsCount: 0,
      duplicatesCount: 0,
      emptySnCount: 0,
      errorsCount: 0,
      errors: ['הקובץ אינו מכיל שורות נתונים'],
      duplicates: [],
      irrelevantSnRows: [],
      rows: []
    };
  }

  // Fetch all existing rooms from DB
  const existingRooms = db.prepare('SELECT id, name, code, holder_id FROM rooms').all() as RoomRecord[];

  const parsedRows: ParsedScanRow[] = [];
  const errors: string[] = [];
  const duplicates: Array<{
    rowIdx: number;
    masha: string;
    serialNumber: string | null;
    duplicateOfRow: number;
    reason: string;
  }> = [];
  const irrelevantSnRows: Array<{ rowIdx: number; originalText: string }> = [];

  // Trackers for duplication detection
  // 1. Masha + S/N duplicate map (when S/N is not empty)
  const seenMashaSnMap = new Map<string, { rowIdx: number; masha: string; sn: string }>();
  // 2. Global S/N duplicate map (an S/N can't be scanned in 2 places in the same batch)
  const seenSnMap = new Map<string, { rowIdx: number; masha: string; sn: string }>();
  // 3. Exact row duplicate map for empty S/N (same room + masha + timestamp)
  const seenEmptySnMap = new Map<string, { rowIdx: number }>();

  let emptySnCount = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const rowIdx = i + 2; // 1-based index (header is row 1)

    const rawTs = row.timestamp;
    const rawRoom = String(row.room || '').trim();
    const { masha: cleanMasha, description: extractedDesc } = parseMashaString(row.masha);
    const rawSn = row.serialNumber;

    const timestamp = parseScanTimestamp(rawTs);

    // Clean Serial Number
    const { serialNumber, isIrrelevant, note } = cleanSerialNumber(rawSn);
    if (isIrrelevant) {
      emptySnCount++;
      irrelevantSnRows.push({
        rowIdx,
        originalText: String(rawSn).trim()
      });
    } else if (!serialNumber) {
      emptySnCount++;
    }

    // Resolve Room
    const matchedRoom = resolveRoom(rawRoom, existingRooms);

    let hasError = false;
    let errorMessage: string | undefined;

    if (!cleanMasha) {
      hasError = true;
      errorMessage = 'חסר מספר מסח"א';
      errors.push(`שורה ${rowIdx}: חסר מספר מסח"א`);
    } else if (!matchedRoom) {
      hasError = true;
      errorMessage = `חדר לא זוהה במערכת מתוך: "${rawRoom}"`;
      errors.push(`שורה ${rowIdx}: חדר לא זוהה מתוך "${rawRoom}"`);
    }

    // Duplication Check
    let isDuplicate = false;
    let duplicateOfRow: number | undefined;
    let duplicateReason: string | undefined;

    if (!hasError) {
      if (serialNumber) {
        // Check Masha + S/N duplication
        const mashaSnKey = `${cleanMasha}::${serialNumber}`;
        const existingMashaSn = seenMashaSnMap.get(mashaSnKey);

        if (existingMashaSn) {
          isDuplicate = true;
          duplicateOfRow = existingMashaSn.rowIdx;
          duplicateReason = `כפילות במסח"א ${cleanMasha} עם מספר סיריאלי ${serialNumber} (זהה לשורה ${existingMashaSn.rowIdx})`;
        } else {
          // Also check global S/N duplication
          const existingSn = seenSnMap.get(serialNumber);
          if (existingSn) {
            isDuplicate = true;
            duplicateOfRow = existingSn.rowIdx;
            duplicateReason = `מספר סיריאלי ${serialNumber} נסרק כבר בשורה ${existingSn.rowIdx} (מסח"א ${existingSn.masha})`;
          } else {
            seenMashaSnMap.set(mashaSnKey, { rowIdx, masha: cleanMasha, sn: serialNumber });
            seenSnMap.set(serialNumber, { rowIdx, masha: cleanMasha, sn: serialNumber });
          }
        }
      } else {
        // Empty S/N: check if exact duplicate Google Form submission (same room + masha + timestamp)
        const emptyKey = `${matchedRoom?.id}::${cleanMasha}::${timestamp}`;
        const existingEmpty = seenEmptySnMap.get(emptyKey);
        if (existingEmpty) {
          isDuplicate = true;
          duplicateOfRow = existingEmpty.rowIdx;
          duplicateReason = `סריקה כפולה זהה לחלוטין (אותו חדר, מסח"א וזמן בדיוק כבשורה ${existingEmpty.rowIdx})`;
        } else {
          seenEmptySnMap.set(emptyKey, { rowIdx });
        }
      }

      if (isDuplicate && duplicateReason) {
        duplicates.push({
          rowIdx,
          masha: cleanMasha,
          serialNumber,
          duplicateOfRow: duplicateOfRow!,
          reason: duplicateReason
        });
      }
    }

    const willImport = !hasError && !isDuplicate;

    parsedRows.push({
      rowIdx,
      timestamp,
      rawTimestamp: String(rawTs || ''),
      rawRoom,
      roomId: matchedRoom ? matchedRoom.id : null,
      roomCode: matchedRoom ? matchedRoom.code : null,
      roomName: matchedRoom ? matchedRoom.name : null,
      masha: cleanMasha,
      rawSerialNumber: String(rawSn !== undefined && rawSn !== null ? rawSn : ''),
      serialNumber,
      isIrrelevantSN: isIrrelevant,
      snNote: note || (extractedDesc ? `תיאור: ${extractedDesc}` : null),
      isDuplicate,
      duplicateOfRow,
      duplicateReason,
      hasError,
      errorMessage,
      willImport
    });
  }

  const validRowsCount = parsedRows.filter(r => r.willImport).length;

  return {
    filename,
    sheetName,
    totalRows: parsedRows.length,
    validRowsCount,
    duplicatesCount: duplicates.length,
    emptySnCount,
    errorsCount: errors.length,
    errors,
    duplicates,
    irrelevantSnRows,
    rows: parsedRows
  };
}

/**
 * Parses Google Form Responses Excel sheet "Form Responses 1"
 */
export function parseScansExcel(buffer: Buffer, originalFilename: string = 'scans.xlsx'): ParseExcelScansResult {
  const workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true });

  // 1. Locate worksheet: prioritized "Form Responses 1", then case-insensitive search, then first sheet
  let selectedSheetName = workbook.SheetNames.find(s => s.trim().toLowerCase() === 'form responses 1');
  if (!selectedSheetName) {
    selectedSheetName = workbook.SheetNames.find(s => 
      s.trim().toLowerCase().includes('form responses') || 
      s.trim().includes('תגובות לטופס')
    );
  }
  if (!selectedSheetName) {
    selectedSheetName = workbook.SheetNames[0];
  }

  const worksheet = workbook.Sheets[selectedSheetName];
  if (!worksheet) {
    throw new Error(`גליון העבודה "${selectedSheetName}" ריק או אינו תקין`);
  }

  // Convert to JSON objects with header row
  const rawRows = xlsx.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
  if (rawRows.length === 0) {
    return {
      filename: originalFilename,
      sheetName: selectedSheetName,
      totalRows: 0,
      validRowsCount: 0,
      duplicatesCount: 0,
      emptySnCount: 0,
      errorsCount: 0,
      errors: ['הגליון שנבחר ריק משורות נתונים'],
      duplicates: [],
      irrelevantSnRows: [],
      rows: []
    };
  }

  // Identify column names by analyzing headers
  const sampleHeaders = Object.keys(rawRows[0] || {});
  
  const findColumn = (keywords: string[]): string | null => {
    for (const h of sampleHeaders) {
      const norm = h.trim().toLowerCase();
      if (keywords.some(k => norm === k.toLowerCase() || norm.includes(k.toLowerCase()))) {
        return h;
      }
    }
    return null;
  };

  const timestampCol = findColumn(['timestamp', 'חותמת זמן', 'זמן', 'תאריך', 'date', 'time']) || sampleHeaders[0];
  const roomCol = findColumn(['חדר', 'שם חדר', 'מיקום', 'room', 'room id', 'room name', 'קוד חדר']) || sampleHeaders[1];
  const mashaCol = findColumn(['מסח"א', 'מסחא', 'מסח\"א', 'masha', 'מק"ט', 'מקט', 'catalog #', 'catalog', 'מספר קטלוגי', 'סוג חומר']) || sampleHeaders[2];
  const snCol = findColumn(['מספר סיריאלי', 'מספר סידורי', 'סריאלי', 'סיריאלי', 'מס"ד', 'מס\'ד', 's/n', 'sn', 'serial number', 'serial', 'מספר מכשיר']) || sampleHeaders[3];

  const standardInputs: RawScanRowInput[] = rawRows.map(row => ({
    timestamp: row[timestampCol],
    room: row[roomCol],
    masha: row[mashaCol],
    serialNumber: row[snCol]
  }));

  return processRawScanRows(standardInputs, selectedSheetName, originalFilename);
}

/**
 * Extracts raw table rows from a PDF using local PDF text parser (pdf-parse)
 */
export async function extractRawRowsFromPdfLocal(buffer: Buffer): Promise<RawScanRowInput[]> {
  const parser = new PDFParse({ data: buffer });
  const textRes = await parser.getText();
  await parser.destroy();

  const fullText = textRes.text || '';
  const lines = fullText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const rawRows: RawScanRowInput[] = [];
  const tsRegex = /(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4}(?:\s+\d{1,2}:\d{1,2}(?::\d{1,2})?)?)/;

  // Query known room codes and mashas to accurately identify tokens
  const knownRoomCodes = new Set<string>();
  const knownRoomIds = new Set<string>();
  const registeredMashas = new Set<string>();
  try {
    const rooms = db.prepare('SELECT id, code FROM rooms').all() as any[];
    rooms.forEach(r => {
      if (r.code) knownRoomCodes.add(String(r.code).toLowerCase());
      if (r.id) knownRoomIds.add(String(r.id).toLowerCase());
    });
    const reg = db.prepare('SELECT masha FROM masha_registry').all() as any[];
    reg.forEach(r => registeredMashas.add(String(r.masha).toUpperCase()));
    const inv = db.prepare('SELECT DISTINCT masha FROM official_inventory').all() as any[];
    inv.forEach(r => registeredMashas.add(String(r.masha).toUpperCase()));
  } catch {
    // ignore if DB is uninitialized
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip headers and page numbers
    if (
      line.startsWith('--') ||
      line.includes('Timestamp') ||
      line.includes('חותמת זמן') ||
      line.includes('Form Responses 1')
    ) {
      continue;
    }

    if (tsRegex.test(line)) {
      // Split line by tab or multiple spaces
      const parts = line.split(/\t+|\s{2,}/).map(s => s.trim()).filter(Boolean);

      // Check RTL layout
      if (parts.length >= 3) {
        if (!tsRegex.test(parts[0]) && tsRegex.test(parts[parts.length - 1])) {
          parts.reverse();
        }
        rawRows.push({
          timestamp: parts[0] || '',
          room: parts[1] || '',
          masha: parts[2] || '',
          serialNumber: parts.slice(3).join(' ') || '',
        });
      } else {
        // Handle single-line with spaces, or multi-line cell format
        const tsMatch = line.match(tsRegex);
        const timestamp = tsMatch ? tsMatch[1] : line;
        let restOfLine = line.replace(tsRegex, '').trim();

        // Check if line was RTL (timestamp was at the end of line)
        const isRtl = !line.trim().startsWith(timestamp) && line.trim().endsWith(timestamp);
        let words = restOfLine.split(/\s+/).filter(Boolean);
        if (isRtl) {
          words.reverse();
        }

        if (words.length >= 2) {
          // Find Masha token index:
          // 1. Exact match in registered mashas
          let mashaIdx = -1;
          for (let w = 1; w < words.length; w++) {
            if (registeredMashas.has(words[w].toUpperCase())) {
              mashaIdx = w;
              break;
            }
          }

          // 2. Explicit MASHA / catalog prefix
          if (mashaIdx === -1) {
            for (let w = 1; w < words.length; w++) {
              if (/^(?:MASHA|מסחא)[-_]?/i.test(words[w])) {
                mashaIdx = w;
                break;
              }
            }
          }

          // 3. Numeric or catalog-style token with digits that isn't a known room code
          if (mashaIdx === -1) {
            for (let w = 1; w < words.length; w++) {
              const word = words[w];
              const isRoomCode = knownRoomCodes.has(word.toLowerCase()) || knownRoomIds.has(word.toLowerCase());
              if (!isRoomCode && (/\d{4,}/.test(word) || /^[A-Za-z0-9\-_]{3,}$/.test(word) && /\d/.test(word))) {
                mashaIdx = w;
                break;
              }
            }
          }

          // Fallback if not matched
          if (mashaIdx === -1) {
            mashaIdx = words.length > 2 ? words.length - 2 : 1;
          }

          const room = words.slice(0, mashaIdx).join(' ');
          const masha = words[mashaIdx] || '';
          const serialNumber = words.slice(mashaIdx + 1).join(' ');

          rawRows.push({
            timestamp,
            room,
            masha,
            serialNumber,
          });
        } else {
          // Multi-line cell format: timestamp is line i, subsequent lines are room, masha, sn
          const gatheredTokens: string[] = [];
          if (restOfLine) gatheredTokens.push(restOfLine);

          while (
            i + 1 < lines.length &&
            !tsRegex.test(lines[i + 1]) &&
            gatheredTokens.length < 3 &&
            !lines[i + 1].startsWith('--')
          ) {
            i++;
            gatheredTokens.push(lines[i]);
          }

          if (gatheredTokens.length >= 2) {
            rawRows.push({
              timestamp,
              room: gatheredTokens[0] || '',
              masha: gatheredTokens[1] || '',
              serialNumber: gatheredTokens[2] || '',
            });
          }
        }
      }
    }
  }

  return rawRows;
}

/**
 * Parses PDF scan export from Google Drive (mobile export)
 * Uses Gemini Multimodal Vertex AI if available, with robust local fallback.
 */
export async function parseScansPdf(buffer: Buffer, originalFilename: string = 'scans.pdf'): Promise<ParseExcelScansResult> {
  let rawRows: RawScanRowInput[] = [];

  // 1. Attempt Gemini Multimodal Extraction
  try {
    const geminiRows = await extractTableFromPdfWithGemini(buffer);
    if (Array.isArray(geminiRows) && geminiRows.length > 0) {
      rawRows = geminiRows.map(r => ({
        timestamp: r.timestamp || '',
        room: r.room || '',
        masha: r.masha || '',
        serialNumber: r.serialNumber || ''
      }));
    }
  } catch (err) {
    console.warn('[PDF Import] Gemini extraction bypassed:', err);
  }

  // 2. Local PDF text extraction fallback
  if (rawRows.length === 0) {
    try {
      rawRows = await extractRawRowsFromPdfLocal(buffer);
    } catch (err: any) {
      console.error('[PDF Import] Local PDF extraction error:', err);
      throw new Error(`שגיאה בפענוח קובץ ה-PDF: ${err.message || 'קובץ אינו קריא'}`);
    }
  }

  return processRawScanRows(rawRows, 'PDF Export (Google Drive)', originalFilename);
}

/**
 * Universal scan file parser handling Excel (.xlsx, .xls, .csv) and PDF (.pdf)
 */
export async function parseScansFile(buffer: Buffer, filename: string): Promise<ParseExcelScansResult> {
  const lower = filename.toLowerCase();
  const isPdf = lower.endsWith('.pdf') || (buffer.length >= 4 && buffer.subarray(0, 4).toString() === '%PDF');

  if (isPdf) {
    return parseScansPdf(buffer, filename);
  }

  return parseScansExcel(buffer, filename);
}

/**
 * Commits the verified and filtered scans into sweep_observations
 */
export function importScansToDatabase(
  rowsToImport: ParsedScanRow[],
  scannedBy: string = 'ייבוא אקסל (Google Forms)',
  originalFilename: string = 'scans.xlsx'
): { success: boolean; insertedCount: number; message: string } {
  const eligibleRows = rowsToImport.filter(r => r.willImport && r.roomId && r.masha);
  if (eligibleRows.length === 0) {
    return {
      success: false,
      insertedCount: 0,
      message: 'לא נמצאו סריקות תקינות לייבוא'
    };
  }

  const insertObservation = db.prepare(`
    INSERT INTO sweep_observations (
      id, sweep_id, room_id, masha, serial_number, scanned_by, sticker_owner_text, product_name_detected, scanned_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const upsertMasha = db.prepare(`
    INSERT INTO masha_registry (masha, category, description, updated_at)
    VALUES (?, 'Regular Workstation', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(masha) DO UPDATE SET
      description = CASE WHEN excluded.description != '' AND excluded.description != 'ציוד' THEN excluded.description ELSE masha_registry.description END,
      updated_at = CURRENT_TIMESTAMP
  `);

  const batchSessionId = 'sweep-excel-' + Date.now();
  let insertedCount = 0;

  const runTx = db.transaction(() => {
    for (let i = 0; i < eligibleRows.length; i++) {
      const row = eligibleRows[i];
      const obsId = `obs-xl-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`;
      const { masha: cleanMasha, description: extractedDesc } = parseMashaString(row.masha);

      upsertMasha.run(cleanMasha, extractedDesc || 'ציוד');

      insertObservation.run(
        obsId,
        null, // historical scans do not belong to an active live sweep session
        row.roomId,
        cleanMasha,
        row.serialNumber, // null if empty or cleaned Hebrew text
        scannedBy,
        row.snNote ? `הערת שטח מקורית: ${row.snNote}` : null,
        extractedDesc || null, // product_name_detected
        row.timestamp
      );

      insertedCount++;
    }
  });

  runTx();

  // Recalculate anomalies
  const anomalies = detectAnomalies();
  broadcast('ANOMALIES_UPDATED', anomalies);
  broadcast('SCANS_UPDATED', { importedCount: insertedCount, batchSessionId });
  broadcast('ROOMS_UPDATED', { action: 'bulk_scans_imported' });

  // Log action in audit history
  logAction({
    actionType: 'bulk_scans_imported',
    description: `ייבוא ${insertedCount} סריקות היסטוריות מקובץ "${originalFilename}"`,
    entityType: 'scan_batch',
    entityId: batchSessionId,
    performedBy: scannedBy,
    stateAfter: {
      filename: originalFilename,
      count: insertedCount,
      importedAt: new Date().toISOString()
    }
  });

  scheduleDebouncedBackup(1000);

  return {
    success: true,
    insertedCount,
    message: `הסריקות יובאו בהצלחה: ${insertedCount} רשומות נוספו למערכת`
  };
}
