import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  X, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  AlertCircle, 
  CheckCircle2, 
  User, 
  UserPlus, 
  Layers,
  ArrowRight
} from 'lucide-react';
import axios from 'axios';
import type { Room, InventoryHolder } from '../types';
import { API_BASE_URL } from '../config';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  rooms: Room[];
}

export const RoomManagementModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  rooms
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [holders, setHolders] = useState<InventoryHolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states for creating new room
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [holderId, setHolderId] = useState('');
  const [isNewHolderMode, setIsNewHolderMode] = useState(false);
  const [newHolderName, setNewHolderName] = useState('');
  const [newHolderEmail, setNewHolderEmail] = useState('');
  const [newHolderPhone, setNewHolderPhone] = useState('');

  // Editing state for an existing room
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editHolderId, setEditHolderId] = useState('');

  // Deletion confirmation
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);

  const fetchHolders = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/inventory/holders`);
      setHolders(res.data);
      if (res.data.length > 0 && !holderId) {
        setHolderId(res.data[0].id);
      }
    } catch (err) {
      console.error('Error fetching holders:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHolders();
      setError(null);
      setSuccessMsg(null);
      if (rooms.length === 0) {
        setActiveTab('create');
      }
    }
  }, [isOpen, rooms.length]);

  if (!isOpen) return null;

  const handleNameChange = (val: string) => {
    setName(val);
    // If code is empty or looks auto-generated, auto-suggest code
    if (!code || code.startsWith('ROOM-') || code.startsWith('R-')) {
      const sanitized = val.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      if (sanitized) {
        setCode(`R-${sanitized}`);
      }
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!name.trim()) {
      setError('נא להזין שם חדר');
      return;
    }
    if (!code.trim()) {
      setError('נא להזין קוד חדר');
      return;
    }

    if (isNewHolderMode) {
      if (!newHolderName.trim()) {
        setError('נא להזין שם בעל מצאי חדש');
        return;
      }
    } else if (!holderId) {
      setError('נא לבחור בעל מצאי מהרשימה');
      return;
    }

    setLoading(true);
    try {
      let resolvedHolderId = holderId;

      if (isNewHolderMode) {
        const holderRes = await axios.post(`${API_BASE_URL}/api/inventory/holders`, {
          name: newHolderName.trim(),
          email: newHolderEmail.trim() || undefined,
          phone: newHolderPhone.trim() || undefined,
        });
        resolvedHolderId = holderRes.data.id;
        await fetchHolders();
      }

      await axios.post(`${API_BASE_URL}/api/inventory/rooms`, {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        holder_id: resolvedHolderId,
      });

      setSuccessMsg(`החדר "${name}" נוצר בהצלחה`);
      setName('');
      setCode('');
      setIsNewHolderMode(false);
      setNewHolderName('');
      setNewHolderEmail('');
      setNewHolderPhone('');
      onSuccess();

      setTimeout(() => {
        setSuccessMsg(null);
        setActiveTab('list');
      }, 1000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'שגיאה ביצירת החדר');
    } finally {
      setLoading(false);
    }
  };

  const startEditRoom = (room: Room) => {
    setEditingRoomId(room.id);
    setEditName(room.name);
    setEditCode(room.code);
    setEditHolderId(room.holder_id);
    setError(null);
  };

  const cancelEditRoom = () => {
    setEditingRoomId(null);
    setError(null);
  };

  const handleUpdateRoom = async (roomId: string) => {
    setError(null);
    if (!editName.trim() || !editCode.trim() || !editHolderId) {
      setError('כל השדות הם שדות חובה בעריכת חדר');
      return;
    }

    setLoading(true);
    try {
      await axios.put(`${API_BASE_URL}/api/inventory/rooms/${roomId}`, {
        name: editName.trim(),
        code: editCode.trim().toUpperCase(),
        holder_id: editHolderId,
      });
      setSuccessMsg('פרטי החדר עודכנו בהצלחה');
      setEditingRoomId(null);
      onSuccess();
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'שגיאה בעדכון החדר');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    setLoading(true);
    setError(null);
    try {
      await axios.delete(`${API_BASE_URL}/api/inventory/rooms/${roomId}`);
      setSuccessMsg('החדר נמחק בהצלחה');
      setDeletingRoomId(null);
      onSuccess();
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'שגיאה במחיקת החדר');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">ניהול חדרים ומבנים</h3>
              <p className="text-xs text-gray-400">הגדרת רשימת החדרים ובעלי המצאי בארגון</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-800 px-6 pt-3 bg-gray-950/20 gap-2">
          <button
            onClick={() => { setActiveTab('list'); setError(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'list'
                ? 'border-emerald-500 text-emerald-400 bg-gray-800/50'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/20'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>רשימת חדרים ({rooms.length})</span>
          </button>

          <button
            onClick={() => { setActiveTab('create'); setError(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'create'
                ? 'border-emerald-500 text-emerald-400 bg-gray-800/50'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/20'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>הוספת חדר חדש</span>
          </button>
        </div>

        {/* Feedback Messages */}
        {error && (
          <div className="mx-6 mt-4 flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mx-6 mt-4 flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'create' ? (
            <form onSubmit={handleCreateRoom} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Room Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
                    <span>שם החדר</span>
                    <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="לדוגמה: חדר מחשבים 101, מעבדת חומרה"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <span className="text-[11px] text-gray-500">שם החדר כפי שיופיע בסריקות ובדו"חות</span>
                </div>

                {/* Room Code */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
                    <span>קוד / מזהה חדר</span>
                    <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="לדוגמה: R-101, LAB-B"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-emerald-400 placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors uppercase"
                  />
                  <span className="text-[11px] text-gray-500">קוד ייחודי קצר לסריקה מהירה</span>
                </div>
              </div>

              {/* Inventory Holder Section */}
              <div className="bg-gray-950/60 border border-gray-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-emerald-400" />
                    <span>שיוך בעל מצאי אחראי לחדר</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => setIsNewHolderMode(!isNewHolderMode)}
                    className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium transition-colors"
                  >
                    {isNewHolderMode ? (
                      <>
                        <ArrowRight className="w-3 h-3" />
                        <span>בחר בעל מצאי קיים</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3 h-3" />
                        <span>+ בעל מצאי חדש</span>
                      </>
                    )}
                  </button>
                </div>

                {!isNewHolderMode ? (
                  <div className="space-y-1">
                    <select
                      value={holderId}
                      onChange={(e) => setHolderId(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                    >
                      {holders.length === 0 && (
                        <option value="">אין בעלי מצאי קיימים - לחץ על "+ בעל מצאי חדש"</option>
                      )}
                      {holders.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name} {h.email ? `(${h.email})` : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-gray-500">
                      כל ציוד רשמי שמשויך לחדר זה ישויך אוטומטית לבעל המצאי הנבחר.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 pt-1 animate-in fade-in duration-150">
                    <div>
                      <input
                        type="text"
                        placeholder="שם מלא של בעל המצאי (לדוגמה: ניסים כהן)"
                        value={newHolderName}
                        onChange={(e) => setNewHolderName(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="email"
                        placeholder="כתובת אימייל (אופציונלי)"
                        value={newHolderEmail}
                        onChange={(e) => setNewHolderEmail(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                      />
                      <input
                        type="tel"
                        placeholder="מספר טלפון (אופציונלי)"
                        value={newHolderPhone}
                        onChange={(e) => setNewHolderPhone(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white transition-all shadow-lg shadow-emerald-500/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>{loading ? 'יוצר חדר...' : 'הוסף חדר למערכת'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              {rooms.length === 0 ? (
                <div className="text-center py-10 bg-gray-950/40 rounded-2xl border border-gray-800 border-dashed p-6 space-y-3">
                  <Building2 className="w-10 h-10 text-gray-600 mx-auto" />
                  <div className="text-sm font-medium text-gray-300">לא הוגדרו עדיין חדרים במערכת</div>
                  <p className="text-xs text-gray-500 max-w-sm mx-auto">
                    יש להגדיר את רשימת החדרים כאן בדשבורד לפני ייבוא קבצי אקסל וסריקת ציוד.
                  </p>
                  <button
                    onClick={() => setActiveTab('create')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-500/20 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>צור חדר ראשון</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {rooms.map((room) => {
                    const isEditing = editingRoomId === room.id;
                    const isDeleting = deletingRoomId === room.id;

                    if (isEditing) {
                      return (
                        <div
                          key={room.id}
                          className="bg-gray-950 border border-emerald-500/40 rounded-xl p-4 space-y-3"
                        >
                          <div className="text-xs font-semibold text-emerald-400">עריכת פרטי חדר</div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="text-[11px] text-gray-400">שם החדר</label>
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] text-gray-400">קוד חדר</label>
                              <input
                                type="text"
                                value={editCode}
                                onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs font-mono text-emerald-400 focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[11px] text-gray-400">בעל מצאי אחראי</label>
                            <select
                              value={editHolderId}
                              onChange={(e) => setEditHolderId(e.target.value)}
                              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                            >
                              {holders.map((h) => (
                                <option key={h.id} value={h.id}>
                                  {h.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              onClick={cancelEditRoom}
                              className="px-3 py-1.5 text-xs text-gray-400 hover:text-white"
                            >
                              ביטול
                            </button>
                            <button
                              onClick={() => handleUpdateRoom(room.id)}
                              disabled={loading}
                              className="flex items-center gap-1 px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>שמור שינויים</span>
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={room.id}
                        className="bg-gray-950/70 border border-gray-800 hover:border-gray-700/80 rounded-xl p-3.5 flex items-center justify-between gap-4 transition-all"
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">
                              {room.code}
                            </span>
                            <span className="font-semibold text-white text-sm">{room.name}</span>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3 text-gray-500" />
                              <span>בעל מצאי: <strong className="text-gray-300">{room.holder_name}</strong></span>
                            </span>

                            {room.total_items !== undefined && (
                              <span className="text-gray-500">
                                • {room.swept_items || 0} / {room.total_items} פריטים נסרקו
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5">
                          {isDeleting ? (
                            <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/30 p-1.5 rounded-lg">
                              <span className="text-[11px] text-rose-300 px-1 font-medium">בטוח למחוק?</span>
                              <button
                                onClick={() => handleDeleteRoom(room.id)}
                                className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold"
                              >
                                כן
                              </button>
                              <button
                                onClick={() => setDeletingRoomId(null)}
                                className="px-2 py-0.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-xs"
                              >
                                לא
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => startEditRoom(room)}
                                title="ערוך חדר"
                                className="p-1.5 text-gray-400 hover:text-emerald-400 hover:bg-gray-800/80 rounded-lg transition-colors"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeletingRoomId(room.id)}
                                title="מחק חדר"
                                className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-gray-950/60 border-t border-gray-800 text-xs text-gray-400">
          <span>רשימת החדרים משמשת את אפליקציית הסריקה הניידת ואת מנוע זיהוי החריגות.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
};
