import { VersionBadge } from '../VersionBadge';

export function Footer() {
  return (
    <footer className="pt-6 pb-2 border-t border-gray-900/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
      <div className="flex items-center gap-2">
        <span className="font-bold text-gray-400">shelv.ai</span>
        <span>•</span>
        <span>מערכת ניהול, סריקת מלאי וזיהוי חריגות</span>
      </div>
      <VersionBadge variant="detailed" />
    </footer>
  );
}
