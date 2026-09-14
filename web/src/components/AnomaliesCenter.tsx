import React, { useState } from 'react';
import type { AnomalyReport } from '../types';
import { AlertTriangle, HelpCircle, Check, MapPin, UserCheck, ShieldAlert, BarChart3, Download } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { CategoryLogo } from './CategoryLogo';
import { useTableSelection } from '../hooks/useTableSelection';
import { TableCheckbox } from './ui/TableCheckbox';
import { TableBulkActionsBar } from './ui/TableBulkActionsBar';
import { exportToExcel } from '../utils/excelExportUtils';

interface Props {
  anomalies: AnomalyReport | null;
  onRefresh: () => void;
}

export const AnomaliesCenter: React.FC<Props> = ({ anomalies, onRefresh }) => {
  const [activeTab, setActiveTab] = useState<'unauthorized' | 'discrepancies' | 'distribution'>('unauthorized');
  const [resolvingSn, setResolvingSn] = useState<string | null>(null);
  const [bulkApproving, setBulkApproving] = useState(false);

  const unauthorizedTransfers = anomalies?.unauthorizedTransfers || [];
  const quotaDiscrepancies = anomalies?.quotaDiscrepancies || [];
  const discoveredDistribution = anomalies?.discoveredDistribution || [];

  const handleApproveTransfer = async (serialNumber: string, targetHolderId: string) => {
    setResolvingSn(serialNumber);
    try {
      await axios.post(`${API_BASE_URL}/api/anomalies/approve-transfer`, {
        serialNumber,
        targetHolderId,
        resolvedBy: 'משתמש מערכת',
      });
      onRefresh();
    } catch (err) {
      console.error('Failed to approve transfer', err);
    } finally {
      setResolvingSn(null);
    }
  };

  const getTransferItemId = (item: any) => item.serialNumber || `${item.masha}-${item.scannedHolderId}`;

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
  } = useTableSelection({
    items: unauthorizedTransfers,
    getItemId: getTransferItemId,
  });

  const handleBulkApproveTransfer = async () => {
    const approvable = selectedItems.filter((i) => Boolean(i.serialNumber));
    if (approvable.length === 0) {
      alert('אף אחד מהפריטים שנבחרו אינו בעל מספר סידורי הניתן להעברה אוטומטית.');
      return;
    }
    if (
      !window.confirm(
        `האם אתה בטוח שברצונך לאשר ולהעביר חתימה עבור ${approvable.length} פריטים שנבחרו?`
      )
    ) {
      return;
    }

    setBulkApproving(true);
    try {
      for (const item of approvable) {
        await axios.post(`${API_BASE_URL}/api/anomalies/approve-transfer`, {
          serialNumber: item.serialNumber,
          targetHolderId: item.scannedHolderId,
          resolvedBy: 'משתמש מערכת',
        });
      }
      clearSelection();
      onRefresh();
    } catch (err: any) {
      console.error('Failed to bulk approve transfers:', err);
      alert('שגיאה באישור העברות');
    } finally {
      setBulkApproving(false);
    }
  };

  const handleExportSelectedTransfers = () => {
    if (selectedItems.length === 0) return;
    exportToExcel({
      filename: `shelv_selected_anomalies_${new Date().toISOString().slice(0, 10)}`,
      sheetName: 'Selected Anomalies',
      columns: [
        { header: 'תיאור פריט', accessor: (item) => item.description || '' },
        { header: 'מסח"א', accessor: (item) => item.masha },
        { header: 'מספר סידורי (S/N)', accessor: (item) => item.serialNumber || '' },
        { header: 'נמצא בחדר (סריקה)', accessor: (item) => item.scannedRoomName },
        { header: 'בעל המצאי של החדר', accessor: (item) => item.scannedHolderName },
        { header: 'חתימה משוערת', accessor: (item) => item.supposedHolderName || '' },
        { header: 'נסרק ע"י', accessor: (item) => item.scannedBy },
        { header: 'זמן סריקה', accessor: (item) => new Date(item.scannedAt).toLocaleString('he-IL') },
      ],
      data: selectedItems,
    });
  };

  if (!anomalies) return null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl sm:rounded-2xl p-3 sm:p-6 space-y-3 sm:space-y-6 shadow-lg sm:shadow-xl max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 border-b border-gray-800 pb-3 sm:pb-4">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <ShieldAlert className="w-4 h-4 sm:w-6 sm:h-6 text-rose-400 shrink-0" />
          <h2 className="text-base sm:text-xl font-bold text-white">מרכז חריגות וחלוקת מצאי</h2>
        </div>

        <div className="flex gap-1 p-0.5 sm:p-1 bg-gray-950 rounded-lg sm:rounded-xl border border-gray-800 overflow-x-auto scrollbar-thin max-w-full">
          <button
            onClick={() => setActiveTab('unauthorized')}
            className={'flex items-center gap-1 sm:gap-1.5 px-2.5 py-1 sm:px-4 sm:py-2 text-[11px] sm:text-sm font-medium rounded-md sm:rounded-lg transition-all shrink-0 whitespace-nowrap ' + (
              activeTab === 'unauthorized'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'text-gray-400 hover:text-white'
            )}
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>ציוד זר בחדר</span>
            <span className="px-1.5 py-0.2 text-[10px] sm:text-xs rounded-full bg-rose-500/30 text-rose-200 font-bold">
              {unauthorizedTransfers.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('discrepancies')}
            className={'flex items-center gap-1 sm:gap-1.5 px-2.5 py-1 sm:px-4 sm:py-2 text-[11px] sm:text-sm font-medium rounded-md sm:rounded-lg transition-all shrink-0 whitespace-nowrap ' + (
              activeTab === 'discrepancies'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-gray-400 hover:text-white'
            )}
          >
            <HelpCircle className="w-3.5 h-3.5 shrink-0" />
            <span>פערי חתימות</span>
            <span className="px-1.5 py-0.2 text-[10px] sm:text-xs rounded-full bg-amber-500/30 text-amber-200 font-bold">
              {quotaDiscrepancies.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('distribution')}
            className={'flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium rounded-lg transition-all shrink-0 whitespace-nowrap ' + (
              activeTab === 'distribution'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                : 'text-gray-400 hover:text-white'
            )}
          >
            <BarChart3 className="w-4 h-4 shrink-0" />
            <span>פריסה פיזית</span>
            <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/30 text-blue-200 font-bold">
              {discoveredDistribution.length}
            </span>
          </button>
        </div>
      </div>

      {/* Tab 1: Unauthorized Items Found in a Room */}
      {activeTab === 'unauthorized' && (
        <div className="space-y-4">
          {/* Bulk Actions Bar */}
          <TableBulkActionsBar
            selectedCount={selectedCount}
            totalPresentCount={totalPresentCount}
            itemLabel="חריגות"
            onClearSelection={clearSelection}
            onSelectAllPresent={selectAllPresent}
            isAllSelected={isAllSelected}
          >
            <button
              type="button"
              onClick={handleExportSelectedTransfers}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white border border-gray-700 text-xs font-medium transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>ייצא לאקסל ({selectedCount})</span>
            </button>

            <button
              type="button"
              onClick={handleBulkApproveTransfer}
              disabled={bulkApproving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>{bulkApproving ? 'מאשר ומעביר...' : `אשר והעבר חתימה ל-${selectedCount} פריטים`}</span>
            </button>
          </TableBulkActionsBar>

          {unauthorizedTransfers.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">
              <Check className="w-12 h-12 text-emerald-400 mx-auto mb-2 opacity-80" />
              <p>לא נמצאו פריטים בחדרים של בעלי מצאי ללא חתימה מתאימה.</p>
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-right text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-xs">
                    <th className="pb-3 pr-2 w-10 text-center">
                      <TableCheckbox
                        checked={isAllSelected}
                        indeterminate={isIndeterminate}
                        onChange={toggleSelectAll}
                        title="בחר / בטל בחירת כל החריגות בסינון"
                      />
                    </th>
                    <th className="pb-3 pr-2">תיאור ומסח\"א</th>
                    <th className="pb-3">מספר סידורי (S/N)</th>
                    <th className="pb-3">נמצא בחדר (סריקה)</th>
                    <th className="pb-3">בעל המצאי של החדר</th>
                    <th className="pb-3">חתימה משוערת</th>
                    <th className="pb-3">נסרק ע\"י</th>
                    <th className="pb-3 pl-2 text-left">פעולה</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {unauthorizedTransfers.map((item, idx) => {
                    const itemId = getTransferItemId(item);
                    const selected = isSelected(itemId);

                    return (
                      <tr
                        key={item.serialNumber || `${item.masha}-${idx}`}
                        className={`hover:bg-gray-800/30 transition-colors ${
                          selected ? 'bg-emerald-950/25 border-r-2 border-r-emerald-500' : ''
                        }`}
                      >
                        <td className="py-4 pr-2 text-center">
                          <TableCheckbox
                            checked={selected}
                            onChange={() => toggleRow(itemId)}
                            title={`בחר פריט ${item.serialNumber || item.masha}`}
                          />
                        </td>
                      <td className="py-4 pr-2">
                        <div className="flex items-center gap-2.5">
                          <CategoryLogo category={item.category} size="xs" />
                          <div>
                            <div className="font-semibold text-white">{item.description}</div>
                            <div className="text-xs font-mono text-emerald-400">מסח\"א: {item.masha}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 font-mono text-xs text-gray-300">
                        {item.serialNumber || <span className="text-gray-500 italic">ללא S/N</span>}
                      </td>
                      <td className="py-4 text-xs">
                        <div className="flex items-center gap-1 text-white font-medium">
                          <MapPin className="w-3.5 h-3.5 text-rose-400" />
                          <span>{item.scannedRoomName}</span>
                        </div>
                      </td>
                      <td className="py-4 text-xs font-bold text-rose-400">
                        {item.scannedHolderName}
                        <div className="text-[10px] text-gray-400 font-normal">
                          (אין חתימה על מסח\"א זו)
                        </div>
                      </td>
                      <td className="py-4 text-xs text-amber-300 font-medium">
                        {item.supposedHolderName}
                      </td>
                      <td className="py-4 text-xs text-gray-400">
                        <div>{item.scannedBy}</div>
                        <div className="text-[10px] text-gray-500">{new Date(item.scannedAt).toLocaleTimeString('he-IL')}</div>
                      </td>
                      <td className="py-4 pl-2 text-left">
                        {item.serialNumber ? (
                          <button
                            onClick={() => handleApproveTransfer(item.serialNumber!, item.scannedHolderId)}
                            disabled={resolvingSn === item.serialNumber}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-medium transition-all"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>העבר חתימה ל-{item.scannedHolderName}</span>
                          </button>
                        ) : (
                          <span className="text-gray-500 text-xs italic">עדכון ידני לפי מסח"א</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Quota Discrepancies (Signed Quantity vs Discovered Quantity) */}
      {activeTab === 'discrepancies' && (
        <div className="space-y-4">
          {quotaDiscrepancies.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">
              <Check className="w-12 h-12 text-emerald-400 mx-auto mb-2 opacity-80" />
              <p>כל המכסות החתומות באקסל אומתו בסריקות הפיזיות במלואן!</p>
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-right text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-xs">
                    <th className="pb-3 pr-2">בעל מצאי</th>
                    <th className="pb-3">מסח\"א ותיאור</th>
                    <th className="pb-3">חתימה באקסל</th>
                    <th className="pb-3">נמצאו בסריקות</th>
                    <th className="pb-3 pl-2">פער חסר</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {quotaDiscrepancies.map((d) => (
                    <tr key={d.holderId + '-' + d.masha} className="hover:bg-gray-800/30 transition-colors">
                      <td className="py-3.5 pr-2 font-bold text-white">
                        {d.holderName}
                      </td>
                      <td className="py-3.5">
                        <div className="flex items-center gap-2.5">
                          <CategoryLogo category={d.category} size="xs" />
                          <div>
                            <div className="font-medium text-gray-200">{d.description}</div>
                            <div className="text-xs font-mono text-emerald-400">מסח\"א: {d.masha}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 text-xs text-gray-300 font-semibold">
                        {d.expectedQuantity} יח'
                      </td>
                      <td className="py-3.5 text-xs text-blue-400 font-semibold">
                        {d.actualDiscovered} יח'
                      </td>
                      <td className="py-3.5 pl-2">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          חסר {Math.abs(d.difference)} יח'
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Discovered Physical Distribution across Rooms */}
      {activeTab === 'distribution' && (
        <div className="space-y-4">
          {discoveredDistribution.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">
              טרם בוצעו סריקות למיפוי מיקומי הפריטים בחדרים.
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-right text-sm min-w-[550px]">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-xs">
                    <th className="pb-3 pr-2">בעל מצאי</th>
                    <th className="pb-3">חדר</th>
                    <th className="pb-3">תיאור ומסח\"א</th>
                    <th className="pb-3 pl-2">כמות שזוהתה בחדר זה</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {discoveredDistribution.map((dist, idx) => (
                    <tr key={idx} className="hover:bg-gray-800/30 transition-colors">
                      <td className="py-3.5 pr-2 font-semibold text-white">
                        {dist.holderName}
                      </td>
                      <td className="py-3.5 text-xs text-emerald-300">
                        {dist.roomName} ({dist.roomCode})
                      </td>
                      <td className="py-3.5">
                        <div className="font-medium text-gray-200">{dist.description}</div>
                        <div className="text-xs font-mono text-gray-400">מסח\"א: {dist.masha}</div>
                      </td>
                      <td className="py-3.5 pl-2 font-bold text-white">
                        {dist.count} יח'
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};