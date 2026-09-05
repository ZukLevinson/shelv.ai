import React, { useState } from 'react';
import type { OfficialItem } from '../types';
import { Search, Database, Monitor, Laptop, Printer, Tv, Box } from 'lucide-react';

interface Props {
  items: OfficialItem[];
}

export const InventoryCatalog: React.FC<Props> = ({ items }) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filtered = items.filter((item) => {
    const matchesSearch =
      item.serial_number.toLowerCase().includes(search.toLowerCase()) ||
      item.masha.includes(search) ||
      item.description.toLowerCase().includes(search.toLowerCase()) ||
      item.holder_name.toLowerCase().includes(search.toLowerCase()) ||
      item.room_name.toLowerCase().includes(search.toLowerCase());

    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'pc': return <Monitor className="w-4 h-4 text-blue-400" />;
      case 'laptop': return <Laptop className="w-4 h-4 text-purple-400" />;
      case 'printer': return <Printer className="w-4 h-4 text-amber-400" />;
      case 'screen': case 'tv': return <Tv className="w-4 h-4 text-emerald-400" />;
      default: return <Box className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-6 shadow-xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-emerald-400" />
          <h2 className="text-xl font-bold text-white">????? ???? ???? (ספר נכסים)</h2>
        </div>

        <div className="flex items-center gap-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="??? ??? S/N, ?????, ????? ?? ?????..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-gray-950 border border-gray-800 rounded-xl pr-9 pl-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 w-72"
            />
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">?? ?????????</option>
            <option value="PC">???ספר נכסים? (PC)</option>
            <option value="Laptop">???ספר נכסים?</option>
            <option value="Screen">????? / ?????</option>
            <option value="Printer">??????</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-xs">
              <th className="pb-3 pr-2">???</th>
              <th className="pb-3">????? ????</th>
              <th className="pb-3">???"? (Catalog #)</th>
              <th className="pb-3">?ספר נכסים? (S/N)</th>
              <th className="pb-3">ספר נכסים</th>
              <th className="pb-3 pl-2">??? ???? ????</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filtered.map((item) => (
              <tr key={item.id} className="hover:bg-gray-800/30 transition-colors">
                <td className="py-3 pr-2">
                  <div className="p-2 rounded-lg bg-gray-800/50 inline-block">
                    {getCategoryIcon(item.category)}
                  </div>
                </td>
                <td className="py-3">
                  <div className="font-semibold text-white">{item.description}</div>
                  <div className="text-xs text-gray-500">{item.category}</div>
                </td>
                <td className="py-3 font-mono text-xs text-emerald-400">
                  {item.masha}
                </td>
                <td className="py-3 font-mono text-xs text-gray-300">
                  {item.serial_number}
                </td>
                <td className="py-3 text-xs text-gray-300">
                  {item.room_name} ({item.room_code})
                </td>
                <td className="py-3 pl-2 text-xs font-medium text-emerald-300">
                  {item.holder_name}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
