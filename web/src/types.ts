export interface Room {
  id: string;
  name: string;
  code: string;
  holder_id: string;
  holder_name: string;
  total_items?: number;
  swept_items: number;
}

export interface InventoryHolder {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  total_signed_items: number;
  rooms: Array<{ id: string; name: string; code: string }>;
}

export interface OfficialItem {
  serial_number: string;
  masha: string;
  description: string;
  category: string;
  current_room_id: string;
  room_name: string;
  room_code: string;
  holder_name: string;
  last_seen_at: string;
  last_scanned_by: string;
  sticker_owner_text?: string;
}

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
  stats: {
    totalExpectedItems: number;
    totalDiscoveredItems: number;
    unauthorizedCount: number;
    missingCount: number;
  };
}