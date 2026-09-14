import React, { useState, useMemo } from 'react';
import type { Room, AnomalyReport } from '../types';
import { 
  Layers, 
  User, 
  Plus, 
  Building2, 
  ScanLine, 
  AlertTriangle, 
  CheckCircle2, 
  Search, 
  X,
  ShieldAlert
} from 'lucide-react';

interface Props {
  rooms: Room[];
  anomalies?: AnomalyReport | null;
  onManageRooms?: () => void;
}

type FilterMode = 'all' | 'flagged' | 'clean';

export const RoomGrid: React.FC<Props> = ({ rooms, anomalies, onManageRooms }) => {
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Precalculate stats for each room to optimize rendering & filtering
  const roomsWithStats = useMemo(() => {
    return rooms.map((room) => {
      let flagsCount = room.flags_count ?? 0;
      if (anomalies) {
        let count = 0;
        if (anomalies.unauthorizedTransfers) {
          count += anomalies.unauthorizedTransfers.filter(
            (item) => item.scannedRoomId === room.id || (room.name && item.scannedRoomName === room.name)
          ).length;
        }
        if (anomalies.missingItems) {
          count += anomalies.missingItems.filter(
            (item) => item.officialRoomId === room.id || (room.name && item.officialRoomName === room.name)
          ).length;
        }
        if (anomalies.internalMoves) {
          count += anomalies.internalMoves.filter(
            (item) => item.scannedRoomId === room.id || item.officialRoomId === room.id
          ).length;
        }
        flagsCount = count;
      }

      const scansCount = room.scans_count ?? room.swept_items ?? 0;
      const code = room.code || room.id;
      return {
        ...room,
        displayCode: code,
        scansCount,
        flagsCount,
      };
    });
  }, [rooms, anomalies]);

  const flaggedCount = useMemo(() => {
    return roomsWithStats.filter((r) => r.flagsCount > 0).length;
  }, [roomsWithStats]);

  const cleanCount = useMemo(() => {
    return roomsWithStats.filter((r) => r.flagsCount === 0).length;
  }, [roomsWithStats]);

  // Filtered rooms based on search & filter mode
  const filteredRooms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return roomsWithStats.filter((room) => {
      if (filterMode === 'flagged' && room.flagsCount === 0) return false;
      if (filterMode === 'clean' && room.flagsCount > 0) return false;

      if (!q) return true;
      const matchName = (room.name || '').toLowerCase().includes(q);
      const matchCode = (room.displayCode || '').toLowerCase().includes(q);
      const matchHolder = (room.holder_name || '').toLowerCase().includes(q);
      return matchName || matchCode || matchHolder;
    });
  }, [roomsWithStats, filterMode, searchQuery]);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl sm:rounded-2xl p-3 sm:p-5 space-y-3.5 shadow-lg flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Layers className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
          <h3 className="font-bold text-white text-xs sm:text-base">
            סטטוס סריקת חדרים
          </h3>
          <span className="text-[10px] sm:text-xs text-gray-400 font-normal">
            ({rooms.length})
          </span>

          {/* Quick status summary pills */}
          {rooms.length > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 mr-1 text-[11px]">
              <button
                type="button"
                onClick={() => setFilterMode((prev) => (prev === 'clean' ? 'all' : 'clean'))}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full border transition-all ${
                  filterMode === 'clean'
                    ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                }`}
                title="הצג חדרים תקינים בלבד"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>{cleanCount} תקינים</span>
              </button>

              {flaggedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterMode((prev) => (prev === 'flagged' ? 'all' : 'flagged'))}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full border transition-all ${
                    filterMode === 'flagged'
                      ? 'bg-rose-500/25 border-rose-400 text-rose-200'
                      : 'bg-rose-500/15 border-rose-500/30 text-rose-300 hover:bg-rose-500/25'
                  }`}
                  title="הצג חדרים עם חריגות בלבד"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping"></span>
                  <span>{flaggedCount} עם חריגות</span>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs">
          {/* Filter Pills for Mobile */}
          {rooms.length > 0 && (
            <div className="flex sm:hidden items-center gap-1">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                  filterMode === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'
                }`}
              >
                הכל
              </button>
              {flaggedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterMode((prev) => (prev === 'flagged' ? 'all' : 'flagged'))}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                    filterMode === 'flagged' ? 'bg-rose-600 text-white' : 'bg-gray-800 text-rose-400'
                  }`}
                >
                  חריגות ({flaggedCount})
                </button>
              )}
            </div>
          )}

          {/* Manage rooms button */}
          <button
            onClick={onManageRooms}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 text-[11px] sm:text-xs font-semibold text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-lg sm:rounded-xl transition-all"
          >
            <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span>ניהול חדרים</span>
          </button>
        </div>
      </div>

      {/* Filter / Search Bar if more than 3 rooms */}
      {rooms.length > 3 && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-gray-500 absolute right-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="חיפוש לפי שם חדר, קוד או בעל מצאי..."
              className="w-full bg-gray-950/60 border border-gray-800 rounded-lg pr-8 pl-8 py-1 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {filterMode !== 'all' && (
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className="px-2 py-1 text-[10px] sm:text-xs text-gray-400 hover:text-white bg-gray-800/80 border border-gray-700/60 rounded-lg transition-colors whitespace-nowrap"
            >
              איפוס סינון
            </button>
          )}
        </div>
      )}

      {/* Main Content Area */}
      {rooms.length === 0 ? (
        <div className="bg-gray-950/40 border border-gray-800 border-dashed rounded-xl p-6 sm:p-8 text-center space-y-3">
          <Building2 className="w-9 h-9 sm:w-11 sm:h-11 text-gray-600 mx-auto" />
          <div className="text-sm sm:text-base font-bold text-white">טרם הוגדרו חדרים במערכת</div>
          <p className="text-[11px] sm:text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
            רשימת החדרים מוגדרת ישירות כאן בדשבורד. צור את החדרים הראשונים ושייך אותם לבעלי המצאי כדי להתחיל בסריקות ובייבוא פריטים.
          </p>
          <button
            onClick={onManageRooms}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg shadow-lg shadow-emerald-500/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>הוסף חדר ראשון</span>
          </button>
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="bg-gray-950/40 border border-gray-800/60 rounded-xl p-6 text-center space-y-2">
          <ShieldAlert className="w-7 h-7 text-gray-600 mx-auto" />
          <div className="text-xs sm:text-sm font-semibold text-gray-300">
            לא נמצאו חדרים התואמים לקריטריון הסינון
          </div>
          <button
            type="button"
            onClick={() => {
              setFilterMode('all');
              setSearchQuery('');
            }}
            className="text-xs text-emerald-400 hover:underline"
          >
            הצג את כל החדרים
          </button>
        </div>
      ) : (
        /* Scrollable container matching LiveFeed height */
        <div className="max-h-80 sm:max-h-96 overflow-y-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-2.5">
            {filteredRooms.map((room) => {
              const hasFlags = room.flagsCount > 0;

              return (
                <div
                  key={room.id}
                  className={`relative rounded-lg sm:rounded-xl p-2.5 border transition-all flex flex-col justify-between gap-1.5 group ${
                    hasFlags
                      ? 'bg-rose-950/15 border-rose-500/30 hover:border-rose-500/50 hover:bg-rose-950/25'
                      : 'bg-gray-800/40 border-gray-800/80 hover:border-gray-700 hover:bg-gray-800/70'
                  }`}
                >
                  {/* Top Row: Code Badge + Room Name + Status Badge */}
                  <div className="flex items-center justify-between gap-1.5 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded font-bold shrink-0 truncate max-w-[70px]"
                        title={`קוד חדר: ${room.displayCode}`}
                      >
                        {room.displayCode}
                      </span>
                      <h4
                        className="font-bold text-white text-xs sm:text-sm truncate"
                        title={room.name}
                      >
                        {room.name}
                      </h4>
                    </div>

                    {/* Status indicator badge */}
                    {hasFlags ? (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-rose-300 bg-rose-500/20 border border-rose-500/40 px-1.5 sm:px-2 py-0.5 rounded-full shrink-0"
                        title={`${room.flagsCount} חריגות נמצאו בחדר זה`}
                      >
                        <AlertTriangle className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-rose-400 shrink-0" />
                        <span>{room.flagsCount}</span>
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-400/90 bg-emerald-500/10 px-1.5 py-0.5 rounded-full shrink-0 border border-emerald-500/15"
                        title="חדר תקין - ללא חריגות"
                      >
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                        <span className="hidden xs:inline">תקין</span>
                      </span>
                    )}
                  </div>

                  {/* Bottom Row: Holder + Scans Count */}
                  <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-gray-800/60 text-[11px] text-gray-400">
                    <div
                      className="flex items-center gap-1 truncate min-w-0"
                      title={room.holder_name ? `בעל מצאי: ${room.holder_name}` : 'טרם שויך בעל מצאי'}
                    >
                      <User className="w-3 h-3 text-gray-500 shrink-0" />
                      <span className="truncate text-gray-300 text-[10px] sm:text-[11px]">
                        {room.holder_name || <span className="text-gray-500">ללא שיוך</span>}
                      </span>
                    </div>

                    <div
                      className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-900/60 border border-gray-800 rounded text-[10px] sm:text-[11px] font-medium text-cyan-300 shrink-0"
                      title={`סה"כ ${room.scansCount} פריטים נסרקו בחדר`}
                    >
                      <ScanLine className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-cyan-400 shrink-0" />
                      <span>{room.scansCount}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
