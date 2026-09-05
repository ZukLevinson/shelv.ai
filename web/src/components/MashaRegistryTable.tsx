import React, { useState } from 'react';
import { Tag, Edit3, Monitor, Laptop, Tv, Printer, Fingerprint, Box } from 'lucide-react';
import { MashaEditModal } from './MashaEditModal';

interface MashaItem {
  masha: string;
  name?: string;
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
  const [search, setSearch] = useState('');

  const getCategoryIcon = (category?: string) => {
    switch ((category || '').toLowerCase()) {
      case 'pc': return <Monitor className="w-4 h-4 text-blue-400" />;
      case 'laptop': return <Laptop className="w-4 h-4 text-purple-400" />;
      case 'screen': case 'tv': return <Tv className="w-4 h-4 text-emerald-400" />;
      case 'printer': return <Printer className="w-4 h-4 text-amber-400" />;
      case 'scanner': return <Fingerprint className="w-4 h-4 text-rose-400" />;
      default: return <Box className="w-4 h-4 text-gray-400" />;
    }
  };

  const filtered = mashaList.filter(m =>
    m.masha.includes(search) ||
    (m.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (m.description || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-6 space-y-5 sm:space-y-6 shadow-xl max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2.5">
          <Tag className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white">הגדרת שמות וסוגי מסח"א</h2>
            <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">
              הענק שם דגם, סוג פריט ותיאור לכל מסח"א כדי שיוצג בצורה ברורה בסריקות ובדשבורד
            </p>
          </div>
        </div>

        <div className="w-full sm:w-auto">
          <input
            type="text"
            placeholder={'חפש לפי מספר מסח"א או דגם...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 w-full sm:w-64"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-10 text-gray-500 text-xs">
          אין כרגע מסחאות במערכת. ייבא קובץ אקסל חתימות כדי להתחיל.
        </div>
      ) : (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-right text-sm min-w-[650px]">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-xs">
                <th className="pb-3 pr-2">סוג</th>
                <th className="pb-3">מסח"א (Catalog #)</th>
                <th className="pb-3">שם פריט ודגם</th>
                <th className="pb-3">מפרט / תיאור נוסף</th>
                <th className="pb-3">סה"כ חתום (אקסל)</th>
                <th className="pb-3">נסרק בפועל</th>
                <th className="pb-3 pl-2 text-left">פעולה</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map((item) => (
                <tr key={item.masha} className="hover:bg-gray-800/30 transition-colors">
                  <td className="py-3.5 pr-2">
                    <div className="p-2 rounded-lg bg-gray-800/50 inline-block">
                      {getCategoryIcon(item.category)}
                    </div>
                  </td>
                  <td className="py-3.5 font-mono text-xs font-bold text-emerald-400">
                    {item.masha}
                  </td>
                  <td className="py-3.5 font-medium text-white">
                    {item.name ? item.name : <span className="text-gray-500 italic">טרם הוגדר שם</span>}
                  </td>
                  <td className="py-3.5 text-xs text-gray-400 max-w-xs truncate">
                    {item.description || '-'}
                  </td>
                  <td className="py-3.5 text-xs font-semibold text-gray-200">
                    {item.total_signed || 0} יח'
                  </td>
                  <td className="py-3.5 text-xs font-semibold text-emerald-400">
                    {item.total_discovered || 0} יח'
                  </td>
                  <td className="py-3.5 pl-2 text-left">
                    <button
                      onClick={() => setSelectedMasha(item)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-emerald-500/20 text-gray-300 hover:text-emerald-300 border border-gray-700 hover:border-emerald-500/30 text-xs transition-all"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>ערוך הגדרה</span>
                    </button>
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
    </div>
  );
};
