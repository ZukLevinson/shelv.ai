import React from 'react';
import { CheckSquare, X } from 'lucide-react';

export interface TableBulkActionsBarProps {
  selectedCount: number;
  totalPresentCount?: number;
  itemLabel?: string;
  onClearSelection: () => void;
  onSelectAllPresent?: () => void;
  isAllSelected?: boolean;
  children?: React.ReactNode;
}

export const TableBulkActionsBar: React.FC<TableBulkActionsBarProps> = ({
  selectedCount,
  totalPresentCount,
  itemLabel = 'שורות',
  onClearSelection,
  onSelectAllPresent,
  isAllSelected = false,
  children,
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="bg-gray-950/95 border border-emerald-500/30 shadow-xl shadow-black/40 rounded-xl p-3 px-4 flex flex-wrap items-center justify-between gap-3 transition-all animate-in fade-in duration-200">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold text-xs">
          <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
          <span>
            נבחרו {selectedCount} {itemLabel}
            {totalPresentCount !== undefined ? ` (מתוך ${totalPresentCount} בסינון)` : ''}
          </span>
        </div>

        {onSelectAllPresent && !isAllSelected && totalPresentCount && totalPresentCount > selectedCount && (
          <button
            type="button"
            onClick={onSelectAllPresent}
            className="text-xs text-emerald-400 hover:text-emerald-300 underline font-medium cursor-pointer transition-colors"
          >
            בחר את כל {totalPresentCount} המוצגים
          </button>
        )}

        <button
          type="button"
          onClick={onClearSelection}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-rose-400 font-medium cursor-pointer transition-colors"
          title="בטל את כל הבחירות"
        >
          <X className="w-3.5 h-3.5" />
          <span>נקה בחירה</span>
        </button>
      </div>

      {children && (
        <div className="flex items-center gap-2 flex-wrap">
          {children}
        </div>
      )}
    </div>
  );
};
