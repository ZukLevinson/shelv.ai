import React, { useState } from 'react';
import type { AnomalyReport } from '../types';
import { AlertTriangle, HelpCircle, Check, MapPin, UserCheck, ShieldAlert, BarChart3 } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

interface Props {
  anomalies: AnomalyReport | null;
  onRefresh: () => void;
}

export const AnomaliesCenter: React.FC<Props> = ({ anomalies, onRefresh }) => {
  const [activeTab, setActiveTab] = useState<'unauthorized' | 'discrepancies' | 'distribution'>('unauthorized');
  const [resolvingSn, setResolvingSn] = useState<string | null>(null);

  if (!anomalies) return null;

  const unauthorizedTransfers = anomalies.unauthorizedTransfers || [];
  const quotaDiscrepancies = anomalies.quotaDiscrepancies || [];
  const discoveredDistribution = anomalies.discoveredDistribution || [];

  const handleApproveTransfer = async (serialNumber: string, targetHolderId: string) => {
    setResolvingSn(serialNumber);
    try {
      await axios.post(`${API_BASE_URL}/api/anomalies/approve-transfer`, {
        serialNumber,
        targetHolderId,
        resolvedBy: 'מנהל מערכת',
      });
      onRefresh();
    } catch (err) {
      console.error('Failed to approve transfer', err);
    } finally {
      setResolvingSn(null);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-6 shadow-xl">
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-gray-800 pb-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-rose-400" />
          <h2 className="text-xl font-bold text-white">מרכז חריגות וחלוקת מצאי</h2>
        </div>

        <div className="flex gap-2 p-1 bg-gray-950 rounded-xl border border-gray-800">
          <button
            onClick={() => setActiveTab('unauthorized')}
            className={'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ' + (
              activeTab === 'unauthorized'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'text-gray-400 hover:text-white'
            )}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>ציוד זר בחדר (ללא חתימה)</span>
            <span className="px-2 py-0.5 text-xs rounded-full bg-rose-500/30 text-rose-200">
              {unauthorizedTransfers.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('discrepancies')}
            className={'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ' + (
              activeTab === 'discrepancies'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-gray-400 hover:text-white'
            )}
          >
            <HelpCircle className="w-4 h-4" />
            <span>פערי חתימות חסרים</span>
            <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500/30 text-amber-200">
              {quotaDiscrepancies.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('distribution')}
            className={'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ' + (
              activeTab === 'distribution'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                : 'text-gray-400 hover:text-white'
            )}
          >
            <BarChart3 className="w-4 h-4" />
            <span>פריסה פיזית לפי חדרים</span>
            <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/30 text-blue-200">
              {discoveredDistribution.length}
            </span>
          </button>
        </div>
      </div>

      {/* Tab 1: Unauthorized Items Found in a Room */}
      {activeTab === 'unauthorized' && (
        <div className="space-y-4">
          {unauthorizedTransfers.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">
              <Check className="w-12 h-12 text-emerald-400 mx-auto mb-2 opacity-80" />
              <p>לא נמצאו פריטים בחדרים של בעלי מצאי ללא חתימה מתאימה.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-xs">
                    <th className="pb-3 pr-2">דגם ומסח\"א</th>
                    <th className="pb-3">מספר סידורי (S/N)</th>
                    <th className="pb-3">נמצא בחדר (סריקה)</th>
                    <th className="pb-3">בעל המצאי של החדר</th>
                    <th className="pb-3">חתימה משוערת</th>
                    <th className="pb-3">נסרק ע\"י</th>
                    <th className="pb-3 pl-2 text-left">פעולה</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {unauthorizedTransfers.map((item) => (
                    <tr key={item.serialNumber} className="hover:bg-gray-800/30 transition-colors">
                      <td className="py-4 pr-2">
                        <div className="font-semibold text-white">{item.mashaName}</div>
                        <div className="text-xs font-mono text-emerald-400">מסח\"א: {item.masha}</div>
                      </td>
                      <td className="py-4 font-mono text-xs text-gray-300">
                        {item.serialNumber}
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
                        <button
                          onClick={() => handleApproveTransfer(item.serialNumber, item.scannedHolderId)}
                          disabled={resolvingSn === item.serialNumber}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-medium transition-all"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>העבר חתימה ל-{item.scannedHolderName}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
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
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-xs">
                    <th className="pb-3 pr-2">בעל מצאי</th>
                    <th className="pb-3">מסח\"א ודגם</th>
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
                        <div className="font-medium text-gray-200">{d.mashaName}</div>
                        <div className="text-xs font-mono text-emerald-400">מסח\"א: {d.masha}</div>
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
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-xs">
                    <th className="pb-3 pr-2">בעל מצאי</th>
                    <th className="pb-3">חדר</th>
                    <th className="pb-3">דגם ומסח\"א</th>
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
                        <div className="font-medium text-gray-200">{dist.mashaName}</div>
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