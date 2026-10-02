'use client';

import React from 'react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { FlameIcon } from '../ui/icons';

interface NutritionGoalCardProps {
  caloriesConsumed: number;
  targetCalories: number;
  targetTypeLabel?: string;
}

export function NutritionGoalCard({
  caloriesConsumed = 0,
  targetCalories = 2000,
  targetTypeLabel = 'Recommended target',
}: NutritionGoalCardProps) {
  const safeTarget = Math.max(1, isFinite(targetCalories) ? targetCalories : 2000);
  const safeConsumed = Math.max(0, isFinite(caloriesConsumed) ? caloriesConsumed : 0);
  const remaining = Math.max(0, safeTarget - safeConsumed);
  const progressPercent = Math.min(100, Math.max(0, Math.round((safeConsumed / safeTarget) * 100)));

  // Status computation without judgmental phrasing
  let statusVariant: 'emerald' | 'amber' | 'blue' | 'stone' = 'blue';
  let statusText = 'Fueling Day';

  if (progressPercent >= 90 && progressPercent <= 110) {
    statusVariant = 'emerald';
    statusText = 'On Target';
  } else if (progressPercent > 110) {
    statusVariant = 'amber';
    statusText = 'Target Reached';
  } else if (progressPercent >= 50) {
    statusVariant = 'blue';
    statusText = 'In Progress';
  } else if (safeConsumed === 0) {
    statusVariant = 'stone';
    statusText = 'Not Started';
  }

  return (
    <Card className="border border-stone-200/80 bg-white shadow-xs overflow-hidden">
      <CardContent className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <FlameIcon size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-stone-900">Today&apos;s Calorie Goal</h2>
              <span className="text-2xs text-stone-500 font-medium">{targetTypeLabel}</span>
            </div>
          </div>
          <Badge variant={statusVariant} className="text-xs font-semibold px-2.5 py-0.5">
            {statusText}
          </Badge>
        </div>

        {/* Big numbers */}
        <div className="flex items-baseline justify-between pt-1">
          <div>
            <span className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
              {safeConsumed}
            </span>
            <span className="text-sm text-stone-500 font-medium ml-1">/ {safeTarget} kcal</span>
          </div>
          <div className="text-right">
            <span className="text-base font-bold text-emerald-700">{remaining}</span>
            <span className="text-xs text-stone-500 block">kcal remaining</span>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="space-y-1.5" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100} aria-label="Daily calorie progress">
          <div className="h-3 w-full rounded-full bg-stone-100 overflow-hidden p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-2xs text-stone-500">
            <span>{progressPercent}% of target</span>
            <span>{safeTarget} kcal target</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
