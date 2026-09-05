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
  personal_number?: string;
  email?: string;
  phone?: string;
  total_signed_items?: number;
  swept_items_count?: number;
  created_at?: string;
  rooms: Array<{ id: string; name: string; code: string }>;
}


export interface OfficialItem {
  serial_number?: string | null;
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
    serialNumber?: string | null;
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

export interface ScanObservation {
  id: string;
  sweep_id?: string | null;
  scanned_room_id: string;
  serial_number?: string | null;
  masha: string;
  scanned_by: string;
  sticker_owner_text?: string | null;
  product_name_detected?: string | null;
  scanned_at: string;
  scanned_room_name: string;
  scanned_room_code: string;
  scanned_holder_id: string;
  scanned_holder_name: string;
  official_item_id?: string | null;
  official_room_id?: string | null;
  official_holder_id?: string | null;
  official_room_name?: string | null;
  official_room_code?: string | null;
  official_holder_name?: string | null;
  item_description: string;
  category: string;
  scan_status: 'matched' | 'mismatch' | 'unregistered';
}

export interface ScanInvestigationData {
  serialNumber: string;
  officialItem: {
    id: string;
    masha: string;
    serial_number: string;
    description: string;
    category: string;
    room_id: string;
    holder_id: string;
    room_name: string;
    room_code: string;
    holder_name: string;
    masha_name?: string;
    masha_category?: string;
    masha_description?: string;
    created_at: string;
  } | null;
  observations: Array<{
    id: string;
    sweep_id?: string | null;
    room_id: string;
    serial_number: string;
    masha?: string;
    scanned_by: string;
    sticker_owner_text?: string | null;
    product_name_detected?: string | null;
    scanned_at: string;
    room_name: string;
    room_code: string;
    holder_name: string;
  }>;
  resolutions: Array<{
    id: string;
    serial_number: string;
    type: string;
    from_room_id?: string;
    to_room_id?: string;
    from_holder_id?: string;
    to_holder_id?: string;
    resolved_by: string;
    resolved_at: string;
    from_room_name?: string;
    to_room_name?: string;
    from_holder_name?: string;
    to_holder_name?: string;
  }>;
}