import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

export const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold transition-colors leading-normal select-none',
  {
    variants: {
      variant: {
        default:
          'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
        secondary:
          'bg-gray-800 text-gray-300 border border-gray-700/50',
        destructive:
          'bg-rose-500/20 text-rose-300 border border-rose-500/30',
        outline:
          'text-gray-300 border border-gray-700/60 bg-transparent',
        emerald:
          'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
        purple:
          'bg-purple-500/20 text-purple-300 border border-purple-500/40',
        blue:
          'bg-blue-500/20 text-blue-300 border border-blue-500/40',
        cyan:
          'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40',
        amber:
          'bg-amber-500/20 text-amber-300 border border-amber-500/40',
        rose:
          'bg-rose-500/20 text-rose-300 border border-rose-500/30',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
