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
  masha: string;
  serialNumber?: string | null;
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

export interface GeminiSuspicions {
  mashaCandidate?: string | null;
  serialCandidate?: string | null;
  productCandidate?: string | null;
  ownerCandidate?: string | null;
  confidence?: 'high' | 'medium' | 'low' | 'none';
  hint?: string;
}

export interface GeminiFrameQualification {
  isRelevant: boolean;
  probability: 'high' | 'medium' | 'low';
  elementType?: 'masha_label' | 'serial_label' | 'barcode' | 'equipment_label' | 'none';
  hint: string;
}

export interface GeminiScanResponse {
  detected: boolean;
  masha?: string;
  serialNumber?: string;
  productDescription?: string;
  stickerOwner?: string;
  rawText?: string;
  suspicions?: GeminiSuspicions;
}

export async function qualifyWithGemini(
  base64Image: string,
  targetMode?: 'masha' | 'sn' | 'both'
): Promise<GeminiFrameQualification> {
  const res = await fetch(`${SERVER_URL}/api/sweep/gemini-qualify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Image, targetMode }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Gemini Vision qualification failed');
  }
  return res.json();
}

export async function scanWithGemini(base64Image: string, targetMode?: 'masha' | 'sn' | 'both'): Promise<GeminiScanResponse> {
  const res = await fetch(`${SERVER_URL}/api/sweep/gemini-scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Image, targetMode }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Gemini Vision scan failed');
  }
  return res.json();
}