import React from 'react';
import { MacroDistribution } from '../../lib/types';

export interface MacroDistributionBarProps {
  distribution: MacroDistribution;
  className?: string;
  showLabels?: boolean;
}

export function MacroDistributionBar({
  distribution,
  className = '',
  showLabels = true,
}: MacroDistributionBarProps) {
  const { carbsPercent, proteinPercent, fatPercent } = distribution;

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Segmented Bar */}
      <div className="h-4 w-full bg-stone-100 rounded-full overflow-hidden flex border border-stone-200/80 shadow-2xs">
        <div
          style={{ width: `${carbsPercent}%` }}
          className="bg-amber-500 hover:bg-amber-600 transition-all duration-300 relative group"
          title={`Carbohydrates: ${carbsPercent}%`}
        />
        <div
          style={{ width: `${proteinPercent}%` }}
          className="bg-emerald-600 hover:bg-emerald-700 transition-all duration-300 relative group"
          title={`Protein: ${proteinPercent}%`}
        />
        <div
          style={{ width: `${fatPercent}%` }}
          className="bg-rose-500 hover:bg-rose-600 transition-all duration-300 relative group"
          title={`Fat: ${fatPercent}%`}
        />
      </div>

      {/* Legend & Details */}
      {showLabels && (
        <div className="flex flex-wrap items-center justify-between text-xs gap-y-1.5 pt-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="font-semibold text-stone-800">Carbs:</span>
            <span className="text-stone-600">{carbsPercent}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
            <span className="font-semibold text-stone-800">Protein:</span>
            <span className="text-stone-600">{proteinPercent}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span className="font-semibold text-stone-800">Fat:</span>
            <span className="text-stone-600">{fatPercent}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
