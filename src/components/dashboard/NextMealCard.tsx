'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { SparklesIcon, CheckIcon } from '../ui/icons';
import { NextMealRecommendation, HostelFilterMode } from '../../lib/types/analytics';

interface NextMealCardProps {
  recommendations: NextMealRecommendation[];
  proteinGapG?: number;
  calorieGapKcal?: number;
  isHostelite?: boolean;
  onFilterChange?: (mode: HostelFilterMode) => void;
}

export function NextMealCard({
  recommendations = [],
  proteinGapG = 0,
  calorieGapKcal = 0,
  isHostelite = true,
  onFilterChange,
}: NextMealCardProps) {
  const [activeFilter, setActiveFilter] = useState<HostelFilterMode>('all');

  const filterOptions: { id: HostelFilterMode; label: string }[] = [
    { id: 'all', label: 'All Recommendations' },
    { id: 'no_cook', label: 'No Cook' },
    { id: 'budget', label: 'Budget (₹)' },
    { id: 'high_protein', label: 'High Protein' },
    { id: 'mess_friendly', label: 'Mess Friendly' },
    { id: 'no_fridge', label: 'No Fridge' },
  ];

  const handleFilterSelect = (mode: HostelFilterMode) => {
    setActiveFilter(mode);
    onFilterChange?.(mode);
  };

  // Filter recommendations based on active filter
  const displayedRecs = recommendations.filter(rec => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'no_cook') return rec.noCookRequired || rec.preparationType === 'no-cook';
    if (activeFilter === 'budget') return rec.affordabilityCategory === 'budget' || rec.estimatedCost.includes('₹1');
    if (activeFilter === 'high_protein') return (rec.estimatedNutrition?.protein || 0) >= 8;
    if (activeFilter === 'mess_friendly') return rec.messFriendly === true || rec.preparationType === 'canteen';
    if (activeFilter === 'no_fridge') return rec.requiresFridge === false;
    return true;
  });

  const topRec = displayedRecs[0] || recommendations[0];

  if (!topRec) {
    return (
      <Card className="border border-stone-200/80 bg-white shadow-xs">
        <CardContent className="p-5 sm:p-6 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">✨</span>
            <h2 className="text-sm font-semibold text-stone-900">Next Meal Plan</h2>
          </div>
          <p className="text-xs text-stone-500">
            Log your current meals to receive personalized, budget-friendly next-meal suggestions.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-emerald-200/80 bg-gradient-to-br from-emerald-50/40 via-white to-white shadow-xs overflow-hidden">
      <CardContent className="p-5 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-lg">
              {topRec.emoji || '🍽️'}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-semibold text-stone-900">Smart Next-Meal Recommendation</h2>
                <SparklesIcon size={14} className="text-amber-500" />
              </div>
              <span className="text-2xs text-stone-500 font-medium">
                {isHostelite ? 'Hostel & Campus Adapted' : 'Personalized Food Balance'}
              </span>
            </div>
          </div>
          <Badge variant="emerald" className="text-2xs font-semibold px-2 py-0.5">
            {topRec.estimatedCost || '₹ Budget Friendly'}
          </Badge>
        </div>

        {/* Gap Advisory */}
        {(proteinGapG > 10 || calorieGapKcal > 300) && (
          <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/60 text-2xs text-amber-900 flex items-center gap-2">
            <span className="font-bold text-xs">💡</span>
            <span>
              {proteinGapG > 10
                ? `You're approximately ${Math.round(proteinGapG)}g short of your protein target today.`
                : `You have approximately ${Math.round(calorieGapKcal)} kcal remaining in today's fuel budget.`}
            </span>
          </div>
        )}

        {/* Hostel Mode Filter Chips */}
        {isHostelite && (
          <div className="space-y-1.5">
            <span className="text-3xs uppercase font-bold text-stone-400 block tracking-wider">
              Hostel Filters:
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none" role="tablist" aria-label="Hostel Mode Filters">
              {filterOptions.map(opt => {
                const isSelected = opt.id === activeFilter;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => handleFilterSelect(opt.id)}
                    className={`px-2 py-0.5 rounded-lg text-3xs font-semibold whitespace-nowrap transition-all ${
                      isSelected
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Recommended Food Card */}
        <div className="p-4 rounded-2xl bg-white border border-stone-200/80 space-y-3 shadow-2xs">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-stone-900">{topRec.title}</h3>
              <p className="text-xs text-stone-600 mt-1 leading-relaxed">{topRec.reason}</p>
            </div>
            {topRec.confidence !== undefined && (
              <span className="text-3xs font-mono font-semibold px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 shrink-0">
                {Math.round(topRec.confidence * 100)}% match
              </span>
            )}
          </div>

          {/* Nutrition Benefit Statement */}
          {topRec.nutritionBenefit && (
            <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200/60 text-2xs text-emerald-950 flex items-start gap-2">
              <CheckIcon size={14} className="text-emerald-700 shrink-0 mt-0.5" />
              <span>{topRec.nutritionBenefit}</span>
            </div>
          )}

          {/* Key tags & Prep type */}
          <div className="flex flex-wrap items-center gap-1.5">
            {topRec.hostelFriendly && (
              <span className="text-3xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900">
                Hostel Friendly
              </span>
            )}
            {topRec.preparationType && (
              <span className="text-3xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
                {topRec.preparationType === 'no-cook' ? 'Zero Cook' : topRec.preparationType}
              </span>
            )}
            {topRec.messFriendly && (
              <span className="text-3xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                Mess Friendly
              </span>
            )}
          </div>

          {/* Suggested Items */}
          {topRec.suggestedFoods && topRec.suggestedFoods.length > 0 && (
            <div className="pt-2 border-t border-stone-100">
              <span className="text-3xs font-bold uppercase tracking-wider text-stone-400 block mb-1.5">
                Suggested Ingredients / Cart Items:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {topRec.suggestedFoods.map((food, idx) => (
                  <span
                    key={idx}
                    className="text-2xs px-2 py-0.5 rounded-md bg-stone-50 border border-stone-200/60 text-stone-700"
                  >
                    {food}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Estimated contribution */}
          {topRec.estimatedNutrition && (
            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-stone-100 text-center">
              <div className="p-1.5 rounded-lg bg-stone-50">
                <span className="text-3xs uppercase font-medium text-stone-400 block">Calories</span>
                <span className="text-xs font-bold text-stone-800">{topRec.estimatedNutrition.calories}</span>
              </div>
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-900">
                <span className="text-3xs uppercase font-medium text-emerald-600 block">Protein</span>
                <span className="text-xs font-bold">{topRec.estimatedNutrition.protein}g</span>
              </div>
              <div className="p-1.5 rounded-lg bg-stone-50">
                <span className="text-3xs uppercase font-medium text-stone-400 block">Carbs</span>
                <span className="text-xs font-bold text-stone-800">{topRec.estimatedNutrition.carbs}g</span>
              </div>
              <div className="p-1.5 rounded-lg bg-stone-50">
                <span className="text-3xs uppercase font-medium text-stone-400 block">Fiber</span>
                <span className="text-xs font-bold text-stone-800">{topRec.estimatedNutrition.fiber}g</span>
              </div>
            </div>
          )}

          {/* Action Tip */}
          {topRec.actionTip && (
            <p className="text-2xs text-stone-500 italic pt-1">
              Campus tip: {topRec.actionTip}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
