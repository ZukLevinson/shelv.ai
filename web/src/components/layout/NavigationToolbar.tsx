import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Tag,
  Package,
  ShieldCheck,
  FileSpreadsheet,
  Upload,
  Filter,
  Building2,
  RotateCcw,
  RefreshCw,
  Smartphone,
} from 'lucide-react';
import type { OnlineScannerInfo } from '../../types';

export interface NavigationToolbarProps {
  holdersCount: number;
  mashaCount: number;
  displayItemsCount: number;
  isManager: boolean;
  exporting: boolean;
  onExportExcel: () => void;
  onOpenUploadModal: () => void;
  hasCorrespondentOwner: boolean;
  myInventoryOnly: boolean;
  onToggleMyInventory: () => void;
  onOpenRoomModal: () => void;
  onOpenActionHistory: () => void;
  loading: boolean;
  onRefresh: () => void;
  onlineScannersCount: number;
  onlineScanners: OnlineScannerInfo[];
}

export function NavigationToolbar({
  holdersCount,
  mashaCount,
  displayItemsCount,
  isManager,
  exporting,
  onExportExcel,
  onOpenUploadModal,
  hasCorrespondentOwner,
  myInventoryOnly,
  onToggleMyInventory,
  onOpenRoomModal,
  onOpenActionHistory,
  loading,
  onRefresh,
  onlineScannersCount,
  onlineScanners,
}: NavigationToolbarProps) {
  return (
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
            {holdersCount}
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
            {mashaCount}
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
            {displayItemsCount}
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
          onClick={onExportExcel}
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
            onClick={onOpenUploadModal}
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
          onClick={onToggleMyInventory}
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
          onClick={onOpenRoomModal}
          className="h-8 shrink-0 flex items-center justify-center gap-1.5 px-2.5 text-xs font-medium text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 active:bg-indigo-500/25 border border-indigo-500/30 rounded-lg transition-all cursor-pointer shadow-sm"
          title="ניהול חדרים, שיוך בעלי מצאי והגדרות"
        >
          <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span>חדרים</span>
        </button>

        {/* Action History / Undo */}
        <button
          type="button"
          onClick={onOpenActionHistory}
          className="h-8 shrink-0 flex items-center justify-center gap-1.5 px-2.5 text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 active:bg-amber-500/25 border border-amber-500/30 rounded-lg transition-all cursor-pointer shadow-sm"
          title="צפה בהיסטוריית כל הפעולות ובטל פעולות קודמות"
        >
          <RotateCcw className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>ביטולים</span>
        </button>

        {/* Refresh Data */}
        <button
          type="button"
          onClick={onRefresh}
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
  );
}
