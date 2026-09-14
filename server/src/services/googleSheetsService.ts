import { sheets, sheets_v4 } from '@googleapis/sheets';
import { GoogleAuth, JWT } from 'google-auth-library';
import * as gcpMetadata from 'gcp-metadata';
import { db } from '../db/database.js';

export const DEFAULT_SPREADSHEET_ID = '110ZY-5XFP1fD55O3qu38RDDx4hZ8szPrMjWlRHMs-qg';

export interface GoogleSheetScanData {
  observationId: string;
  scannedAt: string;
  masha: string;
  serialNumber?: string | null;
  description?: string;
  roomName: string;
  roomCode: string;
  roomHolderName?: string;
  scannedBy: string;
  scanStatus?: string;
  officialRoomName?: string;
  officialHolderName?: string;
  stickerOwnerText?: string;
  hasImageSn?: boolean;
  imageSnUrl?: string;
  hasImageMasha?: boolean;
  imageMashaUrl?: string;
  lastAction?: string;
}

export interface GoogleSheetsConfig {
  spreadsheetId: string;
  serviceAccountEmail: string | null;
  hasPrivateKey: boolean;
  isConfigured: boolean;
  spreadsheetTitle?: string;
  spreadsheetUrl?: string;
  status: 'connected' | 'not_configured' | 'error';
  errorMessage?: string;
  lastSyncedAt?: string | null;
}

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

export const HEADERS = [
  'מזהה סריקה',
  'תאריך ושעה',
  'מסח"א',
  'מספר סידורי',
  'תיאור פריט',
  'חדר נסרק',
  'קוד חדר',
  'בעל מצאי החדר',
  'מי סרק',
  'סטטוס התאמה',
  'חדר רשמי באקסל',
  'בעל מצאי רשמי',
  'טקסט בעלים במדבקה',
  'תמונת מדבקת S/N',
  'תמונת מדבקת מסח"א',
  'פעולה אחרונה'
];

export const ACTIONS_SHEET_TITLE = 'יומן פעולות סריקה';

export const ACTION_HEADERS = [
  'מזהה פעולה',
  'תאריך ושעה',
  'סוג פעולה',
  'תיאור הפעולה',
  'סוג ישות',
  'מזהה ישות / סריקה',
  'בוצע על ידי',
  'סטטוס ביטול',
  'בוטל על ידי',
  'תאריך ביטול'
];

let cachedSheetsClient: sheets_v4.Sheets | null = null;
let lastHeaderCheckSpreadsheetId: string | null = null;
let lastActionsHeaderCheckSpreadsheetId: string | null = null;
let lastSyncTimestamp: string | null = null;

export function getSpreadsheetId(): string {
  return process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim() || DEFAULT_SPREADSHEET_ID;
}

/**
 * Returns an authenticated Google Sheets client or null if not configured.
 */
export function getSheetsClient(): { client: sheets_v4.Sheets | null; spreadsheetId: string; error?: string } {
  const spreadsheetId = getSpreadsheetId();

  if (cachedSheetsClient) {
    return { client: cachedSheetsClient, spreadsheetId };
  }

  try {
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
    let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim();

    let auth: any;

    if (clientEmail && privateKey) {
      if (privateKey.includes('\\n')) {
        privateKey = privateKey.replace(/\\n/g, '\n');
      }
      auth = new JWT({
        email: clientEmail,
        key: privateKey,
        scopes: SCOPES,
      });
    } else {
      auth = new GoogleAuth({
        scopes: SCOPES,
      });
    }

    cachedSheetsClient = sheets({ version: 'v4', auth });
    return { client: cachedSheetsClient, spreadsheetId };
  } catch (err: any) {
    console.error('[GoogleSheets] Failed to initialize Google Sheets client:', err);
    return { client: null, spreadsheetId, error: err?.message || 'Authentication initialization failed' };
  }
}

/**
 * Ensures header row exists in the first sheet.
 */
async function ensureHeaders(client: sheets_v4.Sheets, spreadsheetId: string, sheetTitle = 'סריקות'): Promise<string> {
  if (lastHeaderCheckSpreadsheetId === spreadsheetId) {
    return sheetTitle;
  }

  try {
    const meta = await client.spreadsheets.get({ spreadsheetId });
    const firstSheet = meta.data.sheets?.[0];
    const targetTitle = firstSheet?.properties?.title || sheetTitle;

    const checkRes = await client.spreadsheets.values.get({
      spreadsheetId,
      range: `'${targetTitle}'!A1:P1`,
    });

    const rows = checkRes.data.values;
    if (!rows || rows.length === 0 || rows[0].length === 0) {
      await client.spreadsheets.values.update({
        spreadsheetId,
        range: `'${targetTitle}'!A1:P1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [HEADERS],
        },
      });
      console.log(`[GoogleSheets] Initialized Hebrew headers in sheet "${targetTitle}"`);
    }

    lastHeaderCheckSpreadsheetId = spreadsheetId;
    return targetTitle;
  } catch (err) {
    console.warn('[GoogleSheets] Note checking/creating headers:', err);
    return sheetTitle;
  }
}

/**
 * Ensures the 'יומן פעולות סריקה' (Scan Actions Log) tab and its header row exist.
 */
export async function ensureActionsSheet(client: sheets_v4.Sheets, spreadsheetId: string): Promise<string> {
  if (lastActionsHeaderCheckSpreadsheetId === spreadsheetId) {
    return ACTIONS_SHEET_TITLE;
  }

  try {
    const meta = await client.spreadsheets.get({ spreadsheetId });
    const exists = meta.data.sheets?.some((s) => s.properties?.title === ACTIONS_SHEET_TITLE);

    if (!exists) {
      await client.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: ACTIONS_SHEET_TITLE,
                },
              },
            },
          ],
        },
      });
      console.log(`[GoogleSheets] Created actions sheet tab "${ACTIONS_SHEET_TITLE}"`);
    }

    const checkRes = await client.spreadsheets.values.get({
      spreadsheetId,
      range: `'${ACTIONS_SHEET_TITLE}'!A1:J1`,
    });

    const rows = checkRes.data.values;
    if (!rows || rows.length === 0 || rows[0].length === 0) {
      await client.spreadsheets.values.update({
        spreadsheetId,
        range: `'${ACTIONS_SHEET_TITLE}'!A1:J1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [ACTION_HEADERS],
        },
      });
      console.log(`[GoogleSheets] Initialized headers in actions sheet "${ACTIONS_SHEET_TITLE}"`);
    }

    lastActionsHeaderCheckSpreadsheetId = spreadsheetId;
    return ACTIONS_SHEET_TITLE;
  } catch (err) {
    console.warn('[GoogleSheets] Note checking/creating actions sheet:', err);
    return ACTIONS_SHEET_TITLE;
  }
}

let cachedBaseUrl: string | null = null;
let debouncedSyncTimeout: NodeJS.Timeout | null = null;

export function setCachedBaseUrl(url?: string | null) {
  if (url && typeof url === 'string') {
    cachedBaseUrl = url.replace(/\/$/, '');
  }
}

export function getCachedBaseUrl(): string | null {
  return cachedBaseUrl;
}

/**
 * Schedules a debounced full sync to Google Sheets after state mutations (CRUD).
 * If multiple operations happen in rapid succession, only one sync request is sent.
 */
export function scheduleDebouncedSheetsSync(delayMs = 2500, baseUrl?: string) {
  if (baseUrl) {
    setCachedBaseUrl(baseUrl);
  }
  if (debouncedSyncTimeout) {
    clearTimeout(debouncedSyncTimeout);
  }
  debouncedSyncTimeout = setTimeout(() => {
    debouncedSyncTimeout = null;
    const effectiveBaseUrl = baseUrl || getCachedBaseUrl() || undefined;
    syncAllScansToGoogleSheet(effectiveBaseUrl).catch((err) => {
      console.error('[GoogleSheets] Error in debounced automatic sync:', err?.message || err);
    });
  }, delayMs);
}

/**
 * Appends a single scan observation row to Google Sheets in real time.
 * If the observation already exists in the sheet, it updates the existing row in place.
 */
export async function appendScanToGoogleSheet(scan: GoogleSheetScanData, baseUrl?: string): Promise<boolean> {
  const { client, spreadsheetId, error } = getSheetsClient();
  if (!client || !spreadsheetId) {
    return false;
  }

  if (baseUrl) {
    setCachedBaseUrl(baseUrl);
  } else if (scan.imageSnUrl) {
    try {
      setCachedBaseUrl(new URL(scan.imageSnUrl).origin);
    } catch {}
  }

  try {
    const sheetTitle = await ensureHeaders(client, spreadsheetId);

    // Check if row already exists by observationId
    const colARes = await client.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetTitle}'!A:A`,
    });

    const rows = colARes.data.values || [];
    let foundRowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i]?.[0] === scan.observationId) {
        foundRowIndex = i + 1;
        break;
      }
    }

    const snCell = scan.imageSnUrl
      ? `=HYPERLINK("${scan.imageSnUrl}", "📷 תמונת S/N")`
      : (scan.hasImageSn ? '📷 תמונה שמורה' : '-');

    const mashaCell = scan.imageMashaUrl
      ? `=HYPERLINK("${scan.imageMashaUrl}", "📷 תמונת מסח\"א")`
      : (scan.hasImageMasha ? '📷 תמונה שמורה' : '-');

    const rowValues = [
      scan.observationId,
      new Date(scan.scannedAt).toLocaleString('he-IL'),
      scan.masha,
      scan.serialNumber || '',
      scan.description || '',
      scan.roomName,
      scan.roomCode,
      scan.roomHolderName || '',
      scan.scannedBy,
      scan.scanStatus || '',
      scan.officialRoomName || '',
      scan.officialHolderName || '',
      scan.stickerOwnerText || '',
      snCell,
      mashaCell,
      scan.lastAction || 'סריקה פעילה',
    ];

    if (foundRowIndex > 0) {
      await client.spreadsheets.values.update({
        spreadsheetId,
        range: `'${sheetTitle}'!A${foundRowIndex}:P${foundRowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [rowValues],
        },
      });
    } else {
      await client.spreadsheets.values.append({
        spreadsheetId,
        range: `'${sheetTitle}'!A:P`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [rowValues],
        },
      });
    }

    lastSyncTimestamp = new Date().toISOString();
    return true;
  } catch (err: any) {
    console.error('[GoogleSheets] Error appending/updating scan row to Google Sheet:', err?.message || err);
    return false;
  }
}

/**
 * Updates an existing scan row in Google Sheets with its freshly recalculated match status,
 * official room, and official holder from SQLite.
 */
export async function updateScanInGoogleSheet(observationId: string, baseUrl?: string): Promise<boolean> {
  const { client, spreadsheetId } = getSheetsClient();
  if (!client || !spreadsheetId) return false;

  if (baseUrl) {
    setCachedBaseUrl(baseUrl);
  }
  const effectiveBaseUrl = baseUrl || cachedBaseUrl || undefined;

  try {
    const sheetTitle = await ensureHeaders(client, spreadsheetId);

    const s = db.prepare(`
      SELECT 
        o.id as observationId,
        o.scanned_at as scannedAt,
        o.masha,
        o.serial_number as serialNumber,
        o.product_name_detected as productName,
        o.sticker_owner_text as stickerOwnerText,
        o.scanned_by as scannedBy,
        (o.image_sn IS NOT NULL AND o.image_sn != '') as hasImageSn,
        (o.image_masha IS NOT NULL AND o.image_masha != '') as hasImageMasha,
        (o.image IS NOT NULL AND o.image != '') as hasLegacyImage,
        r.name as roomName,
        r.code as roomCode,
        h.name as roomHolderName,
        i.id as official_item_id,
        off_r.name as officialRoomName,
        off_h.name as officialHolderName,
        COALESCE(m.description, i.description, o.product_name_detected, 'ציוד') as resolvedDescription,
        CASE
          WHEN i.id IS NULL THEN 'לא רשום באקסל'
          WHEN i.holder_id != r.holder_id THEN 'חריגת מיקום / חתימה'
          ELSE 'תואם חתימה'
        END as scanStatus,
        COALESCE(
          (SELECT description FROM action_history WHERE entity_id = o.id ORDER BY performed_at DESC LIMIT 1),
          'סריקה פעילה'
        ) as lastAction
      FROM sweep_observations o
      JOIN rooms r ON o.room_id = r.id
      JOIN inventory_holders h ON r.holder_id = h.id
      LEFT JOIN official_inventory i ON i.id = COALESCE(
        (SELECT i1.id FROM official_inventory i1 WHERE o.serial_number IS NOT NULL AND o.serial_number != '' AND i1.serial_number = o.serial_number LIMIT 1),
        (SELECT i2.id FROM official_inventory i2 WHERE i2.masha = o.masha AND i2.holder_id = r.holder_id LIMIT 1),
        (SELECT i3.id FROM official_inventory i3 WHERE i3.masha = o.masha LIMIT 1)
      )
      LEFT JOIN rooms off_r ON i.room_id = off_r.id
      LEFT JOIN inventory_holders off_h ON i.holder_id = off_h.id
      LEFT JOIN masha_registry m ON COALESCE(o.masha, i.masha) = m.masha
      WHERE o.id = ?
    `).get(observationId) as any;

    const colARes = await client.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetTitle}'!A:A`,
    });

    const rows = colARes.data.values || [];
    let foundRowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i]?.[0] === observationId) {
        foundRowIndex = i + 1;
        break;
      }
    }

    if (!s) {
      // The scan was deleted from database: delete the row completely
      if (foundRowIndex > 1) {
        return deleteScanFromGoogleSheet(observationId);
      }
      return false;
    }

    let snCell = '-';
    let mashaCell = '-';
    const hasSn = Boolean(s.hasImageSn || s.hasLegacyImage);
    const hasMasha = Boolean(s.hasImageMasha);

    if (hasSn) {
      if (effectiveBaseUrl) {
        snCell = `=HYPERLINK("${effectiveBaseUrl}/api/sweep/scans/${s.observationId}/image/sn", "📷 תמונת S/N")`;
      } else {
        snCell = '📷 שמורה';
      }
    }

    if (hasMasha) {
      if (effectiveBaseUrl) {
        mashaCell = `=HYPERLINK("${effectiveBaseUrl}/api/sweep/scans/${s.observationId}/image/masha", "📷 תמונת מסח\"א")`;
      } else {
        mashaCell = '📷 שמורה';
      }
    }

    const rowValues = [
      s.observationId,
      new Date(s.scannedAt).toLocaleString('he-IL'),
      s.masha,
      s.serialNumber || '',
      s.resolvedDescription || '',
      s.roomName,
      s.roomCode,
      s.roomHolderName || '',
      s.scannedBy,
      s.scanStatus,
      s.officialRoomName || '',
      s.officialHolderName || '',
      s.stickerOwnerText || '',
      snCell,
      mashaCell,
      s.lastAction || 'סריקה פעילה',
    ];

    if (foundRowIndex > 0) {
      await client.spreadsheets.values.update({
        spreadsheetId,
        range: `'${sheetTitle}'!A${foundRowIndex}:P${foundRowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [rowValues],
        },
      });
    } else {
      await client.spreadsheets.values.append({
        spreadsheetId,
        range: `'${sheetTitle}'!A:P`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [rowValues],
        },
      });
    }

    lastSyncTimestamp = new Date().toISOString();
    return true;
  } catch (err: any) {
    console.error(`[GoogleSheets] Error updating scan ${observationId} in sheet:`, err?.message || err);
    return false;
  }
}

/**
 * Updates all Google Sheet rows corresponding to a specific asset S/N or Masha
 * (e.g. after a transfer is approved, physical move confirmed, or resolution reverted,
 * changing its status from mismatch to matching).
 */
export async function updateScansForAssetInGoogleSheet(identifier: string, baseUrl?: string): Promise<number> {
  if (!identifier) return 0;
  try {
    const observations = db.prepare(`
      SELECT id FROM sweep_observations 
      WHERE serial_number = ? OR masha = ?
    `).all(identifier, identifier) as Array<{ id: string }>;

    let updatedCount = 0;
    for (const obs of observations) {
      const ok = await updateScanInGoogleSheet(obs.id, baseUrl);
      if (ok) updatedCount++;
    }
    return updatedCount;
  } catch (err) {
    console.error(`[GoogleSheets] Error updating scans for asset ${identifier}:`, err);
    return 0;
  }
}

/**
 * Completely deletes a scan observation row from Google Sheets using deleteDimension.
 */
export async function deleteScanFromGoogleSheet(observationId: string): Promise<boolean> {
  const { client, spreadsheetId } = getSheetsClient();
  if (!client || !spreadsheetId) return false;

  try {
    const meta = await client.spreadsheets.get({ spreadsheetId });
    const firstSheet = meta.data.sheets?.[0];
    const sheetTitle = firstSheet?.properties?.title || 'סריקות';
    const numericSheetId = firstSheet?.properties?.sheetId || 0;

    const colARes = await client.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetTitle}'!A:A`,
    });

    const rows = colARes.data.values || [];
    let foundRowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i]?.[0] === observationId) {
        foundRowIndex = i + 1; // 1-indexed row number
        break;
      }
    }

    if (foundRowIndex > 1) { // Never delete header row (row 1)
      await client.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: numericSheetId,
                  dimension: 'ROWS',
                  startIndex: foundRowIndex - 1, // 0-indexed start (inclusive)
                  endIndex: foundRowIndex,       // 0-indexed end (exclusive)
                },
              },
            },
          ],
        },
      });
      lastSyncTimestamp = new Date().toISOString();
      console.log(`[GoogleSheets] Successfully deleted row ${foundRowIndex} for scan ${observationId}`);
      return true;
    }
    return false;
  } catch (err: any) {
    console.error(`[GoogleSheets] Error deleting scan ${observationId} from sheet:`, err?.message || err);
    return false;
  }
}

/**
 * Deletes multiple scan observation rows from Google Sheets in a single batch request.
 */
export async function deleteMultipleScansFromGoogleSheet(observationIds: string[]): Promise<number> {
  if (!observationIds || observationIds.length === 0) return 0;
  const { client, spreadsheetId } = getSheetsClient();
  if (!client || !spreadsheetId) return 0;

  try {
    const meta = await client.spreadsheets.get({ spreadsheetId });
    const firstSheet = meta.data.sheets?.[0];
    const sheetTitle = firstSheet?.properties?.title || 'סריקות';
    const numericSheetId = firstSheet?.properties?.sheetId || 0;

    const colARes = await client.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetTitle}'!A:A`,
    });

    const rows = colARes.data.values || [];
    const idSet = new Set(observationIds);
    const indicesToDelete: number[] = [];

    for (let i = 0; i < rows.length; i++) {
      if (rows[i]?.[0] && idSet.has(rows[i][0])) {
        if (i > 0) { // Never delete header row (row 0 in 0-indexed)
          indicesToDelete.push(i);
        }
      }
    }

    if (indicesToDelete.length === 0) return 0;

    // Sort descending so deleting higher indices does not alter lower indices
    indicesToDelete.sort((a, b) => b - a);

    const requests = indicesToDelete.map((idx) => ({
      deleteDimension: {
        range: {
          sheetId: numericSheetId,
          dimension: 'ROWS',
          startIndex: idx,
          endIndex: idx + 1,
        },
      },
    }));

    await client.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    });

    lastSyncTimestamp = new Date().toISOString();
    console.log(`[GoogleSheets] Successfully batch deleted ${indicesToDelete.length} rows`);
    return indicesToDelete.length;
  } catch (err: any) {
    console.error('[GoogleSheets] Error batch deleting scans from sheet:', err?.message || err);
    return 0;
  }
}

/**
 * Backward-compatible alias for deleteScanFromGoogleSheet.
 */
export async function markScanDeletedInGoogleSheet(observationId: string): Promise<boolean> {
  return deleteScanFromGoogleSheet(observationId);
}

/**
 * Clears all scan rows from Google Sheets (keeps the header row A1:O1 intact).
 */
export async function clearAllScansInGoogleSheet(): Promise<boolean> {
  const { client, spreadsheetId } = getSheetsClient();
  if (!client || !spreadsheetId) return false;

  try {
    const sheetTitle = await ensureHeaders(client, spreadsheetId);
    await client.spreadsheets.values.clear({
      spreadsheetId,
      range: `'${sheetTitle}'!A2:P`,
    });
    lastSyncTimestamp = new Date().toISOString();
    return true;
  } catch (err: any) {
    console.error('[GoogleSheets] Error clearing scans from sheet:', err?.message || err);
    return false;
  }
}

/**
 * Synchronizes all historical scans from SQLite database to the Google Sheet.
 */
export async function syncAllScansToGoogleSheet(baseUrl?: string): Promise<{
  success: boolean;
  totalSynced: number;
  spreadsheetUrl: string;
  error?: string;
}> {
  const spreadsheetId = getSpreadsheetId();
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  const { client, error } = getSheetsClient();

  if (!client) {
    return {
      success: false,
      totalSynced: 0,
      spreadsheetUrl,
      error: error || 'Google Sheets is not configured or authenticated.',
    };
  }

  try {
    const meta = await client.spreadsheets.get({ spreadsheetId });
    const firstSheet = meta.data.sheets?.[0];
    const sheetTitle = firstSheet?.properties?.title || 'סריקות';

    const scans = db.prepare(`
      SELECT 
        o.id as observationId,
        o.scanned_at as scannedAt,
        o.masha,
        o.serial_number as serialNumber,
        o.product_name_detected as productName,
        o.sticker_owner_text as stickerOwnerText,
        o.scanned_by as scannedBy,
        (o.image_sn IS NOT NULL AND o.image_sn != '') as hasImageSn,
        (o.image_masha IS NOT NULL AND o.image_masha != '') as hasImageMasha,
        (o.image IS NOT NULL AND o.image != '') as hasLegacyImage,
        r.name as roomName,
        r.code as roomCode,
        h.name as roomHolderName,
        i.id as official_item_id,
        off_r.name as officialRoomName,
        off_h.name as officialHolderName,
        COALESCE(m.description, i.description, o.product_name_detected, 'ציוד') as resolvedDescription,
        CASE
          WHEN i.id IS NULL THEN 'לא רשום באקסל'
          WHEN i.holder_id != r.holder_id THEN 'חריגת מיקום / חתימה'
          ELSE 'תואם חתימה'
        END as scanStatus,
        COALESCE(
          (SELECT description FROM action_history WHERE entity_id = o.id ORDER BY performed_at DESC LIMIT 1),
          'סריקה פעילה'
        ) as lastAction
      FROM sweep_observations o
      JOIN rooms r ON o.room_id = r.id
      JOIN inventory_holders h ON r.holder_id = h.id
      LEFT JOIN official_inventory i ON i.id = COALESCE(
        (SELECT i1.id FROM official_inventory i1 WHERE o.serial_number IS NOT NULL AND o.serial_number != '' AND i1.serial_number = o.serial_number LIMIT 1),
        (SELECT i2.id FROM official_inventory i2 WHERE i2.masha = o.masha AND i2.holder_id = r.holder_id LIMIT 1),
        (SELECT i3.id FROM official_inventory i3 WHERE i3.masha = o.masha LIMIT 1)
      )
      LEFT JOIN rooms off_r ON i.room_id = off_r.id
      LEFT JOIN inventory_holders off_h ON i.holder_id = off_h.id
      LEFT JOIN masha_registry m ON COALESCE(o.masha, i.masha) = m.masha
      ORDER BY o.scanned_at ASC
    `).all() as any[];

    const rows: any[][] = [HEADERS];

    for (const s of scans) {
      let snCell = '-';
      let mashaCell = '-';

      const hasSn = Boolean(s.hasImageSn || s.hasLegacyImage);
      const hasMasha = Boolean(s.hasImageMasha);

      if (hasSn) {
        if (baseUrl) {
          const imgUrl = `${baseUrl.replace(/\/$/, '')}/api/sweep/scans/${s.observationId}/image/sn`;
          snCell = `=HYPERLINK("${imgUrl}", "📷 תמונת S/N")`;
        } else {
          snCell = '📷 שמורה';
        }
      }

      if (hasMasha) {
        if (baseUrl) {
          const imgUrl = `${baseUrl.replace(/\/$/, '')}/api/sweep/scans/${s.observationId}/image/masha`;
          mashaCell = `=HYPERLINK("${imgUrl}", "📷 תמונת מסח\"א")`;
        } else {
          mashaCell = '📷 שמורה';
        }
      }

      rows.push([
        s.observationId,
        new Date(s.scannedAt).toLocaleString('he-IL'),
        s.masha,
        s.serialNumber || '',
        s.resolvedDescription || '',
        s.roomName,
        s.roomCode,
        s.roomHolderName || '',
        s.scannedBy,
        s.scanStatus,
        s.officialRoomName || '',
        s.officialHolderName || '',
        s.stickerOwnerText || '',
        snCell,
        mashaCell,
        s.lastAction || 'סריקה פעילה',
      ]);
    }

    // Clear any existing scan data rows below the header to guarantee deleted rows are removed
    await client.spreadsheets.values.clear({
      spreadsheetId,
      range: `'${sheetTitle}'!A2:P`,
    });

    await client.spreadsheets.values.update({
      spreadsheetId,
      range: `'${sheetTitle}'!A1:P${rows.length}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: rows,
      },
    });

    lastSyncTimestamp = new Date().toISOString();
    lastHeaderCheckSpreadsheetId = spreadsheetId;

    // Concurrently synchronize all scan-related actions to the actions tab
    setImmediate(() => {
      syncAllActionsToGoogleSheet().catch((e) =>
        console.error('[GoogleSheets] Failed to sync scan actions during full sync:', e)
      );
    });

    return {
      success: true,
      totalSynced: scans.length,
      spreadsheetUrl,
    };
  } catch (err: any) {
    console.error('[GoogleSheets] Full sync error:', err);
    return {
      success: false,
      totalSynced: 0,
      spreadsheetUrl,
      error: err?.message || 'Failed to sync with Google Sheets',
    };
  }
}

let cachedRuntimeEmail: string | null = null;

/**
 * Discovers the active service account email from environment variables,
 * the official GCP metadata server, or Application Default Credentials.
 */
export async function getEffectiveServiceAccountEmail(): Promise<string | null> {
  if (cachedRuntimeEmail) {
    return cachedRuntimeEmail;
  }
  if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim()) {
    cachedRuntimeEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL.trim();
    return cachedRuntimeEmail;
  }

  // 1. Check official GCP Metadata Server (Cloud Run / GCE)
  try {
    const isAvail = await gcpMetadata.isAvailable();
    if (isAvail) {
      const email = await gcpMetadata.instance('service-accounts/default/email');
      if (email && typeof email === 'string') {
        cachedRuntimeEmail = email.trim();
        return cachedRuntimeEmail;
      }
    }
  } catch {}

  // 2. Direct fetch fallback for Cloud Run container environment
  try {
    const res = await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email', {
      headers: { 'Metadata-Flavor': 'Google' },
      signal: AbortSignal.timeout(1500),
    });
    if (res.ok) {
      const email = (await res.text()).trim();
      if (email) {
        cachedRuntimeEmail = email;
        return cachedRuntimeEmail;
      }
    }
  } catch {}

  // 3. Check GoogleAuth credentials
  try {
    const auth = new GoogleAuth({ scopes: SCOPES });
    const creds = await auth.getCredentials();
    if (creds && creds.client_email) {
      cachedRuntimeEmail = creds.client_email;
      return cachedRuntimeEmail;
    }
  } catch {}

  return null;
}

/**
 * Returns current Google Sheets connection status and configuration metadata.
 */
export async function getGoogleSheetsStatus(): Promise<GoogleSheetsConfig> {
  const spreadsheetId = getSpreadsheetId();
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  const detectedEmail = await getEffectiveServiceAccountEmail();
  const serviceAccountEmail = detectedEmail || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() || null;
  const hasPrivateKey = Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim());

  const { client, error } = getSheetsClient();
  if (!client) {
    return {
      spreadsheetId,
      serviceAccountEmail,
      hasPrivateKey,
      isConfigured: Boolean(serviceAccountEmail || process.env.GOOGLE_APPLICATION_CREDENTIALS),
      status: 'error',
      errorMessage: error || 'Authentication credentials missing or invalid',
      spreadsheetUrl,
      lastSyncedAt: lastSyncTimestamp,
    };
  }

  try {
    const meta = await client.spreadsheets.get({ spreadsheetId });
    const title = meta.data.properties?.title || 'Google Sheet';

    return {
      spreadsheetId,
      serviceAccountEmail,
      hasPrivateKey,
      isConfigured: true,
      spreadsheetTitle: title,
      spreadsheetUrl,
      status: 'connected',
      lastSyncedAt: lastSyncTimestamp,
    };
  } catch (err: any) {
    let errorMsg = err?.message || 'Failed to connect to Google Spreadsheet';
    const isPermissionDenied = errorMsg.includes('The caller does not have permission') || err?.code === 403;
    if (isPermissionDenied) {
      errorMsg = serviceAccountEmail
        ? `אין הרשאת גישה לקובץ ה-Google Sheet. יש לשתף את הקובץ עם "${serviceAccountEmail}" כ-Editor (עורך), או להגדיר שיתוף קישור: "כל מי שיש לו את הקישור יכול לערוך".`
        : `אין הרשאת גישה לקובץ ה-Google Sheet. יש להגדיר שיתוף קישור: "כל מי שיש לו את הקישור יכול לערוך" או לשתף עם חשבון השירות.`;
    }

    return {
      spreadsheetId,
      serviceAccountEmail,
      hasPrivateKey,
      isConfigured: Boolean(serviceAccountEmail),
      status: 'error',
      errorMessage: errorMsg,
      spreadsheetUrl,
      lastSyncedAt: lastSyncTimestamp,
    };
  }
}

/**
 * Formats system action types into human-readable Hebrew terms for the spreadsheet.
 */
export function formatActionTypeHebrew(actionType: string): string {
  switch (actionType) {
    case 'scan_created':
      return 'סריקת פריט';
    case 'scan_deleted':
      return 'ביטול / מחיקת סריקה';
    case 'transfer_approved':
      return 'אישור העברה';
    case 'internal_move_confirmed':
      return 'אישור הזזה פנימית';
    case 'bulk_scans_imported':
      return 'ייבוא סריקות מקובץ';
    case 'all_scans_cleared':
      return 'איפוס כל הסריקות';
    default:
      return actionType;
  }
}

/**
 * Formats an action record into a row array for the 'יומן פעולות סריקה' sheet.
 */
export function formatActionRow(action: {
  id: string;
  performed_at: string;
  action_type: string;
  description: string;
  entity_type: string;
  entity_id: string;
  performed_by: string;
  reverted_at?: string | null;
  reverted_by?: string | null;
}): any[] {
  const isReverted = Boolean(action.reverted_at);
  return [
    action.id,
    new Date(action.performed_at).toLocaleString('he-IL'),
    formatActionTypeHebrew(action.action_type),
    action.description || '',
    action.entity_type || 'scan',
    action.entity_id || '',
    action.performed_by || '',
    isReverted ? 'בוטל (Reverted)' : 'פעיל',
    action.reverted_by || (isReverted ? 'משתמש' : '-'),
    action.reverted_at ? new Date(action.reverted_at).toLocaleString('he-IL') : '-',
  ];
}

/**
 * Appends a scan-related action to the 'יומן פעולות סריקה' sheet in real-time.
 */
export async function appendActionToGoogleSheet(action: {
  id: string;
  actionType: string;
  description: string;
  entityType: string;
  entityId: string;
  performedBy: string;
  performedAt?: string;
  revertedAt?: string | null;
  revertedBy?: string | null;
}): Promise<boolean> {
  const { client, spreadsheetId } = getSheetsClient();
  if (!client || !spreadsheetId) return false;

  try {
    const sheetTitle = await ensureActionsSheet(client, spreadsheetId);
    const rowValues = formatActionRow({
      id: action.id,
      performed_at: action.performedAt || new Date().toISOString(),
      action_type: action.actionType,
      description: action.description,
      entity_type: action.entityType,
      entity_id: action.entityId,
      performed_by: action.performedBy,
      reverted_at: action.revertedAt,
      reverted_by: action.revertedBy,
    });

    await client.spreadsheets.values.append({
      spreadsheetId,
      range: `'${sheetTitle}'!A:J`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [rowValues],
      },
    });

    return true;
  } catch (err: any) {
    console.error('[GoogleSheets] Error appending action to sheet:', err?.message || err);
    return false;
  }
}

/**
 * Updates an existing action row in the 'יומן פעולות סריקה' sheet when it is reverted.
 */
export async function updateActionInGoogleSheet(actionId: string, revertedBy: string): Promise<boolean> {
  const { client, spreadsheetId } = getSheetsClient();
  if (!client || !spreadsheetId) return false;

  try {
    const sheetTitle = await ensureActionsSheet(client, spreadsheetId);
    const colARes = await client.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetTitle}'!A:A`,
    });

    const rows = colARes.data.values || [];
    let foundRowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i]?.[0] === actionId) {
        foundRowIndex = i + 1;
        break;
      }
    }

    if (foundRowIndex > 1) {
      const nowStr = new Date().toLocaleString('he-IL');
      await client.spreadsheets.values.update({
        spreadsheetId,
        range: `'${sheetTitle}'!H${foundRowIndex}:J${foundRowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [['בוטל (Reverted)', revertedBy, nowStr]],
        },
      });
      return true;
    }
    return false;
  } catch (err: any) {
    console.error(`[GoogleSheets] Error updating action ${actionId} in sheet:`, err?.message || err);
    return false;
  }
}

/**
 * Synchronizes all historical scan-related actions from the SQLite database to the 'יומן פעולות סריקה' sheet.
 */
export async function syncAllActionsToGoogleSheet(): Promise<number> {
  const { client, spreadsheetId } = getSheetsClient();
  if (!client || !spreadsheetId) return 0;

  try {
    const sheetTitle = await ensureActionsSheet(client, spreadsheetId);
    const actions = db.prepare(`
      SELECT * FROM action_history
      WHERE entity_type IN ('scan', 'scan_batch')
         OR action_type IN ('scan_created', 'scan_deleted', 'transfer_approved', 'internal_move_confirmed', 'bulk_scans_imported', 'all_scans_cleared')
      ORDER BY performed_at ASC
    `).all() as any[];

    const rows: any[][] = [ACTION_HEADERS];
    for (const a of actions) {
      rows.push(formatActionRow(a));
    }

    await client.spreadsheets.values.clear({
      spreadsheetId,
      range: `'${sheetTitle}'!A2:J`,
    });

    await client.spreadsheets.values.update({
      spreadsheetId,
      range: `'${sheetTitle}'!A1:J${rows.length}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: rows,
      },
    });

    console.log(`[GoogleSheets] Synchronized ${actions.length} scan actions to "${sheetTitle}"`);
    return actions.length;
  } catch (err: any) {
    console.error('[GoogleSheets] Error syncing actions to sheet:', err?.message || err);
    return 0;
  }
}


