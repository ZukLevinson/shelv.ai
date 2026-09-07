import type { AnomalyReport, OfficialItem, Room, User } from '../types';

export const computeFilteredAnomalies = (
  anomalies: AnomalyReport | null,
  user: User | null,
  displayItems: OfficialItem[],
  displayRooms: Room[],
  myInventoryOnly: boolean
): AnomalyReport | null => {
  if (!anomalies) return null;
  if (!myInventoryOnly || !user?.holder_id) return anomalies;

  const holderId = user.holder_id;
  const holderName = user.holder_name;

  // Unauthorized transfers relevant to the user:
  // (a) Foreign items scanned in user's rooms (unauthorized presence)
  // (b) User's signed items scanned in foreign rooms
  const filteredUnauthorized = (anomalies.unauthorizedTransfers || []).filter((item) => {
    const isScannedInMyRoom = item.scannedHolderId === holderId ||
      (item as any).scannedRoomHolderId === holderId ||
      (holderName && item.scannedHolderName === holderName);
    const isSupposedlyMine = item.supposedHolderId === holderId ||
      (item as any).officialHolderId === holderId ||
      (holderName && (item.supposedHolderName === holderName || (item as any).officialHolderName === holderName || item.supposedHolderName?.includes(holderName)));
    return isScannedInMyRoom || isSupposedlyMine;
  });

  // Quota discrepancies for the user's signed quota vs discovered
  const filteredQuotas = (anomalies.quotaDiscrepancies || []).filter(
    (d) => d.holderId === holderId || (holderName && d.holderName === holderName)
  );

  // Physical placements discovered in the user's rooms
  const filteredDistribution = (anomalies.discoveredDistribution || []).filter(
    (dist) => dist.holderId === holderId || (holderName && dist.holderName === holderName)
  );

  const totalExpected = displayItems.length;
  const totalDiscovered = displayRooms.reduce((sum, r) => sum + (r.swept_items || 0), 0);
  const totalMissing = filteredQuotas.reduce((sum, d) => sum + Math.abs(d.difference), 0);

  return {
    ...anomalies,
    unauthorizedTransfers: filteredUnauthorized,
    quotaDiscrepancies: filteredQuotas,
    discoveredDistribution: filteredDistribution,
    stats: {
      totalExpectedItems: totalExpected,
      totalDiscoveredItems: totalDiscovered,
      unauthorizedCount: filteredUnauthorized.length,
      missingCount: totalMissing,
    },
  };
};
