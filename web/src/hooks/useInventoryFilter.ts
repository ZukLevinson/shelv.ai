import { useState, useEffect, useMemo } from 'react';
import type { Room, OfficialItem, AnomalyReport, User } from '../types';
import { computeFilteredAnomalies } from '../utils/anomalyFilters';

export const useInventoryFilter = (
  user: User | null,
  rooms: Room[],
  items: OfficialItem[],
  anomalies: AnomalyReport | null
) => {
  const [myInventoryOnly, setMyInventoryOnly] = useState(false);

  // Filter for "my equipment only" is only enabled if the user has a correspondent inventory owner
  const hasCorrespondentOwner = Boolean(user?.holder_id);

  // Automatically reset the filter if the user does not have a correspondent inventory owner
  useEffect(() => {
    if (!hasCorrespondentOwner && myInventoryOnly) {
      setMyInventoryOnly(false);
    }
  }, [hasCorrespondentOwner, myInventoryOnly]);

  // Filtered lists for Inventory Owner when "My Inventory Only" is toggled
  const displayRooms = useMemo(() => {
    if (myInventoryOnly && user?.holder_id) {
      return rooms.filter(
        (r) => r.holder_id === user.holder_id || (user.holder_name && r.holder_name === user.holder_name)
      );
    }
    return rooms;
  }, [rooms, myInventoryOnly, user?.holder_id, user?.holder_name]);

  const displayItems = useMemo(() => {
    if (myInventoryOnly && (user?.holder_id || user?.holder_name)) {
      return items.filter(
        (i) => (i.holder_id && i.holder_id === user.holder_id) || (user.holder_name && i.holder_name === user.holder_name)
      );
    }
    return items;
  }, [items, myInventoryOnly, user?.holder_id, user?.holder_name]);

  const displayAnomalies = useMemo(() => {
    return computeFilteredAnomalies(anomalies, user, displayItems, displayRooms, myInventoryOnly);
  }, [anomalies, user, displayItems, displayRooms, myInventoryOnly]);

  return {
    myInventoryOnly,
    setMyInventoryOnly,
    hasCorrespondentOwner,
    displayRooms,
    displayItems,
    displayAnomalies,
  };
};
