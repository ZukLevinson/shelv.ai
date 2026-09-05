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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-emerald-400" />
            <h3 className="font-semibold text-base text-white">×”×’×“×¨×ª ×¤×¨×˜×™ ×ž×¡×—× {mashaItem.masha}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              ×©× ×”×¤×¨×™×˜ / ×“×’× (×œ×“×•×’×ž×”: HP Elite Mini 800 G9):
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="×”×–×Ÿ ×©× ×“×’×..."
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              ×¡×•×’ ×¤×¨×™×˜:
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="PC">×ž×—×©×‘ × ×™×™×— (PC)</option>
              <option value="Laptop">×ž×—×©×‘ × ×™×™×“ (Laptop)</option>
              <option value="Screen">×ž×¡×š (Screen)</option>
              <option value="Switch">×ž×ª×’ ×ª×¦×•×’×” / ×¨×©×ª (Switch)</option>
              <option value="Printer">×ž×“×¤×¡×ª (Printer)</option>
              <option value="TV">×˜×œ×•×•×™×–×™×” / ×ž×¡×š ×ª×¦×•×’×” (TV)</option>
              <option value="Scanner">×¡×•×¨×§ ×˜×‘×™×¢×•×ª ××¦×‘×¢ (Fingerprint Scanner)</option>
              <option value="Other">××—×¨ (Other)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              ×ž×¤×¨×˜ / ×ª×™××•×¨ × ×•×¡×£ (××•×¤×¦×™×•× ×œ×™):
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="×œ×“×•×’×ž×”: ×ž×¢×‘×“ i7-12700, 16GB ×–×™×›×¨×•×Ÿ, ×“×™×¡×§ 512GB..."
              rows={3}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-950/50 border-t border-gray-800">
          <button onClick={onClose} className="px-4 py-2 text-xs text-gray-400 hover:text-white">
            ×‘×™×˜×•×œ
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white transition-all shadow-md shadow-emerald-500/20"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? '×©×•×ž×¨...' : '×©×ž×•×¨ ×”×’×“×¨×•×ª'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

