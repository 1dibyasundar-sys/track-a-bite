'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { GoalProgressSummary, SupportedHealthGoal } from '../../lib/types/analytics';

interface GoalProgressCardProps {
  goalSummaries: GoalProgressSummary[];
  activeGoal?: SupportedHealthGoal;
  onGoalChange?: (goal: SupportedHealthGoal) => void;
}

export function GoalProgressCard({
  goalSummaries = [],
  activeGoal = 'general_health',
  onGoalChange,
}: GoalProgressCardProps) {
  const [selectedGoal, setSelectedGoal] = useState<SupportedHealthGoal>(activeGoal);

  const currentSummary =
    goalSummaries.find(g => g.goal === selectedGoal) || goalSummaries[0];

  if (!currentSummary) {
    return null;
  }

  const handleSelect = (goal: SupportedHealthGoal) => {
    setSelectedGoal(goal);
    onGoalChange?.(goal);
  };

  const getTrendBadge = (trend: GoalProgressSummary['weeklyTrend']) => {
    switch (trend) {
      case 'improving':
        return <Badge variant="emerald" className="text-3xs uppercase font-bold">Improving</Badge>;
      case 'stable':
        return <Badge variant="stone" className="text-3xs uppercase font-bold">Stable</Badge>;
      case 'needs_attention':
      default:
        return <Badge variant="amber" className="text-3xs uppercase font-bold">Needs Attention</Badge>;
    }
  };

  return (
    <Card className="border border-stone-200/80 bg-white shadow-xs overflow-hidden">
      <CardContent className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-base">🎯</span>
            <h2 className="text-sm font-semibold text-stone-900">Personal Goal Progress</h2>
          </div>
          {getTrendBadge(currentSummary.weeklyTrend)}
        </div>

        {/* Goal selector pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none" role="tablist" aria-label="Goal Selection">
          {goalSummaries.map(s => {
            const isSelected = s.goal === selectedGoal;
            return (
              <button
                key={s.goal}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => handleSelect(s.goal)}
                className={`px-2.5 py-1 rounded-lg text-2xs font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-stone-900 text-white shadow-2xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {s.goalLabel.split(' ')[0]}
              </button>
            );
          })}
        </div>

        {/* Selected Goal Card */}
        <div className="p-3.5 rounded-2xl bg-stone-50/80 border border-stone-200/70 space-y-3">
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-3xs font-bold uppercase tracking-wider text-stone-500 block">
                {currentSummary.goalLabel}
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-extrabold text-stone-900">
                  {currentSummary.currentValue}
                </span>
                <span className="text-xs font-semibold text-stone-500">
                  / {currentSummary.targetValue} {currentSummary.unit}
                </span>
              </div>
            </div>
            <span className="text-sm font-bold text-stone-800">
              {currentSummary.progressPercent}%
            </span>
          </div>

          {/* Accessible progressbar */}
          <div
            className="w-full bg-stone-200/80 h-2.5 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={currentSummary.progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${currentSummary.goalLabel} progress`}
          >
            <div
              className="bg-emerald-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${currentSummary.progressPercent}%` }}
            />
          </div>

          <div className="pt-2 border-t border-stone-200/60 grid grid-cols-2 gap-2 text-2xs">
            <div>
              <span className="text-stone-400 block text-3xs uppercase font-medium">Weekly Trend</span>
              <span className="text-stone-700 font-medium leading-tight block mt-0.5">
                {currentSummary.weeklyTrendDescription}
              </span>
            </div>
            <div>
              <span className="text-stone-400 block text-3xs uppercase font-medium">Consistency</span>
              <span className="text-stone-700 font-medium leading-tight block mt-0.5">
                {currentSummary.consistencyPercent}% target alignment
              </span>
            </div>
          </div>

          <div className="p-2 rounded-xl bg-white border border-stone-200/60 text-2xs text-stone-600 flex items-start gap-1.5">
            <span className="text-emerald-600 font-bold shrink-0">💡</span>
            <span>{currentSummary.recommendedAction}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
