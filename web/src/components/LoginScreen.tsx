import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { VersionBadge } from './VersionBadge';
import { ShieldCheck, Smartphone, AlertCircle, Scan, ArrowLeft, UserCheck } from 'lucide-react';

declare global {
  interface Window {
    google?: any;
  }
}

export const LoginScreen: React.FC = () => {
  const { googleClientId, loginWithGoogle, loginAsScanner, isLoading } = useAuth();
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [scannerLoading, setScannerLoading] = useState(false);

  useEffect(() => {
    document.title = 'התחברות למערכת | shelv.ai';
  }, []);

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

  const handleScannerLogin = async () => {
    setScannerLoading(true);
    setAuthError(null);
    try {
      await loginAsScanner();
    } catch (err: any) {
      setAuthError(err.response?.data?.error || err.message || 'שגיאה בכניסה כסורק');
    } finally {
      setScannerLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden" dir="rtl">
      {/* Background glow effects */}
      <div className="absolute top-1/4 -right-24 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -left-24 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-gray-900/90 border border-gray-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-2xl shadow-xl shadow-emerald-500/20 text-white font-black text-3xl">
            S
          </div>
          <div>
            <div className="flex items-center justify-center gap-2">
              <span className="text-xl sm:text-2xl font-black tracking-tight text-white">shelv.ai</span>
              <VersionBadge variant="compact" />
            </div>
            <h1 className="text-base sm:text-lg font-bold text-emerald-400 mt-1">
              התחברות למערכת
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              מערכת ניהול, סריקת מלאי וזיהוי חריגות בעלי מצאי בארגון
            </p>
          </div>
        </div>

        {/* Roles information badge */}
        <div className="bg-gray-950/60 border border-gray-800/80 rounded-2xl p-3.5 space-y-2 text-xs">
          <div className="font-semibold text-gray-300 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>הרשאות ומסלולי כניסה למערכת:</span>
          </div>
          <ul className="space-y-1.5 text-[11px] text-gray-400 pr-4 list-disc">
            <li>
              <strong className="text-blue-300 font-medium">בעל מצאי (Inventory Owner) / הרשאת ניהול (Management):</strong> כניסה מאובטחת <u>אך ורק באמצעות חשבון Google</u> לשיוך לפי מ"א, מעקב ציוד וניהול הרשאות.
            </li>
            <li>
              <strong className="text-cyan-300 font-medium">סורק (Scanner):</strong> כניסה <u>ללא צורך בחשבון Google</u> לביצוע סריקות מצאי בשטח ותחקור סריקות.
            </li>
          </ul>
        </div>

        {authError && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{authError}</span>
          </div>
        )}

        {/* Option 1: Google Sign-In (Required for Inventory Holder & Management) */}
        <div className="p-4 bg-gray-950/70 border border-gray-800 rounded-2xl space-y-3">
          <div className="text-center space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-white">
              <UserCheck className="w-4 h-4 text-blue-400" />
              <span>התחברות בעלי מצאי ומנהלים (Google)</span>
            </div>
            <p className="text-[11px] text-gray-400">
              כניסה עם Google מאפשרת שיוך מ"א וניהול הרשאות
            </p>
          </div>

          {googleClientId ? (
            <div className="flex justify-center min-h-[44px]">
              <div ref={googleBtnRef} />
            </div>
          ) : (
            <div className="p-2.5 bg-gray-900 border border-gray-800 rounded-xl text-center text-xs text-gray-400">
              התחברות Google טרם הופעלה (חסר GOOGLE_CLIENT_ID בשרת).
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="relative flex items-center justify-center">
          <div className="border-t border-gray-800 w-full" />
          <span className="bg-gray-900 px-3 text-[11px] text-gray-500 font-medium absolute">או</span>
        </div>

        {/* Option 2: Scanner Login (Button only) */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleScannerLogin}
            disabled={scannerLoading || isLoading}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 text-xs font-bold text-cyan-950 bg-cyan-400 hover:bg-cyan-300 active:scale-[0.99] rounded-xl transition-all shadow-lg shadow-cyan-500/20 cursor-pointer disabled:opacity-50"
          >
            <Scan className="w-4 h-4" />
            <span>{scannerLoading ? 'מתחבר כסורק...' : 'התחבר כסורק מצאי (ללא Google)'}</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>

          {/* Direct Camera Scanner Shortcut */}
          <div className="text-center pt-1">
            <a
              href="/scanner/"
              className="inline-flex items-center gap-1.5 text-[11px] text-cyan-400/90 hover:text-cyan-300 transition-colors"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>פתיחת סורק מצלמה נייד ישירות (לסמארטפון)</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
