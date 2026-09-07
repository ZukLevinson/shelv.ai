import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  RotateCcw,
  X,
  Search,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Users,
  Tag,
  Scan,
  ArrowRightLeft,
  Filter,
  RefreshCw,
  Clock
} from 'lucide-react';
import { API_BASE_URL } from '../config';

export interface ActionRecord {
  id: string;
  action_type: string;
  description: string;
  entity_type: string;
  entity_id: string;
  performed_by: string;
  performed_at: string;
  reverted_at: string | null;
  reverted_by: string | null;
  state_before: string | null;
  state_after: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onActionReverted: () => void;
}

export const ActionHistoryModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onActionReverted,
}) => {
  const [actions, setActions] = useState<ActionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchActions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/actions/recent?limit=100`);
      setActions(res.data || []);
    } catch (err: any) {
      console.error('Failed to fetch action history:', err);
      setError('נכשל בטעינת היסטוריית הפעולות');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchActions();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRevert = async (actionId: string) => {
    if (!window.confirm('האם אתה בטוח שברצונך לבטל פעולה זו? המערכת תחזיר את הנתונים למצבם הקודם.')) {
      return;
    }

    setRevertingId(actionId);
    try {
      await axios.post(`${API_BASE_URL}/api/actions/${actionId}/revert`, {
        revertedBy: 'מנהל מערכת',
      });
      await fetchActions();
      onActionReverted();
    } catch (err: any) {
      console.error('Error reverting action:', err);
      alert(err.response?.data?.error || 'שגיאה בעת ביטול הפעולה');
    } finally {
      setRevertingId(null);
    }
  };

  const filteredActions = actions.filter((act) => {
    if (filterType !== 'all' && act.entity_type !== filterType) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const descMatch = act.description.toLowerCase().includes(q);
      const userMatch = act.performed_by.toLowerCase().includes(q);
      const typeMatch = act.action_type.toLowerCase().includes(q);
      return descMatch || userMatch || typeMatch;
    }
    return true;
  });

  const getActionIcon = (entityType: string) => {
    switch (entityType) {
      case 'scan':
        return <Scan className="w-4 h-4 text-emerald-400" />;
      case 'room':
        return <Building2 className="w-4 h-4 text-blue-400" />;
      case 'holder':
        return <Users className="w-4 h-4 text-purple-400" />;
      case 'masha':
        return <Tag className="w-4 h-4 text-amber-400" />;
      case 'resolution':
        return <ArrowRightLeft className="w-4 h-4 text-rose-400" />;
      default:
        return <RotateCcw className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 animate-in fade-in">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl sm:rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 bg-gray-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>מרכז ביטול פעולות והיסטוריה</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 font-normal">
                  {actions.length} פעולות מתועדות
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                כל פעולה שבוצעה במערכת (סריקה, שינוי חדר, בעל מצאי, מסח"א או אישור) ניתנת לביטול
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchActions}
              disabled={loading}
              className="p-2 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-xl transition-all"
              title="רענן רשימה"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="p-4 border-b border-gray-800/80 bg-gray-950/20 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="חיפוש פעולה או משתמש..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl pr-9 pl-3 py-1.5 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0 scrollbar-none w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 text-gray-400 shrink-0 ml-1" />
            {[
              { id: 'all', label: 'הכל' },
              { id: 'scan', label: 'סריקות' },
              { id: 'resolution', label: 'אישורי העברה' },
              { id: 'room', label: 'חדרים' },
              { id: 'holder', label: 'בעלי מצאי' },
              { id: 'masha', label: 'מסח"א' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id)}
                className={`px-3 py-1 text-xs rounded-lg font-medium transition-all shrink-0 ${
                  filterType === tab.id
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-gray-400 hover:text-white bg-gray-900 border border-gray-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action List */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2.5">
          {error && (
            <div className="p-3 bg-rose-500/20 border border-rose-500/30 text-rose-300 rounded-xl text-xs text-center">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-16 text-gray-400">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-amber-400" />
              <p className="text-xs">טוען היסטוריית פעולות...</p>
            </div>
          ) : filteredActions.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <RotateCcw className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">לא נמצאו פעולות התואמות את החיפוש</p>
            </div>
          ) : (
            filteredActions.map((act) => {
              const isReverted = Boolean(act.reverted_at);
              const dateStr = new Date(act.performed_at).toLocaleString('he-IL', {
                dateStyle: 'short',
                timeStyle: 'medium',
              });

              return (
                <div
                  key={act.id}
                  className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 rounded-xl border transition-all gap-3 ${
                    isReverted
                      ? 'bg-gray-950/40 border-gray-800/60 opacity-60'
                      : 'bg-gray-950/80 border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="p-2 bg-gray-900 rounded-xl shrink-0 border border-gray-800">
                      {getActionIcon(act.entity_type)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-sm font-bold truncate ${isReverted ? 'line-through text-gray-400' : 'text-white'}`}>
                          {act.description}
                        </p>
                        {isReverted ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-800 text-gray-400 border border-gray-700">
                            בוטלה ↩️
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            פעילה
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-1 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-gray-500" />
                          {dateStr}
                        </span>
                        <span>•</span>
                        <span>בוצע ע"י: <strong className="text-gray-300 font-semibold">{act.performed_by}</strong></span>
                        {isReverted && (
                          <>
                            <span>•</span>
                            <span className="text-amber-400/80">
                              בוטלה ע"י {act.reverted_by} ב-
                              {new Date(act.reverted_at!).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {!isReverted && (
                    <button
                      onClick={() => handleRevert(act.id)}
                      disabled={revertingId === act.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition-all shrink-0 disabled:opacity-50"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${revertingId === act.id ? 'animate-spin' : ''}`} />
                      <span>{revertingId === act.id ? 'מבטל...' : 'בטל פעולה זו ↩️'}</span>
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-gray-950/60 border-t border-gray-800 flex justify-between items-center text-xs text-gray-400">
          <span>ביטול פעולה מחזיר את המערכת והנתונים למצב המקורי ומעדכן את מנוע החריגות.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-all"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
};
