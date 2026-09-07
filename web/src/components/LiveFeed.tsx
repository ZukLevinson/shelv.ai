import React, { useEffect, useState } from 'react';
import { Activity, Radio, CheckCircle, AlertTriangle } from 'lucide-react';
import { WS_URL } from '../config';

interface ScanEvent {
  observationId: string;
  serialNumber: string;
  masha?: string;
  scannedRoom: { name: string; code: string; holder_id: string; holder_name: string };
  officialItem?: {
    description: string;
    official_room_name?: string;
    official_holder_id: string;
    official_holder_name: string;
  };
  scannedBy: string;
  timestamp: string;
}

export const LiveFeed: React.FC = () => {
  const [events, setEvents] = useState<ScanEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (message) => {
      try {
        const data = JSON.parse(message.data);
        if (data.type === 'ITEM_SCANNED') {
          setEvents((prev) => [data.payload, ...prev.slice(0, 19)]);
        }
      } catch (err) {
        console.error('WS parse error', err);
      }
    };

    return () => ws.close();
  }, []);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl sm:rounded-2xl p-3 sm:p-5 space-y-3 sm:space-y-4 shadow-lg sm:shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
          <h3 className="font-bold text-white text-xs sm:text-base">זרם סריקות חי (Live Feed)</h3>
        </div>
        <div className="flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs text-gray-400">
          <Radio className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${connected ? 'text-emerald-400 animate-pulse' : 'text-gray-600'}`} />
          <span className="hidden xs:inline">{connected ? 'מחובר' : 'מתחבר...'}</span>
        </div>
      </div>

      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {events.length === 0 ? (
          <div className="text-[11px] sm:text-xs text-gray-500 py-4 sm:py-6 text-center">
            ממתין לסריקות ראשונות מהאפליקציה הניידת...
          </div>
        ) : (
          events.map((ev) => {
            const isMismatch = ev.officialItem && ev.officialItem.official_holder_id !== ev.scannedRoom.holder_id;

            return (
              <div
                key={ev.observationId}
                className={`p-2.5 sm:p-3 rounded-lg sm:rounded-xl border text-[11px] sm:text-xs flex items-center justify-between gap-2.5 sm:gap-3 transition-all ${
                  isMismatch
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                    : 'bg-gray-800/40 border-gray-800 text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                  {isMismatch ? (
                    <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400 shrink-0" />
                  ) : (
                    <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="font-semibold text-white truncate">
                      {ev.officialItem?.description || 'פריט חדש'}
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-gray-400 truncate">
                      S/N: <span className="font-mono text-gray-300">{ev.serialNumber}</span> | {ev.scannedRoom.name}
                    </div>
                  </div>
                </div>

                <div className="text-left text-[11px] text-gray-400 flex-shrink-0">
                  <div>ע"י {ev.scannedBy}</div>
                  <div className="text-[10px] text-gray-500">
                    {new Date(ev.timestamp).toLocaleTimeString('he-IL')}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};