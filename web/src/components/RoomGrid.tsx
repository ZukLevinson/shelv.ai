import React from 'react';
import type { Room } from '../types';
import { Layers, CheckCircle2, User, Box, Plus, Building2 } from 'lucide-react';

interface Props {
  rooms: Room[];
  onManageRooms?: () => void;
}

export const RoomGrid: React.FC<Props> = ({ rooms, onManageRooms }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-emerald-400" />
          <h2 className="text-xl font-bold text-white">×¡×˜×˜×•×¡ ×¡×¨×™×§×ª ×—×“×¨×™×</h2>
        </div>

        <button
          onClick={onManageRooms}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-xl transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>× ×™×”×•×œ ×•×”×•×¡×¤×ª ×—×“×¨×™×</span>
        </button>
      </div>

      {rooms.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 border-dashed rounded-2xl p-8 text-center space-y-3 shadow-md">
          <Building2 className="w-12 h-12 text-gray-600 mx-auto" />
          <div className="text-base font-bold text-white">×˜×¨× ×”×•×’×“×¨×• ×—×“×¨×™× ×‘×ž×¢×¨×›×ª</div>
          <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
            ×¨×©×™×ž×ª ×”×—×“×¨×™× ×ž×•×’×“×¨×ª ×™×©×™×¨×•×ª ×›××Ÿ ×‘×“×©×‘×•×¨×“ (×•×œ× ×“×¨×š ××§×¡×œ). ×¦×•×¨ ××ª ×”×—×“×¨×™× ×”×¨××©×•× ×™× ×•×©×™×™×š ××•×ª× ×œ×‘×¢×œ×™ ×”×ž×¦××™ ×›×“×™ ×œ×”×ª×—×™×œ ×‘×¡×¨×™×§×•×ª ×•×‘×™×™×‘×•× ×¤×¨×™×˜×™×.
          </p>
          <button
            onClick={onManageRooms}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl shadow-lg shadow-emerald-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>×”×•×¡×£ ×—×“×¨ ×¨××©×•×Ÿ ×‘×“×©×‘×•×¨×“</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {rooms.map((room) => {
            const total = room.total_items || 0;
            const percentage = total > 0 ? Math.round((room.swept_items / total) * 100) : 0;
            const isComplete = total > 0 && percentage === 100;

            return (
              <div
                key={room.id}
                className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-all shadow-md relative overflow-hidden group"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md inline-block mb-1 border border-emerald-500/20 font-bold">
                      {room.code}
                    </div>
                    <h3 className="font-bold text-white text-base">{room.name}</h3>
                  </div>
                  {isComplete ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Box className="w-5 h-5 text-gray-600" />
                  )}
                </div>

                <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-400">
                  <User className="w-3.5 h-3.5 text-gray-500" />
                  <span>×‘×¢×œ ×ž×¦××™: <strong className="text-gray-200">{room.holder_name}</strong></span>
                </div>

                <div className="mt-4 space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-gray-400">×”×ª×§×“×ž×•×ª ×¡×¨×™×§×”</span>
                    <span className={isComplete ? "text-emerald-400" : "text-gray-300"}>
                      {room.swept_items} / {total} ({percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
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
