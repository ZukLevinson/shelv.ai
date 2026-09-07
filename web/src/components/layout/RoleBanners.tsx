import { Info, Edit2, UserCheck, Smartphone } from 'lucide-react';
import type { User } from '../../types';

export interface RoleBannersProps {
  user: User | null;
  isInventoryOwner: boolean;
  isScanner: boolean;
  hasCorrespondentOwner: boolean;
  onOpenEditPN: () => void;
}

export function RoleBanners({
  user,
  isInventoryOwner,
  isScanner,
  hasCorrespondentOwner,
  onOpenEditPN,
}: RoleBannersProps) {
  return (
    <>
      {/* Inventory Owner Banner if uncoupled */}
      {isInventoryOwner && !hasCorrespondentOwner && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-start gap-2.5">
            <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold text-amber-100">
                אתה מחובר כבעל מצאי {user?.personal_number ? `(מ"א: ${user.personal_number})` : ''} - פרטי המצאי שלך טרם נקלטו במערכת.
              </strong>
              <p className="text-amber-300/80 text-[11px] mt-0.5">
                ברגע שמנהל יטען את קובץ המצאי או יזין את פרטיך במערכת, החשבון יסונכרן אוטומטית. אם נפלה טעות במספר האישי, ניתן לעדכן אותו כעת.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 flex-wrap">
            <button
              type="button"
              onClick={onOpenEditPN}
              className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer text-xs"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>ערוך מ"א</span>
            </button>
          </div>
        </div>
      )}

      {/* Scoped view toggle for users with a correspondent inventory owner */}
      {hasCorrespondentOwner && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 bg-gray-900/80 border border-gray-800 px-4 py-2.5 rounded-2xl text-xs">
          <div className="flex items-center gap-2 text-gray-300 flex-wrap">
            <UserCheck className="w-4 h-4 text-teal-400 shrink-0" />
            <span>
              אתה מחובר כבעל המצאי: <strong className="text-teal-300">{user?.holder_name}</strong>
              {user?.personal_number && <span className="text-gray-400 font-mono text-[11px] mr-1">(מ"א: {user.personal_number})</span>}
            </span>
            <button
              type="button"
              onClick={onOpenEditPN}
              className="p-1 text-gray-500 hover:text-emerald-400 rounded transition-colors cursor-pointer"
              title="ערוך מספר אישי (מ''א)"
            >
              <Edit2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Scanner Banner for Scanner role */}
      {isScanner && (
        <div className="flex items-center justify-between bg-cyan-500/10 border border-cyan-500/30 px-4 py-2.5 rounded-2xl text-xs text-cyan-200">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-cyan-400" />
            <span>
              אתה מחובר כ<strong>סורק מצאי</strong>. באפשרותך לבצע סריקות פיזיות בשטח או לתחקר סריקות קיימות.
            </span>
          </div>

          <a
            href="/scanner/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer text-xs"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>פתח סורק נייד</span>
          </a>
        </div>
      )}
    </>
  );
}
