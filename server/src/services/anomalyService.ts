import { db } from '../db/database.js';

export interface AnomalyReport {
  unauthorizedTransfers: Array<{
    serialNumber: string;
    masha: string;
    description: string;
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
    description: string;
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
    description: string;
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
    WHERE (
      (o.serial_number IS NOT NULL AND o.serial_number != '' AND o.id = (
        SELECT sub.id
        FROM sweep_observations sub
        WHERE sub.serial_number = o.serial_number
        ORDER BY sub.scanned_at DESC, sub.id DESC
        LIMIT 1
      ))
      OR (o.serial_number IS NULL OR o.serial_number = '')
    )
  `;
  const latestScans = db.prepare(latestScansQuery).all() as any[];

  const officialItemsQuery = `
    SELECT i.*, 
           r.name as official_room_name, 
           r.code as official_room_code,
           h.id as official_holder_id,
           h.name as official_holder_name,
           COALESCE(m.description, i.description) as resolved_description,
           COALESCE(m.category, i.category, 'Regular Workstation') as resolved_category
    FROM official_inventory i
    LEFT JOIN rooms r ON i.room_id = r.id
    JOIN inventory_holders h ON i.holder_id = h.id
    LEFT JOIN masha_registry m ON i.masha = m.masha
  `;
  const officialItems = db.prepare(officialItemsQuery).all() as any[];

  const mashaList = db.prepare('SELECT * FROM masha_registry').all() as any[];
  const mashaMap = new Map<string, { category: string; description: string }>();
  for (const m of mashaList) {
    mashaMap.set(m.masha, {
      category: m.category || 'Regular Workstation',
      description: m.description || '',
    });
  }

  const resolveMashaInfo = (masha: string, defaultDesc?: string, defaultCategory?: string) => {
    const reg = mashaMap.get(masha);
    return {
      description: reg?.description || defaultDesc || (masha ? `מסח"א ${masha}` : 'ציוד כללי'),
      category: reg?.category || defaultCategory || 'Regular Workstation',
    };
  };

  const scanMap = new Map<string, any>();
  latestScans.forEach((scan) => {
    if (scan.serial_number && String(scan.serial_number).trim()) {
      scanMap.set(String(scan.serial_number).toUpperCase().trim(), scan);
    }
  });

  const officialItemMap = new Map<string, any>();
  officialItems.forEach((item) => {
    if (item.serial_number && String(item.serial_number).trim()) {
      officialItemMap.set(String(item.serial_number).toUpperCase().trim(), item);
    }
  });

  // Map of holderId -> Set of mashas they are signed on
  const holderSignedMashas = new Map<string, Set<string>>();
  // Map of masha -> list of holderNames signed on this masha
  const mashaHoldersMap = new Map<string, string[]>();
  for (const item of officialItems) {
    if (!holderSignedMashas.has(item.holder_id)) {
      holderSignedMashas.set(item.holder_id, new Set());
    }
    holderSignedMashas.get(item.holder_id)!.add(item.masha);

    if (!mashaHoldersMap.has(item.masha)) {
      mashaHoldersMap.set(item.masha, []);
    }
    const list = mashaHoldersMap.get(item.masha)!;
    if (!list.includes(item.official_holder_name)) {
      list.push(item.official_holder_name);
    }
  }

  const unauthorizedTransfers: AnomalyReport['unauthorizedTransfers'] = [];
  const internalMoves: AnomalyReport['internalMoves'] = [];
  const missingItems: AnomalyReport['missingItems'] = [];

  // 1. Check official serialized items against physical scans
  for (const item of officialItems) {
    if (item.serial_number && String(item.serial_number).trim()) {
      const snKey = String(item.serial_number).toUpperCase().trim();
      const scan = scanMap.get(snKey);

      if (!scan) {
        missingItems.push({
          serialNumber: item.serial_number,
          masha: item.masha,
          description: item.resolved_description || item.description,
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
            description: mashaInfo.description,
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
            description: mashaInfo.description,
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
  }

  // 2. Check scanned items that are NOT explicitly matched by S/N above
  for (const scan of latestScans) {
    const snKey = scan.serial_number && String(scan.serial_number).trim()
      ? String(scan.serial_number).toUpperCase().trim()
      : null;

    // If already checked as an exact serialized item above, skip
    if (snKey && officialItemMap.has(snKey)) {
      continue;
    }

    const effectiveMasha = scan.masha || '';
    const roomHolderSignedMashas = holderSignedMashas.get(scan.scanned_room_holder_id);

    // If the room's holder is signed on this Masha in Excel, this physical item matches
    // their signature quota! It is NOT unauthorized.
    if (effectiveMasha && roomHolderSignedMashas && roomHolderSignedMashas.has(effectiveMasha)) {
      continue;
    }

    // Otherwise, the room's holder does NOT hold a signature for this Masha
    const mashaInfo = resolveMashaInfo(effectiveMasha, scan.product_name_detected);
    const orgHoldersForMasha = effectiveMasha ? (mashaHoldersMap.get(effectiveMasha) || []) : [];
    const supposedHolderDisplay = orgHoldersForMasha.length > 0
      ? `חתימה רשומה אצל: ${orgHoldersForMasha.join(', ')}`
      : 'לא רשום באקסל החתימות';

    unauthorizedTransfers.push({
      serialNumber: scan.serial_number || null,
      masha: effectiveMasha,
      description: mashaInfo.description,
      category: mashaInfo.category,
      scannedRoomId: scan.room_id,
      scannedRoomName: scan.scanned_room_name,
      scannedHolderId: scan.scanned_room_holder_id,
      scannedHolderName: scan.scanned_room_holder_name,
      supposedHolderId: '',
      supposedHolderName: supposedHolderDisplay,
      scannedBy: scan.scanned_by,
      scannedAt: scan.scanned_at,
      stickerOwnerText: scan.sticker_owner_text || undefined,
      scannedRoomHolderId: scan.scanned_room_holder_id,
      scannedRoomHolderName: scan.scanned_room_holder_name,
    });
  }

  // 3. Discovered Distribution (physical placements across rooms)
  const distMap = new Map<string, {
    holderId: string;
    holderName: string;
    roomId: string;
    roomName: string;
    roomCode: string;
    masha: string;
    description: string;
    count: number;
  }>();

  for (const scan of latestScans) {
    const snKey = scan.serial_number && String(scan.serial_number).trim()
      ? String(scan.serial_number).toUpperCase().trim()
      : null;
    const official = snKey ? officialItemMap.get(snKey) : null;
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
        description: mashaInfo.description,
        count: 1,
      });
    }
  }

  const discoveredDistribution = Array.from(distMap.values()).sort((a, b) => {
    if (a.holderName !== b.holderName) return a.holderName.localeCompare(b.holderName, 'he');
    if (a.roomName !== b.roomName) return a.roomName.localeCompare(b.roomName, 'he');
    return a.masha.localeCompare(b.masha);
  });

  // 4. Quota Discrepancies (signed expected vs discovered in holder's rooms)
  const quotaExpectedMap = new Map<string, {
    holderId: string;
    holderName: string;
    masha: string;
    description: string;
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
        description: mashaInfo.description,
        category: mashaInfo.category,
        expectedQuantity: 1,
      });
    }
  }

  const quotaDiscoveredCountMap = new Map<string, number>();
  for (const scan of latestScans) {
    const snKey = scan.serial_number && String(scan.serial_number).trim()
      ? String(scan.serial_number).toUpperCase().trim()
      : null;
    const official = snKey ? officialItemMap.get(snKey) : null;
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
        description: quota.description,
        category: quota.category,
        expectedQuantity: quota.expectedQuantity,
        actualDiscovered,
        difference,
      });
    }
  }

  quotaDiscrepancies.sort((a, b) => a.holderName.localeCompare(b.holderName, 'he'));

  const totalMissingQuotas = quotaDiscrepancies.reduce((sum, q) => sum + Math.abs(q.difference), 0);

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
      missingCount: Math.max(totalMissingQuotas, missingItems.length),
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
    const rawDesc = latestObs?.product_name_detected || 'ציוד שנוסף מסריקה';
    const mashaRecord = db.prepare('SELECT category, description FROM masha_registry WHERE masha = ?').get(masha) as any;
    const resolvedCat = mashaRecord?.category || 'Regular Workstation';
    const resolvedDesc = rawDesc !== 'ציוד שנוסף מסריקה' ? rawDesc : (mashaRecord?.description || rawDesc);
    const itemId = 'item-' + Date.now();
    db.prepare(`
      INSERT INTO official_inventory (id, masha, serial_number, description, category, room_id, holder_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(itemId, masha, serialNumber, resolvedDesc, resolvedCat, targetRoom.id, targetRoom.holder_id);
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

export function revertResolution(resolutionId: string, revertedBy: string) {
  const resolution = db.prepare('SELECT * FROM anomaly_resolutions WHERE id = ?').get(resolutionId) as any;
  if (!resolution) {
    throw new Error('Resolution record not found');
  }

  const { serial_number, from_room_id, from_holder_id, to_room_id } = resolution;

  // Check if item currently exists in official inventory
  const currentItem = db.prepare('SELECT * FROM official_inventory WHERE serial_number = ?').get(serial_number) as any;

  if (currentItem) {
    if (!from_room_id && !from_holder_id) {
      // The item was newly added during this resolution (was not in official inventory before)
      db.prepare('DELETE FROM official_inventory WHERE serial_number = ?').run(serial_number);
    } else {
      // Restore previous room and holder
      db.prepare(`
        UPDATE official_inventory 
        SET room_id = ?, holder_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE serial_number = ?
      `).run(from_room_id, from_holder_id, serial_number);
    }
  }

  // Remove the resolution record from history
  db.prepare('DELETE FROM anomaly_resolutions WHERE id = ?').run(resolutionId);

  return {
    success: true,
    message: 'הפעולה בוטלה בהצלחה והפריט הוחזר למצבו הקודם',
    serialNumber: serial_number,
    restoredRoomId: from_room_id,
    restoredHolderId: from_holder_id
  };
}