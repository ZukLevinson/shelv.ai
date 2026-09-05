import { Router } from 'express';
import { recordObservation, startSweepSession, completeSweepSession } from '../services/sweepService.js';
import { analyzeFrameWithGemini, qualifyFrameWithGemini } from '../services/geminiVisionService.js';
import { db } from '../db/database.js';

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
  const { sweepId, roomId, serialNumber, masha, scannedBy, stickerOwnerText, productNameDetected } = req.body;

  if (!roomId || !masha || !scannedBy) {
    return res.status(400).json({ error: 'roomId, masha, and scannedBy are required' });
  }

  try {
    const result = recordObservation({
      sweepId,
      roomId,
      masha: String(masha).trim(),
      serialNumber: serialNumber ? String(serialNumber).trim() : null,
      scannedBy,
      stickerOwnerText,
      productNameDetected
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
        CASE
          WHEN i.id IS NULL THEN 'unregistered'
          WHEN i.holder_id != r.holder_id THEN 'mismatch'
          ELSE 'matched'
        END as scan_status
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

// DELETE /api/sweep/scans/:id - Delete erroneous or test scan observation
sweepRouter.delete('/scans/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const existing = db.prepare('SELECT * FROM sweep_observations WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ error: 'תצפית סריקה לא נמצאה' });
    }

    db.prepare('DELETE FROM sweep_observations WHERE id = ?').run(id);

    // Import dynamic/lazy services to avoid circular dependency
    const { detectAnomalies } = await import('../services/anomalyService.js');
    const { broadcast } = await import('../sockets/socketServer.js');

    const anomalies = detectAnomalies();
    broadcast('ANOMALIES_UPDATED', anomalies);
    broadcast('SCANS_UPDATED', { deletedObservationId: id, serialNumber: existing.serial_number });

    res.json({ success: true, message: 'סריקה נמחקה בהצלחה', deletedId: id });
  } catch (error: any) {
    console.error('[Sweep API] Error deleting scan:', error);
    res.status(500).json({ error: error.message || 'Failed to delete scan' });
  }
});