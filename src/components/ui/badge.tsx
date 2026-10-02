import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'emerald' | 'amber' | 'stone' | 'blue' | 'rose' | 'outline';
  size?: 'sm' | 'md';
}

export function Badge({
  children,
  className,
  variant = 'emerald',
  size = 'md',
  ...props
}: BadgeProps) {
  const variants = {
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
    amber: 'bg-amber-50 text-amber-900 border-amber-200/80',
    stone: 'bg-stone-100 text-stone-700 border-stone-200',
    blue: 'bg-sky-50 text-sky-800 border-sky-200/80',
    rose: 'bg-rose-50 text-rose-800 border-rose-200/80',
    outline: 'bg-transparent text-stone-700 border-stone-300',
  };

  const sizes = {
    sm: 'text-2xs px-2 py-0.5 rounded-md font-medium tracking-wide',
    md: 'text-xs px-2.5 py-1 rounded-lg font-medium',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 border border-solid transition-colors',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
