import React from 'react';
import { resolveCategory, type CategoryDefinition } from '../constants/categories';

export interface CategoryLogoProps {
  category?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showEnglish?: boolean;
  sublabel?: string;
  className?: string;
  onClick?: () => void;
}

const SIZE_CONFIGS = {
  xs: {
    container: 'w-7 h-7 rounded-lg border',
    icon: 'w-3.5 h-3.5',
    textMain: 'text-xs',
    textSub: 'text-[10px]',
  },
  sm: {
    container: 'w-8 h-8 rounded-xl border',
    icon: 'w-4 h-4',
    textMain: 'text-xs font-semibold',
    textSub: 'text-[10px]',
  },
  md: {
    container: 'w-10 h-10 rounded-xl border',
    icon: 'w-5 h-5',
    textMain: 'text-sm font-semibold',
    textSub: 'text-xs',
  },
  lg: {
    container: 'w-12 h-12 rounded-2xl border',
    icon: 'w-6 h-6',
    textMain: 'text-base font-bold',
    textSub: 'text-xs',
  },
};

export const CategoryLogo: React.FC<CategoryLogoProps> = ({
  category,
  size = 'sm',
  showLabel = false,
  showEnglish = true,
  sublabel,
  className = '',
  onClick,
}) => {
  const cat: CategoryDefinition = resolveCategory(category);
  const Icon = cat.icon;
  const cfg = SIZE_CONFIGS[size];

  // The actual category logo badge element
  const logoBadge = (
    <div
      className={`relative flex items-center justify-center shrink-0 shadow-sm transition-transform duration-200 group-hover:scale-105 ${cfg.container} ${cat.theme.bgColor} ${cat.theme.borderColor} bg-gradient-to-br ${cat.theme.gradientBg} ${className}`}
      title={`${cat.labelHe} (${cat.labelEn})`}
    >
      <Icon className={`${cfg.icon} ${cat.theme.textColor} shrink-0 drop-shadow-sm`} />
    </div>
  );

  if (!showLabel) {
    if (onClick) {
      return (
        <button
          type="button"
          onClick={onClick}
          className="focus:outline-none focus:ring-2 focus:ring-emerald-500/40 rounded-xl"
        >
          {logoBadge}
        </button>
      );
    }
    return logoBadge;
  }

  // Display original category name as subtext if it differs and adds value
  const originalClean = (category || '').trim();
  const displaySubtext = sublabel ?? (
    showEnglish
      ? (originalClean && originalClean !== cat.shortLabelHe && originalClean !== cat.labelHe ? originalClean : cat.labelEn)
      : undefined
  );

  const content = (
    <div className="flex items-center gap-2.5 group">
      {logoBadge}
      <div className="flex flex-col text-right min-w-0">
        <span className={`${cfg.textMain} text-gray-200 truncate leading-tight group-hover:text-white transition-colors`}>
          {cat.shortLabelHe}
        </span>
        {displaySubtext && (
          <span className={`${cfg.textSub} text-gray-400 font-mono truncate leading-tight mt-0.5`}>
            {displaySubtext}
          </span>
        )}
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="focus:outline-none text-right rounded-xl"
      >
        {content}
      </button>
    );
  }

  return content;
};

export default CategoryLogo;
