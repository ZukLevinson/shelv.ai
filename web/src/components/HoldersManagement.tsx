import React, { useState } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  Phone, 
  Building2, 
  Package, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Check, 
  UserCheck,
  IdCard
} from 'lucide-react';
import axios from 'axios';
import type { InventoryHolder, Room } from '../types';
import { API_BASE_URL } from '../config';

interface Props {
  holders: InventoryHolder[];
  rooms?: Room[];
  onRefresh: () => void;
  onOpenRoomModal?: () => void;
}

export const HoldersManagement: React.FC<Props> = ({
  holders,
  rooms = [],
  onRefresh,
  onOpenRoomModal
}) => {
  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingHolder, setEditingHolder] = useState<InventoryHolder | null>(null);
  const [deletingHolder, setDeletingHolder] = useState<InventoryHolder | null>(null);

  // Add / Edit form states
  const [formName, setFormName] = useState('');
  const [formPersonalNumber, setFormPersonalNumber] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Filter holders
  const filteredHolders = holders.filter((h) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const nameMatch = h.name.toLowerCase().includes(q);
    const personalNumberMatch = (h.personal_number || '').toLowerCase().includes(q);
    const phoneMatch = (h.phone || '').toLowerCase().includes(q);
    const roomMatch = h.rooms?.some(
      (r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q)
    );
    return nameMatch || personalNumberMatch || phoneMatch || roomMatch;
  });

  // Calculate summary stats
  const totalHolders = holders.length;
  const holdersWithRooms = holders.filter(h => (h.rooms?.length || 0) > 0).length;
  const totalRoomsCount = rooms.length || holders.reduce((sum, h) => sum + (h.rooms?.length || 0), 0);
  const totalAssignedItems = holders.reduce((sum, h) => sum + (h.total_signed_items || 0), 0);
  const totalSwept = holders.reduce((sum, h) => sum + (h.swept_items_count || 0), 0);

  const openCreateModal = () => {
    setEditingHolder(null);
    setFormName('');
    setFormPersonalNumber('');
    setFormPhone('');
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (holder: InventoryHolder) => {
    setEditingHolder(holder);
    setFormName(holder.name);
    setFormPersonalNumber(holder.personal_number || '');
    setFormPhone(holder.phone || '');
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleSaveHolder = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formName.trim()) {
      setFormError('שם בעל המצאי הוא שדה חובה');
      return;
    }

    setFormLoading(true);
    try {
      if (editingHolder) {
        // Edit
        await axios.put(`${API_BASE_URL}/api/inventory/holders/${editingHolder.id}`, {
          name: formName.trim(),
          personal_number: formPersonalNumber.trim() || null,
          phone: formPhone.trim() || null
        });
        setActionSuccess(`פרטי בעל המצאי "${formName.trim()}" עודכנו בהצלחה`);
      } else {
        // Create
        await axios.post(`${API_BASE_URL}/api/inventory/holders`, {
          name: formName.trim(),
          personal_number: formPersonalNumber.trim() || null,
          phone: formPhone.trim() || null
        });
        setActionSuccess(`בעל המצאי "${formName.trim()}" נוצר בהצלחה`);
      }

      setIsAddModalOpen(false);
      onRefresh();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'אירעה שגיאה בשמירת פרטי בעל המצאי');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingHolder) return;
    setFormLoading(true);
    setFormError(null);

    try {
      await axios.delete(`${API_BASE_URL}/api/inventory/holders/${deletingHolder.id}`);
      setActionSuccess(`בעל המצאי "${deletingHolder.name}" נמחק בהצלחה`);
      setDeletingHolder(null);
      onRefresh();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'שגיאה במחיקת בעל המצאי');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-5 sm:space-y-6 max-w-full overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 sm:p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl shrink-0">
              <Users className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2 flex-wrap">
                <span>ניהול בעלי מצאי</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {totalHolders} רשומים
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">
                צפייה, הוספה, עריכה ושיוך של בעלי מצאי, חדרים ופריטים חתומים בארגון
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 w-full lg:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-gray-500 absolute right-3 top-2.5" />
              <input
                type="text"
                placeholder="חיפוש לפי שם, חדר, טלפון..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-gray-950 border border-gray-800 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 w-full transition-colors"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {onOpenRoomModal && (
                <button
                  onClick={onOpenRoomModal}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl transition-all cursor-pointer"
                >
                  <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>ניהול חדרים</span>
                </button>
              )}

              <button
                onClick={openCreateModal}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>הוסף בעל מצאי</span>
              </button>
            </div>
          </div>
        </div>

        {/* Success Alert Banner */}
        {actionSuccess && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2.5 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Quick KPI stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 pt-1">
          <div className="bg-gray-950/60 border border-gray-800/80 rounded-xl p-3 sm:p-3.5">
            <div className="text-[11px] text-gray-400 flex items-center justify-between">
              <span>סך בעלי מצאי</span>
              <Users className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="text-lg sm:text-xl font-black text-white mt-1">{totalHolders}</div>
          </div>

          <div className="bg-gray-950/60 border border-gray-800/80 rounded-xl p-3 sm:p-3.5">
            <div className="text-[11px] text-gray-400 flex items-center justify-between">
              <span>חדרים משויכים</span>
              <Building2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-lg sm:text-xl font-black text-emerald-400 mt-1">
              {totalRoomsCount} <span className="text-[10px] sm:text-xs font-normal text-gray-500">({holdersWithRooms})</span>
            </div>
          </div>

          <div className="bg-gray-950/60 border border-gray-800/80 rounded-xl p-3 sm:p-3.5">
            <div className="text-[11px] text-gray-400 flex items-center justify-between">
              <span>פריטים חתומים</span>
              <Package className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-lg sm:text-xl font-black text-white mt-1">{totalAssignedItems}</div>
          </div>

          <div className="bg-gray-950/60 border border-gray-800/80 rounded-xl p-3 sm:p-3.5">
            <div className="text-[11px] text-gray-400 flex items-center justify-between">
              <span>נסרקו בפועל</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
            </div>
            <div className="text-lg sm:text-xl font-black text-teal-300 mt-1">{totalSwept}</div>
          </div>
        </div>
      </div>

      {/* Holders Table */}
      {filteredHolders.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 sm:p-12 text-center space-y-3">
          <Users className="w-12 h-12 text-gray-600 mx-auto" />
          <h3 className="text-base font-bold text-gray-300">לא נמצאו בעלי מצאי</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            {search ? 'נסה לשנות את מונח החיפוש.' : 'עדיין לא הוגדרו בעלי מצאי במערכת. לחץ על הכפתור מעלה להוספת בעל מצאי ראשון.'}
          </p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-xl max-w-full">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-right text-xs min-w-[720px]">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-950/40 text-gray-400">
                  <th className="py-3.5 px-4 font-semibold">בעל מצאי</th>
                  <th className="py-3.5 px-4 font-semibold">
                    <div className="flex items-center gap-1.5">
                      <IdCard className="w-3.5 h-3.5 text-blue-400" />
                      <span>מ"א</span>
                    </div>
                  </th>
                  <th className="py-3.5 px-4 font-semibold">טלפון</th>
                  <th className="py-3.5 px-4 font-semibold">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>חדרים משויכים</span>
                      </div>
                      {onOpenRoomModal && (
                        <button
                          type="button"
                          onClick={onOpenRoomModal}
                          className="text-[10px] text-emerald-400 hover:text-emerald-300 font-normal hover:underline cursor-pointer"
                        >
                          ניהול חדרים
                        </button>
                      )}
                    </div>
                  </th>
                  <th className="py-3.5 px-4 font-semibold text-center">מצאי חתום</th>
                  <th className="py-3.5 px-4 font-semibold text-center">נסרק בפועל</th>
                  <th className="py-3.5 px-4 font-semibold text-left">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredHolders.map((holder) => {
                  const hasRooms = (holder.rooms?.length || 0) > 0;
                  const signedCount = holder.total_signed_items || 0;
                  const sweptCount = holder.swept_items_count || 0;

                  return (
                    <tr 
                      key={holder.id} 
                      className="hover:bg-gray-800/40 transition-colors group"
                    >
                      {/* Name & Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-600/30 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-400 text-xs shrink-0">
                            {holder.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-white group-hover:text-emerald-300 transition-colors">
                              {holder.name}
                            </div>
                            <div className="text-[10px] text-gray-500 font-mono">
                              {holder.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Personal Number (מ"א) */}
                      <td className="py-3.5 px-4 text-gray-300 font-mono">
                        {holder.personal_number ? (
                          <span className="inline-block px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-300 font-bold tracking-wider">
                            {holder.personal_number}
                          </span>
                        ) : (
                          <span className="text-gray-600 italic font-sans">לא הוזן</span>
                        )}
                      </td>

                      {/* Phone */}
                      <td className="py-3.5 px-4 text-gray-300 font-mono">
                        {holder.phone ? (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-gray-500 shrink-0" />
                            <span>{holder.phone}</span>
                          </div>
                        ) : (
                          <span className="text-gray-600 italic font-sans">לא הוזן</span>
                        )}
                      </td>

                      {/* Rooms */}
                      <td className="py-3.5 px-4">
                        {hasRooms ? (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {holder.rooms.map((rm) => (
                              <span
                                key={rm.id}
                                className="px-2 py-0.5 bg-gray-950 border border-gray-800 rounded-md text-[11px] text-gray-300 flex items-center gap-1"
                              >
                                <span>{rm.name}</span>
                                <span className="text-[9px] font-mono text-gray-500 bg-gray-800/80 px-1 rounded">
                                  {rm.code}
                                </span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-600 italic">אין חדרים משויכים</span>
                        )}
                      </td>

                      {/* Signed Count */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-gray-950 border border-gray-800 font-bold text-white">
                          {signedCount} יח'
                        </span>
                      </td>

                      {/* Swept Count */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 font-bold text-emerald-400">
                          {sweptCount} יח'
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-left">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(holder)}
                            title="ערוך פרטים"
                            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setFormError(null);
                              setDeletingHolder(holder);
                            }}
                            title="מחק בעל מצאי"
                            className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Holder Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                <span>{editingHolder ? 'עריכת פרטי בעל מצאי' : 'הוספת בעל מצאי חדש'}</span>
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2.5 text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveHolder} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-300 font-medium mb-1.5">
                  שם מלא <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="לדוגמה: ישראל ישראלי"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-medium mb-1.5 flex items-center justify-between">
                  <span>מספר אישי (מ"א)</span>
                  <span className="text-[10px] text-gray-500">למשל: 8888888</span>
                </label>
                <input
                  type="text"
                  maxLength={10}
                  placeholder="8888888"
                  value={formPersonalNumber}
                  onChange={(e) => setFormPersonalNumber(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-white placeholder-gray-500 font-mono tracking-wider focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-medium mb-1.5">
                  טלפון / נייד
                </label>
                <input
                  type="text"
                  placeholder="050-1234567"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div className="pt-3 border-t border-gray-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={formLoading}
                  className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-colors cursor-pointer"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingHolder ? 'שמור שינויים' : 'הוסף בעל מצאי'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingHolder && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">אישור מחיקת בעל מצאי</h3>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              האם אתה בטוח שברצונך למחוק את בעל המצאי <strong className="text-white">"{deletingHolder.name}"</strong>?
            </p>

            {(deletingHolder.rooms?.length > 0 || (deletingHolder.total_signed_items || 0) > 0) && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong>שים לב:</strong> משויכים לבעל מצאי זה {deletingHolder.rooms?.length || 0} חדרים ו-
                  {deletingHolder.total_signed_items || 0} פריטים חתומים. המערכת תחסום מחיקה זו עד להעברתם.
                </div>
              </div>
            )}

            {formError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-gray-800">
              <button
                type="button"
                onClick={() => setDeletingHolder(null)}
                disabled={formLoading}
                className="px-4 py-2 text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-colors cursor-pointer"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={formLoading}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors cursor-pointer"
              >
                {formLoading ? 'מוחק...' : 'מחק לצמיתות'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
