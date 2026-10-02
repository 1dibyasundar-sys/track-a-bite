import React from 'react';
import { cn } from '../../lib/utils';

export interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  description?: string;
  centered?: boolean;
  action?: React.ReactNode;
  className?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  centered = false,
  action,
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        'mb-8 sm:mb-12 flex flex-col',
        centered ? 'items-center text-center' : 'items-start text-left',
        action && 'md:flex-row md:items-end md:justify-between',
        className
      )}
    >
      <div className={cn(centered ? 'max-w-2xl' : 'max-w-3xl')}>
        {eyebrow && (
          <span className="inline-block text-xs font-semibold tracking-wider uppercase text-[#E86A33] dark:text-[#F4A340] bg-[#FEF7EE] dark:bg-[#2A1C14] px-2.5 py-1 rounded-md mb-3 border border-[#E86A33]/20 dark:border-[#E86A33]/30">
            {eyebrow}
          </span>
        )}
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-stone-900 dark:text-stone-100 leading-tight">
          {title}
        </h2>
        {description && (
          <p className="mt-3 text-sm sm:text-base text-stone-600 dark:text-stone-400 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-4 md:mt-0 shrink-0">{action}</div>}
    </div>
  );
}
