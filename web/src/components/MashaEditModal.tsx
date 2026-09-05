import React, { useState } from 'react';
import { Tag, X, Save } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  mashaItem: { masha: string; name?: string; category?: string; description?: string } | null;
  onSaved: () => void;
}

export const MashaEditModal: React.FC<Props> = ({ isOpen, onClose, mashaItem, onSaved }) => {
  if (!isOpen || !mashaItem) return null;

  const [name, setName] = useState(mashaItem.name || '');
  const [category, setCategory] = useState(mashaItem.category || 'PC');
  const [description, setDescription] = useState(mashaItem.description || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.post(`${API_BASE_URL}/api/inventory/masha-registry/update`, {
        masha: mashaItem.masha,
        name,
        category,
        description
      });
      onSaved();
      onClose();
    } catch (err) {
      console.error('Error saving Masha', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-emerald-400 shrink-0" />
            <h3 className="font-semibold text-sm sm:text-base text-white">הגדרת פרטי מסח"א {mashaItem.masha}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              שם הפריט / דגם (לדוגמה: HP Elite Mini 800 G9):
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="הזן שם דגם..."
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              סוג פריט:
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="PC">מחשב נייח (PC)</option>
              <option value="Laptop">מחשב נייד (Laptop)</option>
              <option value="Screen">מסך (Screen)</option>
              <option value="Switch">מתג תצוגה / רשת (Switch)</option>
              <option value="Printer">מדפסת (Printer)</option>
              <option value="TV">טלוויזיה / מסך תצוגה (TV)</option>
              <option value="Scanner">סורק טביעת אצבע (Fingerprint Scanner)</option>
              <option value="Other">אחר (Other)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              מפרט / תיאור נוסף (אופציונלי):
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="לדוגמה: מעבד i7-12700, 16GB זיכרון, דיסק 512GB..."
              rows={3}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-950/50 border-t border-gray-800">
          <button onClick={onClose} className="px-4 py-2 text-xs text-gray-400 hover:text-white">
            ביטול
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white transition-all shadow-md shadow-emerald-500/20"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'שומר...' : 'שמור הגדרות'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
