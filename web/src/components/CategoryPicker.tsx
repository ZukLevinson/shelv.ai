import React, { useState } from 'react';
import { CategoryLogo } from './CategoryLogo';
import { EDITABLE_CATEGORIES, resolveCategory, type CategoryDefinition } from '../constants/categories';
import { Check, Edit2, Grid } from 'lucide-react';

interface CategoryPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export const CategoryPicker: React.FC<CategoryPickerProps> = ({ value, onChange }) => {
  const [isCustomMode, setIsCustomMode] = useState(false);
  const resolved: CategoryDefinition = resolveCategory(value);

  // Check if current value matches one of the standard options
  const isStandardValue = EDITABLE_CATEGORIES.some(
    (c) => c.value.toLowerCase() === (value || '').toLowerCase()
  );

  return (
    <div className="space-y-3">
      {/* Current Selection & Logo Preview Bar */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-gray-950/80 border border-gray-800">
        <div className="flex items-center gap-3">
          <CategoryLogo category={value} size="md" />
          <div className="text-right">
            <div className="text-xs text-gray-400">לוגו וסיווג נבחר:</div>
            <div className="text-sm font-bold text-white flex items-center gap-1.5 mt-0.5">
              <span>{resolved.shortLabelHe}</span>
              <span className="text-xs text-gray-400 font-normal">({resolved.labelEn})</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsCustomMode(!isCustomMode)}
          className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all cursor-pointer"
        >
          {isCustomMode ? (
            <>
              <Grid className="w-3.5 h-3.5" />
              <span>בחירה מרשימה</span>
            </>
          ) : (
            <>
              <Edit2 className="w-3.5 h-3.5" />
              <span>הקלדה חופשית</span>
            </>
          )}
        </button>
      </div>

      {isCustomMode ? (
        <div className="p-3.5 rounded-xl bg-gray-950 border border-gray-800 space-y-2">
          <label className="block text-xs font-semibold text-gray-300">
            הזן שם קטגוריה חופשי (בעברית או באנגלית):
          </label>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder='למשל: מחשב, מחשב נייד, מסך 24", סורק ברקוד, מתג...'
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
          <div className="flex items-center gap-2 pt-1 text-xs text-gray-400">
            <span>זיהוי לוגו אוטומטי:</span>
            <CategoryLogo category={value} size="xs" showLabel={true} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
          {EDITABLE_CATEGORIES.map((cat) => {
            const isSelected =
              value.toLowerCase() === cat.value.toLowerCase() ||
              (!isStandardValue && resolved.id === cat.categoryId && cat.value === 'Regular Workstation');

            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => onChange(cat.value)}
                className={`flex items-center gap-2 p-2.5 rounded-xl border text-right transition-all cursor-pointer relative ${
                  isSelected
                    ? 'bg-emerald-500/15 border-emerald-500/50 shadow-md shadow-emerald-500/10'
                    : 'bg-gray-950/60 border-gray-800/80 hover:bg-gray-800/40 hover:border-gray-700'
                }`}
              >
                <CategoryLogo category={cat.value} size="xs" />
                <div className="min-w-0 flex-1">
                  <div className={`text-xs font-medium truncate ${isSelected ? 'text-white font-bold' : 'text-gray-300'}`}>
                    {cat.labelHe.split('(')[0].trim()}
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono truncate">
                    {cat.labelEn}
                  </div>
                </div>
                {isSelected && (
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 absolute top-2 left-2" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CategoryPicker;
