import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserCheck, Smartphone, AlertCircle, CheckCircle2, RefreshCw, Shield, Sparkles } from 'lucide-react';

interface Props {
  isOpen: boolean;
}

export const OnboardingModal: React.FC<Props> = ({ isOpen }) => {
  const { user, completeOnboarding } = useAuth();
  const [selectedRole, setSelectedRole] = useState<'inventory_owner' | 'scanner' | null>(null);
  const [personalNumber, setPersonalNumber] = useState(user?.personal_number || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'info'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFeedback(null);

    if (!selectedRole) {
      setError('יש לבחור האם אתה בעל מצאי או סורק');
      return;
    }

    if (selectedRole === 'inventory_owner' && !personalNumber.trim()) {
      setError('חובה להזין מספר אישי (מ"א) עבור בעל מצאי');
      return;
    }

    setSubmitting(true);
    try {
      const res = await completeOnboarding(
        selectedRole,
        selectedRole === 'inventory_owner' ? personalNumber.trim() : undefined
      );

      if (res.coupled) {
        setFeedback({
          type: 'success',
          text: `שויכת בהצלחה לבעל המצאי "${res.holderName}". מעביר למערכת...`,
        });
      } else if (selectedRole === 'inventory_owner') {
        setFeedback({
          type: 'info',
          text: 'נרשמת בהצלחה כבעל מצאי! פרטי המצאי שלך טרם הוזנו למערכת ע"י מנהל, והחשבון יקושר אוטומטית ברגע שהרשימה תיטען.',
        });
      }
    } catch (err: any) {
      console.error('[Onboarding] Error:', err);
      setError(err.response?.data?.error || err.message || 'שגיאה בהגדרת הפרופיל');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4" dir="rtl">
      <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-lg p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="text-center space-y-2 relative z-10">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 mb-1">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            שלום {user?.name || 'וברוך הבא'}!
          </h2>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            כדי להתאים עבורך את סביבת העבודה, אנא הגדר את תפקידך במערכת shelv.ai
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {feedback && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{feedback.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          <div className="space-y-2 text-xs font-semibold text-gray-300">
            <span>האם אתה בעל / מנהל מצאי בארגון?</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Option: Inventory Owner */}
            <button
              type="button"
              onClick={() => {
                setSelectedRole('inventory_owner');
                setError(null);
              }}
              className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between gap-2 cursor-pointer ${
                selectedRole === 'inventory_owner'
                  ? 'bg-blue-500/15 border-blue-500/50 shadow-lg shadow-blue-500/10'
                  : 'bg-gray-950/60 border-gray-800 hover:border-gray-700'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-bold text-sm text-white flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-blue-400" />
                  <span>כן, אני בעל מצאי</span>
                </span>
                <span
                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    selectedRole === 'inventory_owner'
                      ? 'border-blue-400 bg-blue-500'
                      : 'border-gray-600'
                  }`}
                >
                  {selectedRole === 'inventory_owner' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </span>
              </div>
              <p className="text-[11px] text-gray-400">
                אחראי על ציוד, חדרים או תחנות עבודה בארגון.
              </p>
            </button>

            {/* Option: Scanner */}
            <button
              type="button"
              onClick={() => {
                setSelectedRole('scanner');
                setError(null);
              }}
              className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between gap-2 cursor-pointer ${
                selectedRole === 'scanner'
                  ? 'bg-cyan-500/15 border-cyan-500/50 shadow-lg shadow-cyan-500/10'
                  : 'bg-gray-950/60 border-gray-800 hover:border-gray-700'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-bold text-sm text-white flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-cyan-400" />
                  <span>לא, אני סורק</span>
                </span>
                <span
                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    selectedRole === 'scanner'
                      ? 'border-cyan-400 bg-cyan-500'
                      : 'border-gray-600'
                  }`}
                >
                  {selectedRole === 'scanner' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </span>
              </div>
              <p className="text-[11px] text-gray-400">
                ביצוע סריקות מצאי פיזיות בשטח ותחקור סריקות.
              </p>
            </button>
          </div>

          {/* Sub-form when Inventory Owner is chosen */}
          {selectedRole === 'inventory_owner' && (
            <div className="p-4 bg-gray-950/80 border border-blue-500/30 rounded-2xl space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
              <label className="block text-xs font-semibold text-blue-200">
                מספר אישי (מ"א) בצה"ל / בארגון: <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={personalNumber}
                onChange={(e) => setPersonalNumber(e.target.value)}
                placeholder="למשל: 8123456"
                autoFocus
                className="w-full px-3 py-2.5 text-xs bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono"
              />
              <div className="flex items-start gap-1.5 text-[11px] text-gray-400">
                <Shield className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                <span>
                  המספר האישי יצמיד את חשבונך לפרופיל בעל המצאי שלך. ניתן להירשם גם אם פרטי המצאי שלך טרם הועלו למערכת.
                </span>
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting || !selectedRole}
              className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>שומר הגדרות...</span>
                </>
              ) : (
                <span>אישור והמשך למערכת</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
