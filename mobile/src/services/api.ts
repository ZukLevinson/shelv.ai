export const SERVER_URL = 'http://localhost:4000'; // or local network IP for physical device

export async function fetchRooms() {
  const res = await fetch(`${SERVER_URL}/api/inventory/rooms`);
  return res.json();
}

export async function submitScan(payload: {
  sweepId?: string;
  roomId: string;
  serialNumber: string;
  masha?: string;
  scannedBy: string;
  stickerOwnerText?: string;
  productNameDetected?: string;
}) {
  const res = await fetch(`${SERVER_URL}/api/sweep/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function lookupItem(sn?: string, masha?: string) {
  const params = new URLSearchParams();
  if (sn) params.append('sn', sn);
  if (masha) params.append('masha', masha);
  const res = await fetch(`${SERVER_URL}/api/inventory/lookup?${params.toString()}`);
  return res.json();
}