import React from 'react';
import { cn } from '../../lib/utils';

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'bg-white dark:bg-[#1D1A17] border border-[#E8DED2] dark:border-[#38312A] text-stone-900 dark:text-stone-100 rounded-2xl shadow-xs transition-colors duration-200 overflow-hidden',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function GlassCard({
  className,
  children,
  interactive = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        interactive ? 'glass-panel-interactive' : 'glass-panel',
        'rounded-2xl text-stone-900 dark:text-stone-100 overflow-hidden',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  subtitle,
  icon,
  trend,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  label: string;
  value: React.ReactNode;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: { value: string; positive?: boolean };
}) {
  return (
    <div
      className={cn(
        'bg-white dark:bg-[#1D1A17] border border-[#E8DED2] dark:border-[#38312A] p-5 rounded-2xl shadow-xs transition-colors',
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
          {label}
        </span>
        {icon && (
          <div className="w-8 h-8 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 flex items-center justify-center">
            {icon}
          </div>
        )}
      </div>
      <div className="mt-2 text-2xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
        {value}
      </div>
      {(subtitle || trend) && (
        <div className="mt-1 flex items-center gap-2 text-xs">
          {trend && (
            <span
              className={cn(
                'font-bold',
                trend.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              )}
            >
              {trend.value}
            </span>
          )}
          {subtitle && <span className="text-stone-500 dark:text-stone-400">{subtitle}</span>}
        </div>
      )}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-5 sm:p-6 pb-3', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('text-lg font-semibold tracking-tight text-stone-900 dark:text-stone-100', className)}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-sm text-stone-600 dark:text-stone-400 mt-1', className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-5 sm:p-6 pt-0', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('p-5 sm:p-6 pt-3 border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-between', className)}
      {...props}
    >
      {children}
    </div>
  );
}
