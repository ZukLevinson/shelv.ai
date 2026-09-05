import React, { useState } from 'react';
import type { AnomalyReport } from '../types';
import { AlertTriangle, ArrowRightLeft, HelpCircle, Check, MapPin, UserCheck, ShieldAlert } from 'lucide-react';
import axios from 'axios';

interface Props {
  anomalies: AnomalyReport | null;
  onRefresh: () => void;
}

export const AnomaliesCenter: React.FC<Props> = ({ anomalies, onRefresh }) => {
  const [activeTab, setActiveTab] = useState<'unauthorized' | 'internal' | 'missing'>('unauthorized');
  const [resolvingSn, setResolvingSn] = useState<string | null>(null);

  if (!anomalies) return null;

  const handleApproveTransfer = async (serialNumber: string, targetRoomId: string) => {
    setResolvingSn(serialNumber);
    try {
      await axios.post('http://localhost:4000/api/anomalies/approve-transfer', {
        serialNumber,
        targetRoomId,
        resolvedBy: 'מנהל מערכת',
      });
      onRefresh();
    } catch (err) {
      console.error('Failed to approve transfer', err);
    } finally {
      setResolvingSn(null);
    }
  };

  const handleConfirmInternalMove = async (serialNumber: string, targetRoomId: string) => {
    setResolvingSn(serialNumber);
    try {
      await axios.post('http://localhost:4000/api/anomalies/confirm-move', {
        serialNumber,
        targetRoomId,
        resolvedBy: 'מנהל מערכת',
      });
      onRefresh();
    } catch (err) {
      console.error('Failed to confirm move', err);
    } finally {
      setResolvingSn(null);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-6 shadow-xl">
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-gray-800 pb-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-rose-400" />
          <h2 className="text-xl font-bold text-white">מרכז חריגות ותנועות ציוד</h2>
        </div>

        <div className="flex gap-2 p-1 bg-gray-950 rounded-xl border border-gray-800">
          <button
            onClick={() => setActiveTab('unauthorized')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'unauthorized'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>העברות ללא חתימה</span>
            <span className="px-2 py-0.5 text-xs rounded-full bg-rose-500/30 text-rose-200">
              {anomalies.unauthorizedTransfers.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('internal')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'internal'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>מעבר חדר פנימי</span>
            <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500/30 text-amber-200">
              {anomalies.internalMoves.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('missing')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'missing'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>ציוד חסר בסריקה</span>
            <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/30 text-blue-200">
              {anomalies.missingItems.length}
            </span>
          </button>
        </div>
      </div>

      {activeTab === 'unauthorized' && (
        <div className="space-y-4">
          {anomalies.unauthorizedTransfers.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Check className="w-12 h-12 text-emerald-400 mx-auto mb-2 opacity-80" />
              <p>אין כרגע העברות ללא חתימה. כל הציוד נמצא באחריות בעל המצאי המקורי!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-xs">
                    <th className="pb-3 pr-2">פריט ודגם</th>
                    <th className="pb-3">מסח"א / סריאלי</th>
                    <th className="pb-3">חתימה מקורית</th>
                    <th className="pb-3">נמצא בפועל (סריקה)</th>
                    <th className="pb-3">נסרק ע"י</th>
                    <th className="pb-3 pl-2 text-left">פעולה</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {anomalies.unauthorizedTransfers.map((item) => (
                    <tr key={item.serialNumber} className="hover:bg-gray-800/30 transition-colors">
                      <td className="py-4 pr-2">
                        <div className="font-semibold text-white">{item.description}</div>
                        <div className="text-xs text-gray-500">{item.category}</div>
                      </td>
                      <td className="py-4 font-mono text-xs">
                        <div className="text-emerald-400">מסח"א: {item.masha}</div>
                        <div className="text-gray-400">S/N: {item.serialNumber}</div>
                      </td>
                      <td className="py-4">
                        <div className="text-rose-400 font-medium">{item.officialHolderName}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {item.officialRoomName}
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="text-amber-400 font-medium">{item.scannedRoomHolderName}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {item.scannedRoomName}
                        </div>
                        {item.stickerOwnerText && (
                          <div className="text-[11px] text-gray-400 mt-1">מדבקה: {item.stickerOwnerText}</div>
                        )}
                      </td>
                      <td className="py-4 text-xs text-gray-400">
                        <div>{item.scannedBy}</div>
                        <div className="text-[10px] text-gray-500">{new Date(item.scannedAt).toLocaleTimeString('he-IL')}</div>
                      </td>
                      <td className="py-4 pl-2 text-left">
                        <button
                          onClick={() => handleApproveTransfer(item.serialNumber, item.scannedRoomId)}
                          disabled={resolvingSn === item.serialNumber}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-medium transition-all"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>אשר העברת חתימה ל-{item.scannedRoomHolderName}</span>
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

      {activeTab === 'internal' && (
        <div className="space-y-4">
          {anomalies.internalMoves.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Check className="w-12 h-12 text-emerald-400 mx-auto mb-2 opacity-80" />
              <p>אין מעברים פנימיים לא מעודכנים בין חדרי אותו בעל מצאי.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-xs">
                    <th className="pb-3 pr-2">פריט ודגם</th>
                    <th className="pb-3">מסח"א / סריאלי</th>
                    <th className="pb-3">בעל מצאי (ללא שינוי)</th>
                    <th className="pb-3">מעבר חדר</th>
                    <th className="pb-3 pl-2 text-left">עדכון מיקום</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {anomalies.internalMoves.map((item) => (
                    <tr key={item.serialNumber} className="hover:bg-gray-800/30 transition-colors">
                      <td className="py-4 pr-2">
                        <div className="font-semibold text-white">{item.description}</div>
                        <div className="text-xs text-gray-500">{item.category}</div>
                      </td>
                      <td className="py-4 font-mono text-xs">
                        <div className="text-emerald-400">מסח"א: {item.masha}</div>
                        <div className="text-gray-400">S/N: {item.serialNumber}</div>
                      </td>
                      <td className="py-4 font-medium text-emerald-300">
                        {item.holderName}
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-gray-400">{item.officialRoomName}</span>
                          <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" />
                          <span className="text-amber-300 font-semibold">{item.scannedRoomName}</span>
                        </div>
                      </td>
                      <td className="py-4 pl-2 text-left">
                        <button
                          onClick={() => handleConfirmInternalMove(item.serialNumber, item.scannedRoomId)}
                          disabled={resolvingSn === item.serialNumber}
                          className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-white border border-amber-500/30 text-xs font-medium transition-all"
                        >
                          עדכן רישום ל-{item.scannedRoomName}
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

      {activeTab === 'missing' && (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-xs">
                  <th className="pb-3 pr-2">פריט ודגם</th>
                  <th className="pb-3">מסח"א / סריאלי</th>
                  <th className="pb-3">חדר רשמי</th>
                  <th className="pb-3">בעל מצאי חתום</th>
                  <th className="pb-3 pl-2">סטטוס</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {anomalies.missingItems.map((item) => (
                  <tr key={item.serialNumber} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-4 pr-2">
                      <div className="font-semibold text-white">{item.description}</div>
                      <div className="text-xs text-gray-500">{item.category}</div>
                    </td>
                    <td className="py-4 font-mono text-xs">
                      <div className="text-emerald-400">מסח"א: {item.masha}</div>
                      <div className="text-gray-400">S/N: {item.serialNumber}</div>
                    </td>
                    <td className="py-4 text-xs text-gray-300">
                      {item.officialRoomName}
                    </td>
                    <td className="py-4 text-xs text-gray-300 font-medium">
                      {item.officialHolderName}
                    </td>
                    <td className="py-4 pl-2">
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        טרם נסרק
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};