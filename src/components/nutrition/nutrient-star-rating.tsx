import React from 'react';
import { NutrientRichnessScore } from '../../lib/types';
import { SparklesIcon } from '../ui/icons';

export interface NutrientStarRatingProps {
  richness: NutrientRichnessScore;
  className?: string;
}

export function NutrientStarRating({ richness, className = '' }: NutrientStarRatingProps) {
  const { stars, label, explanation, highlights } = richness;

  // Render 5 stars (filled, half, or outline)
  const starElements = Array.from({ length: 5 }, (_, i) => {
    const starIndex = i + 1;
    const isFull = stars >= starIndex;
    const isHalf = !isFull && stars >= starIndex - 0.5;

    return (
      <span key={i} className="text-xl sm:text-2xl text-amber-500 inline-block">
        {isFull ? (
          '★'
        ) : isHalf ? (
          <span className="relative inline-block">
            <span className="text-stone-300 dark:text-stone-700">★</span>
            <span className="absolute left-0 top-0 overflow-hidden w-[50%] text-amber-500">★</span>
          </span>
        ) : (
          <span className="text-stone-300 dark:text-stone-700">★</span>
        )}
      </span>
    );
  });

  return (
    <div
      className={`p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#1D1A17] border border-stone-200/90 dark:border-[#38312A] text-stone-900 dark:text-stone-100 shadow-2xs space-y-3 ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100 dark:border-stone-800">
        <div>
          <span className="text-2xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 block mb-1">
            Nutrient Richness
          </span>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-0.5" aria-label={`Rating: ${stars} out of 5 stars`}>
              {starElements}
            </div>
            <span className="text-base sm:text-lg font-black text-stone-900 dark:text-stone-100 tracking-tight font-mono">
              {stars.toFixed(1)} / 5.0
            </span>
          </div>
        </div>

        <span className="self-start sm:self-auto text-2xs font-bold px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60">
          {label}
        </span>
      </div>

      <p className="text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed font-medium">
        {explanation}
      </p>

      {highlights && highlights.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {highlights.map((hl, idx) => (
            <span
              key={idx}
              className="text-2xs px-2.5 py-1 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-semibold flex items-center gap-1"
            >
              <SparklesIcon size={12} className="text-emerald-700 dark:text-emerald-400" />
              <span>{hl}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
