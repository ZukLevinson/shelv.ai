import React, { useState } from 'react';
import type { OfficialItem } from '../types';
import { Search, Database, Monitor, Laptop, Printer, Tv, Fingerprint, Box } from 'lucide-react';

interface Props {
  items: OfficialItem[];
}

export const InventoryCatalog: React.FC<Props> = ({ items }) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filtered = items.filter((item) => {
    const matchesSearch =
      (item.serial_number && item.serial_number.toLowerCase().includes(search.toLowerCase())) ||
      (item.masha && item.masha.includes(search)) ||
      (item.description || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.holder_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.room_name || '').toLowerCase().includes(search.toLowerCase());

    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const getCategoryIcon = (category: string) => {
    switch ((category || '').toLowerCase()) {
      case 'pc': return <Monitor className="w-4 h-4 text-blue-400" />;
      case 'laptop': return <Laptop className="w-4 h-4 text-purple-400" />;
      case 'printer': return <Printer className="w-4 h-4 text-amber-400" />;
      case 'screen': case 'tv': return <Tv className="w-4 h-4 text-emerald-400" />;
      case 'scanner': return <Fingerprint className="w-4 h-4 text-rose-400" />;
      default: return <Box className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-6 space-y-5 sm:space-y-6 shadow-xl max-w-full overflow-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-emerald-400 shrink-0" />
          <h2 className="text-lg sm:text-xl font-bold text-white">קטלוג פריטים פיזיים שנסרקו</h2>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full lg:w-auto">
          <div className="relative w-full sm:w-64 md:w-72">
            <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="חפש לפי S/N, מסח״א, תיאור או בעלים..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-gray-950 border border-gray-800 rounded-xl pr-9 pl-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 w-full"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-emerald-500 w-full sm:w-auto"
          >
            <option value="all">כל הקטגוריות</option>
            <option value="PC">מחשבים נייחים (PC)</option>
            <option value="Laptop">מחשבים ניידים</option>
            <option value="Screen">מסכים</option>
            <option value="Switch">מתגים</option>
            <option value="Printer">מדפסות</option>
            <option value="TV">טלוויזיות</option>
            <option value="Scanner">סורקי טביעת אצבע</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-xs">
          טרם נסרקו פריטים. בצע סריקה ראשונה באפליקציית הטלפון כדי לראות כאן את הפריטים והמספרים הסידוריים.
        </div>
      ) : (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-right text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-xs">
                <th className="pb-3 pr-2">סוג</th>
                <th className="pb-3">דגם פריט</th>
                <th className="pb-3">מסח\"א (Catalog #)</th>
                <th className="pb-3">מספר סידורי (S/N)</th>
                <th className="pb-3">חדר נוכחי</th>
                <th className="pb-3">בעל מצאי החדר</th>
                <th className="pb-3 pl-2">סריקה אחרונה</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map((item, idx) => (
                <tr key={item.serial_number || `${item.masha}-${idx}`} className="hover:bg-gray-800/30 transition-colors">
                  <td className="py-3 pr-2">
                    <div className="p-2 rounded-lg bg-gray-800/50 inline-block">
                      {getCategoryIcon(item.category)}
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="font-semibold text-white">{item.description}</div>
                    <div className="text-xs text-gray-500">{item.category}</div>
                  </td>
                  <td className="py-3 font-mono text-xs text-emerald-400 font-bold">
                    {item.masha}
                  </td>
                  <td className="py-3 font-mono text-xs text-gray-300">
                    {item.serial_number || <span className="text-gray-500 italic">ללא S/N</span>}
                  </td>
                  <td className="py-3 text-xs text-gray-300">
                    {item.room_name} ({item.room_code})
                  </td>
                  <td className="py-3 text-xs font-medium text-emerald-300">
                    {item.holder_name}
                  </td>
                  <td className="py-3 pl-2 text-xs text-gray-400">
                    <div>{new Date(item.last_seen_at).toLocaleDateString('he-IL')}</div>
                    <div className="text-[10px] text-gray-500">ע\"י {item.last_scanned_by}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};