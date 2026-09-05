const isBrowser = typeof window !== 'undefined' && Boolean(window.location?.origin);
export const SERVER_URL = isBrowser
  ? window.location.origin
  : 'http://192.168.1.11:4000';

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

export async function startSweepSession(roomId: string, sweptBy: string) {
  const res = await fetch(`${SERVER_URL}/api/sweep/sessions/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId, sweptBy }),
  });
  return res.json();
}

export async function completeSweepSession(sessionId: string) {
  const res = await fetch(`${SERVER_URL}/api/sweep/sessions/${sessionId}/complete`, {
    method: 'POST',
  });
  return res.json();
}

export async function scanWithGemini(base64Image: string) {
  const res = await fetch(`${SERVER_URL}/api/sweep/gemini-scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Image }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Gemini Vision scan failed');
  }
  return res.json();
}