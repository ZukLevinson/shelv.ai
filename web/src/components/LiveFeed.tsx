import React, { useEffect, useState, useMemo, useCallback } from 'react';
import axios from 'axios';
import { 
  Activity, 
  Radio, 
  CheckCircle, 
  AlertTriangle, 
  HelpCircle, 
  RotateCw, 
  ArrowDownUp, 
  Clock, 
  Loader2 
} from 'lucide-react';
import { API_BASE_URL, WS_URL } from '../config';

export interface ScanEvent {
  observationId: string;
  serialNumber?: string | null;
  masha?: string | null;
  scannedRoom: {
    id?: string;
    name: string;
    code?: string;
    holder_id?: string;
    holder_name?: string;
  };
  officialItem?: {
    id?: string;
    description: string;
    official_room_name?: string;
    official_holder_id?: string;
    official_holder_name?: string;
  } | null;
  scannedBy: string;
  timestamp: string;
  productNameDetected?: string | null;
  scanStatus?: 'matched' | 'mismatch' | 'unregistered';
}

type SortOrder = 'desc' | 'asc';

const parseTimestamp = (ts: string): number => {
  if (!ts) return 0;
  // SQLite timestamps are "YYYY-MM-DD HH:MM:SS" (UTC)
  const isoStr = ts.includes('T') ? ts : ts.replace(' ', 'T') + (ts.endsWith('Z') ? '' : 'Z');
  const d = new Date(isoStr);
  return isNaN(d.getTime()) ? new Date(ts).getTime() || 0 : d.getTime();
};

const formatTimeDisplay = (ts: string): { primary: string; secondary?: string; full: string } => {
  try {
    const timeMs = parseTimestamp(ts);
    if (!timeMs) return { primary: ts, full: ts };
    const d = new Date(timeMs);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();

    const timeStr = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const fullStr = d.toLocaleString('he-IL');

    if (isToday) {
      return { primary: timeStr, full: fullStr };
    }
    const dateStr = d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
    return { primary: timeStr, secondary: dateStr, full: fullStr };
  } catch {
    return { primary: ts, full: ts };
  }
};

const normalizeEvent = (ev: any): ScanEvent => {
  return {
    observationId: ev.observationId || ev.id || `temp-${Math.random()}`,
    serialNumber: ev.serialNumber ?? ev.serial_number ?? null,
    masha: ev.masha ?? null,
    scannedRoom: ev.scannedRoom || {
      id: ev.scanned_room_id,
      name: ev.scanned_room_name || 'חדר לא ידוע',
      code: ev.scanned_room_code || '',
      holder_id: ev.scanned_holder_id || '',
      holder_name: ev.scanned_holder_name || '',
    },
    officialItem: ev.officialItem !== undefined ? ev.officialItem : (ev.official_item_id ? {
      id: ev.official_item_id,
      description: ev.item_description || 'פריט',
      official_room_name: ev.official_room_name || '',
      official_holder_id: ev.official_holder_id || '',
      official_holder_name: ev.official_holder_name || '',
    } : null),
    scannedBy: ev.scannedBy || ev.scanned_by || 'סורק לא ידוע',
    timestamp: ev.timestamp || ev.scanned_at || new Date().toISOString(),
    productNameDetected: ev.productNameDetected || ev.product_name_detected || ev.item_description || null,
    scanStatus: ev.scanStatus || ev.scan_status,
  };
};

export const LiveFeed: React.FC = () => {
  const [events, setEvents] = useState<ScanEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState<number>(50);
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Fetch past scans chronologically from server
  const fetchScans = useCallback(async (currentLimit: number) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/sweep/scans`, {
        params: { limit: currentLimit },
      });
      const rawScans: any[] = res.data?.scans || [];
      const normalized = rawScans.map(normalizeEvent);
      setEvents(normalized);
    } catch (err) {
      console.error('[LiveFeed] Error fetching past scans:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch on mount or limit change
  useEffect(() => {
    fetchScans(limit);
  }, [fetchScans, limit]);

  // Real-time WebSocket connection
  useEffect(() => {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (message) => {
      try {
        const data = JSON.parse(message.data);
        if (data.type === 'ITEM_SCANNED') {
          const incoming = normalizeEvent(data.payload);
          setEvents((prev) => {
            const filtered = prev.filter((e) => e.observationId !== incoming.observationId);
            const combined = [incoming, ...filtered];
            // Sort by timestamp descending before slicing to ensure the newest items are retained
            combined.sort((a, b) => parseTimestamp(b.timestamp) - parseTimestamp(a.timestamp));
            return combined.slice(0, limit);
          });
        } else if (data.type === 'SCANS_UPDATED') {
          if (data.payload?.deletedObservationId) {
            setEvents((prev) => prev.filter((e) => e.observationId !== data.payload.deletedObservationId));
          } else {
            fetchScans(limit);
          }
        }
      } catch (err) {
        console.error('[LiveFeed] WS parse error:', err);
      }
    };

    return () => ws.close();
  }, [fetchScans, limit]);

  // Strictly sort chronologically based on selected order
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const timeA = parseTimestamp(a.timestamp);
      const timeB = parseTimestamp(b.timestamp);
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });
  }, [events, sortOrder]);

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl sm:rounded-2xl p-3 sm:p-5 space-y-3 sm:space-y-4 shadow-lg sm:shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
          <h3 className="font-bold text-white text-xs sm:text-base">זרם סריקות חי (Live Feed)</h3>
          <span className="text-[10px] sm:text-xs text-gray-400 font-normal">
            ({sortedEvents.length})
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs">
          {/* Connection status */}
          <div 
            className="flex items-center gap-1 text-gray-400 bg-gray-800/60 px-2 py-0.5 rounded-full border border-gray-700/50"
            title={connected ? 'מחובר בזמן אמת לשרת' : 'מתחבר לשרת...'}
          >
            <Radio className={`w-2.5 h-2.5 sm:w-3 sm:h-3 ${connected ? 'text-emerald-400 animate-pulse' : 'text-gray-500'}`} />
            <span className="hidden xs:inline">{connected ? 'מחובר' : 'מתחבר...'}</span>
          </div>

          {/* Limit selector */}
          <div className="flex items-center gap-1 bg-gray-800/80 rounded-lg p-0.5 border border-gray-700/60">
            {[25, 50, 100].map((num) => (
              <button
                key={num}
                onClick={() => setLimit(num)}
                className={`px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs rounded font-medium transition-all ${
                  limit === num 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'text-gray-400 hover:text-gray-200'
                }`}
                title={`הגבלת תצוגה ל-${num} סריקות אחרונות`}
              >
                {num}
              </button>
            ))}
          </div>

          {/* Sort order toggle button */}
          <button
            onClick={toggleSortOrder}
            className="flex items-center gap-1 px-2 py-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white rounded-lg transition-colors text-[10px] sm:text-xs font-medium"
            title={sortOrder === 'desc' ? 'סדר כרונולוגי: מהחדש לישן (לחץ להחלפה)' : 'סדר כרונולוגי: מהישן לחדש (לחץ להחלפה)'}
          >
            <ArrowDownUp className="w-3 h-3 text-cyan-400" />
            <span className="hidden sm:inline">
              {sortOrder === 'desc' ? 'מהחדש לישן' : 'מהישן לחדש'}
            </span>
          </button>

          {/* Refresh button */}
          <button
            onClick={() => fetchScans(limit)}
            disabled={loading}
            className="p-1 sm:p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
            title="רענן סריקות"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Events List */}
      <div className="space-y-2 max-h-80 sm:max-h-96 overflow-y-auto pr-1">
        {loading && events.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-[11px] sm:text-xs text-gray-400 py-8 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
            <span>טוען סריקות אחרונות...</span>
          </div>
        ) : sortedEvents.length === 0 ? (
          <div className="text-[11px] sm:text-xs text-gray-500 py-6 text-center">
            אין סריקות להצגה. ממתין לסריקות ראשונות מהאפליקציה...
          </div>
        ) : (
          sortedEvents.map((ev) => {
            const isMismatch = ev.scanStatus === 'mismatch' || (
              Boolean(ev.officialItem?.official_holder_id) &&
              Boolean(ev.scannedRoom?.holder_id) &&
              ev.officialItem!.official_holder_id !== ev.scannedRoom.holder_id
            );
            const isUnregistered = ev.scanStatus === 'unregistered' || (!ev.officialItem && !ev.masha);
            const timeInfo = formatTimeDisplay(ev.timestamp);

            return (
              <div
                key={ev.observationId}
                className={`p-2.5 sm:p-3 rounded-lg sm:rounded-xl border text-[11px] sm:text-xs flex items-center justify-between gap-2.5 sm:gap-3 transition-all ${
                  isMismatch
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                    : isUnregistered
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                    : 'bg-gray-800/40 border-gray-800 text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                  {isMismatch ? (
                    <span title="אי-התאמה: שייך למחזיק אחר"><AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400 shrink-0" /></span>
                  ) : isUnregistered ? (
                    <span title="פריט לא רשום במצאי הרשמי"><HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" /></span>
                  ) : (
                    <span title="סריקה תואמת"><CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" /></span>
                  )}

                  <div className="min-w-0">
                    <div className="font-semibold text-white truncate">
                      {ev.officialItem?.description || ev.productNameDetected || (ev.masha ? `מסח"א ${ev.masha}` : 'פריט חדש')}
                    </div>

                    <div className="text-[10px] sm:text-[11px] text-gray-400 truncate flex items-center gap-1.5 flex-wrap mt-0.5">
                      {ev.serialNumber ? (
                        <span>
                          S/N: <span className="font-mono text-gray-200">{ev.serialNumber}</span>
                        </span>
                      ) : null}

                      {ev.masha && (!ev.serialNumber || ev.serialNumber !== ev.masha) ? (
                        <span>
                          מסח"א: <span className="font-mono text-gray-300">{ev.masha}</span>
                        </span>
                      ) : null}

                      <span className="text-gray-500">|</span>
                      <span className="text-gray-300 truncate">{ev.scannedRoom.name}</span>
                      {ev.scannedRoom.code ? (
                        <span className="text-gray-500 font-mono">({ev.scannedRoom.code})</span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div 
                  className="text-left text-[11px] text-gray-400 flex-shrink-0"
                  title={timeInfo.full}
                >
                  <div className="truncate max-w-[90px] sm:max-w-none">ע"י {ev.scannedBy}</div>
                  <div className="text-[10px] text-gray-500 font-mono flex items-center gap-1 justify-end">
                    <Clock className="w-2.5 h-2.5 text-gray-500" />
                    <span>{timeInfo.primary}</span>
                    {timeInfo.secondary ? (
                      <span className="text-[9px] text-gray-600">({timeInfo.secondary})</span>
                    ) : null}
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