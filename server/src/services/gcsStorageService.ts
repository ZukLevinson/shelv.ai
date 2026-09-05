import { Storage } from '@google-cloud/storage';
import path from 'path';
import fs from 'fs';
import { db, DB_PATH } from '../db/database.js';

const storage = new Storage({
  userAgent: 'gcs-skills/1.0 (skill:google-cloud-storage-basics)',
});

const BUCKET_NAME = process.env.GCS_BUCKET_NAME;
const GCS_FILE_NAME = process.env.GCS_DB_OBJECT_NAME || 'shelv.db';

let backupDebounceTimer: NodeJS.Timeout | null = null;
let isBackingUp = false;

/**
 * Downloads the latest database snapshot from GCS if configured and present.
 * Called before opening/initializing SQLite.
 */
export async function restoreDatabaseFromGCS(): Promise<boolean> {
  if (!BUCKET_NAME) {
    console.log('[GCS] GCS_BUCKET_NAME not set. Running with local storage only.');
    return false;
  }

  try {
    const bucket = storage.bucket(BUCKET_NAME);
    const file = bucket.file(GCS_FILE_NAME);

    const [exists] = await file.exists();
    if (!exists) {
      console.log(`[GCS] No remote database found in gs://${BUCKET_NAME}/${GCS_FILE_NAME}. Starting fresh.`);
      return false;
    }

    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    console.log(`[GCS] Downloading remote database from gs://${BUCKET_NAME}/${GCS_FILE_NAME} to ${DB_PATH}...`);
    await file.download({ destination: DB_PATH });
    console.log('[GCS] Database successfully restored from Cloud Storage.');
    return true;
  } catch (error) {
    console.error('[GCS] Failed to restore database from GCS:', error);
    return false;
  }
}

/**
 * Performs a clean online backup of the SQLite database and uploads it to GCS.
 */
export async function backupDatabaseToGCS(): Promise<boolean> {
  if (!BUCKET_NAME) {
    return false;
  }

  if (isBackingUp) {
    // Already in progress, will schedule a subsequent run
    scheduleDebouncedBackup(3000);
    return false;
  }

  isBackingUp = true;
  const tempBackupPath = `${DB_PATH}.backup.${Date.now()}`;

  try {
    // Perform SQLite online backup to create a consistent checkpointed snapshot
    await db.backup(tempBackupPath);

    const bucket = storage.bucket(BUCKET_NAME);
    const file = bucket.file(GCS_FILE_NAME);

    console.log(`[GCS] Uploading database snapshot to gs://${BUCKET_NAME}/${GCS_FILE_NAME}...`);
    await bucket.upload(tempBackupPath, {
      destination: GCS_FILE_NAME,
      metadata: {
        contentType: 'application/vnd.sqlite3',
        metadata: {
          updatedAt: new Date().toISOString(),
        },
      },
    });

    console.log('[GCS] Database snapshot successfully stored in Cloud Storage.');
    return true;
  } catch (error) {
    console.error('[GCS] Error backing up database to GCS:', error);
    return false;
  } finally {
    isBackingUp = false;
    if (fs.existsSync(tempBackupPath)) {
      try {
        fs.unlinkSync(tempBackupPath);
      } catch {
        // ignore cleanup error
      }
    }
  }
}

/**
 * Schedule a debounced backup to avoid spamming GCS writes during high volume scans.
 */
export function scheduleDebouncedBackup(delayMs = 5000): void {
  if (!BUCKET_NAME) return;

  if (backupDebounceTimer) {
    clearTimeout(backupDebounceTimer);
  }

  backupDebounceTimer = setTimeout(async () => {
    backupDebounceTimer = null;
    await backupDatabaseToGCS();
  }, delayMs);
}

/**
 * Setup periodic backups and graceful shutdown hooks.
 */
export function initGcsSync(): void {
  if (!BUCKET_NAME) {
    return;
  }

  console.log(`[GCS] Database cloud persistence enabled for bucket: gs://${BUCKET_NAME}`);

  // Periodic backup every 10 minutes as safety net
  setInterval(() => {
    backupDatabaseToGCS().catch((err) => console.error('[GCS] Periodic backup failed:', err));
  }, 10 * 60 * 1000);

  // Graceful shutdown handling
  const handleShutdown = async (signal: string) => {
    console.log(`[GCS] Received ${signal}. Flushing database to Cloud Storage before exit...`);
    if (backupDebounceTimer) {
      clearTimeout(backupDebounceTimer);
    }
    try {
      await backupDatabaseToGCS();
      console.log('[GCS] Final cloud sync complete.');
    } catch (err) {
      console.error('[GCS] Final sync failed on shutdown:', err);
    }
    process.exit(0);
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}
