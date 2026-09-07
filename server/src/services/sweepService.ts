import { db } from '../db/database.js';
import { broadcast } from '../sockets/socketServer.js';
import { detectAnomalies } from './anomalyService.js';
import { logAction } from './actionService.js';

export interface RecordScanInput {
  sweepId?: string;
  roomId: string;
  masha: string;
  serialNumber?: string | null;
  scannedBy: string;
  stickerOwnerText?: string;
  productNameDetected?: string;
}

export function recordObservation(input: RecordScanInput) {
  const cleanMasha = (input.masha || '').trim();
  if (!cleanMasha) {
    throw new Error('מסח"א הוא שדה חובה');
  }

  const cleanSN = input.serialNumber && input.serialNumber.trim() 
    ? input.serialNumber.trim().toUpperCase() 
    : null;

  let existingScan: any = null;
  if (cleanSN) {
    existingScan = db.prepare(`
      SELECT * FROM sweep_observations
      WHERE serial_number = ? AND room_id = ?
      ORDER BY scanned_at DESC LIMIT 1
    `).get(cleanSN, input.roomId) as any;
  }

  if (existingScan) {
    db.prepare(`
      UPDATE sweep_observations 
      SET scanned_at = CURRENT_TIMESTAMP, scanned_by = ?, masha = ?
      WHERE id = ?
    `).run(input.scannedBy, cleanMasha, existingScan.id);

    const officialItem = db.prepare(`
      SELECT i.*, r.name as official_room_name, h.name as official_holder_name
      FROM official_inventory i
      LEFT JOIN rooms r ON i.room_id = r.id
      JOIN inventory_holders h ON i.holder_id = h.id
      WHERE i.serial_number = ?
    `).get(cleanSN) as any;

    const actionId = logAction({
      actionType: 'scan_created',
      description: `עדכון סריקה כפולה לפריט ${cleanSN || cleanMasha}`,
      entityType: 'scan',
      entityId: existingScan.id,
      performedBy: input.scannedBy,
      stateBefore: existingScan,
      stateAfter: { ...existingScan, scanned_by: input.scannedBy, masha: cleanMasha }
    });

    const scannedRoom = db.prepare(`
      SELECT r.*, h.name as holder_name FROM rooms r
      JOIN inventory_holders h ON r.holder_id = h.id
      WHERE r.id = ?
    `).get(input.roomId) as any;

    broadcast('ITEM_SCANNED', {
      observationId: existingScan.id,
      serialNumber: cleanSN,
      masha: cleanMasha,
      scannedRoom,
      officialItem: officialItem || null,
      scannedBy: input.scannedBy,
      timestamp: new Date().toISOString(),
    });

    return {
      status: 'duplicate',
      message: 'Item has already been scanned in this room sweep session',
      observationId: existingScan.id,
      actionId,
      item: officialItem || {
        serial_number: cleanSN,
        masha: cleanMasha,
        description: input.productNameDetected || 'Item',
      },
    };
  }

  const observationId = 'obs-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  db.prepare(`
    INSERT INTO sweep_observations (
      id, sweep_id, room_id, masha, serial_number, scanned_by, sticker_owner_text, product_name_detected
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    observationId,
    input.sweepId || null,
    input.roomId,
    cleanMasha,
    cleanSN,
    input.scannedBy,
    input.stickerOwnerText || null,
    input.productNameDetected || null
  );

  let officialItem: any = null;
  if (cleanSN) {
    officialItem = db.prepare(`
      SELECT i.*, r.name as official_room_name, r.id as official_room_id,
             h.name as official_holder_name, h.id as official_holder_id
      FROM official_inventory i
      LEFT JOIN rooms r ON i.room_id = r.id
      JOIN inventory_holders h ON i.holder_id = h.id
      WHERE i.serial_number = ?
    `).get(cleanSN) as any;
  }

  if (!officialItem) {
    // Check if the scanned room's holder holds a signature on this Masha
    officialItem = db.prepare(`
      SELECT i.*, r.name as official_room_name, r.id as official_room_id,
             h.name as official_holder_name, h.id as official_holder_id
      FROM official_inventory i
      LEFT JOIN rooms r ON i.room_id = r.id
      JOIN inventory_holders h ON i.holder_id = h.id
      JOIN rooms scan_r ON scan_r.holder_id = i.holder_id
      WHERE i.masha = ? AND scan_r.id = ?
      LIMIT 1
    `).get(cleanMasha, input.roomId) as any;
  }

  if (!officialItem) {
    // Fallback: check if any other holder is signed on this Masha
    officialItem = db.prepare(`
      SELECT i.*, r.name as official_room_name, r.id as official_room_id,
             h.name as official_holder_name, h.id as official_holder_id
      FROM official_inventory i
      LEFT JOIN rooms r ON i.room_id = r.id
      JOIN inventory_holders h ON i.holder_id = h.id
      WHERE i.masha = ?
      LIMIT 1
    `).get(cleanMasha) as any;
  }

  const scannedRoom = db.prepare(`
    SELECT r.*, h.name as holder_name FROM rooms r
    JOIN inventory_holders h ON r.holder_id = h.id
    WHERE r.id = ?
  `).get(input.roomId) as any;

  broadcast('ITEM_SCANNED', {
    observationId,
    serialNumber: cleanSN,
    masha: cleanMasha,
    scannedRoom,
    officialItem: officialItem || null,
    scannedBy: input.scannedBy,
    timestamp: new Date().toISOString(),
  });

  // Recalculate and broadcast anomalies asynchronously so the mobile app gets an instant response (<10ms)
  setImmediate(() => {
    try {
      const anomalies = detectAnomalies();
      broadcast('ANOMALIES_UPDATED', anomalies);
    } catch (err) {
      console.error('[Sweep] Error recalculating anomalies asynchronously:', err);
    }
  });

  const actionId = logAction({
    actionType: 'scan_created',
    description: `סריקת פריט ${cleanSN ? 'S/N ' + cleanSN : 'מסח"א ' + cleanMasha} ב${scannedRoom?.name || 'חדר'}`,
    entityType: 'scan',
    entityId: observationId,
    performedBy: input.scannedBy,
    stateAfter: {
      id: observationId,
      sweep_id: input.sweepId || null,
      room_id: input.roomId,
      masha: cleanMasha,
      serial_number: cleanSN,
      scanned_by: input.scannedBy,
      sticker_owner_text: input.stickerOwnerText || null,
      product_name_detected: input.productNameDetected || null,
      scanned_at: new Date().toISOString()
    }
  });

  return {
    status: 'recorded',
    message: 'Item scan recorded successfully',
    observationId,
    actionId,
    item: officialItem || {
      serial_number: cleanSN,
      masha: cleanMasha,
      description: input.productNameDetected || 'Item',
    },
  };
}

export function startSweepSession(roomId: string, sweptBy: string) {
  const sessionId = 'sweep-' + Date.now();
  db.prepare(`
    INSERT INTO sweep_sessions (id, room_id, swept_by, status)
    VALUES (?, ?, ?, 'active')
  `).run(sessionId, roomId, sweptBy);

  broadcast('SWEEP_STARTED', { sessionId, roomId, sweptBy });
  return { sessionId };
}

export function completeSweepSession(sessionId: string) {
  db.prepare(`
    UPDATE sweep_sessions
    SET status = 'completed', completed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(sessionId);

  broadcast('SWEEP_COMPLETED', { sessionId });
  const anomalies = detectAnomalies();
  broadcast('ANOMALIES_UPDATED', anomalies);

  return { success: true };
}