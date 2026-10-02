import React from 'react';
import { InfoIcon } from '../ui/icons';

export function DisclaimerBanner() {
  return (
    <aside aria-label="Nutritional estimates disclaimer" className="bg-amber-50/90 border-b border-amber-200/70 text-amber-950 py-2 px-4 text-xs">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <InfoIcon size={15} className="text-amber-700 shrink-0" />
          <p className="leading-snug">
            <span className="font-semibold text-amber-900">Educational Nutrition Estimates:</span>{' '}
            All values are approximations based on visual portion assessment and standard regional recipes. Not intended for medical or clinical diagnosis.
          </p>
        </div>
      </div>
    </aside>
  );
}
