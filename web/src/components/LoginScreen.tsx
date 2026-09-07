import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Smartphone, UserCheck, KeyRound, AlertCircle, Sparkles } from 'lucide-react';

declare global {
  interface Window {
    google?: any;
  }
}

export const LoginScreen: React.FC = () => {
  const { googleClientId, loginWithGoogle, devLogin, isLoading } = useAuth();
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');

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

  const handleDevLogin = async (role: 'manager' | 'inventory_owner') => {
    try {
      setAuthError(null);
      await devLogin(
        role,
        customEmail.trim() || undefined,
        customName.trim() || undefined
      );
    } catch (err: any) {
      setAuthError(err.response?.data?.error || err.message || 'שגיאה בהתחברות');
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
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                v2.0
              </span>
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
            <span>הרשאות ותפקידים במערכת:</span>
          </div>
          <ul className="space-y-1.5 text-[11px] text-gray-400 pr-4 list-disc">
            <li>
              <strong className="text-emerald-300 font-medium">מנהל מערכת (Manager):</strong> ביצוע פעולות על פריטים, אישור העברות, הוספה ומחיקה בלעדית של בעלי מצאי.
            </li>
            <li>
              <strong className="text-blue-300 font-medium">בעל מצאי (Inventory Owner):</strong> שיוך לפרופיל בעל מצאי קיים, צפייה בציוד ובחדרים המשויכים.
            </li>
            <li>
              <strong className="text-cyan-300 font-medium">סורק (Scanner):</strong> גישה ציבורית חופשית ישירה ללא התחברות.
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

          {googleClientId ? (
            <div className="flex justify-center min-h-[44px]">
              <div ref={googleBtnRef} />
            </div>
          ) : (
            <div className="p-3 bg-gray-950/80 border border-gray-800 rounded-xl text-center space-y-1">
              <p className="text-[11px] text-gray-400">
                טרם הוגדר מפתח Google Client ID בשרת.
              </p>
              <p className="text-[10px] text-gray-500">
                ניתן להגדיר <code className="text-emerald-400 font-mono">GOOGLE_CLIENT_ID</code> או להשתמש בהתחברות מהירה מטה.
              </p>
            </div>
          )}
        </div>

        {/* Quick development / demo sign-in */}
        <div className="border-t border-gray-800/80 pt-4 space-y-3">
          <div className="flex items-center justify-between text-[11px] text-gray-400">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>התחברות מהירה (לפיתוח ובדיקות):</span>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleDevLogin('manager')}
              disabled={isLoading}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] rounded-xl shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>כניסה כמנהל</span>
            </button>

            <button
              onClick={() => handleDevLogin('inventory_owner')}
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
