import React, { useState, useEffect } from 'react';
import { RotateCcw, X, CheckCircle2 } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

export interface UndoToastData {
  actionId: string;
  description: string;
  durationMs?: number;
}

interface Props {
  toast: UndoToastData | null;
  onClose: () => void;
  onReverted: () => void;
}

export const UndoToast: React.FC<Props> = ({ toast, onClose, onReverted }) => {
  const [reverting, setReverting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    setStatusMsg(null);
    const timer = setTimeout(() => {
      onClose();
    }, toast.durationMs || 10000);

    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  const handleRevert = async () => {
    setReverting(true);
    try {
      await axios.post(`${API_BASE_URL}/api/actions/${toast.actionId}/revert`, {
        revertedBy: 'מנהל מערכת',
      });
      setStatusMsg('הפעולה בוטלה בהצלחה ↩️');
      onReverted();
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error('Failed to revert action:', err);
      setStatusMsg(err.response?.data?.error || 'שגיאה בביטול הפעולה');
    } finally {
      setReverting(false);
    }
  };

  return (
    <aside aria-label="Undo action notification" className="fixed bottom-5 left-5 z-50 flex items-center gap-3 bg-gray-900 border border-emerald-500/40 text-white px-4 py-3 rounded-2xl shadow-2xl shadow-black/80 backdrop-blur-md max-w-md animate-in fade-in slide-in-from-bottom-5">
      <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
        <CheckCircle2 className="w-5 h-5" />
      </div>

      <div className="flex-1 text-right">
        <p className="text-xs text-gray-400">פעולה הושלמה בהצלחה</p>
        <p className="text-sm font-semibold text-white truncate">{toast.description}</p>
        {statusMsg && (
          <p className="text-xs font-bold text-amber-400 mt-0.5">{statusMsg}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleRevert}
          disabled={reverting || Boolean(statusMsg)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${reverting ? 'animate-spin' : ''}`} />
          <span>{reverting ? 'מבטל...' : 'בטל פעולה ↩️'}</span>
        </button>

        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-300 p-1 rounded-lg"
          title="סגור"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
