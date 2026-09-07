import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Link,
  Navigate,
  useLocation,
} from 'react-router-dom';
import type { Room, OfficialItem, AnomalyReport, InventoryHolder, OnlineScannerInfo } from './types';
import { ExcelUploadModal } from './components/ExcelUploadModal';
import { RoomManagementModal } from './components/RoomManagementModal';
import { LoginScreen } from './components/LoginScreen';
import { UndoToast, type UndoToastData } from './components/UndoToast';
import { ActionHistoryModal } from './components/ActionHistoryModal';
import { VersionBadge } from './components/VersionBadge';
import { OnboardingModal } from './components/OnboardingModal';
import { EditPersonalNumberModal } from './components/EditPersonalNumberModal';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OverviewPage } from './pages/OverviewPage';
import { ScansPage } from './pages/ScansPage';
import { HoldersPage } from './pages/HoldersPage';
import { MashaRegistryPage } from './pages/MashaRegistryPage';
import { ItemsPage } from './pages/ItemsPage';
import { UsersPage } from './pages/UsersPage';
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
  RotateCcw, 
  FileSpreadsheet, 
  Edit2,
  LayoutDashboard,
  Package
} from 'lucide-react';
import { API_BASE_URL, WS_URL } from './config';

interface PageMeta {
  title: string;
  description: string;
}

const PAGE_METADATA: Record<string, PageMeta> = {
  '/': {
    title: 'מבט על וחריגות',
    description: 'מערכת ניהול, סריקת מלאי וזיהוי חריגות בעלי מצאי בארגון',
  },
  '/scans': {
    title: 'ניהול ותחקור סריקות',
    description: 'כלי תחקור וניהול סריקות מלאי בשטח (מי סרק, מה, איפה ומתי)',
  },
  '/holders': {
    title: 'בעלי מצאי',
    description: 'ניהול בעלי מצאי, הקצאת חדרים ומעקב אחר פריטים חתומים בארגון',
  },
  '/masha-registry': {
    title: 'הגדרת מסחאות',
    description: 'הגדרת סוגי ומפרטי מסח"א, קטגוריות ותיאורי ציוד רשמיים',
  },
  '/items': {
    title: 'קטלוג פריטים',
    description: 'מאגר פריטים פיזיים שנסרקו, מספרים סידוריים ופרטי מצאי',
  },
  '/users': {
    title: 'ניהול משתמשים',
    description: 'ניהול משתמשי המערכת, הרשאות ניהול ושיוך בעלי מצאי',
  },
};

const getPageMeta = (pathname: string): PageMeta => {
  if (PAGE_METADATA[pathname]) return PAGE_METADATA[pathname];
  if (pathname === '/overview') return PAGE_METADATA['/'];
  if (pathname === '/masha') return PAGE_METADATA['/masha-registry'];
  if (pathname === '/catalog') return PAGE_METADATA['/items'];
  return {
    title: 'מבט על וחריגות',
    description: 'מערכת ניהול, סריקת מלאי וזיהוי חריגות בעלי מצאי בארגון',
  };
};

function AppContent() {
  const { user, logout, isManager, isInventoryOwner, isScanner, needsOnboarding, isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  const pageMeta = useMemo(() => getPageMeta(location.pathname), [location.pathname]);

  useEffect(() => {
    document.title = `${pageMeta.title} | shelv.ai`;
  }, [pageMeta.title]);

  const [isEditPNModalOpen, setIsEditPNModalOpen] = useState(false);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [items, setItems] = useState<OfficialItem[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyReport | null>(null);
  const [mashaList, setMashaList] = useState<any[]>([]);
  const [holders, setHolders] = useState<InventoryHolder[]>([]);
  const [onlineScannersCount, setOnlineScannersCount] = useState<number>(0);
  const [onlineScanners, setOnlineScanners] = useState<OnlineScannerInfo[]>([]);
  const [isUploadModalOpen, setUploadModalOpen] = useState(false);
  const [isRoomModalOpen, setRoomModalOpen] = useState(false);
  const [isActionHistoryOpen, setActionHistoryOpen] = useState(false);
  const [undoToast, setUndoToast] = useState<UndoToastData | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [myInventoryOnly, setMyInventoryOnly] = useState(false);

  // Filter for "my equipment only" is only enabled if the user has a correspondent inventory owner
  const hasCorrespondentOwner = Boolean(user?.holder_id);

  // Automatically reset the filter if the user does not have a correspondent inventory owner
  useEffect(() => {
    if (!hasCorrespondentOwner && myInventoryOnly) {
      setMyInventoryOnly(false);
    }
  }, [hasCorrespondentOwner, myInventoryOnly]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [roomsRes, itemsRes, anomaliesRes, mashaRes, holdersRes, onlineRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/inventory/rooms`),
        axios.get(`${API_BASE_URL}/api/inventory/items`),
        axios.get(`${API_BASE_URL}/api/anomalies`),
        axios.get(`${API_BASE_URL}/api/inventory/masha-registry`),
        axios.get(`${API_BASE_URL}/api/inventory/holders`),
        axios.get(`${API_BASE_URL}/api/sweep/scanners/online`).catch(() => ({ data: { count: 0, scanners: [] } })),
      ]);
      setRooms(roomsRes.data);
      setItems(itemsRes.data);
      setAnomalies(anomaliesRes.data);
      setMashaList(mashaRes.data);
      setHolders(holdersRes.data);
      if (onlineRes?.data) {
        setOnlineScannersCount(onlineRes.data.count || 0);
        setOnlineScanners(onlineRes.data.scanners || []);
      }
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
        } else if (data.type === 'SCANNERS_ONLINE_CHANGED') {
          setOnlineScannersCount(data.payload?.count || 0);
          setOnlineScanners(data.payload?.scanners || []);
        } else if (data.type === 'CONNECTED' && data.payload?.onlineScannersCount !== undefined) {
          setOnlineScannersCount(data.payload.onlineScannersCount);
          setOnlineScanners(data.payload.scanners || []);
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
      } catch {}
    };

    return () => ws.close();
  }, [isAuthenticated]);

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/inventory/export-excel`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
      link.setAttribute('download', `shelv_inventory_export_${timestamp}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export Excel file:', err);
      alert('שגיאה בייצוא קובץ האקסל. אנא נסה שנית.');
    } finally {
      setExporting(false);
    }
  };

  // Filtered lists for Inventory Owner when "My Inventory Only" is toggled
  const displayRooms = myInventoryOnly && user?.holder_id
    ? rooms.filter((r) => r.holder_id === user.holder_id || (user.holder_name && r.holder_name === user.holder_name))
    : rooms;

  const displayItems = myInventoryOnly && (user?.holder_id || user?.holder_name)
    ? items.filter((i) => (i.holder_id && i.holder_id === user.holder_id) || (user.holder_name && i.holder_name === user.holder_name))
    : items;

  // Filtered anomalies report: when "My Equipment Only" is toggled, compute exact amounts relevant to the signed user
  const displayAnomalies: AnomalyReport | null = useMemo(() => {
    if (!anomalies) return null;
    if (!myInventoryOnly || !user?.holder_id) return anomalies;

    const holderId = user.holder_id;
    const holderName = user.holder_name;

    // Unauthorized transfers relevant to the user:
    // (a) Foreign items scanned in user's rooms (unauthorized presence)
    // (b) User's signed items scanned in foreign rooms
    const filteredUnauthorized = (anomalies.unauthorizedTransfers || []).filter((item) => {
      const isScannedInMyRoom = item.scannedHolderId === holderId ||
        (item as any).scannedRoomHolderId === holderId ||
        (holderName && item.scannedHolderName === holderName);
      const isSupposedlyMine = item.supposedHolderId === holderId ||
        (item as any).officialHolderId === holderId ||
        (holderName && (item.supposedHolderName === holderName || (item as any).officialHolderName === holderName || item.supposedHolderName?.includes(holderName)));
      return isScannedInMyRoom || isSupposedlyMine;
    });

    // Quota discrepancies for the user's signed quota vs discovered
    const filteredQuotas = (anomalies.quotaDiscrepancies || []).filter(
      (d) => d.holderId === holderId || (holderName && d.holderName === holderName)
    );

    // Physical placements discovered in the user's rooms
    const filteredDistribution = (anomalies.discoveredDistribution || []).filter(
      (dist) => dist.holderId === holderId || (holderName && dist.holderName === holderName)
    );

    const totalExpected = displayItems.length;
    const totalDiscovered = displayRooms.reduce((sum, r) => sum + (r.swept_items || 0), 0);
    const totalMissing = filteredQuotas.reduce((sum, d) => sum + Math.abs(d.difference), 0);

    return {
      ...anomalies,
      unauthorizedTransfers: filteredUnauthorized,
      quotaDiscrepancies: filteredQuotas,
      discoveredDistribution: filteredDistribution,
      stats: {
        totalExpectedItems: totalExpected,
        totalDiscoveredItems: totalDiscovered,
        unauthorizedCount: filteredUnauthorized.length,
        missingCount: totalMissing,
        totalOfficialItems: totalExpected,
        totalSweptItems: totalDiscovered,
        internalMovesCount: (anomalies as any).internalMoves
          ? (anomalies as any).internalMoves.filter((m: any) => m.holderId === holderId).length
          : 0,
      },
    };
  }, [anomalies, myInventoryOnly, user, displayItems, displayRooms]);

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

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-2.5 sm:p-6 md:p-8 space-y-3.5 sm:space-y-8 max-w-full overflow-x-hidden">
      {/* Top Header */}
      <header className="flex flex-col gap-3 sm:gap-3.5 border-b border-gray-800/80 pb-3.5 sm:pb-4">
        {/* Tier 1: Brand, Context & User Profile */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3">

            <div>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <Link
                  to="/"
                  className="text-lg sm:text-2xl font-black tracking-tight text-white hover:text-emerald-300 transition-colors shrink-0"
                  title="חזור למבט על"
                >
                  shelv.ai
                </Link>
                <span className="text-gray-600 font-light text-base sm:text-xl select-none" aria-hidden="true">
                  /
                </span>
                <h1 className="text-base sm:text-xl font-bold text-emerald-400 tracking-tight whitespace-nowrap">
                  {pageMeta.title}
                </h1>
                <span className="px-1.5 py-0.5 rounded-full text-[9px] sm:text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Live Anomaly Engine
                </span>
                <VersionBadge variant="compact" />
              </div>
              <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 line-clamp-1">
                {pageMeta.description}
              </p>
            </div>
          </div>

          {/* User Profile Pill & Logout */}
          <div className="flex items-center gap-2 shrink-0">
            {/* User Profile Card (Expanded on sm+, compact avatar on mobile) */}
            <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 h-9 px-2.5 rounded-xl text-xs">
              <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                {user?.name.charAt(0).toUpperCase()}
              </div>

              <div className="hidden sm:flex items-center gap-1.5 text-right">
                <span className="font-semibold text-white max-w-[120px] truncate">{user?.name}</span>
                {isManager ? (
                  <span className="px-1.5 py-0.2 bg-purple-500/20 text-purple-300 text-[9px] font-bold rounded border border-purple-500/40">
                    הרשאת ניהול
                  </span>
                ) : isInventoryOwner ? (
                  <span className="px-1.5 py-0.2 bg-blue-500/20 text-blue-300 text-[9px] font-bold rounded border border-blue-500/40">
                    בעל מצאי
                  </span>
                ) : (
                  <span className="px-1.5 py-0.2 bg-cyan-500/20 text-cyan-300 text-[9px] font-bold rounded border border-cyan-500/40">
                    סורק
                  </span>
                )}
                {isInventoryOwner && user?.personal_number && (
                  <span className="text-gray-500 font-mono text-[10px]">({user.personal_number})</span>
                )}
                {isInventoryOwner && (
                  <button
                    type="button"
                    onClick={() => setIsEditPNModalOpen(true)}
                    title="ערוך מספר אישי (מ''א)"
                    className="p-0.5 text-gray-500 hover:text-emerald-400 rounded transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={logout}
              title="התנתק מהמערכת"
              className="h-9 px-2.5 flex items-center justify-center gap-1.5 text-xs font-medium text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 border border-gray-800 hover:border-rose-500/30 rounded-xl transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">התנתק</span>
            </button>
          </div>
        </div>

        {/* Tier 2: Page Navigation and Action Buttons Toolbar */}
        <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-2.5 pt-1.5 border-t border-gray-800/50">
          {/* Navigation View Switcher (Page buttons) */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 bg-gray-900/90 border border-gray-800/80 p-1 rounded-xl w-full xl:w-auto shrink-0">
            <NavLink
              to="/"
              end
              title="מבט על וחריגות"
              className={({ isActive }) =>
                `h-8 flex items-center justify-center gap-1.5 px-2 text-xs font-medium rounded-lg border transition-all select-none text-center ${
                  isActive
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shadow-sm shadow-emerald-950/40 font-semibold'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 border-transparent hover:border-gray-800'
                }`
              }
            >
              <LayoutDashboard className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">מבט על</span>
            </NavLink>

            <NavLink
              to="/scans"
              title="ניהול ותחקור סריקות"
              className={({ isActive }) =>
                `h-8 flex items-center justify-center gap-1.5 px-2 text-xs font-medium rounded-lg border transition-all select-none text-center ${
                  isActive
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shadow-sm shadow-emerald-950/40 font-semibold'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 border-transparent hover:border-gray-800'
                }`
              }
            >
              <ClipboardList className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">סריקות</span>
            </NavLink>

            <NavLink
              to="/holders"
              title="בעלי מצאי"
              className={({ isActive }) =>
                `h-8 flex items-center justify-center gap-1.5 px-2 text-xs font-medium rounded-lg border transition-all select-none text-center ${
                  isActive
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shadow-sm shadow-emerald-950/40 font-semibold'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 border-transparent hover:border-gray-800'
                }`
              }
            >
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">בעלי מצאי</span>
              <span className="px-1 py-0.2 rounded text-[9px] font-mono leading-none bg-black/40 text-gray-300 border border-gray-700/50 shrink-0">
                {holders.length}
              </span>
            </NavLink>

            <NavLink
              to="/masha-registry"
              title="הגדרת מסחאות"
              className={({ isActive }) =>
                `h-8 flex items-center justify-center gap-1.5 px-2 text-xs font-medium rounded-lg border transition-all select-none text-center ${
                  isActive
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shadow-sm shadow-emerald-950/40 font-semibold'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 border-transparent hover:border-gray-800'
                }`
              }
            >
              <Tag className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">מסחאות</span>
              <span className="px-1 py-0.2 rounded text-[9px] font-mono leading-none bg-black/40 text-gray-300 border border-gray-700/50 shrink-0">
                {mashaList.length}
              </span>
            </NavLink>

            <NavLink
              to="/items"
              title="קטלוג פריטים"
              className={({ isActive }) =>
                `h-8 flex items-center justify-center gap-1.5 px-2 text-xs font-medium rounded-lg border transition-all select-none text-center ${
                  isActive
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shadow-sm shadow-emerald-950/40 font-semibold'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 border-transparent hover:border-gray-800'
                }`
              }
            >
              <Package className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">קטלוג</span>
              <span className="px-1 py-0.2 rounded text-[9px] font-mono leading-none bg-black/40 text-gray-300 border border-gray-700/50 shrink-0">
                {displayItems.length}
              </span>
            </NavLink>

            {/* Manager-only User Management Tab */}
            {isManager && (
              <NavLink
                to="/users"
                title="ניהול משתמשים"
                className={({ isActive }) =>
                  `h-8 flex items-center justify-center gap-1.5 px-2 text-xs font-medium rounded-lg border transition-all select-none text-center ${
                    isActive
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm shadow-purple-950/40 font-semibold'
                      : 'text-purple-400/80 hover:text-purple-300 hover:bg-purple-950/30 border-transparent hover:border-purple-800/40'
                  }`
                }
              >
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">משתמשים</span>
              </NavLink>
            )}
          </div>

          {/* Action Toolbar (Export and so on action buttons) */}
          <div className="flex items-center gap-1 sm:gap-1.5 py-0.5 overflow-x-auto sm:overflow-visible scrollbar-none max-w-full">
            {/* Export to Excel */}
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={exporting}
              className="h-8 shrink-0 flex items-center justify-center gap-1.5 px-2.5 text-xs font-medium text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 active:bg-emerald-500/25 border border-emerald-500/30 rounded-lg transition-all shadow-sm cursor-pointer disabled:opacity-50"
              title="ייצוא כלל הנתונים לקובץ אקסל (סריקות, מצאי רשמי מתוקנן ודגלי חריגות)"
            >
              <FileSpreadsheet className={'w-3.5 h-3.5 text-emerald-400 shrink-0 ' + (exporting ? 'animate-pulse' : '')} />
              <span>{exporting ? 'מייצא...' : 'ייצוא'}</span>
            </button>

            {/* Excel Upload - Manager only */}
            {isManager && (
              <button
                type="button"
                onClick={() => setUploadModalOpen(true)}
                className="h-8 shrink-0 flex items-center justify-center gap-1.5 px-2.5 text-xs font-semibold text-emerald-100 bg-emerald-600/90 hover:bg-emerald-500 active:bg-emerald-600 border border-emerald-500 rounded-lg shadow-sm shadow-emerald-950/40 transition-all cursor-pointer"
                title="ייבוא קובץ אקסל חתימות מצאי"
              >
                <Upload className="w-3.5 h-3.5 shrink-0" />
                <span>ייבוא</span>
              </button>
            )}

            {/* Filter Toggle: "ציוד שלי בלבד" */}
            <button
              type="button"
              onClick={() => {
                if (hasCorrespondentOwner) {
                  setMyInventoryOnly(!myInventoryOnly);
                }
              }}
              disabled={!hasCorrespondentOwner}
              title={
                hasCorrespondentOwner
                  ? (myInventoryOnly ? 'הצג את כלל ציוד הארגון (בטל סינון)' : 'סנן לציוד שלי בלבד')
                  : 'סינון מושבת: המשתמש אינו משויך לבעל מצאי'
              }
              className={`h-8 shrink-0 flex items-center justify-center gap-1.5 px-2.5 text-xs font-medium rounded-lg border transition-all ${
                !hasCorrespondentOwner
                  ? 'bg-gray-900/40 text-gray-600 border-gray-800/60 cursor-not-allowed opacity-50'
                  : myInventoryOnly
                  ? 'bg-teal-500/20 text-teal-300 border-teal-500/40 shadow-sm shadow-teal-500/20 cursor-pointer'
                  : 'bg-gray-900 text-gray-300 hover:text-white hover:bg-gray-800 border-gray-800 hover:border-gray-700 cursor-pointer'
              }`}
            >
              <Filter className={`w-3.5 h-3.5 shrink-0 ${myInventoryOnly ? 'text-teal-400' : hasCorrespondentOwner ? 'text-gray-400' : 'text-gray-600'}`} />
              <span>{myInventoryOnly ? 'מציג שלי' : 'ציוד שלי'}</span>
              {hasCorrespondentOwner && myInventoryOnly && (
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
              )}
            </button>

            {/* Manage Rooms */}
            <button
              type="button"
              onClick={() => setRoomModalOpen(true)}
              className="h-8 shrink-0 flex items-center justify-center gap-1.5 px-2.5 text-xs font-medium text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 active:bg-indigo-500/25 border border-indigo-500/30 rounded-lg transition-all cursor-pointer shadow-sm"
              title="ניהול חדרים, שיוך בעלי מצאי והגדרות"
            >
              <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>חדרים</span>
            </button>

            {/* Action History / Undo */}
            <button
              type="button"
              onClick={() => setActionHistoryOpen(true)}
              className="h-8 shrink-0 flex items-center justify-center gap-1.5 px-2.5 text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 active:bg-amber-500/25 border border-amber-500/30 rounded-lg transition-all cursor-pointer shadow-sm"
              title="צפה בהיסטוריית כל הפעולות ובטל פעולות קודמות"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>ביטולים</span>
            </button>

            {/* Refresh Data */}
            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              className="h-8 shrink-0 flex items-center justify-center gap-1.5 px-2.5 text-xs font-medium text-gray-300 hover:text-white bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-lg transition-all cursor-pointer"
              title="רענן נתוני מערכת"
            >
              <RefreshCw className={'w-3.5 h-3.5 text-gray-400 shrink-0 ' + (loading ? 'animate-spin' : '')} />
              <span>רענן</span>
            </button>

            {/* Public Scanner shortcut with live online scanners indication */}
            <div className="relative group shrink-0">
              <a
                href="/scanner/"
                target="_blank"
                rel="noopener noreferrer"
                className="h-8 shrink-0 flex items-center justify-center gap-1.5 px-2.5 text-xs font-medium text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-lg transition-all shadow-sm"
                title="פתח סורק נייד בסמארטפון או בדפדפן"
              >
                <Smartphone className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>סורק</span>
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold border leading-none transition-all ${
                    onlineScannersCount > 0
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/20'
                      : 'bg-gray-800 text-gray-400 border-gray-700'
                  }`}
                >
                  <span className="relative flex h-1.5 w-1.5">
                    {onlineScannersCount > 0 && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    )}
                    <span
                      className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                        onlineScannersCount > 0 ? 'bg-emerald-400' : 'bg-gray-500'
                      }`}
                    ></span>
                  </span>
                  <span>{onlineScannersCount}</span>
                </span>
              </a>

              {/* Tooltip dropdown on hover if scanners are online */}
              {onlineScanners.length > 0 && (
                <div className="absolute left-0 top-full mt-1.5 hidden group-hover:block z-50 min-w-[210px] p-2.5 bg-gray-900/95 border border-gray-700/80 rounded-xl shadow-2xl text-xs backdrop-blur-md">
                  <div className="font-semibold text-gray-200 mb-1.5 pb-1 border-b border-gray-800 flex items-center justify-between">
                    <span>סורקים מחוברים כעת ({onlineScanners.length})</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {onlineScanners.map((s) => (
                      <div key={s.id} className="flex flex-col text-[11px] bg-gray-950/70 p-1.5 rounded-lg border border-gray-800/80">
                        <div className="flex items-center justify-between text-white font-medium">
                          <span>{s.name || 'סורק'}</span>
                          <span className="text-[9px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/30">אונליין</span>
                        </div>
                        {s.roomName && (
                          <span className="text-gray-400 text-[10px] mt-0.5">חדר: {s.roomName}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Inventory Owner Banner if uncoupled */}
      {isInventoryOwner && !hasCorrespondentOwner && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-start gap-2.5">
            <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold text-amber-100">
                אתה מחובר כבעל מצאי {user?.personal_number ? `(מ"א: ${user.personal_number})` : ''} - פרטי המצאי שלך טרם נקלטו במערכת.
              </strong>
              <p className="text-amber-300/80 text-[11px] mt-0.5">
                ברגע שמנהל יטען את קובץ המצאי או יזין את פרטיך במערכת, החשבון יסונכרן אוטומטית. אם נפלה טעות במספר האישי, ניתן לעדכן אותו כעת.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 flex-wrap">
            <button
              onClick={() => setIsEditPNModalOpen(true)}
              className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer text-xs"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>ערוך מ"א</span>
            </button>
          </div>
        </div>
      )}

      {/* Scoped view toggle for users with a correspondent inventory owner */}
      {hasCorrespondentOwner && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 bg-gray-900/80 border border-gray-800 px-4 py-2.5 rounded-2xl text-xs">
          <div className="flex items-center gap-2 text-gray-300 flex-wrap">
            <UserCheck className="w-4 h-4 text-teal-400 shrink-0" />
            <span>
              אתה מחובר כבעל המצאי: <strong className="text-teal-300">{user?.holder_name}</strong>
              {user?.personal_number && <span className="text-gray-400 font-mono text-[11px] mr-1">(מ"א: {user.personal_number})</span>}
            </span>
            <button
              onClick={() => setIsEditPNModalOpen(true)}
              className="p-1 text-gray-500 hover:text-emerald-400 rounded transition-colors cursor-pointer"
              title="ערוך מספר אישי (מ''א)"
            >
              <Edit2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Scanner Banner for Scanner role */}
      {isScanner && (
        <div className="flex items-center justify-between bg-cyan-500/10 border border-cyan-500/30 px-4 py-2.5 rounded-2xl text-xs text-cyan-200">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-cyan-400" />
            <span>
              אתה מחובר כ<strong>סורק מצאי</strong>. באפשרותך לבצע סריקות פיזיות בשטח או לתחקר סריקות קיימות.
            </span>
          </div>

          <a
            href="/scanner/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer text-xs"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>פתח סורק נייד</span>
          </a>
        </div>
      )}

      {/* Metric Quick Cards (Clickable navigation links) */}
      {displayAnomalies && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          <Link
            to="/items"
            className="bg-gray-900 border border-gray-800 hover:border-blue-500/40 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 shadow-md sm:shadow-lg transition-all block group cursor-pointer"
            title="מעבר לקטלוג הפריטים"
          >
            <div className="flex items-center justify-between text-gray-400 group-hover:text-blue-300 text-[11px] sm:text-xs transition-colors gap-1">
              <span className="truncate">{myInventoryOnly ? 'סך פריטים חתומים שלך' : 'סך פריטים חתומים'}</span>
              <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400 shrink-0" />
            </div>
            <div className="text-lg sm:text-2xl font-black text-white mt-1 sm:mt-1.5 tracking-tight leading-tight">
              {displayAnomalies.stats?.totalExpectedItems ?? 0}
            </div>
          </Link>

          <Link
            to="/scans"
            className="bg-gray-900 border border-gray-800 hover:border-emerald-500/40 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 shadow-md sm:shadow-lg transition-all block group cursor-pointer"
            title="מעבר לניהול ותחקור סריקות"
          >
            <div className="flex items-center justify-between text-gray-400 group-hover:text-emerald-300 text-[11px] sm:text-xs transition-colors gap-1">
              <span className="truncate">{myInventoryOnly ? 'פריטים שנסרקו בחדרייך' : 'פריטים פיזיים שנסרקו'}</span>
              <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
            </div>
            <div className="text-lg sm:text-2xl font-black text-emerald-400 mt-1 sm:mt-1.5 tracking-tight leading-tight">
              {displayAnomalies.stats?.totalDiscoveredItems ?? 0}
            </div>
          </Link>

          <Link
            to="/"
            className="bg-gray-900 border border-rose-900/30 hover:border-rose-500/50 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 shadow-md sm:shadow-lg transition-all block group cursor-pointer"
            title="מעבר למרכז החריגות במבט על"
          >
            <div className="flex items-center justify-between text-rose-300 group-hover:text-rose-200 text-[11px] sm:text-xs transition-colors gap-1">
              <span className="truncate">{myInventoryOnly ? 'העברות ללא חתימה' : 'העברות ללא חתימה'}</span>
              <AlertOctagon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400 shrink-0" />
            </div>
            <div className="text-lg sm:text-2xl font-black text-rose-400 mt-1 sm:mt-1.5 tracking-tight leading-tight">
              {displayAnomalies.stats?.unauthorizedCount ?? 0}
            </div>
          </Link>

          <Link
            to="/items"
            className="bg-gray-900 border border-amber-900/30 hover:border-amber-500/50 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 shadow-md sm:shadow-lg transition-all block group cursor-pointer"
            title="מעבר לקטלוג הפריטים"
          >
            <div className="flex items-center justify-between text-amber-300 group-hover:text-amber-200 text-[11px] sm:text-xs transition-colors gap-1">
              <span className="truncate">{myInventoryOnly ? 'פער חסר מחתימותיך' : 'פער חסר מסך החתימות'}</span>
              <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
            </div>
            <div className="text-lg sm:text-2xl font-black text-amber-400 mt-1 sm:mt-1.5 tracking-tight leading-tight">
              {displayAnomalies.stats?.missingCount ?? 0}
            </div>
          </Link>
        </div>
      )}

      {/* Page Routes with Back & Forth support */}
      <main>
        <Routes>
          <Route
            path="/"
            element={
              <OverviewPage
                rooms={displayRooms}
                anomalies={displayAnomalies}
                onlineScannersCount={onlineScannersCount}
                onlineScanners={onlineScanners}
                onManageRooms={() => setRoomModalOpen(true)}
                onRefresh={fetchData}
                filterHolderId={myInventoryOnly && user?.holder_id ? user.holder_id : undefined}
                filterHolderName={myInventoryOnly && user?.holder_name ? user.holder_name : undefined}
              />
            }
          />
          <Route path="/overview" element={<Navigate to="/" replace />} />
          <Route
            path="/scans"
            element={
              <ScansPage
                rooms={displayRooms}
                onlineScannersCount={onlineScannersCount}
                onlineScanners={onlineScanners}
              />
            }
          />
          <Route
            path="/holders"
            element={
              <HoldersPage
                holders={myInventoryOnly && user?.holder_id ? holders.filter(h => h.id === user.holder_id) : holders}
                rooms={displayRooms}
                onRefresh={fetchData}
                onOpenRoomModal={() => setRoomModalOpen(true)}
              />
            }
          />
          <Route
            path="/masha-registry"
            element={
              <MashaRegistryPage
                mashaList={mashaList}
                onRefresh={fetchData}
              />
            }
          />
          <Route path="/masha" element={<Navigate to="/masha-registry" replace />} />
          <Route
            path="/items"
            element={<ItemsPage items={displayItems} />}
          />
          <Route path="/catalog" element={<Navigate to="/items" replace />} />
          <Route
            path="/users"
            element={
              <UsersPage
                holders={holders}
                onRefreshHolders={fetchData}
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

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

      {/* Onboarding Modal for First Login / Role & מ"א Setup */}
      <OnboardingModal isOpen={needsOnboarding} />

      {/* Edit Personal Number (מ"א) Modal */}
      <EditPersonalNumberModal
        isOpen={isEditPNModalOpen}
        onClose={() => setIsEditPNModalOpen(false)}
        onSuccess={fetchData}
      />

      {/* Footer with version indication and details */}
      <footer className="pt-6 pb-2 border-t border-gray-900/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-400">shelv.ai</span>
          <span>•</span>
          <span>מערכת ניהול, סריקת מלאי וזיהוי חריגות</span>
        </div>
        <VersionBadge variant="detailed" />
      </footer>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
