import React from 'react';
import type { Room } from '../types';
import { Layers, CheckCircle2, User, Box } from 'lucide-react';

interface Props {
  rooms: Room[];
}

export const RoomGrid: React.FC<Props> = ({ rooms }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Layers className="w-5 h-5 text-emerald-400" />
        <h2 className="text-xl font-bold text-white">סטטוס סריקת חדרים</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {rooms.map((room) => {
          const percentage = room.total_items > 0 ? Math.round((room.swept_items / room.total_items) * 100) : 0;
          const isComplete = percentage === 100;

          return (
            <div
              key={room.id}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-all shadow-md relative overflow-hidden"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md inline-block mb-1 border border-emerald-500/20">
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
                <span>??? ????: <strong className="text-gray-200">{room.holder_name}</strong></span>
              </div>

              {/* Progress bar */}
              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-gray-400">התקדמות סריקה</span>
                  <span className={isComplete ? 'text-emerald-400' : 'text-gray-300'}>
                    {room.swept_items} / {room.total_items} ({percentage}%)
                  </span>
                </div>
                <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      isComplete ? 'bg-emerald-400' : 'bg-blue-500'
                    }`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
