import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';

export interface ScannerSession {
  id: string;
  name: string;
  roomId?: string | null;
  roomName?: string | null;
  connectedAt: string;
  lastHeartbeat: number;
}

let wss: WebSocketServer | null = null;
const onlineScanners = new Map<string, ScannerSession>();
const wsToScannerId = new Map<WebSocket, string>();

export function getOnlineScanners(): ScannerSession[] {
  const now = Date.now();
  const active: ScannerSession[] = [];
  for (const session of onlineScanners.values()) {
    if (now - session.lastHeartbeat <= 35000) {
      active.push(session);
    }
  }
  return active;
}

export function getOnlineScannersCount(): number {
  return getOnlineScanners().length;
}

export function broadcastOnlineScannersChange() {
  const scanners = getOnlineScanners();
  broadcast('SCANNERS_ONLINE_CHANGED', {
    count: scanners.length,
    scanners,
  });
}

export function registerOrTouchScanner(
  info: {
    scannerId: string;
    scannerName?: string;
    roomId?: string | null;
    roomName?: string | null;
  },
  ws?: WebSocket
) {
  const now = Date.now();
  const existing = onlineScanners.get(info.scannerId);
  const updated: ScannerSession = {
    id: info.scannerId,
    name: info.scannerName || existing?.name || 'סורק',
    roomId: info.roomId !== undefined ? info.roomId : existing?.roomId,
    roomName: info.roomName !== undefined ? info.roomName : existing?.roomName,
    connectedAt: existing?.connectedAt || new Date().toISOString(),
    lastHeartbeat: now,
  };
  onlineScanners.set(info.scannerId, updated);
  if (ws) {
    wsToScannerId.set(ws, info.scannerId);
  }
  broadcastOnlineScannersChange();
  return updated;
}

export function disconnectScanner(scannerId: string) {
  if (onlineScanners.has(scannerId)) {
    onlineScanners.delete(scannerId);
    broadcastOnlineScannersChange();
  }
}

export function initSocketServer(server: http.Server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  // Cleanup interval every 10 seconds for stale scanner heartbeats
  setInterval(() => {
    const now = Date.now();
    let changed = false;
    for (const [id, session] of onlineScanners.entries()) {
      if (now - session.lastHeartbeat > 35000) {
        onlineScanners.delete(id);
        changed = true;
      }
    }
    if (changed) {
      broadcastOnlineScannersChange();
    }
  }, 10000);

  wss.on('connection', (ws: WebSocket) => {
    console.log('[WS] New client connected');
    const scanners = getOnlineScanners();
    ws.send(
      JSON.stringify({
        type: 'CONNECTED',
        message: 'Connected to shelv.ai real-time event stream',
        payload: {
          onlineScannersCount: scanners.length,
          scanners,
        },
      })
    );

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        if (data.type === 'SCANNER_REGISTER' || data.type === 'SCANNER_HELLO') {
          const payload = data.payload || {};
          const scannerId = payload.scannerId || `scan_${Math.random().toString(36).slice(2, 9)}`;
          registerOrTouchScanner(
            {
              scannerId,
              scannerName: payload.scannerName || payload.name,
              roomId: payload.roomId,
              roomName: payload.roomName,
            },
            ws
          );
        } else if (data.type === 'SCANNER_UPDATE') {
          const payload = data.payload || {};
          const scannerId = wsToScannerId.get(ws) || payload.scannerId;
          if (scannerId) {
            registerOrTouchScanner(
              {
                scannerId,
                scannerName: payload.scannerName || payload.name,
                roomId: payload.roomId,
                roomName: payload.roomName,
              },
              ws
            );
          }
        } else if (data.type === 'SCANNER_HEARTBEAT' || data.type === 'SCANNER_PING') {
          const payload = data.payload || {};
          const scannerId = wsToScannerId.get(ws) || payload.scannerId;
          if (scannerId) {
            registerOrTouchScanner({ scannerId }, ws);
          }
        } else if (data.type === 'SCANNER_DISCONNECT') {
          const scannerId = wsToScannerId.get(ws) || data.payload?.scannerId;
          if (scannerId) {
            disconnectScanner(scannerId);
          }
        }
      } catch (e) {
        // Ignore unparseable frames
      }
    });

    ws.on('close', () => {
      console.log('[WS] Client disconnected');
      const scannerId = wsToScannerId.get(ws);
      if (scannerId) {
        wsToScannerId.delete(ws);
        disconnectScanner(scannerId);
      }
    });
  });

  return wss;
}

export function broadcast(event: string, payload: any) {
  if (!wss) return;
  const message = JSON.stringify({ type: event, payload, timestamp: new Date().toISOString() });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}