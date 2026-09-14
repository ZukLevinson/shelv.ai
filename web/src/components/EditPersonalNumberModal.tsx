import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { IdCard, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
} from './ui';

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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-gray-900 border-gray-800">
        <DialogHeader className="px-5 py-4 border-b border-gray-800 bg-gray-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <IdCard className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white">
                עדכון מספר אישי (מ"א)
              </DialogTitle>
              <DialogDescription className="text-[11px] text-gray-400 mt-0.5">
                שיוך חשבונך לבעל מצאי בארגון
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col space-y-4 p-5">
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

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-300">
              הזן מספר אישי (מ"א): <span className="text-rose-400">*</span>
            </label>
            <Input
              type="text"
              value={personalNumber}
              onChange={(e) => setPersonalNumber(e.target.value)}
              placeholder="למשל: 8123456"
              autoFocus
              className="font-mono text-sm"
            />
            <p className="text-[11px] text-gray-400">
              שינוי המ"א יבצע בדיקת צימוד מחודשת מיידית מול בעלי המצאי במערכת.
            </p>
          </div>

          <DialogFooter className="pt-3 border-t border-gray-800 flex-row justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={submitting}
            >
              ביטול
            </Button>
            <Button
              type="submit"
              variant="default"
              loading={submitting}
              disabled={submitting || !personalNumber.trim()}
            >
              שמור ובדוק שיוך
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
