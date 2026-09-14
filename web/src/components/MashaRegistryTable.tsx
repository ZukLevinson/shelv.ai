import React, { useState, useMemo } from 'react';
import { Tag, Edit3, Plus, Trash2, Download, Layers } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { MashaEditModal } from './MashaEditModal';
import { MashaCreateModal } from './MashaCreateModal';
import { CategoryLogo } from './CategoryLogo';
import { CATEGORIES, resolveCategory, matchesCategorySearch } from '../constants/categories';
import { useTableSelection } from '../hooks/useTableSelection';
import { TableCheckbox } from './ui/TableCheckbox';
import { TableBulkActionsBar } from './ui/TableBulkActionsBar';
import { exportToExcel } from '../utils/excelExportUtils';

interface MashaItem {
  masha: string;
  category?: string;
  description?: string;
  total_signed: number;
  total_discovered: number;
}

interface Props {
  mashaList: MashaItem[];
  onRefresh: () => void;
}

export const MashaRegistryTable: React.FC<Props> = ({ mashaList, onRefresh }) => {
  const [selectedMasha, setSelectedMasha] = useState<MashaItem | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [deletingMasha, setDeletingMasha] = useState<string | null>(null);

  // Bulk actions state
  const [bulkCategory, setBulkCategory] = useState<string>('');
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    mashaList.forEach((item) => {
      const catId = resolveCategory(item.category).id;
      counts[catId] = (counts[catId] || 0) + 1;
    });
    return counts;
  }, [mashaList]);

  // Categories present in current dataset for quick-filter tabs
  const presentCategories = useMemo(() => {
    return CATEGORIES.filter((c) => (categoryCounts[c.id] || 0) > 0);
  }, [categoryCounts]);

  const filtered = useMemo(() => {
    return mashaList.filter((m) => {
      const resolvedCat = resolveCategory(m.category);
      const matchesCategory = selectedCategoryFilter === 'all' || resolvedCat.id === selectedCategoryFilter;
      const matchesText =
        m.masha.includes(search) ||
        matchesCategorySearch(m.category, search) ||
        (m.description || '').toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesText;
    });
  }, [mashaList, selectedCategoryFilter, search]);

  // Multi-select for filtered masha items
  const {
    selectedCount,
    totalPresentCount,
    isAllSelected,
    isIndeterminate,
    selectedItems,
    toggleRow,
    toggleSelectAll,
    selectAllPresent,
    clearSelection,
    isSelected,
  } = useTableSelection<MashaItem>({
    items: filtered,
    getItemId: (m) => m.masha,
  });

  const handleDeleteMasha = async (masha: string) => {
    if (!window.confirm(`האם אתה בטוח שברצונך למחוק את מסח"א ${masha}?`)) {
      return;
    }

    setDeletingMasha(masha);
    try {
      await axios.delete(`${API_BASE_URL}/api/inventory/masha-registry/${encodeURIComponent(masha)}`);
      onRefresh();
    } catch (err: any) {
      console.error('Error deleting Masha:', err);
      alert(err.response?.data?.error || 'שגיאה במחיקת מסח"א');
    } finally {
      setDeletingMasha(null);
    }
  };

  const handleBulkChangeCategory = async () => {
    if (!bulkCategory || selectedItems.length === 0) return;
    setBulkUpdating(true);
    try {
      for (const item of selectedItems) {
        await axios.post(`${API_BASE_URL}/api/inventory/masha-registry/update`, {
          masha: item.masha,
          category: bulkCategory,
          description: item.description || '',
        });
      }
      setBulkCategory('');
      clearSelection();
      onRefresh();
    } catch (err: any) {
      console.error('Error bulk updating categories:', err);
      alert(err.response?.data?.error || 'שגיאה בעדכון קטגוריות');
    } finally {
      setBulkUpdating(false);
    }
  };

  const eligibleToDelete = useMemo(() => {
    return selectedItems.filter(
      (i) => (i.total_signed || 0) === 0 && (i.total_discovered || 0) === 0
    );
  }, [selectedItems]);

  const handleBulkDelete = async () => {
    if (eligibleToDelete.length === 0) {
      alert('אף אחד מהמסח"אות שנבחרו אינו זמין למחיקה (קיימים פריטים חתומים או שנסרקו).');
      return;
    }
    if (
      !window.confirm(
        `האם אתה בטוח שברצונך למחוק ${eligibleToDelete.length} מסח"אות ללא פריטים פעילים?`
      )
    ) {
      return;
    }

    setBulkDeleting(true);
    try {
      for (const item of eligibleToDelete) {
        await axios.delete(
          `${API_BASE_URL}/api/inventory/masha-registry/${encodeURIComponent(item.masha)}`
        );
      }
      clearSelection();
      onRefresh();
    } catch (err: any) {
      console.error('Error bulk deleting mashas:', err);
      alert('שגיאה במחיקת מסח"אות');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleExportSelected = () => {
    if (selectedItems.length === 0) return;
    exportToExcel({
      filename: `shelv_selected_mashas_${new Date().toISOString().slice(0, 10)}`,
      sheetName: 'Selected Mashas',
      columns: [
        { header: 'מסח"א (Catalog #)', accessor: (m) => m.masha },
        { header: 'סוג / קטגוריה', accessor: (m) => resolveCategory(m.category).labelHe },
        { header: 'תיאור ומפרט', accessor: (m) => m.description || '' },
        { header: 'סה"כ חתום (אקסל)', accessor: (m) => m.total_signed || 0 },
        { header: 'נסרק בפועל', accessor: (m) => m.total_discovered || 0 },
      ],
      data: selectedItems,
    });
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-6 space-y-5 sm:space-y-6 shadow-xl max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2.5">
          <Tag className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white">הגדרת סוגי ומפרטי מסח"א</h2>
            <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">
              הענק סוג פריט ותיאור/מפרט לכל מסח"א כדי שיוצג בצורה ברורה בסריקות ובדשבורד
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <input
            type="text"
            placeholder={'חפש לפי מספר מסח"א, תיאור או קטגוריה...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 w-full sm:w-64"
          />
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>הוסף מסח"א</span>
          </button>
        </div>
      </div>

      {/* Category filter pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setSelectedCategoryFilter('all')}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
            selectedCategoryFilter === 'all'
              ? 'bg-emerald-500 text-white font-bold'
              : 'bg-gray-950 text-gray-400 hover:text-white border border-gray-800'
          }`}
        >
          הכל ({mashaList.length})
        </button>
        {presentCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategoryFilter(cat.id)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
              selectedCategoryFilter === cat.id
                ? 'bg-emerald-500 text-white font-bold'
                : 'bg-gray-950 text-gray-400 hover:text-white border border-gray-800'
            }`}
          >
            <span>{cat.shortLabelHe}</span>
            <span className="text-[10px] opacity-75">({categoryCounts[cat.id] || 0})</span>
          </button>
        ))}
      </div>

      {/* Bulk Actions Bar */}
      <TableBulkActionsBar
        selectedCount={selectedCount}
        totalPresentCount={totalPresentCount}
        itemLabel='מסח"אות'
        onClearSelection={clearSelection}
        onSelectAllPresent={selectAllPresent}
        isAllSelected={isAllSelected}
      >
        <div className="flex items-center gap-1.5">
          <select
            value={bulkCategory}
            onChange={(e) => setBulkCategory(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="">בחר קטגוריה להחלה...</option>
            {CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.labelHe}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleBulkChangeCategory}
            disabled={!bulkCategory || bulkUpdating}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-medium transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{bulkUpdating ? 'מעדכן...' : `החל על ${selectedCount}`}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleExportSelected}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white border border-gray-700 text-xs font-medium transition-all cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-emerald-400" />
          <span>ייצא לאקסל ({selectedCount})</span>
        </button>

        {eligibleToDelete.length > 0 && (
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
            title="מחק מסח״אות שאין עליהן חתימות או סריקות"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{bulkDeleting ? 'מוחק...' : `מחק ${eligibleToDelete.length} ריקות`}</span>
          </button>
        )}
      </TableBulkActionsBar>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-xs space-y-3">
          <p>לא נמצאו סוגי מסח"א התואמים לחיפוש הנוכחי.</p>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>צור מסח"א ראשון</span>
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-right text-sm min-w-[650px]">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-xs">
                <th className="pb-3 pr-2 w-10 text-center">
                  <TableCheckbox
                    checked={isAllSelected}
                    indeterminate={isIndeterminate}
                    onChange={toggleSelectAll}
                    title="בחר / בטל בחירת כל המסח״אות בסינון הנוכחי"
                  />
                </th>
                <th className="pb-3 pr-2">סוג</th>
                <th className="pb-3">מסח"א (Catalog #)</th>
                <th className="pb-3">תיאור ומפרט הפריט</th>
                <th className="pb-3">סה"כ חתום (אקסל)</th>
                <th className="pb-3">נסרק בפועל</th>
                <th className="pb-3 pl-2 text-left">פעולה</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map((item) => {
                const selected = isSelected(item.masha);

                return (
                  <tr
                    key={item.masha}
                    className={`hover:bg-gray-800/30 transition-colors ${
                      selected ? 'bg-emerald-950/25 border-r-2 border-r-emerald-500' : ''
                    }`}
                  >
                    <td className="py-3.5 pr-2 text-center">
                      <TableCheckbox
                        checked={selected}
                        onChange={() => toggleRow(item.masha)}
                        title={`בחר מסח"א ${item.masha}`}
                      />
                    </td>
                    <td className="py-3.5 pr-2">
                      <CategoryLogo category={item.category} size="sm" showLabel={true} />
                    </td>
                    <td className="py-3.5 font-mono text-xs font-bold text-emerald-400">
                      {item.masha}
                    </td>
                    <td className="py-3.5 text-xs text-gray-200 max-w-sm">
                      {item.description ? (
                        item.description
                      ) : (
                        <span className="text-gray-500 italic">טרם הוגדר תיאור</span>
                      )}
                    </td>
                    <td className="py-3.5 text-xs font-semibold text-gray-200">
                      {item.total_signed || 0} יח'
                    </td>
                    <td className="py-3.5 text-xs font-semibold text-emerald-400">
                      {item.total_discovered || 0} יח'
                    </td>
                    <td className="py-3.5 pl-2 text-left">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedMasha(item)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-emerald-500/20 text-gray-300 hover:text-emerald-300 border border-gray-700 hover:border-emerald-500/30 text-xs transition-all cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>ערוך הגדרה</span>
                        </button>

                        {item.total_signed === 0 && item.total_discovered === 0 && (
                          <button
                            onClick={() => handleDeleteMasha(item.masha)}
                            disabled={deletingMasha === item.masha}
                            title={`מחיקת מסח"א ${item.masha}`}
                            className="p-1.5 rounded-lg bg-gray-800 hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 border border-gray-700 hover:border-rose-500/30 text-xs transition-all cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedMasha && (
        <MashaEditModal
          isOpen={true}
          onClose={() => setSelectedMasha(null)}
          mashaItem={selectedMasha}
          onSaved={onRefresh}
        />
      )}

      <MashaCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        existingMashas={mashaList.map((m) => m.masha)}
        onCreated={onRefresh}
      />
    </div>
  );
};
