import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer',
  {
    variants: {
      variant: {
        default:
          'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/20 active:scale-[0.99]',
        destructive:
          'bg-rose-500/20 border border-rose-500/40 text-rose-300 hover:bg-rose-500/30 active:scale-[0.99]',
        outline:
          'border border-gray-800 bg-gray-900/80 text-gray-300 hover:text-white hover:bg-gray-800 hover:border-gray-700 active:scale-[0.99]',
        secondary:
          'bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white active:scale-[0.99]',
        ghost:
          'text-gray-400 hover:text-white hover:bg-gray-800/60',
        link:
          'text-emerald-400 underline-offset-4 hover:underline p-0 h-auto',
        emerald:
          'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 active:scale-[0.99]',
        cyan:
          'bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 active:scale-[0.99]',
        indigo:
          'bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 active:scale-[0.99]',
        amber:
          'bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 active:scale-[0.99]',
        purple:
          'bg-purple-500/10 border border-purple-500/30 text-purple-300 hover:bg-purple-500/20 active:scale-[0.99]',
      },
      size: {
        default: 'h-9 px-3.5 py-2',
        sm: 'h-8 px-2.5 text-xs',
        lg: 'h-10 px-5 text-sm',
        icon: 'h-8 w-8 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />}
        {children}
      </Comp>
    );
  }
);
Button.displayName = 'Button';
