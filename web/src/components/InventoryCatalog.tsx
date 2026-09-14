import React, { useState, useMemo } from 'react';
import type { OfficialItem } from '../types';
import { Search, Database, FileSpreadsheet, Download, Copy, Check } from 'lucide-react';
import { CategoryLogo } from './CategoryLogo';
import { CATEGORIES, resolveCategory, matchesCategorySearch } from '../constants/categories';
import { useTableSelection } from '../hooks/useTableSelection';
import { TableCheckbox } from './ui/TableCheckbox';
import { TableBulkActionsBar } from './ui/TableBulkActionsBar';
import { exportToExcel } from '../utils/excelExportUtils';

interface Props {
  items: OfficialItem[];
}

export const InventoryCatalog: React.FC<Props> = ({ items }) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedExcel, setSelectedExcel] = useState<string>('all');
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  const uniqueExcelFiles = useMemo(() => {
    const files = new Set<string>();
    items.forEach((i) => {
      if (i.import_filename) files.add(i.import_filename);
    });
    return Array.from(files);
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        (item.serial_number && item.serial_number.toLowerCase().includes(search.toLowerCase())) ||
        (item.masha && item.masha.includes(search)) ||
        matchesCategorySearch(item.category, search) ||
        (item.description || '').toLowerCase().includes(search.toLowerCase()) ||
        (item.holder_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (item.room_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (item.import_filename || '').toLowerCase().includes(search.toLowerCase());

      const matchesCategory =
        selectedCategory === 'all' ||
        resolveCategory(item.category).id === selectedCategory;

      const matchesExcel = selectedExcel === 'all' || (item.import_filename || 'unknown') === selectedExcel;

      return matchesSearch && matchesCategory && matchesExcel;
    });
  }, [items, search, selectedCategory, selectedExcel]);

  const getItemId = (item: OfficialItem) =>
    item.serial_number ? `sn:${item.serial_number}` : `masha:${item.masha}:${item.room_code}:${item.holder_name}`;

  const {
    selectedIds,
    selectedCount,
    presentSelectedCount,
    totalPresentCount,
    isAllSelected,
    isIndeterminate,
    selectedItems,
    toggleRow,
    toggleSelectAll,
    selectAllPresent,
    clearSelection,
    isSelected,
  } = useTableSelection<OfficialItem>({
    items: filtered,
    getItemId,
  });

  const handleExportSelected = () => {
    if (selectedItems.length === 0) return;
    exportToExcel({
      filename: `shelv_selected_items_${new Date().toISOString().slice(0, 10)}`,
      sheetName: 'Selected Items',
      columns: [
        { header: 'סוג', accessor: (item) => resolveCategory(item.category).labelHe },
        { header: 'תיאור ומפרט פריט', accessor: (item) => item.description || '' },
        { header: 'מסח"א (Catalog #)', accessor: (item) => item.masha },
        { header: 'מספר סידורי (S/N)', accessor: (item) => item.serial_number || '' },
        { header: 'חדר נוכחי', accessor: (item) => `${item.room_name} (${item.room_code})` },
        { header: 'בעל מצאי', accessor: (item) => item.holder_name },
        { header: 'מקור אקסל', accessor: (item) => item.import_filename || 'מערכת / סריקה ישירה' },
        { header: 'תאריך סריקה אחרונה', accessor: (item) => new Date(item.last_seen_at).toLocaleDateString('he-IL') },
        { header: 'נסרק ע"י', accessor: (item) => item.last_scanned_by || '' },
      ],
      data: selectedItems,
    });
  };

  const handleCopySerialNumbers = () => {
    const sns = selectedItems
      .map((i) => i.serial_number)
      .filter(Boolean) as string[];
    if (sns.length === 0) {
      alert('אין מספרים סידוריים בפריטים שנבחרו');
      return;
    }
    navigator.clipboard.writeText(sns.join('\n'));
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2500);
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
              placeholder="חפש לפי S/N, מסח״א, תיאור, מקור אקסל..."
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
            {CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.labelHe}
              </option>
            ))}
          </select>

          {uniqueExcelFiles.length > 0 && (
            <select
              value={selectedExcel}
              onChange={(e) => setSelectedExcel(e.target.value)}
              className="bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-emerald-400 focus:outline-none focus:border-emerald-500 w-full sm:w-auto"
            >
              <option value="all">כל קבצי האקסל ({uniqueExcelFiles.length})</option>
              {uniqueExcelFiles.map((fn) => (
                <option key={fn} value={fn}>
                  {fn}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Bulk Actions Bar */}
      <TableBulkActionsBar
        selectedCount={selectedCount}
        totalPresentCount={totalPresentCount}
        itemLabel="פריטים"
        onClearSelection={clearSelection}
        onSelectAllPresent={selectAllPresent}
        isAllSelected={isAllSelected}
      >
        <button
          type="button"
          onClick={handleExportSelected}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white border border-gray-700 text-xs font-medium transition-all cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-emerald-400" />
          <span>ייצא נבחרים לאקסל ({selectedCount})</span>
        </button>

        <button
          type="button"
          onClick={handleCopySerialNumbers}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white border border-gray-700 text-xs font-medium transition-all cursor-pointer"
          title="העתק רשימת מספרים סידוריים ללוח"
        >
          {copiedSuccess ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">הועתק ללוח!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-blue-400" />
              <span>העתק S/N נבחרים</span>
            </>
          )}
        </button>
      </TableBulkActionsBar>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-xs">
          טרם נסרקו פריטים או שלא נמצאו תוצאות לחיפוש.
        </div>
      ) : (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-right text-sm min-w-[750px]">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-xs">
                <th className="pb-3 pr-2 w-10 text-center">
                  <TableCheckbox
                    checked={isAllSelected}
                    indeterminate={isIndeterminate}
                    onChange={toggleSelectAll}
                    title="בחר / בטל בחירת כל הפריטים בסינון הנוכחי"
                  />
                </th>
                <th className="pb-3 pr-2">סוג</th>
                <th className="pb-3">תיאור ומפרט פריט</th>
                <th className="pb-3">מסח\"א (Catalog #)</th>
                <th className="pb-3">מספר סידורי (S/N)</th>
                <th className="pb-3">חדר נוכחי</th>
                <th className="pb-3">בעל מצאי</th>
                <th className="pb-3">מקור אקסל</th>
                <th className="pb-3 pl-2">סריקה אחרונה</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map((item, idx) => {
                const itemId = getItemId(item);
                const selected = isSelected(itemId);

                return (
                  <tr
                    key={item.serial_number || `${item.masha}-${idx}`}
                    className={`hover:bg-gray-800/30 transition-colors ${
                      selected ? 'bg-emerald-950/25 border-r-2 border-r-emerald-500' : ''
                    }`}
                  >
                    <td className="py-3 pr-2 text-center">
                      <TableCheckbox
                        checked={selected}
                        onChange={() => toggleRow(itemId)}
                        title={`בחר פריט ${item.serial_number || item.masha}`}
                      />
                    </td>
                    <td className="py-3 pr-2">
                      <CategoryLogo category={item.category} size="sm" />
                    </td>
                    <td className="py-3">
                      <div className="font-semibold text-white">{item.description}</div>
                      <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
                        <span className="text-emerald-400 font-medium">
                          {resolveCategory(item.category).shortLabelHe}
                        </span>
                        {item.category && item.category !== resolveCategory(item.category).shortLabelHe && (
                          <span className="text-gray-500 font-mono text-[10px]">
                            ({item.category})
                          </span>
                        )}
                      </div>
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
                    <td className="py-3 text-xs">
                      {item.import_filename ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono text-[11px]" title={`מקור: ${item.import_filename}`}>
                          <FileSpreadsheet className="w-3 h-3 text-emerald-400" />
                          <span className="max-w-[140px] truncate">{item.import_filename}</span>
                        </span>
                      ) : (
                        <span className="text-gray-600 text-[11px] italic">מערכת / סריקה ישירה</span>
                      )}
                    </td>
                    <td className="py-3 pl-2 text-xs text-gray-400">
                      <div>{new Date(item.last_seen_at).toLocaleDateString('he-IL')}</div>
                      <div className="text-[10px] text-gray-500">ע\"י {item.last_scanned_by}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};