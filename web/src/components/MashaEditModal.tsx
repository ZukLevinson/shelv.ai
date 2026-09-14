import React, { useState, useEffect } from 'react';
import { Tag, Save } from 'lucide-react';
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
  Textarea,
} from './ui';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  mashaItem: { masha: string; category?: string; description?: string } | null;
  onSaved: () => void;
}

export const MashaEditModal: React.FC<Props> = ({ isOpen, onClose, mashaItem, onSaved }) => {
  const [category, setCategory] = useState('Regular Workstation');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mashaItem) {
      setCategory(mashaItem.category === 'PC' ? 'Regular Workstation' : (mashaItem.category || 'Regular Workstation'));
      setDescription(mashaItem.description || '');
    }
  }, [mashaItem]);

  const handleSave = async () => {
    if (!mashaItem) return;
    setSaving(true);
    try {
      await axios.post(`${API_BASE_URL}/api/inventory/masha-registry/update`, {
        masha: mashaItem.masha,
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

  if (!mashaItem) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden bg-gray-900 border-gray-800">
        <DialogHeader className="px-5 py-4 border-b border-gray-800 bg-gray-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="font-bold text-sm sm:text-base text-white">
                הגדרת פרטי מסח"א {mashaItem.masha}
              </DialogTitle>
              <DialogDescription className="text-[11px] text-gray-400 mt-0.5">
                עדכון סוג פריט, אייקון ומפרט טכני
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-4 sm:p-6 space-y-4 max-h-[65vh] overflow-y-auto">
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
              rows={4}
            />
          </div>
        </div>

        <DialogFooter className="px-6 py-4 bg-gray-950/50 border-t border-gray-800 flex-row justify-end gap-2.5">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            ביטול
          </Button>
          <Button
            variant="default"
            onClick={handleSave}
            loading={saving}
          >
            <Save className="w-4 h-4" />
            <span>שמור הגדרות</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
