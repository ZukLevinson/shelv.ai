import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';

let wss: WebSocketServer | null = null;

export function initSocketServer(server: http.Server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    console.log('[WS] New client connected');
    ws.send(JSON.stringify({ type: 'CONNECTED', message: 'Connected to shelv.ai real-time event stream' }));

    ws.on('close', () => {
      console.log('[WS] Client disconnected');
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