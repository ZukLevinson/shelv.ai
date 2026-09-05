import { db } from '../db/database.js';

export interface AnomalyReport {
  unauthorizedTransfers: Array<{
    serialNumber: string;
    masha: string;
    mashaName: string;
    category: string;
    scannedRoomId: string;
    scannedRoomName: string;
    scannedHolderId: string;
    scannedHolderName: string;
    supposedHolderId: string;
    supposedHolderName: string;
    scannedBy: string;
    scannedAt: string;
    stickerOwnerText?: string;
    officialRoomId?: string;
    officialRoomName?: string;
    officialHolderId?: string;
    officialHolderName?: string;
    scannedRoomHolderId?: string;
    scannedRoomHolderName?: string;
  }>;
  quotaDiscrepancies: Array<{
    holderId: string;
    holderName: string;
    masha: string;
    mashaName: string;
    category: string;
    expectedQuantity: number;
    actualDiscovered: number;
    difference: number;
  }>;
  discoveredDistribution: Array<{
    holderId: string;
    holderName: string;
    roomId: string;
    roomName: string;
    roomCode: string;
    masha: string;
    mashaName: string;
    count: number;
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
    totalExpectedItems: number;
    totalDiscoveredItems: number;
    unauthorizedCount: number;
    missingCount: number;
    totalOfficialItems: number;
    totalSweptItems: number;
    internalMovesCount: number;
  };
}

export function detectAnomalies(): AnomalyReport {
  const latestScansQuery = `
    SELECT o.*, 
           r.name as scanned_room_name, 
           r.code as scanned_room_code,
           r.holder_id as scanned_room_holder_id,
           h.name as scanned_room_holder_name
    FROM sweep_observations o
    JOIN rooms r ON o.room_id = r.id
    JOIN inventory_holders h ON r.holder_id = h.id
    WHERE o.id = (
      SELECT sub.id
      FROM sweep_observations sub
      WHERE sub.serial_number = o.serial_number
      ORDER BY sub.scanned_at DESC, sub.id DESC
      LIMIT 1
    )
  `;
  const latestScans = db.prepare(latestScansQuery).all() as any[];

  const officialItemsQuery = `
    SELECT i.*, 
           r.name as official_room_name, 
           r.code as official_room_code,
           h.id as official_holder_id,
           h.name as official_holder_name,
           COALESCE(m.name, i.description) as masha_name,
           COALESCE(m.category, i.category, 'PC') as resolved_category
    FROM official_inventory i
    LEFT JOIN rooms r ON i.room_id = r.id
    JOIN inventory_holders h ON i.holder_id = h.id
    LEFT JOIN masha_registry m ON i.masha = m.masha
  `;
  const officialItems = db.prepare(officialItemsQuery).all() as any[];

  const mashaList = db.prepare('SELECT * FROM masha_registry').all() as any[];
  const mashaMap = new Map<string, { name: string; category: string; description: string }>();
  for (const m of mashaList) {
    mashaMap.set(m.masha, {
      name: m.name || '',
      category: m.category || 'PC',
      description: m.description || '',
    });
  }

  const resolveMashaInfo = (masha: string, defaultName?: string, defaultCategory?: string) => {
    const reg = mashaMap.get(masha);
    return {
      name: reg?.name || defaultName || (masha ? `מסח"א ${masha}` : 'ציוד כללי'),
      category: reg?.category || defaultCategory || 'PC',
    };
  };

  const scanMap = new Map<string, any>();
  latestScans.forEach((scan) => {
    scanMap.set(scan.serial_number.toUpperCase().trim(), scan);
  });

  const officialItemMap = new Map<string, any>();
  officialItems.forEach((item) => {
    officialItemMap.set(item.serial_number.toUpperCase().trim(), item);
  });

  const unauthorizedTransfers: AnomalyReport['unauthorizedTransfers'] = [];
  const internalMoves: AnomalyReport['internalMoves'] = [];
  const missingItems: AnomalyReport['missingItems'] = [];

  for (const item of officialItems) {
    const snKey = item.serial_number.toUpperCase().trim();
    const scan = scanMap.get(snKey);

    if (!scan) {
      missingItems.push({
        serialNumber: item.serial_number,
        masha: item.masha,
        description: item.masha_name || item.description,
        category: item.resolved_category,
        officialRoomId: item.room_id,
        officialRoomName: item.official_room_name,
        officialHolderId: item.official_holder_id,
        officialHolderName: item.official_holder_name,
      });
    } else {
      const mashaInfo = resolveMashaInfo(item.masha, item.description, item.category);

      if (scan.scanned_room_holder_id !== item.official_holder_id) {
        unauthorizedTransfers.push({
          serialNumber: item.serial_number,
          masha: item.masha,
          mashaName: mashaInfo.name,
          category: mashaInfo.category,
          scannedRoomId: scan.room_id,
          scannedRoomName: scan.scanned_room_name,
          scannedHolderId: scan.scanned_room_holder_id,
          scannedHolderName: scan.scanned_room_holder_name,
          supposedHolderId: item.official_holder_id,
          supposedHolderName: item.official_holder_name,
          scannedBy: scan.scanned_by,
          scannedAt: scan.scanned_at,
          stickerOwnerText: scan.sticker_owner_text || undefined,
          officialRoomId: item.room_id,
          officialRoomName: item.official_room_name,
          officialHolderId: item.official_holder_id,
          officialHolderName: item.official_holder_name,
          scannedRoomHolderId: scan.scanned_room_holder_id,
          scannedRoomHolderName: scan.scanned_room_holder_name,
        });
      } else if (item.room_id && scan.room_id !== item.room_id) {
        internalMoves.push({
          serialNumber: item.serial_number,
          masha: item.masha,
          description: mashaInfo.name,
          category: mashaInfo.category,
          officialRoomId: item.room_id,
          officialRoomName: item.official_room_name,
          scannedRoomId: scan.room_id,
          scannedRoomName: scan.scanned_room_name,
          holderId: item.official_holder_id,
          holderName: item.official_holder_name,
          scannedBy: scan.scanned_by,
          scannedAt: scan.scanned_at,
        });
      }
    }
  }

  // Scanned items not found in official inventory
  for (const scan of latestScans) {
    const snKey = scan.serial_number.toUpperCase().trim();
    if (!officialItemMap.has(snKey)) {
      const effectiveMasha = scan.masha || '';
      const mashaInfo = resolveMashaInfo(effectiveMasha, scan.product_name_detected);
      unauthorizedTransfers.push({
        serialNumber: scan.serial_number,
        masha: effectiveMasha,
        mashaName: mashaInfo.name,
        category: mashaInfo.category,
        scannedRoomId: scan.room_id,
        scannedRoomName: scan.scanned_room_name,
        scannedHolderId: scan.scanned_room_holder_id,
        scannedHolderName: scan.scanned_room_holder_name,
        supposedHolderId: '',
        supposedHolderName: 'לא רשום במצאי',
        scannedBy: scan.scanned_by,
        scannedAt: scan.scanned_at,
        stickerOwnerText: scan.sticker_owner_text || undefined,
        scannedRoomHolderId: scan.scanned_room_holder_id,
        scannedRoomHolderName: scan.scanned_room_holder_name,
      });
    }
  }

  // Discovered Distribution (physical placements across rooms)
  const distMap = new Map<string, {
    holderId: string;
    holderName: string;
    roomId: string;
    roomName: string;
    roomCode: string;
    masha: string;
    mashaName: string;
    count: number;
  }>();

  for (const scan of latestScans) {
    const snKey = scan.serial_number.toUpperCase().trim();
    const official = officialItemMap.get(snKey);
    const masha = scan.masha || (official ? official.masha : '') || 'ללא מסח"א';
    const mashaInfo = resolveMashaInfo(masha, official?.description || scan.product_name_detected);

    const key = `${scan.room_id}::${masha}`;
    const existing = distMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      distMap.set(key, {
        holderId: scan.scanned_room_holder_id,
        holderName: scan.scanned_room_holder_name,
        roomId: scan.room_id,
        roomName: scan.scanned_room_name,
        roomCode: scan.scanned_room_code,
        masha,
        mashaName: mashaInfo.name,
        count: 1,
      });
    }
  }

  const discoveredDistribution = Array.from(distMap.values()).sort((a, b) => {
    if (a.holderName !== b.holderName) return a.holderName.localeCompare(b.holderName, 'he');
    if (a.roomName !== b.roomName) return a.roomName.localeCompare(b.roomName, 'he');
    return a.masha.localeCompare(b.masha);
  });

  // Quota Discrepancies (signed expected vs discovered in holder's rooms)
  const quotaExpectedMap = new Map<string, {
    holderId: string;
    holderName: string;
    masha: string;
    mashaName: string;
    category: string;
    expectedQuantity: number;
  }>();

  for (const item of officialItems) {
    const key = `${item.official_holder_id}::${item.masha}`;
    const mashaInfo = resolveMashaInfo(item.masha, item.description, item.category);
    const existing = quotaExpectedMap.get(key);
    if (existing) {
      existing.expectedQuantity += 1;
    } else {
      quotaExpectedMap.set(key, {
        holderId: item.official_holder_id,
        holderName: item.official_holder_name,
        masha: item.masha,
        mashaName: mashaInfo.name,
        category: mashaInfo.category,
        expectedQuantity: 1,
      });
    }
  }

  const quotaDiscoveredCountMap = new Map<string, number>();
  for (const scan of latestScans) {
    const snKey = scan.serial_number.toUpperCase().trim();
    const official = officialItemMap.get(snKey);
    const masha = scan.masha || (official ? official.masha : '') || '';
    if (masha) {
      const key = `${scan.scanned_room_holder_id}::${masha}`;
      quotaDiscoveredCountMap.set(key, (quotaDiscoveredCountMap.get(key) || 0) + 1);
    }
  }

  const quotaDiscrepancies: AnomalyReport['quotaDiscrepancies'] = [];
  for (const [key, quota] of quotaExpectedMap.entries()) {
    const actualDiscovered = quotaDiscoveredCountMap.get(key) || 0;
    const difference = actualDiscovered - quota.expectedQuantity;
    if (difference < 0) {
      quotaDiscrepancies.push({
        holderId: quota.holderId,
        holderName: quota.holderName,
        masha: quota.masha,
        mashaName: quota.mashaName,
        category: quota.category,
        expectedQuantity: quota.expectedQuantity,
        actualDiscovered,
        difference,
      });
    }
  }

  quotaDiscrepancies.sort((a, b) => a.holderName.localeCompare(b.holderName, 'he'));

  return {
    unauthorizedTransfers,
    quotaDiscrepancies,
    discoveredDistribution,
    internalMoves,
    missingItems,
    stats: {
      totalExpectedItems: officialItems.length,
      totalDiscoveredItems: latestScans.length,
      unauthorizedCount: unauthorizedTransfers.length,
      missingCount: missingItems.length,
      totalOfficialItems: officialItems.length,
      totalSweptItems: latestScans.length,
      internalMovesCount: internalMoves.length,
    },
  };
}

export function approveTransfer(serialNumber: string, targetRoomId: string, resolvedBy: string) {
  const targetRoom = db.prepare('SELECT * FROM rooms WHERE id = ?').get(targetRoomId) as any;
  if (!targetRoom) {
    throw new Error('Target room not found');
  }

  let currentItem = db.prepare('SELECT * FROM official_inventory WHERE serial_number = ?').get(serialNumber) as any;
  let fromRoomId = null;
  let fromHolderId = null;

  if (currentItem) {
    fromRoomId = currentItem.room_id;
    fromHolderId = currentItem.holder_id;
    const updateStmt = db.prepare(`
      UPDATE official_inventory 
      SET room_id = ?, holder_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE serial_number = ?
    `);
    updateStmt.run(targetRoom.id, targetRoom.holder_id, serialNumber);
  } else {
    // If item was scanned but not yet in official inventory, register it under the target room & holder
    const latestObs = db.prepare('SELECT * FROM sweep_observations WHERE serial_number = ? ORDER BY scanned_at DESC LIMIT 1').get(serialNumber) as any;
    const masha = latestObs?.masha || '000000000';
    const desc = latestObs?.product_name_detected || 'ציוד שנוסף מסריקה';
    const itemId = 'item-' + Date.now();
    db.prepare(`
      INSERT INTO official_inventory (id, masha, serial_number, description, category, room_id, holder_id)
      VALUES (?, ?, ?, ?, 'PC', ?, ?)
    `).run(itemId, masha, serialNumber, desc, targetRoom.id, targetRoom.holder_id);
  }

  const auditStmt = db.prepare(`
    INSERT INTO anomaly_resolutions (id, serial_number, type, from_room_id, to_room_id, from_holder_id, to_holder_id, resolved_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const resolutionId = 'res-' + Date.now();
  auditStmt.run(
    resolutionId,
    serialNumber,
    'unauthorized_transfer_approved',
    fromRoomId,
    targetRoom.id,
    fromHolderId,
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