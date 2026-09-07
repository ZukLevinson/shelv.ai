import type { ElementType } from 'react';
import { Link } from 'react-router-dom';

export interface MetricCardProps {
  to: string;
  title: string;
  value: number | string;
  icon: ElementType;
  variant: 'blue' | 'emerald' | 'rose' | 'amber';
  tooltip?: string;
}

const VARIANT_STYLES = {
  blue: {
    border: 'border-gray-800 hover:border-blue-500/40',
    titleText: 'text-gray-400 group-hover:text-blue-300',
    iconColor: 'text-blue-400',
    valueColor: 'text-white',
  },
  emerald: {
    border: 'border-gray-800 hover:border-emerald-500/40',
    titleText: 'text-gray-400 group-hover:text-emerald-300',
    iconColor: 'text-emerald-400',
    valueColor: 'text-emerald-400',
  },
  rose: {
    border: 'border-rose-900/30 hover:border-rose-500/50',
    titleText: 'text-rose-300 group-hover:text-rose-200',
    iconColor: 'text-rose-400',
    valueColor: 'text-rose-400',
  },
  amber: {
    border: 'border-amber-900/30 hover:border-amber-500/50',
    titleText: 'text-amber-300 group-hover:text-amber-200',
    iconColor: 'text-amber-400',
    valueColor: 'text-amber-400',
  },
};

export function MetricCard({ to, title, value, icon: Icon, variant, tooltip }: MetricCardProps) {
  const styles = VARIANT_STYLES[variant];

  return (
    <Link
      to={to}
      className={`bg-gray-900 border ${styles.border} rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 shadow-md sm:shadow-lg transition-all block group cursor-pointer`}
      title={tooltip}
    >
      <div className={`flex items-center justify-between ${styles.titleText} text-[11px] sm:text-xs transition-colors gap-1`}>
        <span className="truncate">{title}</span>
        <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${styles.iconColor} shrink-0`} />
      </div>
      <div className={`text-lg sm:text-2xl font-black ${styles.valueColor} mt-1 sm:mt-1.5 tracking-tight leading-tight`}>
        {value}
      </div>
    </Link>
  );
}
