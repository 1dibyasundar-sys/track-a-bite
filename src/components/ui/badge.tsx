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
    emerald: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60',
    amber: 'bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/60',
    stone: 'bg-stone-100 dark:bg-stone-800/80 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700',
    blue: 'bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border-sky-200/80 dark:border-sky-800/60',
    rose: 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200/80 dark:border-rose-800/60',
    outline: 'bg-transparent text-stone-700 dark:text-stone-300 border-stone-300 dark:border-stone-700',
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

export interface StatusBadgeProps {
  status: 'valid' | 'expiring_soon' | 'expired' | 'neutral';
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className = '' }: StatusBadgeProps) {
  const config = {
    valid: {
      color: 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
      dot: 'bg-emerald-500',
      defaultLabel: 'Valid Product',
    },
    expiring_soon: {
      color: 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-800',
      dot: 'bg-amber-500',
      defaultLabel: 'Expiring Soon',
    },
    expired: {
      color: 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800',
      dot: 'bg-rose-500',
      defaultLabel: 'Expired',
    },
    neutral: {
      color: 'bg-stone-100 dark:bg-stone-800/80 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700',
      dot: 'bg-stone-400',
      defaultLabel: 'Unverified',
    },
  }[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-colors',
        config.color,
        className
      )}
    >
      <span className={cn('w-2 h-2 rounded-full shrink-0', config.dot)} />
      <span>{label || config.defaultLabel}</span>
    </span>
  );
}
