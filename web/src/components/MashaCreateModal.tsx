import React, { useState, useEffect } from 'react';
import { Tag, Plus, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { CategoryPicker } from './CategoryPicker';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Textarea,
} from './ui';

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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden bg-gray-900 border-gray-800">
        {/* Header */}
        <DialogHeader className="px-5 py-4 border-b border-gray-800 bg-gray-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="font-bold text-sm sm:text-base text-white">הוספת מסח"א חדש</DialogTitle>
              <DialogDescription className="text-[11px] text-gray-400 mt-0.5">
                הגדרת פריט קטלוגי חדש ומפרט חומרה
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1">
          <div className="p-4 sm:p-6 space-y-4 max-h-[65vh] overflow-y-auto">
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
              <Input
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
                className="font-mono text-sm"
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
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="לדוגמה: HP Elite Mini 800 G9 i7-12700 16GB/512GB..."
                rows={3}
              />
              <p className="text-[11px] text-gray-500 mt-1">
                תיאור זה יוצג לצד המסח"א בכל סריקה ודו"ח
              </p>
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="px-6 py-4 bg-gray-950/50 border-t border-gray-800 flex-row justify-end gap-2.5">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={saving}
            >
              ביטול
            </Button>
            <Button
              type="submit"
              variant="default"
              loading={saving}
              disabled={saving || !masha.trim()}
            >
              <Plus className="w-4 h-4" />
              <span>צור מסח"א</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
