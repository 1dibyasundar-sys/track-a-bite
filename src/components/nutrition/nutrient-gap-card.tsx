import React from 'react';
import { NutrientGapAssessment } from '../../lib/types';
import { CheckIcon, AlertCircleIcon, InfoIcon } from '../ui/icons';

export interface NutrientGapCardProps {
  gaps: NutrientGapAssessment;
  className?: string;
}

export function NutrientGapCard({ gaps, className = '' }: NutrientGapCardProps) {
  const { providedNutrients, missingNutrients, whyItMattersSummary } = gaps;

  return (
    <div
      className={`p-5 sm:p-6 rounded-2xl bg-white border border-stone-200/90 shadow-2xs space-y-5 ${className}`}
    >
      <div className="flex items-center justify-between pb-3 border-b border-stone-100">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-stone-900 tracking-tight">
            What Am I Missing?
          </h3>
          <p className="text-2xs text-stone-500 mt-0.5">
            Understanding what your meal provides and simple ways to fill the gaps.
          </p>
        </div>
        <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-stone-100 text-stone-600">
          Meal Balance Check
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* What You're Getting */}
        <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200/60 space-y-3">
          <span className="text-2xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
            <CheckIcon size={14} className="text-emerald-700" />
            <span>What Your Meal Provides</span>
          </span>

          {providedNutrients.length === 0 ? (
            <p className="text-xs text-stone-500">Minimal micronutrients detected in this sample.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {providedNutrients.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-stone-800">
                  <span className="text-emerald-600 font-bold shrink-0">✓</span>
                  <div>
                    <span className="font-semibold">{item.name}:</span>{' '}
                    <span className="text-stone-600">{item.amountDescription}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* What May Be Missing */}
        <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/60 space-y-3">
          <span className="text-2xs font-bold uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
            <AlertCircleIcon size={14} className="text-amber-700" />
            <span>What You May Be Missing</span>
          </span>

          {missingNutrients.length === 0 ? (
            <p className="text-xs text-emerald-800 font-medium">
              No significant nutrient gaps detected! This meal is well balanced.
            </p>
          ) : (
            <ul className="space-y-2 text-xs">
              {missingNutrients.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-stone-800">
                  <span className="text-amber-600 font-bold shrink-0">⚠</span>
                  <div className="space-y-0.5">
                    <span className="font-semibold text-amber-950">{item.name}</span>
                    <p className="text-2xs text-stone-600 leading-snug">{item.reason}</p>
                    <div className="text-3xs text-emerald-800 font-bold bg-white/70 px-1.5 py-0.5 rounded border border-amber-200/60 inline-block">
                      Easy add: {item.practicalSource}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Why it Matters Summary */}
      <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80 text-xs text-stone-700 flex items-start gap-2.5">
        <InfoIcon size={16} className="text-stone-500 shrink-0 mt-0.5" />
        <p className="text-2xs leading-relaxed">
          <strong>Why this matters for students:</strong> {whyItMattersSummary}
        </p>
      </div>
    </div>
  );
}
