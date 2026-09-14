import React, { useState, useEffect } from 'react';
import { Tag, X, Plus, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { CategoryPicker } from './CategoryPicker';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  existingMashas?: string[];
  onCreated: () => void;
}

export const MashaCreateModal: React.FC<Props> = ({
  isOpen,
  onClose,
  existingMashas = [],
  onCreated,
}) => {
  const [masha, setMasha] = useState('');
  const [category, setCategory] = useState('Regular Workstation');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMasha('');
      setCategory('Regular Workstation');
      setDescription('');
      setError(null);
      setSaving(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const cleanMasha = masha.trim();
    if (!cleanMasha) {
      setError('יש להזין מספר מסח"א');
      return;
    }

    // Client-side duplicate check
    const isDuplicate = existingMashas.some(
      (existing) => existing.trim().toLowerCase() === cleanMasha.toLowerCase()
    );
    if (isDuplicate) {
      setError(`מסח"א "${cleanMasha}" כבר קיים במערכת`);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await axios.post(`${API_BASE_URL}/api/inventory/masha-registry`, {
        masha: cleanMasha,
        category,
        description: description.trim(),
      });
      onCreated();
      onClose();
    } catch (err: any) {
      console.error('Error creating Masha:', err);
      const msg = err.response?.data?.error || 'שגיאה ביצירת מסח"א. נסה שוב מאוחר יותר.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-gray-800 bg-gray-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white">הוספת מסח"א חדש</h3>
              <p className="text-[11px] text-gray-400">הגדרת פריט קטלוגי חדש ומפרט חומרה</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            aria-label="סגור"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2.5 text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                מספר מסח"א (Catalog #) <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                autoFocus
                required
                dir="ltr"
                value={masha}
                onChange={(e) => {
                  setMasha(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="לדוגמה: 074500123"
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-sm font-mono text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                מספר החשבון האפסנאי / מק"ט צבאי של הפריט
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-2">
                סוג פריט ולוגו מסח"א:
              </label>
              <CategoryPicker value={category} onChange={setCategory} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                תיאור ומפרט הפריט:
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="לדוגמה: HP Elite Mini 800 G9 i7-12700 16GB/512GB..."
                rows={3}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                תיאור זה יוצג לצד המסח"א בכל סריקה ודו"ח
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2.5 px-6 py-4 bg-gray-950/50 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white rounded-xl transition-colors cursor-pointer"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={saving || !masha.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-800 disabled:text-gray-500 text-white transition-all shadow-md shadow-emerald-500/20 cursor-pointer disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              <span>{saving ? 'יוצר מסח"א...' : 'צור מסח"א'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
