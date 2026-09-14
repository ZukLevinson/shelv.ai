import { Link } from 'react-router-dom';
import { Edit2, LogOut } from 'lucide-react';
import type { User } from '../../types';
import type { PageMeta } from '../../types/navigation';
import { Badge, Button } from '../ui';

export interface TopBarProps {
  pageMeta: PageMeta;
  user: User | null;
  isManager: boolean;
  isInventoryOwner: boolean;
  onOpenEditPN: () => void;
  onLogout: () => void;
}

export function TopBar({
  pageMeta,
  user,
  isManager,
  isInventoryOwner,
  onOpenEditPN,
  onLogout,
}: TopBarProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 sm:gap-3">
        <div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <Link
              to="/"
              className="text-lg sm:text-2xl font-black tracking-tight text-white hover:text-emerald-300 transition-colors shrink-0"
              title="חזור למבט על"
            >
              shelv.ai
            </Link>
            <span className="text-gray-600 font-light text-base sm:text-xl select-none" aria-hidden="true">
              /
            </span>
            <h1 className="text-base sm:text-xl font-bold text-emerald-400 tracking-tight whitespace-nowrap">
              {pageMeta.title}
            </h1>
            <Badge variant="default" className="text-[9px] sm:text-[11px]">
              Live Anomaly Engine
            </Badge>
          </div>
          <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 line-clamp-1">
            {pageMeta.description}
          </p>
        </div>
      </div>

      {/* User Profile Pill & Logout */}
      <div className="flex items-center gap-2 shrink-0">
        {/* User Profile Card (Expanded on sm+, compact avatar on mobile) */}
        <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 h-9 px-2.5 rounded-xl text-xs">
          <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
            {user?.name.charAt(0).toUpperCase()}
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-right">
            <span className="font-semibold text-white max-w-[120px] truncate">{user?.name}</span>
            {isManager ? (
              <Badge variant="purple" className="text-[9px] py-0 px-1.5">
                הרשאת ניהול
              </Badge>
            ) : isInventoryOwner ? (
              <Badge variant="blue" className="text-[9px] py-0 px-1.5">
                בעל מצאי
              </Badge>
            ) : (
              <Badge variant="cyan" className="text-[9px] py-0 px-1.5">
                סורק
              </Badge>
            )}
            {isInventoryOwner && user?.personal_number && (
              <span className="text-gray-500 font-mono text-[10px]">({user.personal_number})</span>
            )}
            {isInventoryOwner && (
              <button
                type="button"
                onClick={onOpenEditPN}
                title="ערוך מספר אישי (מ''א)"
                className="p-0.5 text-gray-500 hover:text-emerald-400 rounded transition-colors cursor-pointer"
              >
                <Edit2 className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onLogout}
          title="התנתק מהמערכת"
          className="text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden md:inline">התנתק</span>
        </Button>
      </div>
    </div>
  );
}
