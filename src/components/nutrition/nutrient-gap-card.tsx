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
      className={`p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#1D1A17] border border-stone-200/90 dark:border-[#38312A] text-stone-900 dark:text-stone-100 shadow-2xs space-y-5 ${className}`}
    >
      <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-[#38312A]">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100 tracking-tight">
            What Am I Missing?
          </h3>
          <p className="text-2xs text-stone-500 dark:text-stone-400 mt-0.5">
            Understanding what your meal provides and simple ways to fill the gaps.
          </p>
        </div>
        <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-stone-100 dark:bg-[#25211D] text-stone-600 dark:text-stone-300">
          Meal Balance Check
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* What You're Getting */}
        <div className="p-4 rounded-xl bg-[#F0FDF4]/70 dark:bg-[#15251C]/40 border border-[#3F8F68]/30 dark:border-[#3F8F68]/40 space-y-3">
          <span className="text-2xs font-bold uppercase tracking-wider text-[#2E6B4E] dark:text-[#5FA77F] flex items-center gap-1.5">
            <CheckIcon size={14} className="text-[#3F8F68]" />
            <span>What Your Meal Provides</span>
          </span>

          {providedNutrients.length === 0 ? (
            <p className="text-xs text-stone-500 dark:text-stone-400">Minimal micronutrients detected in this sample.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {providedNutrients.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-stone-800 dark:text-stone-200">
                  <span className="text-[#3F8F68] font-bold shrink-0">✓</span>
                  <div>
                    <span className="font-semibold">{item.name}:</span>{' '}
                    <span className="text-stone-600 dark:text-stone-400">{item.amountDescription}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* What May Be Missing */}
        <div className="p-4 rounded-xl bg-[#FFFBEB]/70 dark:bg-[#2A2016]/40 border border-[#F59E0B]/30 dark:border-[#F59E0B]/40 space-y-3">
          <span className="text-2xs font-bold uppercase tracking-wider text-[#B45309] dark:text-[#FBBF24] flex items-center gap-1.5">
            <AlertCircleIcon size={14} className="text-[#F59E0B]" />
            <span>What You May Be Missing</span>
          </span>

          {missingNutrients.length === 0 ? (
            <p className="text-xs text-[#2E6B4E] dark:text-[#5FA77F] font-medium">
              No significant nutrient gaps detected! This meal is well balanced.
            </p>
          ) : (
            <ul className="space-y-2 text-xs">
              {missingNutrients.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-stone-800 dark:text-stone-200">
                  <span className="text-amber-500 font-bold shrink-0">⚠</span>
                  <div className="space-y-0.5">
                    <span className="font-semibold text-stone-900 dark:text-stone-100">{item.name}</span>
                    <p className="text-2xs text-stone-600 dark:text-stone-400 leading-snug">{item.reason}</p>
                    <div className="text-3xs text-[#E86A33] font-bold bg-white dark:bg-[#1D1A17] px-1.5 py-0.5 rounded border border-[#F59E0B]/30 inline-block">
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
      <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-[#25211D] border border-stone-200/80 dark:border-[#38312A] text-xs text-stone-700 dark:text-stone-300 flex items-start gap-2.5">
        <InfoIcon size={16} className="text-stone-500 dark:text-stone-400 shrink-0 mt-0.5" />
        <p className="text-2xs leading-relaxed">
          <strong>Why this matters for students:</strong> {whyItMattersSummary}
        </p>
      </div>
    </div>
  );
}
