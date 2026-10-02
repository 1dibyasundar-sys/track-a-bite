import React from 'react';
import { BalanceAssessment } from '../../lib/types';
import { LeafIcon, AlertCircleIcon, InfoIcon, ShieldCheckIcon } from '../ui/icons';

export interface BalanceBadgeProps {
  assessment: BalanceAssessment;
  showExplanation?: boolean;
}

export function BalanceBadge({ assessment, showExplanation = true }: BalanceBadgeProps) {
  const configs = {
    balanced: {
      bg: 'bg-emerald-50 text-emerald-900 border-emerald-200',
      icon: <ShieldCheckIcon size={16} className="text-emerald-700" />,
      accentColor: 'text-emerald-800',
    },
    'carb-heavy': {
      bg: 'bg-amber-50 text-amber-950 border-amber-200',
      icon: <InfoIcon size={16} className="text-amber-700" />,
      accentColor: 'text-amber-800',
    },
    'protein-light': {
      bg: 'bg-stone-100 text-stone-900 border-stone-300',
      icon: <InfoIcon size={16} className="text-stone-600" />,
      accentColor: 'text-stone-800',
    },
    'fat-heavy': {
      bg: 'bg-orange-50 text-orange-950 border-orange-200',
      icon: <AlertCircleIcon size={16} className="text-orange-700" />,
      accentColor: 'text-orange-800',
    },
    'fiber-rich': {
      bg: 'bg-teal-50 text-teal-950 border-teal-200',
      icon: <LeafIcon size={16} className="text-teal-700" />,
      accentColor: 'text-teal-800',
    },
    'low-vegetable': {
      bg: 'bg-stone-100 text-stone-900 border-stone-200',
      icon: <InfoIcon size={16} className="text-stone-600" />,
      accentColor: 'text-stone-800',
    },
  };

  const config = configs[assessment.rating] || configs.balanced;

  return (
    <div className={`p-4 rounded-xl border ${config.bg} space-y-2`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {config.icon}
          <span className="font-bold text-sm tracking-tight">{assessment.label}</span>
        </div>
        <span className="text-2xs font-semibold px-2 py-0.5 rounded-md bg-white/80 border border-current">
          Glycemic Load: {assessment.glycemicImpactEstimate}
        </span>
      </div>

      <p className="text-xs font-medium leading-relaxed">{assessment.summary}</p>

      {showExplanation && assessment.detail && (
        <p className="text-2xs leading-relaxed text-stone-600 pt-1 border-t border-black/5">
          {assessment.detail}
        </p>
      )}
    </div>
  );
}
