import React from 'react';
import { InfoIcon } from '../ui/icons';
import { cn } from '../../lib/utils';

export interface DisclaimerBannerProps {
  className?: string;
  variant?: 'subtle' | 'card' | 'banner';
}

export function DisclaimerBanner({ className, variant = 'subtle' }: DisclaimerBannerProps) {
  if (variant === 'card') {
    return (
      <div
        role="note"
        aria-label="Nutritional estimates disclaimer"
        className={cn(
          'p-3.5 sm:p-4 rounded-2xl bg-amber-50/70 border border-amber-200/70 text-amber-950 text-xs flex items-start gap-2.5 leading-relaxed',
          className
        )}
      >
        <InfoIcon size={16} className="text-amber-700 shrink-0 mt-0.5" />
        <p>
          <span className="font-semibold text-amber-900">Educational Nutrition Estimates:</span>{' '}
          All values are approximations based on visual portion assessment and standard regional recipes. Not intended for medical or clinical diagnosis.
        </p>
      </div>
    );
  }

  return (
    <div
      role="note"
      aria-label="Nutritional estimates disclaimer"
      className={cn(
        'p-3 rounded-xl bg-stone-100/90 border border-stone-200/80 text-stone-600 text-xs flex items-start gap-2.5 leading-relaxed',
        className
      )}
    >
      <InfoIcon size={15} className="text-stone-500 shrink-0 mt-0.5" />
      <p>
        <span className="font-semibold text-stone-800">Educational Nutrition Estimates:</span>{' '}
        All values are approximations based on visual portion assessment and standard regional recipes. Not intended for medical or clinical diagnosis.
      </p>
    </div>
  );
}

