import React from 'react';
import type { Room } from '../types';
import { Layers, CheckCircle2, User, Box, Plus, Building2 } from 'lucide-react';

interface Props {
  rooms: Room[];
  onManageRooms?: () => void;
}

export const RoomGrid: React.FC<Props> = ({ rooms, onManageRooms }) => {
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
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          {rooms.map((room) => {
            const total = room.total_items || 0;
            const percentage = total > 0 ? Math.round((room.swept_items / total) * 100) : 0;
            const isComplete = total > 0 && percentage === 100;

            return (
              <div
                key={room.id}
                className="bg-gray-900 border border-gray-800 rounded-xl sm:rounded-2xl p-2.5 sm:p-5 hover:border-gray-700 transition-all shadow-md relative overflow-hidden group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] sm:text-xs font-mono text-emerald-400 bg-emerald-500/10 px-1.5 sm:px-2 py-0.5 rounded-md inline-block mb-1 border border-emerald-500/20 font-bold truncate max-w-full">
                        {room.code}
                      </div>
                      <h3 className="font-bold text-white text-xs sm:text-base truncate leading-snug">{room.name}</h3>
                    </div>
                    {isComplete ? (
                      <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <Box className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 shrink-0 mt-0.5" />
                    )}
                  </div>

                  <div className="mt-1.5 sm:mt-3 flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-gray-400 truncate">
                    <User className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-500 shrink-0" />
                    <span className="truncate">בעל מצאי: <strong className="text-gray-200">{room.holder_name}</strong></span>
                  </div>
                </div>

                <div className="mt-2.5 sm:mt-4 space-y-1 sm:space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] sm:text-xs font-medium">
                    <span className="text-gray-400">התקדמות</span>
                    <span className={isComplete ? "text-emerald-400 font-bold" : "text-gray-300"}>
                      {room.swept_items}/{total} ({percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 h-1.5 sm:h-2 rounded-full overflow-hidden">
                    <div
                      className={"h-full transition-all duration-500 " + (isComplete ? "bg-emerald-400" : "bg-blue-500")}
                      style={{ width: Math.min(percentage, 100) + "%" }}
                    />
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
