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
  'תמונת מדבקת מסח"א'
];

let cachedSheetsClient: sheets_v4.Sheets | null = null;
let lastHeaderCheckSpreadsheetId: string | null = null;
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
      range: `'${targetTitle}'!A1:O1`,
    });

    const rows = checkRes.data.values;
    if (!rows || rows.length === 0 || rows[0].length === 0) {
      await client.spreadsheets.values.update({
        spreadsheetId,
        range: `'${targetTitle}'!A1:O1`,
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
    ];

    if (foundRowIndex > 0) {
      await client.spreadsheets.values.update({
        spreadsheetId,
        range: `'${sheetTitle}'!A${foundRowIndex}:O${foundRowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [rowValues],
        },
      });
    } else {
      await client.spreadsheets.values.append({
        spreadsheetId,
        range: `'${sheetTitle}'!A:O`,
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
        END as scanStatus
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
      // The scan was deleted from database
      if (foundRowIndex > 0) {
        await client.spreadsheets.values.update({
          spreadsheetId,
          range: `'${sheetTitle}'!J${foundRowIndex}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [['נמחק (בוטל במערכת)']],
          },
        });
        lastSyncTimestamp = new Date().toISOString();
        return true;
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
    ];

    if (foundRowIndex > 0) {
      await client.spreadsheets.values.update({
        spreadsheetId,
        range: `'${sheetTitle}'!A${foundRowIndex}:O${foundRowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [rowValues],
        },
      });
    } else {
      await client.spreadsheets.values.append({
        spreadsheetId,
        range: `'${sheetTitle}'!A:O`,
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
 * Marks a scan row in Google Sheets as deleted.
 */
export async function markScanDeletedInGoogleSheet(observationId: string): Promise<boolean> {
  const { client, spreadsheetId } = getSheetsClient();
  if (!client || !spreadsheetId) return false;

  try {
    const sheetTitle = await ensureHeaders(client, spreadsheetId);
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

    if (foundRowIndex > 0) {
      await client.spreadsheets.values.update({
        spreadsheetId,
        range: `'${sheetTitle}'!J${foundRowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [['נמחק (בוטל במערכת)']],
        },
      });
      lastSyncTimestamp = new Date().toISOString();
      return true;
    }
    return false;
  } catch (err: any) {
    console.error(`[GoogleSheets] Error marking scan ${observationId} deleted in sheet:`, err?.message || err);
    return false;
  }
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
      range: `'${sheetTitle}'!A2:O`,
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
        END as scanStatus
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
      ]);
    }

    await client.spreadsheets.values.update({
      spreadsheetId,
      range: `'${sheetTitle}'!A1:O${rows.length}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: rows,
      },
    });

    lastSyncTimestamp = new Date().toISOString();
    lastHeaderCheckSpreadsheetId = spreadsheetId;

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

