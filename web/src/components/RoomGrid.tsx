import React from 'react';
import type { Room, AnomalyReport } from '../types';
import { Layers, User, Plus, Building2, ScanLine, Flag } from 'lucide-react';

interface Props {
  rooms: Room[];
  anomalies?: AnomalyReport | null;
  onManageRooms?: () => void;
}

export const RoomGrid: React.FC<Props> = ({ rooms, anomalies, onManageRooms }) => {
  const getRoomFlagsCount = (room: Room): number => {
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
      return count;
    }
    return room.flags_count ?? 0;
  };

  const getRoomScansCount = (room: Room): number => {
    return room.scans_count ?? room.swept_items ?? 0;
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Layers className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
          <h2 className="text-base sm:text-xl font-bold text-white">סטטוס סריקת חדרים</h2>
        </div>

        <button
          onClick={onManageRooms}
          className="flex items-center gap-1 sm:gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 text-[11px] sm:text-xs font-semibold text-emerald-300 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-lg sm:rounded-xl transition-all"
        >
          <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          <span>ניהול והוספת חדרים</span>
        </button>
      </div>

      {rooms.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 border-dashed rounded-xl sm:rounded-2xl p-6 sm:p-8 text-center space-y-3 shadow-md">
          <Building2 className="w-10 h-10 sm:w-12 sm:h-12 text-gray-600 mx-auto" />
          <div className="text-sm sm:text-base font-bold text-white">טרם הוגדרו חדרים במערכת</div>
          <p className="text-[11px] sm:text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
            רשימת החדרים מוגדרת ישירות כאן בדשבורד (ולא דרך אקסל). צור את החדרים הראשונים ושייך אותם לבעלי המצאי כדי להתחיל בסריקות ובייבוא פריטים.
          </p>
          <button
            onClick={onManageRooms}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 sm:px-5 sm:py-2 text-[11px] sm:text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg sm:rounded-xl shadow-lg shadow-emerald-500/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>הוסף חדר ראשון בדשבורד</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          {rooms.map((room) => {
            const scansCount = getRoomScansCount(room);
            const flagsCount = getRoomFlagsCount(room);
            const roomIdDisplay = room.code || room.id;

            return (
              <div
                key={room.id}
                className="bg-gray-900 border border-gray-800 rounded-xl sm:rounded-2xl p-3 sm:p-4 hover:border-gray-700 transition-all shadow-md relative overflow-hidden group flex flex-col justify-between"
              >
                <div>
                  {/* 1. ID */}
                  <div className="mb-2">
                    <span 
                      className="text-[10px] sm:text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md inline-block border border-emerald-500/20 font-bold truncate max-w-full"
                      title={`מזהה חדר: ${roomIdDisplay}`}
                    >
                      {roomIdDisplay}
                    </span>
                  </div>

                  {/* 2. Room Name */}
                  <h3 
                    className="font-bold text-white text-sm sm:text-base truncate leading-snug"
                    title={room.name}
                  >
                    {room.name}
                  </h3>

                  {/* 3. Owner */}
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400 truncate">
                    <User className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                    <span className="truncate">
                      בעל מצאי: <strong className="text-gray-200 font-medium">{room.holder_name}</strong>
                    </span>
                  </div>
                </div>

                {/* 4. Number of scans & 5. Number of flags */}
                <div className="mt-3.5 pt-3 border-t border-gray-800/80 grid grid-cols-2 gap-2">
                  <div className="bg-gray-800/40 border border-gray-800 rounded-lg p-2 flex flex-col justify-between">
                    <div className="flex items-center gap-1 text-[11px] text-gray-400">
                      <ScanLine className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="truncate">מספר סריקות</span>
                    </div>
                    <span className="text-base sm:text-lg font-bold text-white mt-1">
                      {scansCount}
                    </span>
                  </div>

                  <div className={`border rounded-lg p-2 flex flex-col justify-between transition-colors ${
                    flagsCount > 0
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                      : 'bg-gray-800/40 border-gray-800 text-gray-400'
                  }`}>
                    <div className="flex items-center gap-1 text-[11px]">
                      <Flag className={`w-3.5 h-3.5 shrink-0 ${flagsCount > 0 ? 'text-rose-400' : 'text-gray-500'}`} />
                      <span className={`truncate ${flagsCount > 0 ? 'text-rose-300 font-medium' : 'text-gray-400'}`}>
                        מספר דגלים
                      </span>
                    </div>
                    <span className={`text-base sm:text-lg font-bold mt-1 ${
                      flagsCount > 0 ? 'text-rose-400' : 'text-gray-400'
                    }`}>
                      {flagsCount}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
