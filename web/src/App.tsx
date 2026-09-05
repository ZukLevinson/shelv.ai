import { useState, useEffect } from 'react';
import axios from 'axios';
import type { Room, OfficialItem, AnomalyReport } from './types';
import { RoomGrid } from './components/RoomGrid';
import { AnomaliesCenter } from './components/AnomaliesCenter';
import { LiveFeed } from './components/LiveFeed';
import { InventoryCatalog } from './components/InventoryCatalog';
import { ExcelUploadModal } from './components/ExcelUploadModal';
import { ShieldCheck, Upload, RefreshCw, BarChart3, AlertOctagon, CheckCircle2 } from 'lucide-react';

export function App() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [items, setItems] = useState<OfficialItem[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyReport | null>(null);
  const [isUploadModalOpen, setUploadModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [roomsRes, itemsRes, anomaliesRes] = await Promise.all([
        axios.get('http://localhost:4000/api/inventory/rooms'),
        axios.get('http://localhost:4000/api/inventory/items'),
        axios.get('http://localhost:4000/api/anomalies'),
      ]);
      setRooms(roomsRes.data);
      setItems(itemsRes.data);
      setAnomalies(anomaliesRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const ws = new WebSocket('ws://localhost:4000/ws');
    ws.onmessage = (message) => {
      try {
        const data = JSON.parse(message.data);
        if (data.type === 'ANOMALIES_UPDATED') {
          setAnomalies(data.payload);
        } else if (data.type === 'ITEM_SCANNED' || data.type === 'TRANSFER_APPROVED' || data.type === 'INVENTORY_SYNCED') {
          fetchData();
        }
      } catch (err) {}
    };

    return () => ws.close();
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6 md:p-8 space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800/80 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-2xl shadow-lg shadow-emerald-500/20 text-white font-black text-2xl">
            S
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-white">shelv.ai</h1>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Live Anomaly Engine
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              מערכת ניהול, סריקת מלאי וזיהוי חריגות בעלי מצאי בארגון
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-300 hover:text-white bg-gray-900 border border-gray-800 rounded-xl hover:border-gray-700 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>רענן נתונים?</span>
          </button>

          <button
            onClick={() => setUploadModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl shadow-lg shadow-emerald-500/20 transition-all"
          >
            <Upload className="w-4 h-4" />
            <span>?ייבוא קובץ אקסל</span>
          </button>
        </div>
      </header>

      {anomalies && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span>?? ??ייבוא קובץ אקסל</span>
              <BarChart3 className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-black text-white mt-2">
              {anomalies.stats.totalOfficialItems}
            </div>
            <div className="text-[11px] text-gray-500 mt-1">??רענן נתונים ??????</div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span>??רענן נתונים? ?????</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400 mt-2">
              {anomalies.stats.totalSweptItems}
            </div>
            <div className="text-[11px] text-gray-500 mt-1">?רענן נתונים?? ???????</div>
          </div>

          <div className="bg-gray-900 border border-rose-900/30 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between text-rose-300 text-xs">
              <span>העברות ללא חתימה (חריגות)</span>
              <AlertOctagon className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-black text-rose-400 mt-2">
              {anomalies.stats.unauthorizedCount}
            </div>
            <div className="text-[11px] text-rose-300/70 mt-1">רענן נתונים ???? ?? ??? ???? ???</div>
          </div>

          <div className="bg-gray-900 border border-amber-900/30 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between text-amber-300 text-xs">
              <span>????? ??? ???????</span>
              <ShieldCheck className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-amber-400 mt-2">
              {anomalies.stats.internalMovesCount}
            </div>
            <div className="text-[11px] text-amber-300/70 mt-1">באחריות אותו ??? ???? (??? ????)</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RoomGrid rooms={rooms} />
        </div>
        <div>
          <LiveFeed />
        </div>
      </div>

      <AnomaliesCenter anomalies={anomalies} onRefresh={fetchData} />
      <InventoryCatalog items={items} />

      <ExcelUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onSuccess={() => {
          setUploadModalOpen(false);
          fetchData();
        }}
      />
    </div>
  );
}

export default App;
