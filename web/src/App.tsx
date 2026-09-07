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
import { UserManagement } from './components/UserManagement';
import { LoginScreen } from './components/LoginScreen';
import { UndoToast, type UndoToastData } from './components/UndoToast';
import { ActionHistoryModal } from './components/ActionHistoryModal';
import { AuthProvider, useAuth } from './context/AuthContext';
import { 
  ShieldCheck, 
  Upload, 
  RefreshCw, 
  BarChart3, 
  AlertOctagon, 
  CheckCircle2, 
  Tag, 
  Building2, 
  Users, 
  ClipboardList, 
  Smartphone,
  LogOut,
  UserCheck,
  Filter,
  Info,
  RotateCcw
} from 'lucide-react';
import { API_BASE_URL, WS_URL } from './config';

function AppContent() {
  const { user, logout, isManager, isInventoryOwner, isLoading, isAuthenticated } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [items, setItems] = useState<OfficialItem[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyReport | null>(null);
  const [mashaList, setMashaList] = useState<any[]>([]);
  const [holders, setHolders] = useState<InventoryHolder[]>([]);
  const [isUploadModalOpen, setUploadModalOpen] = useState(false);
  const [isRoomModalOpen, setRoomModalOpen] = useState(false);
  const [isActionHistoryOpen, setActionHistoryOpen] = useState(false);
  const [undoToast, setUndoToast] = useState<UndoToastData | null>(null);
  const [activeView, setActiveView] = useState<'overview' | 'scans' | 'holders' | 'masha_registry' | 'items' | 'users'>('overview');
  const [loading, setLoading] = useState(false);
  const [myInventoryOnly, setMyInventoryOnly] = useState(false);

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
    if (!isAuthenticated) return;

    fetchData();

    const ws = new WebSocket(WS_URL);
    ws.onmessage = (message) => {
      try {
        const data = JSON.parse(message.data);
        if (data.type === 'ANOMALIES_UPDATED') {
          setAnomalies(data.payload);
        } else if (data.type === 'ACTION_LOGGED') {
          setUndoToast({
            actionId: data.payload.id,
            description: data.payload.description,
            durationMs: 12000,
          });
        } else if (
          data.type === 'ITEM_SCANNED' ||
          data.type === 'TRANSFER_APPROVED' ||
          data.type === 'INVENTORY_SYNCED' ||
          data.type === 'MASHA_UPDATED' ||
          data.type === 'ROOMS_UPDATED' ||
          data.type === 'HOLDERS_UPDATED' ||
          data.type === 'SCANS_UPDATED' ||
          data.type === 'ACTION_REVERTED'
        ) {
          fetchData();
        }
      } catch (err) {}
    };

    return () => ws.close();
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-xs text-gray-400 font-medium">טוען נתונים...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  // Filtered lists for Inventory Owner when "My Inventory Only" is toggled
  const displayRooms = myInventoryOnly && user?.holder_id
    ? rooms.filter((r) => r.holder_id === user.holder_id)
    : rooms;

  const displayItems = myInventoryOnly && user?.holder_name
    ? items.filter((i) => i.holder_name === user.holder_name)
    : items;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-2.5 sm:p-6 md:p-8 space-y-3.5 sm:space-y-8 max-w-full overflow-x-hidden">
      {/* Top Header */}
      <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 sm:gap-4 border-b border-gray-800/80 pb-3 sm:pb-5">
        <div className="flex items-center justify-between xl:justify-start gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-3 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-xl sm:rounded-2xl shadow-lg shadow-emerald-500/20 text-white font-black text-lg sm:text-2xl shrink-0">
              S
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h1 className="text-lg sm:text-2xl font-black tracking-tight text-white">shelv.ai</h1>
                <span className="px-1.5 py-0.5 rounded-full text-[9px] sm:text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Live Anomaly Engine
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 line-clamp-1">
                מערכת ניהול, סריקת מלאי וזיהוי חריגות בעלי מצאי בארגון
              </p>
            </div>
          </div>

          {/* User Profile Pill (Mobile right-aligned) */}
          <div className="flex items-center gap-2 xl:hidden">
            <button
              onClick={logout}
              title="התנתק מהמערכת"
              className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 sm:gap-3 w-full xl:w-auto">
          {/* Navigation View Switcher */}
          <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 p-1 rounded-xl overflow-x-auto scrollbar-thin max-w-full">
            <button
              onClick={() => setActiveView('overview')}
              className={'whitespace-nowrap px-2.5 py-1.5 text-[11px] sm:text-xs font-medium rounded-lg transition-all shrink-0 ' + (
                activeView === 'overview' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-gray-400 hover:text-white'
              )}
            >
              מבט על וחריגות
            </button>
            <button
              onClick={() => setActiveView('scans')}
              className={'whitespace-nowrap flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] sm:text-xs font-medium rounded-lg transition-all shrink-0 ' + (
                activeView === 'scans' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-gray-400 hover:text-white'
              )}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>ניהול ותחקור סריקות</span>
            </button>
            <button
              onClick={() => setActiveView('holders')}
              className={'whitespace-nowrap flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] sm:text-xs font-medium rounded-lg transition-all shrink-0 ' + (
                activeView === 'holders' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-gray-400 hover:text-white'
              )}
            >
              <Users className="w-3.5 h-3.5" />
              <span>בעלי מצאי ({holders.length})</span>
            </button>
            <button
              onClick={() => setActiveView('masha_registry')}
              className={'whitespace-nowrap flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] sm:text-xs font-medium rounded-lg transition-all shrink-0 ' + (
                activeView === 'masha_registry' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-gray-400 hover:text-white'
              )}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>הגדרת מסחאות ({mashaList.length})</span>
            </button>
            <button
              onClick={() => setActiveView('items')}
              className={'whitespace-nowrap px-2.5 py-1.5 text-[11px] sm:text-xs font-medium rounded-lg transition-all shrink-0 ' + (
                activeView === 'items' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-gray-400 hover:text-white'
              )}
            >
              קטלוג פריטים ({items.length})
            </button>

            {/* Manager-only User Management Tab */}
            {isManager && (
              <button
                onClick={() => setActiveView('users')}
                className={'whitespace-nowrap flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] sm:text-xs font-medium rounded-lg transition-all shrink-0 ' + (
                  activeView === 'users' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'text-purple-400/80 hover:text-purple-300'
                )}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>ניהול משתמשים</span>
              </button>
            )}
          </div>

          {/* Action Buttons & Profile */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-300 hover:text-white bg-gray-900 border border-gray-800 rounded-xl hover:border-gray-700 transition-all cursor-pointer"
            >
              <RefreshCw className={'w-3.5 h-3.5 ' + (loading ? 'animate-spin' : '')} />
              <span>רענן</span>
            </button>

            <button
              onClick={() => setActionHistoryOpen(true)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl transition-all cursor-pointer shadow-sm"
              title="צפה בהיסטוריית כל הפעולות ובטל פעולות קודמות"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>היסטוריית ביטולים ↩️</span>
            </button>

            <button
              onClick={() => setRoomModalOpen(true)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl transition-all cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>ניהול חדרים</span>
            </button>

            {/* Excel Upload - Manager only */}
            {isManager && (
              <button
                onClick={() => setUploadModalOpen(true)}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>ייבוא אקסל</span>
              </button>
            )}

            {/* Public Scanner shortcut */}
            <a
              href="/scanner/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-xl transition-all"
              title="פתח סורק נייד בסמארטפון או בדפדפן"
            >
              <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
              <span>סורק נייד</span>
            </a>

            {/* User Profile Badge & Logout (Desktop) */}
            <div className="hidden xl:flex items-center gap-2 bg-gray-900 border border-gray-800 py-1 px-2.5 rounded-xl text-xs">
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-[10px] font-bold text-white">
                {user?.name.charAt(0).toUpperCase()}
              </div>

              <div className="flex flex-col text-right">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-white max-w-[120px] truncate">{user?.name}</span>
                  {isManager ? (
                    <span className="px-1.5 py-0.2 bg-purple-500/20 text-purple-300 text-[9px] font-bold rounded border border-purple-500/40">
                      הרשאת עריכה
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.2 bg-blue-500/20 text-blue-300 text-[9px] font-bold rounded border border-blue-500/40">
                      בעל מצאי
                    </span>
                  )}
                </div>

                {isInventoryOwner && (
                  <span className="text-[10px] text-gray-400">
                    {user?.holder_name ? `משויך: ${user.holder_name}` : 'לא מקושר לפרופיל'}
                  </span>
                )}
              </div>

              <button
                onClick={logout}
                title="התנתק"
                className="p-1 text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors mr-1 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Inventory Owner Banner if uncoupled */}
      {isInventoryOwner && !user?.holder_id && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-center gap-2.5">
            <Info className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <strong className="font-semibold text-amber-100">חשבונך מוגדר כבעל מצאי אך טרם שויך לפרופיל בעל מצאי במערכת.</strong>
              <p className="text-amber-300/80 text-[11px] mt-0.5">
                ניתן לפנות לבעלי הרשאת עריכה על מנת לקשר את חשבון ה-Google לפרופיל בעל המצאי, או לבצע שיוך דרך טבלת המשתמשים.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Scoped view toggle for Inventory Owners */}
      {isInventoryOwner && user?.holder_id && (
        <div className="flex items-center justify-between bg-gray-900/80 border border-gray-800 px-4 py-2.5 rounded-2xl text-xs">
          <div className="flex items-center gap-2 text-gray-300">
            <UserCheck className="w-4 h-4 text-teal-400" />
            <span>אתה מחובר כבעל המצאי: <strong className="text-teal-300">{user.holder_name}</strong></span>
          </div>

          <button
            onClick={() => setMyInventoryOnly(!myInventoryOnly)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              myInventoryOnly
                ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                : 'bg-gray-950 text-gray-400 border-gray-800 hover:text-white'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>{myInventoryOnly ? 'מציג: הציוד והחדרים שלי' : 'סנן לציוד שלי בלבד'}</span>
          </button>
        </div>
      )}

      {/* Metric Quick Cards */}
      {anomalies && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
            <div className="text-[11px] text-gray-500 mt-1">זוהו ואומתו בסריקות המצאי</div>
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
              <RoomGrid rooms={displayRooms} onManageRooms={() => setRoomModalOpen(true)} />
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
        <InventoryCatalog items={displayItems} />
      )}

      {/* Tab: Users Management (Manager only) */}
      {activeView === 'users' && isManager && (
        <UserManagement holders={holders} onRefreshHolders={fetchData} />
      )}

      {/* Excel Upload Modal */}
      {isManager && (
        <ExcelUploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setUploadModalOpen(false)}
          onSuccess={() => {
            setUploadModalOpen(false);
            fetchData();
          }}
        />
      )}

      {/* Room Management Modal */}
      <RoomManagementModal
        isOpen={isRoomModalOpen}
        onClose={() => setRoomModalOpen(false)}
        onSuccess={() => {
          fetchData();
        }}
        rooms={rooms}
      />

      {/* Instant Undo Toast Notification */}
      <UndoToast
        toast={undoToast}
        onClose={() => setUndoToast(null)}
        onReverted={() => fetchData()}
      />

      {/* Universal Action History & Undo Modal */}
      <ActionHistoryModal
        isOpen={isActionHistoryOpen}
        onClose={() => setActionHistoryOpen(false)}
        onActionReverted={() => fetchData()}
      />
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
