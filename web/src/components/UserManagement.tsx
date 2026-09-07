import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Users, 
  ShieldCheck, 
  UserCheck, 
  Smartphone,
  Search, 
  Link2, 
  Unlink, 
  Trash2, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw,
  Info,
  Shield,
  Edit2
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import type { User, InventoryHolder } from '../types';
import { useAuth } from '../context/AuthContext';

interface Props {
  holders: InventoryHolder[];
  onRefreshHolders?: () => void;
}

export const UserManagement: React.FC<Props> = ({ holders, onRefreshHolders }) => {
  const { user: currentUser, refreshUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [editingPNUserId, setEditingPNUserId] = useState<string | null>(null);
  const [editingPNValue, setEditingPNValue] = useState<string>('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/users`);
      setUsers(res.data);
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err.response?.data?.error || 'שגיאה בטעינת משתמשים',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: 'inventory_owner' | 'scanner') => {
    setUpdatingUserId(userId);
    setActionMessage(null);
    try {
      await axios.put(`${API_BASE_URL}/api/users/${userId}/role`, { role: newRole });
      setActionMessage({ type: 'success', text: 'תפקיד המשתמש עודכן בהצלחה' });
      await fetchUsers();
      if (userId === currentUser?.id) {
        await refreshUser();
      }
    } catch (err: any) {
      console.error('[UserManagement] Error changing role:', err);
      setActionMessage({
        type: 'error',
        text: err.response?.data?.error || 'שגיאה בעדכון תפקיד המשתמש',
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleManagementToggle = async (userId: string, currentIsManager: boolean) => {
    setUpdatingUserId(userId);
    setActionMessage(null);
    try {
      const res = await axios.put(`${API_BASE_URL}/api/users/${userId}/management`, {
        is_manager: !currentIsManager,
      });
      setActionMessage({
        type: 'success',
        text: res.data?.message || 'הרשאת הניהול עודכנה בהצלחה',
      });
      await fetchUsers();
      if (userId === currentUser?.id) {
        await refreshUser();
      }
    } catch (err: any) {
      console.error('[UserManagement] Error toggling management:', err);
      setActionMessage({
        type: 'error',
        text: err.response?.data?.error || 'שגיאה בעדכון הרשאת ניהול',
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleHolderCouple = async (userId: string, targetHolderId: string | null) => {
    setUpdatingUserId(userId);
    setActionMessage(null);
    try {
      await axios.put(`${API_BASE_URL}/api/users/${userId}/holder`, { holder_id: targetHolderId });
      setActionMessage({
        type: 'success',
        text: targetHolderId ? 'המשתמש שויך לבעל המצאי בהצלחה' : 'השיוך לבעל המצאי הוסר בהצלחה',
      });
      await fetchUsers();
      if (onRefreshHolders) {
        onRefreshHolders();
      }
      if (userId === currentUser?.id) {
        await refreshUser();
      }
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err.response?.data?.error || 'שגיאה בעדכון שיוך בעל המצאי',
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleSavePersonalNumber = async (userId: string) => {
    setUpdatingUserId(userId);
    setActionMessage(null);
    try {
      await axios.put(`${API_BASE_URL}/api/users/${userId}/holder`, {
        personal_number: editingPNValue.trim() || null,
      });
      setActionMessage({
        type: 'success',
        text: 'המספר האישי עודכן בהצלחה',
      });
      setEditingPNUserId(null);
      await fetchUsers();
      if (userId === currentUser?.id) {
        await refreshUser();
      }
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err.response?.data?.error || 'שגיאה בעדכון מספר אישי',
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!window.confirm(`האם אתה בטוח שברצונך למחוק את המשתמש "${userName}"?`)) {
      return;
    }

    setUpdatingUserId(userId);
    setActionMessage(null);
    try {
      await axios.delete(`${API_BASE_URL}/api/users/${userId}`);
      setActionMessage({ type: 'success', text: `המשתמש "${userName}" הוסר בהצלחה` });
      await fetchUsers();
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err.response?.data?.error || 'שגיאה במחיקת המשתמש',
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.personal_number || '').toLowerCase().includes(q) ||
      (u.holder_name || '').toLowerCase().includes(q) ||
      (u.role === 'scanner' ? 'סורק' : 'בעל מצאי').includes(q)
    );
  });

  const totalManagers = users.filter((u) => u.is_manager).length;
  const totalOwners = users.filter((u) => u.role === 'inventory_owner').length;
  const totalScanners = users.filter((u) => u.role === 'scanner').length;
  const coupledUsers = users.filter((u) => Boolean(u.holder_id)).length;

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl sm:rounded-2xl p-2.5 sm:p-5 shadow-md sm:shadow-lg">
          <div className="flex items-center justify-between text-gray-400 text-[11px] sm:text-xs gap-1">
            <span className="truncate">סך משתמשים רשומים</span>
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-white mt-1 sm:mt-2 tracking-tight leading-tight">{users.length}</div>
          <div className="text-[10px] sm:text-[11px] text-gray-500 mt-0.5 sm:mt-1 truncate">מחוברים באמצעות Google</div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl sm:rounded-2xl p-2.5 sm:p-5 shadow-md sm:shadow-lg">
          <div className="flex items-center justify-between text-gray-400 text-[11px] sm:text-xs gap-1">
            <span className="truncate">הרשאת ניהול (Managers)</span>
            <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400 shrink-0" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-purple-400 mt-1 sm:mt-2 tracking-tight leading-tight">{totalManagers}</div>
          <div className="text-[10px] sm:text-[11px] text-gray-500 mt-0.5 sm:mt-1 truncate">ניהול מערכת, הרשאות</div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl sm:rounded-2xl p-2.5 sm:p-5 shadow-md sm:shadow-lg">
          <div className="flex items-center justify-between text-gray-400 text-[11px] sm:text-xs gap-1">
            <span className="truncate">בעלי מצאי (Owners)</span>
            <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400 shrink-0" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-blue-400 mt-1 sm:mt-2 tracking-tight leading-tight">{totalOwners}</div>
          <div className="text-[10px] sm:text-[11px] text-gray-500 mt-0.5 sm:mt-1 truncate">אחראים על ציוד וחדרים</div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl sm:rounded-2xl p-2.5 sm:p-5 shadow-md sm:shadow-lg">
          <div className="flex items-center justify-between text-gray-400 text-[11px] sm:text-xs gap-1">
            <span className="truncate">סורקים (Scanners)</span>
            <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400 shrink-0" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-cyan-400 mt-1 sm:mt-2 tracking-tight leading-tight">{totalScanners}</div>
          <div className="text-[10px] sm:text-[11px] text-gray-500 mt-0.5 sm:mt-1 truncate">סריקות ותחקור בשטח</div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl sm:rounded-2xl p-2.5 sm:p-5 shadow-md sm:shadow-lg col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-gray-400 text-[11px] sm:text-xs gap-1">
            <span className="truncate">משויכים לפרופיל מצאי</span>
            <Link2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-400 shrink-0" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-teal-400 mt-1 sm:mt-2 tracking-tight leading-tight">
            {coupledUsers} / {totalOwners}
          </div>
          <div className="text-[10px] sm:text-[11px] text-gray-500 mt-0.5 sm:mt-1 truncate">מקושרים לישות בעל מצאי</div>
        </div>
      </div>

      {/* Info notice about roles and management structure */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 flex items-start gap-3 text-xs text-blue-200">
        <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-semibold text-blue-100">מבנה ההרשאות והשיוכים במערכת:</div>
          <p className="text-blue-200/90 leading-relaxed">
            כל משתמש במערכת מוגדר כ<strong>בעל מצאי</strong> או כ<strong>סורק</strong>. רק בעל מצאי יכול לקבל <strong>הרשאת ניהול</strong> (המאפשרת קליטת אקסל, איפוס נתונים והקצאת הרשאות ניהול לאחרים).
            שיוך בעלי מצאי מתבצע אוטומטית לפי המספר האישי (מ"א) שהמשתמש מזין, גם אם נתוני המצאי שלו ייקלטו רק בעתיד.
          </p>
        </div>
      </div>

      {actionMessage && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
            actionMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-gray-400 hover:text-white text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Table Card */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-xl overflow-hidden">
        {/* Header & Search */}
        <div className="p-4 sm:p-5 border-b border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base sm:text-lg font-bold text-white">רשימת משתמשים והרשאות</h2>
            <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full font-semibold">
              {filteredUsers.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="חיפוש לפי שם, אימייל, מ''א, בעל מצאי..."
                className="w-full pl-3 pr-9 py-2 text-xs bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              onClick={fetchUsers}
              disabled={loading}
              className="p-2 text-gray-400 hover:text-white bg-gray-950 border border-gray-800 rounded-xl hover:border-gray-700 transition-all shrink-0 cursor-pointer"
              title="רענן רשימת משתמשים"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-gray-950/70 border-b border-gray-800 text-gray-400 font-semibold">
              <tr>
                <th className="py-3.5 px-4">משתמש</th>
                <th className="py-3.5 px-4">אימייל Google</th>
                <th className="py-3.5 px-4">תפקיד</th>
                <th className="py-3.5 px-4">מספר אישי (מ"א)</th>
                <th className="py-3.5 px-4 text-center">הרשאת ניהול</th>
                <th className="py-3.5 px-4">שיוך לבעל מצאי</th>
                <th className="py-3.5 px-4 text-center">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    {search ? 'לא נמצאו משתמשים התואמים לחיפוש' : 'אין עדיין משתמשים רשומים במערכת'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrent = u.id === currentUser?.id;
                  const isUpdating = updatingUserId === u.id;
                  const isZuk = u.email.toLowerCase() === 'zuklevinson@gmail.com';
                  const isOwner = u.role === 'inventory_owner';

                  return (
                    <tr key={u.id} className="hover:bg-gray-800/30 transition-colors">
                      {/* Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-sm">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-white flex items-center gap-1.5">
                              <span>{u.name}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 text-[10px] rounded font-medium border border-emerald-500/30">
                                  אתה
                                </span>
                              )}
                              {isZuk && (
                                <span className="px-1.5 py-0.2 bg-purple-500/20 text-purple-300 text-[10px] rounded font-medium border border-purple-500/30">
                                  מנהל ראשי
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-gray-500">
                              הצטרף: {u.created_at ? new Date(u.created_at).toLocaleDateString('he-IL') : '-'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-3.5 px-4 text-gray-300 font-mono text-[11px]">
                        {u.email}
                      </td>

                      {/* Role Selector */}
                      <td className="py-3.5 px-4">
                        <select
                          value={u.role}
                          disabled={isUpdating || isZuk}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as 'inventory_owner' | 'scanner')}
                          className={`text-xs font-semibold px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer ${
                            u.role === 'inventory_owner'
                              ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 hover:bg-blue-500/30'
                              : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30'
                          } ${isZuk ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                          <option value="inventory_owner" className="bg-gray-900 text-blue-300">
                            בעל מצאי (Inventory Owner)
                          </option>
                          <option value="scanner" className="bg-gray-900 text-cyan-300">
                            סורק (Scanner)
                          </option>
                        </select>
                      </td>

                      {/* Personal Number (מ"א) */}
                      <td className="py-3.5 px-4">
                        {editingPNUserId === u.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={editingPNValue}
                              onChange={(e) => setEditingPNValue(e.target.value)}
                              placeholder="מ''א"
                              className="w-24 px-2 py-1 text-xs bg-gray-950 border border-emerald-500 rounded-lg text-white font-mono"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSavePersonalNumber(u.id)}
                              disabled={isUpdating}
                              className="px-2 py-1 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold"
                            >
                              שמור
                            </button>
                            <button
                              onClick={() => setEditingPNUserId(null)}
                              className="px-1.5 py-1 text-[10px] text-gray-400 hover:text-white"
                            >
                              ביטול
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            {u.personal_number ? (
                              <span className="font-mono text-gray-200 bg-gray-950 px-2 py-1 rounded-lg border border-gray-800 text-[11px]">
                                {u.personal_number}
                              </span>
                            ) : (
                              <span className="text-gray-500 italic text-[11px]">לא הוזן</span>
                            )}
                            {isOwner && (
                              <button
                                onClick={() => {
                                  setEditingPNUserId(u.id);
                                  setEditingPNValue(u.personal_number || '');
                                }}
                                title="ערוך מ''א"
                                className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-800 transition-colors"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Management Permission Switch */}
                      <td className="py-3.5 px-4 text-center">
                        {isZuk ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                            <Shield className="w-3 h-3 text-purple-400" />
                            <span>מנהל ראשי</span>
                          </span>
                        ) : isOwner ? (
                          <button
                            onClick={() => handleManagementToggle(u.id, u.is_manager)}
                            disabled={isUpdating}
                            title={u.is_manager ? 'לחץ לשלילת הרשאת ניהול' : 'לחץ להענקת הרשאת ניהול'}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              u.is_manager
                                ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 hover:bg-purple-500/30'
                                : 'bg-gray-950 text-gray-400 border-gray-800 hover:text-white hover:border-gray-700'
                            }`}
                          >
                            <ShieldCheck className={`w-3.5 h-3.5 ${u.is_manager ? 'text-purple-400' : 'text-gray-500'}`} />
                            <span>{u.is_manager ? 'מנהל פעיל' : 'אין ניהול'}</span>
                          </button>
                        ) : (
                          <span
                            className="text-[10px] text-gray-500 italic"
                            title="סורק אינו יכול להחזיק בהרשאת ניהול"
                          >
                            לא ישים (סורק)
                          </span>
                        )}
                      </td>

                      {/* Holder Coupling */}
                      <td className="py-3.5 px-4">
                        {isOwner ? (
                          <div className="flex items-center gap-2">
                            <select
                              value={u.holder_id || ''}
                              disabled={isUpdating}
                              onChange={(e) => handleHolderCouple(u.id, e.target.value || null)}
                              className={`text-xs px-2.5 py-1.5 rounded-xl border max-w-xs transition-all ${
                                u.holder_id
                                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                  : 'bg-gray-950 text-amber-300 border-amber-500/30'
                              }`}
                            >
                              <option value="" className="bg-gray-900 text-gray-400">
                                -- ממתין לקליטת בעל מצאי --
                              </option>
                              {holders.map((h) => (
                                <option key={h.id} value={h.id} className="bg-gray-900 text-white">
                                  {h.name} {h.personal_number ? `(מ"א: ${h.personal_number})` : ''}
                                </option>
                              ))}
                            </select>

                            {u.holder_id && (
                              <button
                                onClick={() => handleHolderCouple(u.id, null)}
                                disabled={isUpdating}
                                title="בטל שיוך לבעל מצאי"
                                className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                              >
                                <Unlink className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-gray-500 italic">ללא שיוך (סורק)</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleDeleteUser(u.id, u.name)}
                          disabled={isCurrent || isUpdating || isZuk}
                          title={isCurrent ? 'לא ניתן למחוק את חשבונך' : isZuk ? 'מנהל ראשי מוגן' : 'מחק משתמש'}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isCurrent || isZuk
                              ? 'text-gray-600 cursor-not-allowed'
                              : 'text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer'
                          }`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
