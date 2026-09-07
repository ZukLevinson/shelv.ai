import { RefreshCw } from 'lucide-react';

export function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
        <p className="text-xs text-gray-400 font-medium">טוען נתונים...</p>
      </div>
    </div>
  );
}
