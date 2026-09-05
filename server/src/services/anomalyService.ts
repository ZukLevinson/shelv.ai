import { db } from '../db/database.js';

export interface AnomalyReport {
  unauthorizedTransfers: Array<{
    serialNumber: string;
    masha: string;
    description: string;
    category: string;
    officialRoomId: string;
    officialRoomName: string;
    officialHolderId: string;
    officialHolderName: string;
    scannedRoomId: string;
    scannedRoomName: string;
    scannedRoomHolderId: string;
    scannedRoomHolderName: string;
    scannedBy: string;
    scannedAt: string;
    stickerOwnerText?: string;
  }>;
  internalMoves: Array<{
    serialNumber: string;
    masha: string;
    description: string;
    category: string;
    officialRoomId: string;
    officialRoomName: string;
    scannedRoomId: string;
    scannedRoomName: string;
    holderId: string;
    holderName: string;
    scannedBy: string;
    scannedAt: string;
  }>;
  missingItems: Array<{
    serialNumber: string;
    masha: string;
    description: string;
    category: string;
    officialRoomId: string;
    officialRoomName: string;
    officialHolderId: string;
    officialHolderName: string;
  }>;
  stats: {
    totalOfficialItems: number;
    totalSweptItems: number;
    unauthorizedCount: number;
    internalMovesCount: number;
    missingCount: number;
  };
}

export function detectAnomalies(): AnomalyReport {
  const latestScansQuery = `
    SELECT o.*, r.name as scanned_room_name, r.holder_id as scanned_room_holder_id,
           h.name as scanned_room_holder_name
    FROM sweep_observations o
    JOIN rooms r ON o.room_id = r.id
    JOIN inventory_holders h ON r.holder_id = h.id
    WHERE o.scanned_at = (
      SELECT MAX(sub.scanned_at)
      FROM sweep_observations sub
      WHERE sub.serial_number = o.serial_number
    )
  `;
  const latestScans = db.prepare(latestScansQuery).all() as any[];

  const officialItemsQuery = `
    SELECT i.*, 
           r.name as official_room_name, 
           h.id as official_holder_id,
           h.name as official_holder_name
    FROM official_inventory i
    JOIN rooms r ON i.room_id = r.id
    JOIN inventory_holders h ON i.holder_id = h.id
  `;
  const officialItems = db.prepare(officialItemsQuery).all() as any[];

  const scanMap = new Map<string, any>();
  latestScans.forEach((scan) => {
    scanMap.set(scan.serial_number.toUpperCase().trim(), scan);
  });

  const unauthorizedTransfers: AnomalyReport['unauthorizedTransfers'] = [];
  const internalMoves: AnomalyReport['internalMoves'] = [];
  const missingItems: AnomalyReport['missingItems'] = [];

  let sweptCount = 0;

  for (const item of officialItems) {
    const snKey = item.serial_number.toUpperCase().trim();
    const scan = scanMap.get(snKey);

    if (!scan) {
      missingItems.push({
        serialNumber: item.serial_number,
        masha: item.masha,
        description: item.description,
        category: item.category,
        officialRoomId: item.room_id,
        officialRoomName: item.official_room_name,
        officialHolderId: item.official_holder_id,
        officialHolderName: item.official_holder_name,
      });
    } else {
      sweptCount++;
      if (scan.room_id !== item.room_id) {
        if (scan.scanned_room_holder_id === item.official_holder_id) {
          internalMoves.push({
            serialNumber: item.serial_number,
            masha: item.masha,
            description: item.description,
            category: item.category,
            officialRoomId: item.room_id,
            officialRoomName: item.official_room_name,
            scannedRoomId: scan.room_id,
            scannedRoomName: scan.scanned_room_name,
            holderId: item.official_holder_id,
            holderName: item.official_holder_name,
            scannedBy: scan.scanned_by,
            scannedAt: scan.scanned_at,
          });
        } else {
          unauthorizedTransfers.push({
            serialNumber: item.serial_number,
            masha: item.masha,
            description: item.description,
            category: item.category,
            officialRoomId: item.room_id,
            officialRoomName: item.official_room_name,
            officialHolderId: item.official_holder_id,
            officialHolderName: item.official_holder_name,
            scannedRoomId: scan.room_id,
            scannedRoomName: scan.scanned_room_name,
            scannedRoomHolderId: scan.scanned_room_holder_id,
            scannedRoomHolderName: scan.scanned_room_holder_name,
            scannedBy: scan.scanned_by,
            scannedAt: scan.scanned_at,
            stickerOwnerText: scan.sticker_owner_text || undefined,
          });
        }
      }
    }
  }

  return {
    unauthorizedTransfers,
    internalMoves,
    missingItems,
    stats: {
      totalOfficialItems: officialItems.length,
      totalSweptItems: sweptCount,
      unauthorizedCount: unauthorizedTransfers.length,
      internalMovesCount: internalMoves.length,
      missingCount: missingItems.length,
    },
  };
}

export function approveTransfer(serialNumber: string, targetRoomId: string, resolvedBy: string) {
  const targetRoom = db.prepare('SELECT * FROM rooms WHERE id = ?').get(targetRoomId) as any;
  if (!targetRoom) {
    throw new Error('Target room not found');
  }

  const currentItem = db.prepare('SELECT * FROM official_inventory WHERE serial_number = ?').get(serialNumber) as any;
  if (!currentItem) {
    throw new Error('Official inventory item not found');
  }

  const updateStmt = db.prepare(`
    UPDATE official_inventory 
    SET room_id = ?, holder_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE serial_number = ?
  `);
  updateStmt.run(targetRoom.id, targetRoom.holder_id, serialNumber);

  const auditStmt = db.prepare(`
    INSERT INTO anomaly_resolutions (id, serial_number, type, from_room_id, to_room_id, from_holder_id, to_holder_id, resolved_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const resolutionId = 'res-' + Date.now();
  auditStmt.run(
    resolutionId,
    serialNumber,
    'unauthorized_transfer_approved',
    currentItem.room_id,
    targetRoom.id,
    currentItem.holder_id,
    targetRoom.holder_id,
    resolvedBy
  );

  return { success: true, resolutionId };
}

export function confirmInternalMove(serialNumber: string, targetRoomId: string, resolvedBy: string) {
  const targetRoom = db.prepare('SELECT * FROM rooms WHERE id = ?').get(targetRoomId) as any;
  if (!targetRoom) {
    throw new Error('Target room not found');
  }

  const currentItem = db.prepare('SELECT * FROM official_inventory WHERE serial_number = ?').get(serialNumber) as any;
  if (!currentItem) {
    throw new Error('Official inventory item not found');
  }

  const updateStmt = db.prepare(`
    UPDATE official_inventory 
    SET room_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE serial_number = ?
  `);
  updateStmt.run(targetRoom.id, serialNumber);

  const auditStmt = db.prepare(`
    INSERT INTO anomaly_resolutions (id, serial_number, type, from_room_id, to_room_id, from_holder_id, to_holder_id, resolved_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const resolutionId = 'res-' + Date.now();
  auditStmt.run(
    resolutionId,
    serialNumber,
    'internal_move_confirmed',
    currentItem.room_id,
    targetRoom.id,
    currentItem.holder_id,
    currentItem.holder_id,
    resolvedBy
  );

  return { success: true, resolutionId };
}