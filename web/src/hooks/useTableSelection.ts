import { useState, useMemo, useCallback } from 'react';

export interface UseTableSelectionOptions<T> {
  items: T[];
  getItemId: (item: T) => string;
}

export interface UseTableSelectionReturn<T> {
  selectedIds: Set<string>;
  selectedCount: number;
  presentSelectedCount: number;
  totalPresentCount: number;
  isAllSelected: boolean;
  isIndeterminate: boolean;
  selectedItems: T[];
  isSelected: (id: string) => boolean;
  toggleRow: (id: string) => void;
  toggleSelectAll: () => void;
  selectAllPresent: () => void;
  clearSelection: () => void;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export function useTableSelection<T>({
  items,
  getItemId,
}: UseTableSelectionOptions<T>): UseTableSelectionReturn<T> {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Present item IDs in the current filtered list
  const presentIds = useMemo(() => {
    return items.map(getItemId);
  }, [items, getItemId]);

  // How many of the currently present items are selected
  const presentSelectedCount = useMemo(() => {
    let count = 0;
    for (const id of presentIds) {
      if (selectedIds.has(id)) count++;
    }
    return count;
  }, [presentIds, selectedIds]);

  const totalPresentCount = items.length;

  const isAllSelected = useMemo(() => {
    return totalPresentCount > 0 && presentSelectedCount === totalPresentCount;
  }, [totalPresentCount, presentSelectedCount]);

  const isIndeterminate = useMemo(() => {
    return presentSelectedCount > 0 && !isAllSelected;
  }, [presentSelectedCount, isAllSelected]);

  // Selected items from the present list
  const selectedItems = useMemo(() => {
    return items.filter((item) => selectedIds.has(getItemId(item)));
  }, [items, getItemId, selectedIds]);

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  const toggleRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Select all ONLY for the present rows (the ones in the filter)
  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (isAllSelected) {
        // Unselect all present rows
        for (const id of presentIds) {
          next.delete(id);
        }
      } else {
        // Select all present rows
        for (const id of presentIds) {
          next.add(id);
        }
      }
      return next;
    });
  }, [isAllSelected, presentIds]);

  const selectAllPresent = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of presentIds) {
        next.add(id);
      }
      return next;
    });
  }, [presentIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    presentSelectedCount,
    totalPresentCount,
    isAllSelected,
    isIndeterminate,
    selectedItems,
    isSelected,
    toggleRow,
    toggleSelectAll,
    selectAllPresent,
    clearSelection,
    setSelectedIds,
  };
}
