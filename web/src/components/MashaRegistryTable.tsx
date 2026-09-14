import React, { useState, useMemo } from 'react';
import { Tag, Edit3, Plus, Trash2, Filter } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { MashaEditModal } from './MashaEditModal';
import { MashaCreateModal } from './MashaCreateModal';
import { CategoryLogo } from './CategoryLogo';
import { CATEGORIES, resolveCategory, matchesCategorySearch } from '../constants/categories';

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

  const filtered = mashaList.filter((m) => {
    const resolvedCat = resolveCategory(m.category);
    const matchesCategory = selectedCategoryFilter === 'all' || resolvedCat.id === selectedCategoryFilter;
    const matchesText =
      m.masha.includes(search) ||
      matchesCategorySearch(m.category, search) ||
      (m.description || '').toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesText;
  });

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

      {/* Category Filter Pills */}
      {mashaList.length > 0 && presentCategories.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin pt-1">
          <div className="text-xs text-gray-500 flex items-center gap-1 shrink-0 ml-1">
            <Filter className="w-3.5 h-3.5" />
            <span>סינון לפי סוג:</span>
          </div>

          <button
            type="button"
            onClick={() => setSelectedCategoryFilter('all')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all shrink-0 cursor-pointer ${
              selectedCategoryFilter === 'all'
                ? 'bg-emerald-500 text-white font-bold shadow-md shadow-emerald-500/20'
                : 'bg-gray-950 border border-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-700'
            }`}
          >
            <span>הכל</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${selectedCategoryFilter === 'all' ? 'bg-white/20 text-white' : 'bg-gray-800 text-gray-400'}`}>
              {mashaList.length}
            </span>
          </button>

          {presentCategories.map((cat) => {
            const count = categoryCounts[cat.id] || 0;
            const isSelected = selectedCategoryFilter === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategoryFilter(isSelected ? 'all' : cat.id)}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs transition-all shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-gray-800 border-emerald-500/50 text-white font-bold ring-1 ring-emerald-500/50 shadow-md'
                    : 'bg-gray-950 border border-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-700'
                }`}
              >
                <CategoryLogo category={cat.id} size="xs" />
                <span>{cat.shortLabelHe}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-emerald-500/30 text-emerald-300 font-bold' : 'bg-gray-800 text-gray-400'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 space-y-3">
          <Tag className="w-8 h-8 text-gray-600 mx-auto" />
          <p className="text-xs text-gray-400">
            {search || selectedCategoryFilter !== 'all'
              ? 'לא נמצאו מסחאות התואמות לחיפוש או לסינון הנבחר'
              : 'אין כרגע מסחאות במערכת. צור מסח"א חדש או ייבא קובץ אקסל חתימות.'}
          </p>
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
                <th className="pb-3 pr-2">סוג</th>
                <th className="pb-3">מסח"א (Catalog #)</th>
                <th className="pb-3">תיאור ומפרט הפריט</th>
                <th className="pb-3">סה"כ חתום (אקסל)</th>
                <th className="pb-3">נסרק בפועל</th>
                <th className="pb-3 pl-2 text-left">פעולה</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map((item) => (
                <tr key={item.masha} className="hover:bg-gray-800/30 transition-colors">
                  <td className="py-3.5 pr-2">
                    <CategoryLogo category={item.category} size="sm" showLabel={true} />
                  </td>
                  <td className="py-3.5 font-mono text-xs font-bold text-emerald-400">
                    {item.masha}
                  </td>
                  <td className="py-3.5 text-xs text-gray-200 max-w-sm">
                    {item.description ? item.description : <span className="text-gray-500 italic">טרם הוגדר תיאור</span>}
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
              ))}
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
