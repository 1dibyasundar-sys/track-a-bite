'use client';

import React from 'react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { ShieldCheckIcon } from '../ui/icons';
import { NutritionScoreRating } from '../../lib/types/analytics';

interface NutritionScoreCardProps {
  score: number;
  rating: NutritionScoreRating;
  caloriesPercent?: number;
  proteinPercent?: number;
  hydrationPercent?: number;
  fiberPercent?: number;
  mealCount?: number;
}

export function NutritionScoreCard({
  score = 0,
  rating = 'needs_attention',
  caloriesPercent = 0,
  proteinPercent = 0,
  hydrationPercent = 0,
  fiberPercent = 0,
  mealCount = 0,
}: NutritionScoreCardProps) {
  const safeScore = Math.max(0, Math.min(100, isFinite(score) ? score : 0));
  const effectiveRating = rating || (safeScore >= 85 ? 'excellent' : safeScore >= 70 ? 'good' : safeScore >= 50 ? 'fair' : 'needs_attention');

  let badgeVariant: 'emerald' | 'amber' | 'blue' | 'stone' = 'stone';
  let badgeLabel = 'Needs Attention';
  let scoreColor = 'text-stone-700';

  if (effectiveRating === 'excellent') {
    badgeVariant = 'emerald';
    badgeLabel = 'Excellent';
    scoreColor = 'text-emerald-700';
  } else if (effectiveRating === 'good') {
    badgeVariant = 'blue';
    badgeLabel = 'Good';
    scoreColor = 'text-emerald-600';
  } else if (effectiveRating === 'fair') {
    badgeVariant = 'amber';
    badgeLabel = 'Fair';
    scoreColor = 'text-amber-700';
  } else {
    badgeVariant = 'stone';
    badgeLabel = 'Needs Attention';
    scoreColor = 'text-stone-600';
  }

  // Factual, non-judgmental explanations
  const factors: string[] = [];
  if (mealCount === 0) {
    factors.push('Log meals today to evaluate your daily score.');
  } else {
    if (proteinPercent >= 90) factors.push('Protein target achieved (+30 pts)');
    else if (proteinPercent >= 50) factors.push(`Protein: ${proteinPercent}% of daily target`);
    else factors.push('Protein below target; consider adding sprouts or eggs');

    if (caloriesPercent >= 80 && caloriesPercent <= 115) factors.push('Calorie intake well-aligned with goals (+25 pts)');
    else factors.push(`Calories: ${caloriesPercent}% of daily target`);

    if (hydrationPercent >= 80) factors.push('Hydration on track');
    else factors.push(`Hydration: ${hydrationPercent}% of fluid target`);

    if (fiberPercent >= 75) factors.push('Fiber diversity well-supported');
  }

  return (
    <Card className="border border-stone-200/80 bg-white shadow-xs">
      <CardContent className="p-5 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <ShieldCheckIcon size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-stone-900">Daily Nutrition Score</h2>
              <span className="text-2xs text-stone-500 font-medium">Objective dietary quality</span>
            </div>
          </div>
          <Badge variant={badgeVariant} className="text-xs font-semibold px-2.5 py-0.5">
            {badgeLabel}
          </Badge>
        </div>

        {/* Score & Rating */}
        <div className="flex items-center gap-4 pt-1">
          <div className={`text-4xl sm:text-5xl font-black ${scoreColor} tracking-tight font-sans`}>
            {safeScore}
            <span className="text-stone-300 text-2xl font-normal ml-0.5">/100</span>
          </div>

          <div className="flex-1 text-xs text-stone-600 leading-snug">
            {mealCount === 0 ? (
              <p className="text-stone-500">Scan your first meal to calculate your daily nutrition score.</p>
            ) : safeScore >= 85 ? (
              <p>Outstanding nutrient density and macronutrient alignment across today&apos;s meals.</p>
            ) : safeScore >= 70 ? (
              <p>Balanced day overall. Minor nutritional adjustments can help you hit remaining targets.</p>
            ) : safeScore >= 50 ? (
              <p>Reasonable energy intake with opportunities to boost protein and fiber density.</p>
            ) : (
              <p>Early in the day or missing foundational nutrients. Check recommendations below.</p>
            )}
          </div>
        </div>

        {/* Why this score exists (Factual & Non-Judgmental) */}
        <div className="pt-2 border-t border-stone-100 space-y-1.5">
          <span className="text-2xs font-bold uppercase tracking-wider text-stone-400 block">
            Score Breakdown
          </span>
          <ul className="space-y-1 text-xs text-stone-700">
            {factors.slice(0, 3).map((factor, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                <span>{factor}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
