import React from 'react';
import { NutritionProfile } from '../../lib/types';
import { formatNutrient } from '../../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

export interface NutritionSummaryCardProps {
  nutrition: NutritionProfile;
  title?: string;
  showMicronutrients?: boolean;
  compact?: boolean;
}

export function NutritionSummaryCard({
  nutrition,
  title = 'Estimated Nutritional Profile',
  showMicronutrients = true,
  compact = false,
}: NutritionSummaryCardProps) {
  const macros = [
    { label: 'Calories', value: `${nutrition.calories}`, unit: 'kcal', color: 'text-stone-900 dark:text-stone-100', bg: 'bg-stone-50 dark:bg-[#25211D] border-stone-200 dark:border-[#38312A]' },
    { label: 'Protein', value: formatNutrient(nutrition.protein, 'g'), unit: '', color: 'text-[#E86A33] dark:text-[#F4A340]', bg: 'bg-[#FEF7EE] dark:bg-[#251A14] border-[#FBD5BD] dark:border-[#4D2918]' },
    { label: 'Carbs', value: formatNutrient(nutrition.carbohydrates, 'g'), unit: '', color: 'text-amber-800 dark:text-amber-300', bg: 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-200/60 dark:border-amber-800/60' },
    { label: 'Fat', value: formatNutrient(nutrition.fat, 'g'), unit: '', color: 'text-rose-800 dark:text-rose-300', bg: 'bg-rose-50/70 dark:bg-rose-950/40 border-rose-200/60 dark:border-rose-800/60' },
    { label: 'Fiber', value: formatNutrient(nutrition.fiber, 'g'), unit: '', color: 'text-[#3F8F68] dark:text-[#5FA77F]', bg: 'bg-[#F0FDF4] dark:bg-[#15251C] border-[#3F8F68]/30 dark:border-[#3F8F68]/40' },
  ];

  return (
    <Card className="border-stone-200/80 dark:border-[#38312A]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
          <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700">
            Estimated
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {/* Macro Pill Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3">
          {macros.map((m, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-xl border ${m.bg} flex flex-col justify-between ${idx === 0 ? 'col-span-2 sm:col-span-1' : ''}`}
            >
              <span className="text-2xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                {m.label}
              </span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className={`text-xl sm:text-2xl font-bold tracking-tight ${m.color}`}>
                  {m.value}
                </span>
                {m.unit && <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">{m.unit}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Secondary Details (Sodium & Sugar) */}
        {!compact && (nutrition.sodium !== undefined || nutrition.sugar !== undefined) && (
          <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center gap-6 text-xs text-stone-600 dark:text-stone-300">
            {nutrition.sodium !== undefined && (
              <div>
                <span className="font-semibold text-stone-700 dark:text-stone-200">Estimated Sodium:</span>{' '}
                {nutrition.sodium} mg
              </div>
            )}
            {nutrition.sugar !== undefined && (
              <div>
                <span className="font-semibold text-stone-700 dark:text-stone-200">Natural / Added Sugar:</span>{' '}
                {nutrition.sugar} g
              </div>
            )}
          </div>
        )}

        {/* Micronutrients */}
        {showMicronutrients && nutrition.micronutrients && nutrition.micronutrients.length > 0 && (
          <div className="mt-5 pt-4 border-t border-stone-100 dark:border-stone-800">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-2.5">
              Key Micronutrients Detected
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {nutrition.micronutrients.map((micro, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-stone-50 dark:bg-[#25211D] border border-stone-200/60 dark:border-[#38312A] text-xs flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between font-medium">
                    <span className="text-stone-900 dark:text-stone-100">{micro.name}</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold">{micro.amount}</span>
                  </div>
                  {micro.healthContext && (
                    <p className="text-2xs text-stone-500 dark:text-stone-400 mt-1 leading-snug">
                      {micro.healthContext}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
