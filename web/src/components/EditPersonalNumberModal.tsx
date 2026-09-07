import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, IdCard, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const EditPersonalNumberModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const { user, updatePersonalNumber } = useAuth();
  const [personalNumber, setPersonalNumber] = useState(user?.personal_number || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'info'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFeedback(null);

    const cleanPN = personalNumber.trim();
    if (!cleanPN) {
      setError('חובה להזין מספר אישי (מ"א) תקין');
      return;
    }

    setSubmitting(true);
    try {
      const res = await updatePersonalNumber(cleanPN);
      if (res.coupled) {
        setFeedback({
          type: 'success',
          text: `שויכת בהצלחה לבעל המצאי "${res.holderName}"!`,
        });
      } else {
        setFeedback({
          type: 'info',
          text: 'המ"א עודכן בהצלחה. פרטי בעל המצאי טרם נקלטו במערכת, החשבון יסונכרן אוטומטית ברגע שהרשימה תיטען.',
        });
      }

      if (onSuccess) {
        onSuccess();
      }

      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err: any) {
      console.error('[EditPersonalNumber] Error:', err);
      setError(err.response?.data?.error || err.message || 'שגיאה בעדכון מספר אישי');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4" dir="rtl">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <IdCard className="w-4 h-4 text-emerald-400" />
            <span>עדכון מספר אישי (מ"א)</span>
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {feedback && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{feedback.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <label className="block font-medium text-gray-300">
              הזן מספר אישי (מ"א): <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={personalNumber}
              onChange={(e) => setPersonalNumber(e.target.value)}
              placeholder="למשל: 8123456"
              autoFocus
              className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 font-mono text-sm"
            />
            <p className="text-[11px] text-gray-400">
              שינוי המ"א יבצע בדיקת צימוד מחודשת מיידית מול בעלי המצאי במערכת.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition-colors"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>שומר...</span>
                </>
              ) : (
                <span>שמור ובדוק שיוך</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
