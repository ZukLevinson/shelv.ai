export interface Room {
  id: string;
  name: string;
  code: string;
  holder_id: string;
  holder_name: string;
  holder_email?: string;
  total_items: number;
  swept_items: number;
}

export interface InventoryHolder {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  rooms: Array<{ id: string; name: string; code: string }>;
}

export interface OfficialItem {
  id: string;
  masha: string;
  serial_number: string;
  description: string;
  category: string;
  room_id: string;
  room_name: string;
  room_code: string;
  holder_id: string;
  holder_name: string;
  created_at: string;
}

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