'use client';

import React from 'react';
import { NutritionProfile } from '../../lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

export interface NutritionBreakdownProps {
  nutrition: NutritionProfile;
  title?: string;
  servingDescription?: string;
  className?: string;
}

export function NutritionBreakdown({
  nutrition,
  title = 'Estimated Nutrition Breakdown',
  servingDescription,
  className = '',
}: NutritionBreakdownProps) {
  // Typical reference meal targets for young adults / college students (approx. 1/3 of daily intake)
  // Used only to scale the visual progress bars cleanly (not medical targets)
  const referenceScale = {
    protein: 30, // grams
    carbs: 80,   // grams
    fat: 25,     // grams
    fiber: 12,   // grams
  };

  const proteinPct = Math.min(100, Math.round((nutrition.protein / referenceScale.protein) * 100));
  const carbsPct = Math.min(100, Math.round((nutrition.carbohydrates / referenceScale.carbs) * 100));
  const fatPct = Math.min(100, Math.round((nutrition.fat / referenceScale.fat) * 100));
  const fiberPct = Math.min(100, Math.round((nutrition.fiber / referenceScale.fiber) * 100));

  // Determine dominant energy contributor
  const proteinCalories = nutrition.protein * 4;
  const carbsCalories = nutrition.carbohydrates * 4;
  const fatCalories = nutrition.fat * 9;
  const totalMacroCalories = Math.max(1, proteinCalories + carbsCalories + fatCalories);

  const proteinShare = Math.round((proteinCalories / totalMacroCalories) * 100);
  const carbsShare = Math.round((carbsCalories / totalMacroCalories) * 100);
  const fatShare = Math.round((fatCalories / totalMacroCalories) * 100);

  let dominantNote = 'Balanced macronutrient distribution';
  let dominantClass = 'text-stone-700 bg-stone-100 border-stone-200';
  if (carbsShare >= 55) {
    dominantNote = `Carbohydrate dominant (${carbsShare}% of meal energy)`;
    dominantClass = 'text-amber-800 bg-amber-50 border-amber-200';
  } else if (fatShare >= 45) {
    dominantNote = `Fat dominant (${fatShare}% of meal energy)`;
    dominantClass = 'text-rose-800 bg-rose-50 border-rose-200';
  } else if (proteinShare >= 25) {
    dominantNote = `Protein-rich meal (${proteinShare}% of meal energy)`;
    dominantClass = 'text-emerald-800 bg-emerald-50 border-emerald-200';
  }

  const bars = [
    {
      label: 'Protein',
      value: `${nutrition.protein}g`,
      sub: `${proteinShare}% energy`,
      pct: proteinPct,
      color: 'bg-[#E86A33]',
      track: 'bg-[#E86A33]/15',
      badge: nutrition.protein >= 15 ? 'Solid source' : nutrition.protein >= 8 ? 'Moderate' : 'Low',
      badgeColor: nutrition.protein >= 15 ? 'text-[#E86A33] bg-[#E86A33]/10 dark:bg-[#E86A33]/20' : 'text-stone-600 bg-stone-100 dark:bg-[#25211D] dark:text-stone-300',
    },
    {
      label: 'Carbohydrates',
      value: `${nutrition.carbohydrates}g`,
      sub: `${carbsShare}% energy`,
      pct: carbsPct,
      color: 'bg-[#F4A340]',
      track: 'bg-[#F4A340]/15',
      badge: carbsShare >= 60 ? 'Primary energy' : 'Balanced',
      badgeColor: 'text-[#D97706] dark:text-[#F4A340] bg-[#FEF3C7] dark:bg-[#F4A340]/20',
    },
    {
      label: 'Fat',
      value: `${nutrition.fat}g`,
      sub: `${fatShare}% energy`,
      pct: fatPct,
      color: 'bg-[#E15B64]',
      track: 'bg-[#E15B64]/15',
      badge: fatShare >= 45 ? 'High contribution' : 'Moderate',
      badgeColor: fatShare >= 45 ? 'text-[#BE123C] dark:text-[#FDA4AF] bg-[#FFE4E6] dark:bg-[#BE123C]/20' : 'text-stone-600 bg-stone-100 dark:bg-[#25211D] dark:text-stone-300',
    },
    {
      label: 'Fiber',
      value: `${nutrition.fiber}g`,
      sub: `${nutrition.fiber >= 6 ? 'High gut fiber' : 'Moderate fiber'}`,
      pct: fiberPct,
      color: 'bg-[#3F8F68]',
      track: 'bg-[#3F8F68]/15',
      badge: nutrition.fiber >= 6 ? 'Gut-friendly' : nutrition.fiber >= 3 ? 'Some fiber' : 'Needs boost',
      badgeColor: nutrition.fiber >= 6 ? 'text-[#3F8F68] bg-[#3F8F68]/10 dark:bg-[#3F8F68]/20' : 'text-[#D97706] bg-[#FEF3C7] dark:bg-[#F4A340]/20',
    },
  ];

  return (
    <Card className={`border-stone-200/90 dark:border-[#38312A] bg-white dark:bg-[#1D1A17] shadow-sm ${className}`}>
      <CardHeader className="pb-3 border-b border-stone-100 dark:border-[#38312A]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base sm:text-lg text-stone-900 dark:text-stone-100">{title}</CardTitle>
              <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-stone-100 dark:bg-[#25211D] text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-[#38312A]">
                Estimated nutrition
              </span>
            </div>
            {servingDescription && (
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Calculated for: <span className="font-semibold text-stone-700 dark:text-stone-300">{servingDescription}</span>
              </p>
            )}
          </div>

          <div className="flex items-baseline gap-1 self-start sm:self-auto bg-stone-50 dark:bg-[#25211D] px-3 py-1.5 rounded-xl border border-stone-200/70 dark:border-[#38312A]">
            <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">Estimated Energy:</span>
            <span className="text-lg font-bold text-stone-900 dark:text-stone-100">{nutrition.calories}</span>
            <span className="text-xs font-semibold text-stone-600 dark:text-stone-400">kcal</span>
          </div>
        </div>

        {/* Dominant energy badge */}
        <div className="pt-2">
          <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border ${dominantClass}`}>
            <span>📊</span>
            <span>{dominantNote}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Visual Macro Progress Bars */}
        <div className="space-y-3.5">
          {bars.map((bar, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-stone-900 dark:text-stone-100">{bar.label}</span>
                  <span className={`text-3xs font-semibold px-1.5 py-0.2 rounded ${bar.badgeColor}`}>
                    {bar.badge}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-3xs text-stone-500 dark:text-stone-400">{bar.sub}</span>
                  <span className="font-bold text-stone-900 dark:text-stone-100 text-sm">{bar.value}</span>
                </div>
              </div>

              {/* Progress Track */}
              <div className={`w-full h-3 rounded-full ${bar.track} overflow-hidden p-0.5`}>
                <div
                  className={`h-full rounded-full ${bar.color} transition-all duration-500`}
                  style={{ width: `${Math.max(6, bar.pct)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Micronutrients / Electrolytes if present */}
        {nutrition.micronutrients && nutrition.micronutrients.length > 0 && (
          <div className="pt-4 border-t border-stone-100 dark:border-[#38312A]">
            <h4 className="text-2xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-2">
              Detected Micronutrient Contributions
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {nutrition.micronutrients.map((micro, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-stone-50 dark:bg-[#25211D] border border-stone-200/70 dark:border-[#38312A] text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-stone-800 dark:text-stone-200">{micro.name}</span>
                    <span className="font-bold text-[#3F8F68] dark:text-[#5FA77F]">{micro.amount}</span>
                  </div>
                  {micro.healthContext && (
                    <span className="text-3xs text-stone-500 dark:text-stone-400 block mt-0.5 line-clamp-1">
                      {micro.healthContext}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Disclaimer Note */}
        <p className="text-3xs text-stone-500 dark:text-stone-400 italic pt-1 text-center">
          Nutritional figures are educational estimates derived from visual plate segmentation and standard regional recipes, not lab chromatography.
        </p>
      </CardContent>
    </Card>
  );
}
