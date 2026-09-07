import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { VersionBadge } from './VersionBadge';
import { ShieldCheck, Smartphone, UserCheck, KeyRound, AlertCircle, Sparkles } from 'lucide-react';

declare global {
  interface Window {
    google?: any;
  }
}

export const LoginScreen: React.FC = () => {
  const { googleClientId, loginWithGoogle, quickLogin, devLogin, updateGoogleClientId, isLoading } = useAuth();
  const loginAction = quickLogin || devLogin;
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [clientIdInput, setClientIdInput] = useState('');
  const [savingClientId, setSavingClientId] = useState(false);
  const [showConfigInput, setShowConfigInput] = useState(false);

  useEffect(() => {
    if (!googleClientId || !window.google?.accounts?.id || !googleBtnRef.current) {
      return;
    }

    try {
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response: any) => {
          if (response?.credential) {
            try {
              setAuthError(null);
              await loginWithGoogle(response.credential);
            } catch (err: any) {
              setAuthError(err.response?.data?.error || err.message || 'ההתחברות עם גוגל נכשלה');
            }
          }
        },
      });

      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'filled_black',
        size: 'large',
        text: 'signin_with',
        shape: 'pill',
        width: 280,
      });
    } catch (err) {
      console.error('[GIS] Error rendering Google button:', err);
    }
  }, [googleClientId, loginWithGoogle]);

  const handleQuickLogin = async (role: 'manager' | 'inventory_owner') => {
    try {
      setAuthError(null);
      await loginAction(
        role,
        customEmail.trim() || undefined,
        customName.trim() || undefined
      );
    } catch (err: any) {
      setAuthError(err.response?.data?.error || err.message || 'שגיאה בהתחברות');
    }
  };

  const handleSaveClientId = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientIdInput.trim()) return;
    setSavingClientId(true);
    setAuthError(null);
    try {
      await updateGoogleClientId(clientIdInput.trim());
      setShowConfigInput(false);
    } catch (err: any) {
      setAuthError('שגיאה בשמירת מזהה Google Client ID');
    } finally {
      setSavingClientId(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden" dir="rtl">
      {/* Background glow effects */}
      <div className="absolute top-1/4 -right-24 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -left-24 w-96 h-96 bg-teal-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-gray-900/90 border border-gray-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-2xl shadow-xl shadow-emerald-500/20 text-white font-black text-3xl">
            S
          </div>
          <div>
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-white">shelv.ai</h1>
              <VersionBadge variant="compact" />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              מערכת ניהול, סריקת מלאי וזיהוי חריגות בעלי מצאי בארגון
            </p>
          </div>
        </div>

        {/* Roles information badge */}
        <div className="bg-gray-950/60 border border-gray-800/80 rounded-2xl p-3.5 space-y-2 text-xs">
          <div className="font-semibold text-gray-300 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>הרשאות במערכת:</span>
          </div>
          <ul className="space-y-1.5 text-[11px] text-gray-400 pr-4 list-disc">
            <li>
              <strong className="text-emerald-300 font-medium">הרשאת עריכה מלאה (Full Access):</strong> ביצוע פעולות על פריטים, אישור העברות, הוספה ועריכה של בעלי מצאי.
            </li>
            <li>
              <strong className="text-blue-300 font-medium">בעל מצאי (Inventory Owner):</strong> שיוך לפרופיל בעל מצאי קיים, צפייה בציוד ובחדרים המשויכים.
            </li>
            <li>
              <strong className="text-cyan-300 font-medium">סריקה (Scanner):</strong> גישה ציבורית ישירה ללא התחברות.
            </li>
          </ul>
        </div>

        {authError && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{authError}</span>
          </div>
        )}

        {/* Primary Login: Google Sign-In */}
        <div className="space-y-3 pt-2">
          <label className="block text-center text-xs font-semibold text-gray-300">
            התחברות מאובטחת באמצעות Google
          </label>

          {googleClientId && !showConfigInput ? (
            <div className="space-y-2">
              <div className="flex justify-center min-h-[44px]">
                <div ref={googleBtnRef} />
              </div>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setClientIdInput(googleClientId);
                    setShowConfigInput(true);
                  }}
                  className="text-[10px] text-gray-500 hover:text-gray-400 underline cursor-pointer"
                >
                  הגדרת מזהה Google Client ID אחר
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSaveClientId} className="p-3.5 bg-gray-950/90 border border-gray-800 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between text-xs text-gray-300 font-semibold">
                <span>הגדרת Google Client ID:</span>
                {googleClientId && (
                  <button
                    type="button"
                    onClick={() => setShowConfigInput(false)}
                    className="text-[10px] text-gray-500 hover:text-white"
                  >
                    ביטול
                  </button>
                )}
              </div>
              <p className="text-[11px] text-gray-400">
                הדבק כאן את מזהה הלקוח (Client ID) מ-Google Cloud Console להפעלת כפתור ההתחברות:
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  dir="ltr"
                  value={clientIdInput}
                  onChange={(e) => setClientIdInput(e.target.value)}
                  placeholder="xxxx-xxxx.apps.googleusercontent.com"
                  className="flex-1 px-3 py-2 text-xs bg-gray-900 border border-gray-700 rounded-xl text-white font-mono placeholder-gray-600 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  disabled={savingClientId || !clientIdInput.trim()}
                  className="px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] rounded-xl transition-all disabled:opacity-50 shrink-0 cursor-pointer"
                >
                  {savingClientId ? 'שומר...' : 'הפעל כפתור'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Quick sign-in */}
        <div className="border-t border-gray-800/80 pt-4 space-y-3">
          <div className="flex items-center justify-between text-[11px] text-gray-400">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>התחברות מהירה:</span>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleQuickLogin('manager')}
              disabled={isLoading}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] rounded-xl shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>כניסה בהרשאת עריכה</span>
            </button>

            <button
              onClick={() => handleQuickLogin('inventory_owner')}
              disabled={isLoading}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-blue-200 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 active:scale-[0.98] rounded-xl transition-all disabled:opacity-50"
            >
              <UserCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>כניסה כבעל מצאי</span>
            </button>
          </div>

          {/* Optional custom identity inputs */}
          <details className="text-[11px] text-gray-500 cursor-pointer">
            <summary className="hover:text-gray-400 flex items-center gap-1 select-none">
              <KeyRound className="w-3 h-3" />
              <span>התאמה אישית של שם / אימייל להתחברות</span>
            </summary>
            <div className="mt-2 space-y-2 p-2.5 bg-gray-950/80 rounded-xl border border-gray-800">
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="שם לתצוגה (אופציונלי)"
                className="w-full px-2.5 py-1.5 text-xs bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
              />
              <input
                type="email"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                placeholder="אימייל (אופציונלי)"
                className="w-full px-2.5 py-1.5 text-xs bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </details>
        </div>

        {/* Public Scanner Access (No Sign-In Needed!) */}
        <div className="border-t border-gray-800/80 pt-4">
          <a
            href="/scanner/"
            className="flex items-center justify-center gap-2 w-full px-4 py-3 text-xs font-semibold text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-2xl transition-all shadow-sm group"
          >
            <Smartphone className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
            <span>סורק נייד (גישה ציבורית ללא התחברות)</span>
          </a>
        </div>
      </div>
    </div>
  );
};
