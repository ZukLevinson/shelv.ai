import { db } from '../db/database.js';
import { broadcast } from '../sockets/socketServer.js';
import { detectAnomalies } from './anomalyService.js';

export interface RecordScanInput {
  sweepId?: string;
  roomId: string;
  serialNumber: string;
  masha?: string;
  scannedBy: string;
  stickerOwnerText?: string;
  productNameDetected?: string;
}

export function recordObservation(input: RecordScanInput) {
  const cleanSN = input.serialNumber.trim().toUpperCase();
  const cleanMasha = input.masha ? input.masha.trim() : null;

  const existingScan = db.prepare(`
    SELECT * FROM sweep_observations
    WHERE serial_number = ? AND room_id = ?
    ORDER BY scanned_at DESC LIMIT 1
  `).get(cleanSN, input.roomId) as any;

  if (existingScan) {
    db.prepare(`
      UPDATE sweep_observations 
      SET scanned_at = CURRENT_TIMESTAMP, scanned_by = ?
      WHERE id = ?
    `).run(input.scannedBy, existingScan.id);

    const officialItem = db.prepare(`
      SELECT i.*, r.name as official_room_name, h.name as official_holder_name
      FROM official_inventory i
      LEFT JOIN rooms r ON i.room_id = r.id
      JOIN inventory_holders h ON i.holder_id = h.id
      WHERE i.serial_number = ?
    `).get(cleanSN) as any;

    return {
      status: 'duplicate',
      message: 'Item has already been scanned in this room sweep session',
      observationId: existingScan.id,
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
      id, sweep_id, room_id, serial_number, masha, scanned_by, sticker_owner_text, product_name_detected
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    observationId,
    input.sweepId || null,
    input.roomId,
    cleanSN,
    cleanMasha,
    input.scannedBy,
    input.stickerOwnerText || null,
    input.productNameDetected || null
  );

  const officialItem = db.prepare(`
    SELECT i.*, r.name as official_room_name, r.id as official_room_id,
           h.name as official_holder_name, h.id as official_holder_id
    FROM official_inventory i
    LEFT JOIN rooms r ON i.room_id = r.id
    JOIN inventory_holders h ON i.holder_id = h.id
    WHERE i.serial_number = ?
  `).get(cleanSN) as any;

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

  const anomalies = detectAnomalies();
  broadcast('ANOMALIES_UPDATED', anomalies);

  return {
    status: 'recorded',
    message: 'Item scan recorded successfully',
    observationId,
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