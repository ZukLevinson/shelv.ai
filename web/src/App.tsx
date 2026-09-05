import { useState, useEffect } from 'react';
import axios from 'axios';
import type { Room, OfficialItem, AnomalyReport, InventoryHolder } from './types';
import { RoomGrid } from './components/RoomGrid';
import { AnomaliesCenter } from './components/AnomaliesCenter';
import { LiveFeed } from './components/LiveFeed';
import { InventoryCatalog } from './components/InventoryCatalog';
import { ExcelUploadModal } from './components/ExcelUploadModal';
import { MashaRegistryTable } from './components/MashaRegistryTable';
import { RoomManagementModal } from './components/RoomManagementModal';
import { HoldersManagement } from './components/HoldersManagement';
import { ScanManagement } from './components/ScanManagement';
import { ShieldCheck, Upload, RefreshCw, BarChart3, AlertOctagon, CheckCircle2, Tag, Building2, Users, ClipboardList, Smartphone } from 'lucide-react';
import { API_BASE_URL, WS_URL } from './config';

export function App() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [items, setItems] = useState<OfficialItem[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyReport | null>(null);
  const [mashaList, setMashaList] = useState<any[]>([]);
  const [holders, setHolders] = useState<InventoryHolder[]>([]);
  const [isUploadModalOpen, setUploadModalOpen] = useState(false);
  const [isRoomModalOpen, setRoomModalOpen] = useState(false);
  const [activeView, setActiveView] = useState<'overview' | 'scans' | 'holders' | 'masha_registry' | 'items'>('overview');
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [roomsRes, itemsRes, anomaliesRes, mashaRes, holdersRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/inventory/rooms`),
        axios.get(`${API_BASE_URL}/api/inventory/items`),
        axios.get(`${API_BASE_URL}/api/anomalies`),
        axios.get(`${API_BASE_URL}/api/inventory/masha-registry`),
        axios.get(`${API_BASE_URL}/api/inventory/holders`),
      ]);
      setRooms(roomsRes.data);
      setItems(itemsRes.data);
      setAnomalies(anomaliesRes.data);
      setMashaList(mashaRes.data);
      setHolders(holdersRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const ws = new WebSocket(WS_URL);
    ws.onmessage = (message) => {
      try {
        const data = JSON.parse(message.data);
        if (data.type === 'ANOMALIES_UPDATED') {
          setAnomalies(data.payload);
        } else if (
          data.type === 'ITEM_SCANNED' ||
          data.type === 'TRANSFER_APPROVED' ||
          data.type === 'INVENTORY_SYNCED' ||
          data.type === 'MASHA_UPDATED' ||
          data.type === 'ROOMS_UPDATED' ||
          data.type === 'HOLDERS_UPDATED' ||
          data.type === 'SCANS_UPDATED'
        ) {
          fetchData();
        }
      } catch (err) {}
    };

    return () => ws.close();
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6 md:p-8 space-y-8">
      {/* Top Header */}
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
          {/* Navigation View Switcher */}
          <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveView('overview')}
              className={'px-3 py-1.5 text-xs font-medium rounded-lg transition-all ' + (
                activeView === 'overview' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-gray-400 hover:text-white'
              )}
            >
              מבט על וחריגות
            </button>
            <button
              onClick={() => setActiveView('scans')}
              className={'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ' + (
                activeView === 'scans' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-gray-400 hover:text-white'
              )}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>ניהול ותחקור סריקות</span>
            </button>
            <button
              onClick={() => setActiveView('holders')}
              className={'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ' + (
                activeView === 'holders' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-gray-400 hover:text-white'
              )}
            >
              <Users className="w-3.5 h-3.5" />
              <span>בעלי מצאי ({holders.length})</span>
            </button>
            <button
              onClick={() => setActiveView('masha_registry')}
              className={'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ' + (
                activeView === 'masha_registry' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-gray-400 hover:text-white'
              )}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>הגדרת מסחאות ({mashaList.length})</span>
            </button>
            <button
              onClick={() => setActiveView('items')}
              className={'px-3 py-1.5 text-xs font-medium rounded-lg transition-all ' + (
                activeView === 'items' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-gray-400 hover:text-white'
              )}
            >
              קטלוג פריטים שנסרקו ({items.length})
            </button>
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-300 hover:text-white bg-gray-900 border border-gray-800 rounded-xl hover:border-gray-700 transition-all"
          >
            <RefreshCw className={'w-3.5 h-3.5 ' + (loading ? 'animate-spin' : '')} />
            <span>רענן</span>
          </button>

          <button
            onClick={() => setRoomModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl transition-all"
          >
            <Building2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>ניהול חדרים</span>
          </button>

          <button
            onClick={() => setUploadModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl shadow-lg shadow-emerald-500/20 transition-all"
          >
            <Upload className="w-4 h-4" />
            <span>ייבוא אקסל חתימות</span>
          </button>

          <a
            href="/scanner/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-xl transition-all"
            title="פתח סורק נייד בסמארטפון או בדפדפן"
          >
            <Smartphone className="w-4 h-4 text-cyan-400" />
            <span>סורק נייד (PWA)</span>
          </a>
        </div>
      </header>

      {/* Metric Quick Cards */}
      {anomalies && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span>סך פריטים חתומים (באקסל)</span>
              <BarChart3 className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-black text-white mt-2">
              {anomalies.stats?.totalExpectedItems ?? (anomalies.stats as any)?.totalOfficialItems ?? 0}
            </div>
            <div className="text-[11px] text-gray-500 mt-1">מכסת החתימות של בעלי המצאי</div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span>פריטים פיזיים שנסרקו</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400 mt-2">
              {anomalies.stats?.totalDiscoveredItems ?? (anomalies.stats as any)?.totalSweptItems ?? 0}
            </div>
            <div className="text-[11px] text-gray-500 mt-1">זוהו ואומתו בסריקות העובדים</div>
          </div>

          <div className="bg-gray-900 border border-rose-900/30 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between text-rose-300 text-xs">
              <span>העברות ללא חתימה (חריגות)</span>
              <AlertOctagon className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-black text-rose-400 mt-2">
              {anomalies.stats?.unauthorizedCount ?? 0}
            </div>
            <div className="text-[11px] text-rose-300/70 mt-1">פריטים בחדר של בעל מצאי שאין לו חתימה</div>
          </div>

          <div className="bg-gray-900 border border-amber-900/30 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between text-amber-300 text-xs">
              <span>פער חסר מסך החתימות</span>
              <ShieldCheck className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-amber-400 mt-2">
              {anomalies.stats?.missingCount ?? 0}
            </div>
            <div className="text-[11px] text-amber-300/70 mt-1">פריטים שעדיין לא נמצאו בשום סריקה</div>
          </div>
        </div>
      )}

      {/* Tab: Overview */}
      {activeView === 'overview' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <RoomGrid rooms={rooms} onManageRooms={() => setRoomModalOpen(true)} />
            </div>
            <div>
              <LiveFeed />
            </div>
          </div>

          <AnomaliesCenter anomalies={anomalies} onRefresh={fetchData} />
        </>
      )}

      {/* Tab: Scan Management & Investigation */}
      {activeView === 'scans' && (
        <ScanManagement rooms={rooms} />
      )}

      {/* Tab: Holders Management */}
      {activeView === 'holders' && (
        <HoldersManagement
          holders={holders}
          rooms={rooms}
          onRefresh={fetchData}
          onOpenRoomModal={() => setRoomModalOpen(true)}
        />
      )}

      {/* Tab: Masha Registry (Name, Category, Description manager) */}
      {activeView === 'masha_registry' && (
        <MashaRegistryTable mashaList={mashaList} onRefresh={fetchData} />
      )}

      {/* Tab: Items Catalog */}
      {activeView === 'items' && (
        <InventoryCatalog items={items} />
      )}

      {/* Excel Upload Modal */}
      <ExcelUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onSuccess={() => {
          setUploadModalOpen(false);
          fetchData();
        }}
      />

      {/* Room Management Modal */}
      <RoomManagementModal
        isOpen={isRoomModalOpen}
        onClose={() => setRoomModalOpen(false)}
        onSuccess={() => {
          fetchData();
        }}
        rooms={rooms}
      />
    </div>
  );
}

export default App;

