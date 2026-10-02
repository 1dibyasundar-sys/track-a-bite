import React from 'react';
import { cn } from '../../lib/utils';

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number; // 0 to 100
  max?: number;
  indicatorColor?: 'emerald' | 'amber' | 'rose' | 'teal' | 'stone';
  size?: 'sm' | 'md' | 'lg';
}

export function Progress({
  value,
  max = 100,
  indicatorColor = 'emerald',
  size = 'md',
  className,
  ...props
}: ProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const colors = {
    emerald: 'bg-emerald-600',
    amber: 'bg-amber-600',
    rose: 'bg-rose-500',
    teal: 'bg-teal-600',
    stone: 'bg-stone-700',
  };

  const sizes = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-3.5',
  };

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cn(
        'w-full bg-stone-100 rounded-full overflow-hidden border border-stone-200/60',
        sizes[size],
        className
      )}
      {...props}
    >
      <div
        className={cn('h-full transition-all duration-300 rounded-full', colors[indicatorColor])}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
