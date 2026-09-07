import { getWsUrl, sendScannerHeartbeat, sendScannerDisconnect } from './api';

export interface PresenceState {
  connected: boolean;
  onlineScannersCount: number;
}

export function getOrCreateScannerId(): string {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      let id = window.localStorage.getItem('shelv_scanner_client_id');
      if (!id) {
        id = `scanner_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
        window.localStorage.setItem('shelv_scanner_client_id', id);
      }
      return id;
    } catch {
      // Fallback if localStorage is inaccessible
    }
  }
  return `scanner_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
}

export interface ScannerPresenceOptions {
  getScannerName: () => string;
  getRoomId: () => string | undefined;
  getRoomName: () => string | undefined;
  onStatusChange?: (state: PresenceState) => void;
}

export class ScannerPresenceManager {
  private scannerId: string;
  private ws: WebSocket | null = null;
  private heartbeatTimer: any = null;
  private reconnectTimer: any = null;
  private options: ScannerPresenceOptions;
  private isDestroyed = false;
  private isConnected = false;
  private onlineCount = 0;

  constructor(options: ScannerPresenceOptions) {
    this.scannerId = getOrCreateScannerId();
    this.options = options;
  }

  public start() {
    this.isDestroyed = false;
    this.connectWs();
    this.startHeartbeatLoop();
    this.bindWindowEvents();
  }

  public update() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(
          JSON.stringify({
            type: 'SCANNER_UPDATE',
            payload: {
              scannerId: this.scannerId,
              scannerName: this.options.getScannerName(),
              roomId: this.options.getRoomId() || null,
              roomName: this.options.getRoomName() || null,
            },
          })
        );
      } catch (e) {
        // Fall back to HTTP heartbeat
      }
    }
    // Also touch via HTTP
    sendScannerHeartbeat({
      scannerId: this.scannerId,
      scannerName: this.options.getScannerName(),
      roomId: this.options.getRoomId() || null,
      roomName: this.options.getRoomName() || null,
    });
  }

  private connectWs() {
    if (this.isDestroyed) return;

    try {
      const wsUrl = getWsUrl();
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      ws.onopen = () => {
        if (this.isDestroyed) {
          ws.close();
          return;
        }
        this.isConnected = true;
        this.notifyStatus();

        // Send registration
        ws.send(
          JSON.stringify({
            type: 'SCANNER_REGISTER',
            payload: {
              scannerId: this.scannerId,
              scannerName: this.options.getScannerName(),
              roomId: this.options.getRoomId() || null,
              roomName: this.options.getRoomName() || null,
            },
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'SCANNERS_ONLINE_CHANGED' && data.payload?.count !== undefined) {
            this.onlineCount = data.payload.count;
            this.notifyStatus();
          } else if (data.type === 'CONNECTED' && data.payload?.onlineScannersCount !== undefined) {
            this.onlineCount = data.payload.onlineScannersCount;
            this.notifyStatus();
          }
        } catch {
          // Ignore
        }
      };

      ws.onclose = () => {
        this.isConnected = false;
        this.notifyStatus();
        this.scheduleReconnect();
      };

      ws.onerror = () => {
        // Handled by onclose
      };
    } catch (e) {
      this.isConnected = false;
      this.notifyStatus();
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.isDestroyed) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connectWs();
    }, 3000);
  }

  private startHeartbeatLoop() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    // Initial heartbeat
    sendScannerHeartbeat({
      scannerId: this.scannerId,
      scannerName: this.options.getScannerName(),
      roomId: this.options.getRoomId() || null,
      roomName: this.options.getRoomName() || null,
    });

    this.heartbeatTimer = setInterval(() => {
      if (this.isDestroyed) return;

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(
            JSON.stringify({
              type: 'SCANNER_HEARTBEAT',
              payload: { scannerId: this.scannerId },
            })
          );
        } catch {
          // Fall back to HTTP
        }
      }

      // Periodically ping HTTP as fallback
      sendScannerHeartbeat({
        scannerId: this.scannerId,
        scannerName: this.options.getScannerName(),
        roomId: this.options.getRoomId() || null,
        roomName: this.options.getRoomName() || null,
      });
    }, 15000);
  }

  private notifyStatus() {
    if (this.options.onStatusChange) {
      this.options.onStatusChange({
        connected: this.isConnected,
        onlineScannersCount: this.onlineCount,
      });
    }
  }

  private handleVisibility = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.connectWs();
      }
      this.update();
    }
  };

  private handleUnload = () => {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(
          JSON.stringify({
            type: 'SCANNER_DISCONNECT',
            payload: { scannerId: this.scannerId },
          })
        );
        this.ws.close();
      } catch {}
    }
    sendScannerDisconnect(this.scannerId);
  };

  private bindWindowEvents() {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.handleUnload);
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', this.handleVisibility);
      }
    }
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.handleUnload();

    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.handleUnload);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', this.handleVisibility);
      }
    }
  }
}
