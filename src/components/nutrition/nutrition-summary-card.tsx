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
    { label: 'Calories', value: `${nutrition.calories}`, unit: 'kcal', color: 'text-stone-900', bg: 'bg-stone-50 border-stone-200' },
    { label: 'Protein', value: formatNutrient(nutrition.protein, 'g'), unit: '', color: 'text-emerald-800', bg: 'bg-emerald-50/70 border-emerald-200/60' },
    { label: 'Carbs', value: formatNutrient(nutrition.carbohydrates, 'g'), unit: '', color: 'text-amber-800', bg: 'bg-amber-50/70 border-amber-200/60' },
    { label: 'Fat', value: formatNutrient(nutrition.fat, 'g'), unit: '', color: 'text-rose-800', bg: 'bg-rose-50/70 border-rose-200/60' },
    { label: 'Fiber', value: formatNutrient(nutrition.fiber, 'g'), unit: '', color: 'text-teal-800', bg: 'bg-teal-50/70 border-teal-200/60' },
  ];

  return (
    <Card className="border-stone-200/80">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
          <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
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
              <span className="text-2xs font-semibold uppercase tracking-wider text-stone-500">
                {m.label}
              </span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className={`text-xl sm:text-2xl font-bold tracking-tight ${m.color}`}>
                  {m.value}
                </span>
                {m.unit && <span className="text-xs text-stone-500 font-medium">{m.unit}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Secondary Details (Sodium & Sugar) */}
        {!compact && (nutrition.sodium !== undefined || nutrition.sugar !== undefined) && (
          <div className="mt-4 pt-3 border-t border-stone-100 flex items-center gap-6 text-xs text-stone-600">
            {nutrition.sodium !== undefined && (
              <div>
                <span className="font-semibold text-stone-700">Estimated Sodium:</span>{' '}
                {nutrition.sodium} mg
              </div>
            )}
            {nutrition.sugar !== undefined && (
              <div>
                <span className="font-semibold text-stone-700">Natural / Added Sugar:</span>{' '}
                {nutrition.sugar} g
              </div>
            )}
          </div>
        )}

        {/* Micronutrients */}
        {showMicronutrients && nutrition.micronutrients && nutrition.micronutrients.length > 0 && (
          <div className="mt-5 pt-4 border-t border-stone-100">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2.5">
              Key Micronutrients Detected
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {nutrition.micronutrients.map((micro, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-stone-50 border border-stone-200/60 text-xs flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between font-medium">
                    <span className="text-stone-900">{micro.name}</span>
                    <span className="text-emerald-700 font-bold">{micro.amount}</span>
                  </div>
                  {micro.healthContext && (
                    <p className="text-2xs text-stone-500 mt-1 leading-snug">
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
