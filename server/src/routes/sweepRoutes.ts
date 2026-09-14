import { Router } from 'express';
import multer from 'multer';
import { recordObservation, startSweepSession, completeSweepSession } from '../services/sweepService.js';
import { analyzeFrameWithGemini, qualifyFrameWithGemini } from '../services/geminiVisionService.js';
import { db } from '../db/database.js';
import { getOnlineScanners, getOnlineScannersCount, registerOrTouchScanner, disconnectScanner } from '../sockets/socketServer.js';
import { authenticateToken, requireRole } from '../auth/authMiddleware.js';
import { parseScansExcel, parseScansPdf, parseScansFile, importScansToDatabase } from '../services/scanExcelImportService.js';
import { getGoogleSheetsStatus, syncAllScansToGoogleSheet } from '../services/googleSheetsService.js';

const upload = multer({ storage: multer.memoryStorage() });

export const sweepRouter = Router();

// POST /api/sweep/gemini-qualify - Stage 1: Ultra-fast frame relevance & scan probability check
sweepRouter.post('/gemini-qualify', async (req, res) => {
  const { image, targetMode } = req.body;
  if (!image) {
    return res.status(400).json({ error: 'image base64 string is required' });
  }

  try {
    const result = await qualifyFrameWithGemini(image, targetMode);
    res.json(result);
  } catch (error: any) {
    console.error('[Gemini Qualify API] Error checking frame:', error);
    res.status(500).json({ error: error.message || 'Gemini Vision qualification failed' });
  }
});

// POST /api/sweep/gemini-scan - Stage 2: Deep visual inspection & decrypting S/N or Masha
sweepRouter.post('/gemini-scan', async (req, res) => {
  const { image, targetMode } = req.body;
  if (!image) {
    return res.status(400).json({ error: 'image base64 string is required' });
  }

  try {
    const result = await analyzeFrameWithGemini(image, targetMode);
    res.json(result);
  } catch (error: any) {
    console.error('[Gemini Scan API] Error analyzing frame:', error);
    res.status(500).json({ error: error.message || 'Gemini Vision analysis failed' });
  }
});

// GET /api/sweep/check-sn - Immediately check if an S/N has already been scanned
sweepRouter.get('/check-sn', (req, res) => {
  const { sn, roomId } = req.query;
  if (!sn) {
    return res.status(400).json({ error: 'sn query parameter is required' });
  }

  const cleanSN = String(sn).trim().toUpperCase();

  try {
    // Check if this S/N was already scanned in sweep_observations
    const existingObservation = db.prepare(`
      SELECT o.*, 
             r.name as scanned_room_name, 
             r.code as scanned_room_code,
             h.name as scanned_holder_name
      FROM sweep_observations o
      JOIN rooms r ON o.room_id = r.id
      JOIN inventory_holders h ON r.holder_id = h.id
      WHERE o.serial_number = ? COLLATE NOCASE
      ORDER BY o.scanned_at DESC
      LIMIT 1
    `).get(cleanSN) as any;

    if (existingObservation) {
      return res.json({
        alreadyScanned: true,
        existingScan: {
          id: existingObservation.id,
          roomId: existingObservation.room_id,
          roomName: existingObservation.scanned_room_name,
          roomCode: existingObservation.scanned_room_code,
          holderName: existingObservation.scanned_holder_name,
          scannedBy: existingObservation.scanned_by,
          scannedAt: existingObservation.scanned_at,
          masha: existingObservation.masha,
          productName: existingObservation.product_name_detected,
          isCurrentRoom: Boolean(roomId && existingObservation.room_id === roomId),
        },
      });
    }

    // If not scanned, also check official inventory for convenience (to pre-fill description or masha)
    const officialItem = db.prepare(`
      SELECT i.*, 
             r.name as official_room_name, 
             r.code as official_room_code,
             h.name as official_holder_name,
             m.description as masha_description
      FROM official_inventory i
      LEFT JOIN rooms r ON i.room_id = r.id
      LEFT JOIN inventory_holders h ON i.holder_id = h.id
      LEFT JOIN masha_registry m ON i.masha = m.masha
      WHERE i.serial_number = ? COLLATE NOCASE
      LIMIT 1
    `).get(cleanSN) as any;

    return res.json({
      alreadyScanned: false,
      officialItem: officialItem || null,
    });
  } catch (error: any) {
    console.error('[Sweep API] Error checking S/N:', error);
    res.status(500).json({ error: error.message || 'Failed to check S/N' });
  }
});

sweepRouter.post('/scan', (req, res) => {
  const {
    sweepId,
    roomId,
    serialNumber,
    masha,
    scannedBy,
    stickerOwnerText,
    productNameDetected,
    image,
    imageSn,
    imageMasha,
  } = req.body;

  if (!roomId || !masha || !scannedBy) {
    return res.status(400).json({ error: 'roomId, masha, and scannedBy are required' });
  }

  const baseUrl = `${req.protocol}://${req.get('host')}`;

  try {
    const result = recordObservation({
      sweepId,
      roomId,
      masha: String(masha).trim(),
      serialNumber: serialNumber ? String(serialNumber).trim() : null,
      scannedBy,
      stickerOwnerText,
      productNameDetected,
      image,
      imageSn,
      imageMasha,
      baseUrl,
    });
    res.json(result);
  } catch (error: any) {
    console.error('[Sweep API] Error recording scan:', error);
    res.status(500).json({ error: error.message || 'Failed to record scan' });
  }
});

sweepRouter.post('/sessions/start', (req, res) => {
  const { roomId, sweptBy } = req.body;
  if (!roomId || !sweptBy) {
    return res.status(400).json({ error: 'roomId and sweptBy are required' });
  }

  const session = startSweepSession(roomId, sweptBy);
  res.json(session);
});

sweepRouter.post('/sessions/:id/complete', (req, res) => {
  const { id } = req.params;
  const result = completeSweepSession(id);
  res.json(result);
});

sweepRouter.get('/sessions', (req, res) => {
  const sessions = db.prepare(`
    SELECT s.*, r.name as room_name, r.code as room_code,
           (SELECT COUNT(*) FROM sweep_observations o WHERE o.sweep_id = s.id) as observation_count
    FROM sweep_sessions s
    JOIN rooms r ON s.room_id = r.id
    ORDER BY s.started_at DESC
    LIMIT 20
  `).all();
  res.json(sessions);
});

// GET /api/sweep/scanners - List distinct operators who performed scans
sweepRouter.get('/scanners', (req, res) => {
  try {
    const scanners = db.prepare(`
      SELECT DISTINCT scanned_by
      FROM sweep_observations
      WHERE scanned_by IS NOT NULL AND TRIM(scanned_by) != ''
      ORDER BY scanned_by ASC
    `).all() as Array<{ scanned_by: string }>;
    res.json(scanners.map((s) => s.scanned_by));
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch scanners' });
  }
});

// GET /api/sweep/scanners/online - List currently online scanners and their count
sweepRouter.get('/scanners/online', (req, res) => {
  try {
    const scanners = getOnlineScanners();
    res.json({
      count: scanners.length,
      scanners,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch online scanners' });
  }
});

// POST /api/sweep/scanners/heartbeat - HTTP heartbeat / presence registration for scanners
sweepRouter.post('/scanners/heartbeat', (req, res) => {
  try {
    const { scannerId, scannerName, roomId, roomName } = req.body || {};
    if (!scannerId) {
      return res.status(400).json({ error: 'scannerId is required' });
    }
    const session = registerOrTouchScanner({
      scannerId,
      scannerName,
      roomId,
      roomName,
    });
    res.json({
      success: true,
      count: getOnlineScannersCount(),
      session,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to record scanner heartbeat' });
  }
});

// POST /api/sweep/scanners/disconnect - Gracefully disconnect a scanner
sweepRouter.post('/scanners/disconnect', (req, res) => {
  try {
    const { scannerId } = req.body || {};
    if (scannerId) {
      disconnectScanner(scannerId);
    }
    res.json({ success: true, count: getOnlineScannersCount() });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to disconnect scanner' });
  }
});

// GET /api/sweep/scans - Manage & audit scans with rich filters (who, what, where, when)
sweepRouter.get('/scans', (req, res) => {
  const {
    search,
    scannedBy,
    roomId,
    startDate,
    endDate,
    mismatchOnly,
    limit = '100',
    offset = '0'
  } = req.query;

  try {
    let sql = `
      SELECT 
        o.id,
        o.sweep_id,
        o.room_id as scanned_room_id,
        o.serial_number,
        o.masha,
        o.scanned_by,
        o.sticker_owner_text,
        o.product_name_detected,
        o.scanned_at,
        o.import_id,
        e.filename as import_filename,
        r.name as scanned_room_name,
        r.code as scanned_room_code,
        h.id as scanned_holder_id,
        h.name as scanned_holder_name,
        i.id as official_item_id,
        i.room_id as official_room_id,
        i.holder_id as official_holder_id,
        off_r.name as official_room_name,
        off_r.code as official_room_code,
        off_h.name as official_holder_name,
        COALESCE(m.description, i.description, o.product_name_detected, 'ציוד') as item_description,
        COALESCE(m.category, i.category, 'Regular Workstation') as category,
        (o.image_sn IS NOT NULL AND o.image_sn != '') as has_image_sn,
        (o.image_masha IS NOT NULL AND o.image_masha != '') as has_image_masha,
        (o.image IS NOT NULL AND o.image != '') as has_image,
        CASE
          WHEN i.id IS NULL THEN 'unregistered'
          WHEN i.holder_id != r.holder_id THEN 'mismatch'
          ELSE 'matched'
        END as scan_status
      FROM sweep_observations o
      JOIN rooms r ON o.room_id = r.id
      JOIN inventory_holders h ON r.holder_id = h.id
      LEFT JOIN excel_imports e ON o.import_id = e.id
      LEFT JOIN official_inventory i ON i.id = COALESCE(
        (SELECT i1.id FROM official_inventory i1 WHERE o.serial_number IS NOT NULL AND o.serial_number != '' AND i1.serial_number = o.serial_number LIMIT 1),
        (SELECT i2.id FROM official_inventory i2 WHERE i2.masha = o.masha AND i2.holder_id = r.holder_id LIMIT 1),
        (SELECT i3.id FROM official_inventory i3 WHERE i3.masha = o.masha LIMIT 1)
      )
      LEFT JOIN rooms off_r ON i.room_id = off_r.id
      LEFT JOIN inventory_holders off_h ON i.holder_id = off_h.id
      LEFT JOIN masha_registry m ON COALESCE(o.masha, i.masha) = m.masha
      WHERE 1=1
    `;

    const params: any[] = [];

    if (search) {
      const searchPattern = `%${String(search).trim()}%`;
      sql += ` AND (
        o.serial_number LIKE ? OR
        o.masha LIKE ? OR
        o.product_name_detected LIKE ? OR
        o.sticker_owner_text LIKE ? OR
        m.description LIKE ? OR
        i.description LIKE ?
      )`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (scannedBy) {
      sql += ` AND o.scanned_by = ?`;
      params.push(String(scannedBy).trim());
    }

    if (roomId) {
      sql += ` AND o.room_id = ?`;
      params.push(String(roomId).trim());
    }

    if (startDate) {
      sql += ` AND date(o.scanned_at) >= date(?)`;
      params.push(String(startDate));
    }

    if (endDate) {
      sql += ` AND date(o.scanned_at) <= date(?)`;
      params.push(String(endDate));
    }

    if (mismatchOnly === 'true' || mismatchOnly === '1') {
      sql += ` AND (i.id IS NULL OR i.holder_id != r.holder_id)`;
    }

    // Clone query for counting total matching records
    const countSql = `SELECT COUNT(*) as total FROM (${sql}) as filtered_scans`;
    const totalCountRes = db.prepare(countSql).get(...params) as { total: number };

    sql += ` ORDER BY o.scanned_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const scans = db.prepare(sql).all(...params);

    res.json({
      total: totalCountRes.total,
      limit: Number(limit),
      offset: Number(offset),
      scans
    });
  } catch (error: any) {
    console.error('[Sweep API] Error fetching scans:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch scans' });
  }
});

// GET /api/sweep/scans/investigate/:serialNumber - Drill down all actions for a specific asset
sweepRouter.get('/scans/investigate/:serialNumber', (req, res) => {
  const { serialNumber } = req.params;
  const cleanSN = serialNumber.trim().toUpperCase();

  try {
    let officialItem = db.prepare(`
      SELECT i.*, r.name as room_name, r.code as room_code, h.name as holder_name,
             m.category as masha_category, m.description as masha_description
      FROM official_inventory i
      LEFT JOIN rooms r ON i.room_id = r.id
      JOIN inventory_holders h ON i.holder_id = h.id
      LEFT JOIN masha_registry m ON i.masha = m.masha
      WHERE i.serial_number = ?
    `).get(cleanSN) as any;

    if (!officialItem) {
      officialItem = db.prepare(`
        SELECT i.*, r.name as room_name, r.code as room_code, h.name as holder_name,
               m.category as masha_category, m.description as masha_description
        FROM official_inventory i
        LEFT JOIN rooms r ON i.room_id = r.id
        JOIN inventory_holders h ON i.holder_id = h.id
        LEFT JOIN masha_registry m ON i.masha = m.masha
        WHERE i.masha = ?
        LIMIT 1
      `).get(cleanSN) as any;
    }

    const observations = db.prepare(`
      SELECT o.*, r.name as room_name, r.code as room_code, h.name as holder_name
      FROM sweep_observations o
      JOIN rooms r ON o.room_id = r.id
      JOIN inventory_holders h ON r.holder_id = h.id
      WHERE o.serial_number = ? OR o.masha = ?
      ORDER BY o.scanned_at DESC
    `).all(cleanSN, cleanSN);

    const resolutions = db.prepare(`
      SELECT ar.*, 
             r1.name as from_room_name, r2.name as to_room_name,
             h1.name as from_holder_name, h2.name as to_holder_name
      FROM anomaly_resolutions ar
      LEFT JOIN rooms r1 ON ar.from_room_id = r1.id
      LEFT JOIN rooms r2 ON ar.to_room_id = r2.id
      LEFT JOIN inventory_holders h1 ON ar.from_holder_id = h1.id
      LEFT JOIN inventory_holders h2 ON ar.to_holder_id = h2.id
      WHERE ar.serial_number = ?
      ORDER BY ar.resolved_at DESC
    `).all(cleanSN);

    res.json({
      serialNumber: cleanSN,
      officialItem: officialItem || null,
      observations,
      resolutions
    });
  } catch (error: any) {
    console.error('[Sweep API] Error investigating asset:', error);
    res.status(500).json({ error: error.message || 'Failed to investigate asset' });
  }
});

// DELETE /api/sweep/scans & /api/sweep/scans/all - Delete all scan observations, sessions, and scan imports
const handleDeleteAllScans = async (req: any, res: any) => {
  const user = req.body?.revertedBy || req.user?.name || 'משתמש מערכת';
  try {
    const existingObsCount = (db.prepare('SELECT COUNT(*) as c FROM sweep_observations').get() as { c: number }).c;
    const existingSessionsCount = (db.prepare('SELECT COUNT(*) as c FROM sweep_sessions').get() as { c: number }).c;
    const existingImportsCount = (db.prepare("SELECT COUNT(*) as c FROM excel_imports WHERE import_type = 'scans'").get() as { c: number }).c;

    db.prepare('DELETE FROM sweep_observations').run();
    db.prepare('DELETE FROM sweep_sessions').run();
    db.prepare("DELETE FROM excel_imports WHERE import_type = 'scans'").run();

    // Mark active scan actions as reverted
    db.prepare(`
      UPDATE action_history
      SET reverted_at = CURRENT_TIMESTAMP, reverted_by = ?
      WHERE entity_type IN ('scan', 'scan_batch') AND reverted_at IS NULL
    `).run(user);

    // Import dynamic services to avoid circular dependency
    const { detectAnomalies } = await import('../services/anomalyService.js');
    const { broadcast } = await import('../sockets/socketServer.js');
    const { logAction } = await import('../services/actionService.js');
    const { scheduleDebouncedBackup } = await import('../services/gcsStorageService.js');

    const actionId = logAction({
      actionType: 'all_scans_deleted',
      description: `מחיקת כל ${existingObsCount} הסריקות ו-${existingImportsCount} קבצי הסריקות מהמערכת`,
      entityType: 'scan_batch',
      entityId: 'all',
      performedBy: user
    });

    const anomalies = detectAnomalies();
    broadcast('ANOMALIES_UPDATED', anomalies);
    broadcast('SCANS_UPDATED', { allCleared: true });
    broadcast('ROOMS_UPDATED', { action: 'scans_cleared' });
    broadcast('INVENTORY_SYNCED', { action: 'scans_cleared' });

    const { clearAllScansInGoogleSheet } = await import('../services/googleSheetsService.js');
    setImmediate(() => {
      clearAllScansInGoogleSheet().catch((e) =>
        console.error('[GoogleSheets] Failed to clear scans from sheet:', e)
      );
    });

    scheduleDebouncedBackup();

    res.json({
      success: true,
      message: `כל הסריקות נמחקו בהצלחה (${existingObsCount} תצפיות, ${existingImportsCount} קבצים)`,
      deletedObservationsCount: existingObsCount,
      deletedSessionsCount: existingSessionsCount,
      deletedImportsCount: existingImportsCount,
      actionId
    });
  } catch (error: any) {
    console.error('[Sweep API] Error deleting all scans:', error);
    res.status(500).json({ error: error.message || 'Failed to delete all scans' });
  }
};

sweepRouter.delete('/scans', handleDeleteAllScans);
sweepRouter.delete('/scans/all', handleDeleteAllScans);

// DELETE /api/sweep/scans/:id - Delete or revert scan observation
sweepRouter.delete('/scans/:id', async (req, res) => {
  const { id } = req.params;
  const user = req.body?.revertedBy || 'משתמש מערכת';
  try {
    const existing = db.prepare('SELECT * FROM sweep_observations WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ error: 'תצפית סריקה לא נמצאה' });
    }

    db.prepare('DELETE FROM sweep_observations WHERE id = ?').run(id);

    // Import dynamic services to avoid circular dependency
    const { detectAnomalies } = await import('../services/anomalyService.js');
    const { broadcast } = await import('../sockets/socketServer.js');
    const { logAction } = await import('../services/actionService.js');

    // Mark any existing scan_created action for this observation as reverted
    db.prepare(`
      UPDATE action_history
      SET reverted_at = CURRENT_TIMESTAMP, reverted_by = ?
      WHERE entity_type = 'scan' AND entity_id = ? AND action_type = 'scan_created' AND reverted_at IS NULL
    `).run(user, id);

    // Log the deletion action so the deletion itself can also be undone
    const actionId = logAction({
      actionType: 'scan_deleted',
      description: `ביטול/מחיקת סריקה ${existing.serial_number ? 'S/N ' + existing.serial_number : 'מסח"א ' + existing.masha}`,
      entityType: 'scan',
      entityId: id,
      performedBy: user,
      stateBefore: existing
    });

    const anomalies = detectAnomalies();
    broadcast('ANOMALIES_UPDATED', anomalies);
    broadcast('SCANS_UPDATED', { deletedObservationId: id, serialNumber: existing.serial_number });

    const { markScanDeletedInGoogleSheet } = await import('../services/googleSheetsService.js');
    setImmediate(() => {
      markScanDeletedInGoogleSheet(id).catch((e) =>
        console.error('[GoogleSheets] Failed to mark scan deleted:', e)
      );
    });

    res.json({ success: true, message: 'הסריקה בוטלה בהצלחה', deletedId: id, actionId });
  } catch (error: any) {
    console.error('[Sweep API] Error deleting/reverting scan:', error);
    res.status(500).json({ error: error.message || 'Failed to delete scan' });
  }
});

// POST /api/sweep/scans/bulk-delete - Bulk delete or revert scan observations
sweepRouter.post('/scans/bulk-delete', async (req, res) => {
  const { ids, revertedBy } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array is required' });
  }
  const user = revertedBy || (req as any).user?.name || 'משתמש מערכת';
  try {
    const { detectAnomalies } = await import('../services/anomalyService.js');
    const { broadcast } = await import('../sockets/socketServer.js');
    const { logAction } = await import('../services/actionService.js');

    let deletedCount = 0;
    const deleteTx = db.transaction((scanIds: string[]) => {
      const getStmt = db.prepare('SELECT * FROM sweep_observations WHERE id = ?');
      const delStmt = db.prepare('DELETE FROM sweep_observations WHERE id = ?');
      const markRevertedStmt = db.prepare(`
        UPDATE action_history
        SET reverted_at = CURRENT_TIMESTAMP, reverted_by = ?
        WHERE entity_type = 'scan' AND entity_id = ? AND action_type = 'scan_created' AND reverted_at IS NULL
      `);

      for (const id of scanIds) {
        const existing = getStmt.get(id) as any;
        if (existing) {
          delStmt.run(id);
          markRevertedStmt.run(user, id);
          logAction({
            actionType: 'scan_deleted',
            description: `ביטול/מחיקת סריקה ${existing.serial_number ? 'S/N ' + existing.serial_number : 'מסח"א ' + existing.masha}`,
            entityType: 'scan',
            entityId: id,
            performedBy: user,
            stateBefore: existing
          });
          deletedCount++;
        }
      }
    });

    deleteTx(ids);

    const anomalies = detectAnomalies();
    broadcast('ANOMALIES_UPDATED', anomalies);
    broadcast('SCANS_UPDATED', { bulkDeleted: true, count: deletedCount });

    const { markScanDeletedInGoogleSheet } = await import('../services/googleSheetsService.js');
    setImmediate(() => {
      for (const id of ids) {
        markScanDeletedInGoogleSheet(id).catch(() => {});
      }
    });

    res.json({ success: true, message: `נמחקו ${deletedCount} סריקות בהצלחה`, deletedCount });
  } catch (error: any) {
    console.error('[Sweep API] Error bulk deleting scans:', error);
    res.status(500).json({ error: error.message || 'Failed to bulk delete scans' });
  }
});

// POST /api/sweep/scans/parse-excel - Parse and analyze historical scans from Google Forms Excel (.xlsx) or PDF (.pdf) exported from Google Drive
sweepRouter.post('/scans/parse-excel', authenticateToken, requireRole(['manager']), upload.single('file'), async (req: any, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'לא נבחר קובץ אקסל או PDF' });
  }

  try {
    const filename = req.file.originalname
      ? Buffer.from(req.file.originalname, 'latin1').toString('utf8')
      : 'scans.xlsx';

    const result = await parseScansFile(req.file.buffer, filename);
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[Sweep API] Error parsing scans file (Excel/PDF):', error);
    res.status(500).json({ error: error.message || 'שגיאה בפענוח קובץ הסריקות (Excel/PDF)' });
  }
});

// POST /api/sweep/scans/import-excel - Commit confirmed scans into sweep_observations
sweepRouter.post('/scans/import-excel', authenticateToken, requireRole(['manager']), (req: any, res) => {
  const { rows, scannedBy, originalFilename } = req.body;

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'לא סופקו שורות סריקה לייבוא' });
  }

  try {
    const userScannedBy = scannedBy || req.user?.name || 'ייבוא אקסל (Google Forms)';
    const result = importScansToDatabase(rows, userScannedBy, originalFilename || 'scans.xlsx');

    const baseUrl = req.protocol + '://' + req.get('host');
    import('../services/googleSheetsService.js').then(({ syncAllScansToGoogleSheet }) => {
      syncAllScansToGoogleSheet(baseUrl).catch((err) =>
        console.error('[GoogleSheets] Failed to sync scans after excel import:', err)
      );
    });

    res.json(result);
  } catch (error: any) {
    console.error('[Sweep API] Error importing scans from excel:', error);
    res.status(500).json({ error: error.message || 'שגיאה בעת שמירת הסריקות' });
  }
});

function sendBase64Image(res: any, dataUriOrBase64: string | null) {
  if (!dataUriOrBase64) {
    return res.status(404).json({ error: 'תמונה לא נמצאה' });
  }

  let mimeType = 'image/jpeg';
  let base64Data = dataUriOrBase64;

  if (dataUriOrBase64.startsWith('data:')) {
    const parts = dataUriOrBase64.split(',');
    const meta = parts[0];
    base64Data = parts[1] || '';
    const match = meta.match(/data:([^;]+);/);
    if (match) {
      mimeType = match[1];
    }
  }

  const imgBuffer = Buffer.from(base64Data, 'base64');
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(imgBuffer);
}

// GET /api/sweep/scans/:id/image - Serve stored scan image (S/N, Masha, or default)
sweepRouter.get('/scans/:id/image', (req, res) => {
  const { id } = req.params;
  const type = req.query.type as string | undefined;
  try {
    const row = db.prepare('SELECT image, image_sn, image_masha FROM sweep_observations WHERE id = ?').get(id) as any;
    if (!row) {
      return res.status(404).json({ error: 'תצפית סריקה לא נמצאה' });
    }

    let imgData: string | null = null;
    if (type === 'sn') {
      imgData = row.image_sn || row.image;
    } else if (type === 'masha') {
      imgData = row.image_masha || row.image;
    } else {
      imgData = row.image_sn || row.image || row.image_masha;
    }

    if (!imgData) {
      return res.status(404).json({ error: 'לא קיימת תמונה שמורה לסריקה זו' });
    }

    sendBase64Image(res, imgData);
  } catch (error: any) {
    console.error('[Sweep API] Error serving scan image:', error);
    res.status(500).json({ error: error.message || 'שגיאה בשליפת תמונה' });
  }
});

// GET /api/sweep/scans/:id/image/:type - Explicit sub-route for sn or masha image
sweepRouter.get('/scans/:id/image/:type', (req, res) => {
  const { id, type } = req.params;
  try {
    const row = db.prepare('SELECT image, image_sn, image_masha FROM sweep_observations WHERE id = ?').get(id) as any;
    if (!row) {
      return res.status(404).json({ error: 'תצפית סריקה לא נמצאה' });
    }

    let imgData: string | null = null;
    if (type === 'sn') {
      imgData = row.image_sn || row.image;
    } else if (type === 'masha') {
      imgData = row.image_masha || row.image;
    } else {
      imgData = row.image_sn || row.image || row.image_masha;
    }

    if (!imgData) {
      return res.status(404).json({ error: 'לא קיימת תמונה שמורה לסריקה זו' });
    }

    sendBase64Image(res, imgData);
  } catch (error: any) {
    console.error('[Sweep API] Error serving typed scan image:', error);
    res.status(500).json({ error: error.message || 'שגיאה בשליפת תמונה' });
  }
});

// GET /api/sweep/sheets/status - Check Google Sheets connection and metadata
sweepRouter.get('/sheets/status', async (_req, res) => {
  try {
    const status = await getGoogleSheetsStatus();
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'שגיאה בבדיקת חיבור ל-Google Sheets' });
  }
});

// POST /api/sweep/sheets/sync - Synchronize all scans from database to Google Sheets
sweepRouter.post('/sheets/sync', async (req, res) => {
  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const result = await syncAllScansToGoogleSheet(baseUrl);
    res.json(result);
  } catch (error: any) {
    console.error('[Sweep API] Error syncing to Google Sheets:', error);
    res.status(500).json({ error: error.message || 'שגיאה בסנכרון ל-Google Sheets' });
  }
});