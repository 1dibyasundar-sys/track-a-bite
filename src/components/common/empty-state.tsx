import React from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'p-12 text-center rounded-2xl border border-dashed border-stone-300 bg-stone-50/50 flex flex-col items-center justify-center max-w-lg mx-auto',
        className
      )}
    >
      {icon && (
        <div className="w-12 h-12 rounded-full bg-emerald-100/70 text-emerald-800 flex items-center justify-center mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-stone-900">{title}</h3>
      <p className="text-sm text-stone-600 mt-1.5 max-w-sm">{description}</p>
      {actionLabel && onAction && (
        <Button variant="outline" size="sm" onClick={onAction} className="mt-5">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
