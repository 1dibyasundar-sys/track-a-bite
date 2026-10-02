'use client';

import React from 'react';
import { Card, CardContent } from '../ui/card';
import { DashboardStreakMetrics } from '../../lib/types/analytics';

interface ConsistencyCardProps {
  metrics: DashboardStreakMetrics;
}

export function ConsistencyCard({ metrics }: ConsistencyCardProps) {
  const {
    currentStreakDays = 0,
    hasSufficientData = false,
    sevenDayConsistencyPercent = 0,
    thirtyDayConsistencyPercent = 0,
    activeLoggingDaysCount = 0,
    hydrationGoalMetDaysCount = 0,
    mealsLoggedToday = 0,
    streakStatusMessage,
  } = metrics || {};

  return (
    <Card className="border border-stone-200/80 bg-white shadow-xs">
      <CardContent className="p-5 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔥</span>
            <div>
              <h2 className="text-sm font-semibold text-stone-900">Consistency & Streaks</h2>
              <p className="text-2xs text-stone-500">Longitudinal food logging habits</p>
            </div>
          </div>
          {hasSufficientData && currentStreakDays > 0 ? (
            <span className="text-2xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
              {currentStreakDays} {currentStreakDays === 1 ? 'day' : 'days'} streak
            </span>
          ) : (
            <span className="text-2xs font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
              Tracking
            </span>
          )}
        </div>

        {/* Status Message */}
        <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/60 text-xs text-stone-700 font-medium">
          {streakStatusMessage || 'Log meals consistently to build your dietary habits.'}
        </div>

        {/* Consistency Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-center">
          <div className="p-2.5 rounded-xl bg-stone-50/70 border border-stone-200/60">
            <span className="text-xl font-extrabold text-stone-900 block">{mealsLoggedToday}</span>
            <span className="text-3xs text-stone-500 font-medium">Meals Today</span>
          </div>

          <div className="p-2.5 rounded-xl bg-stone-50/70 border border-stone-200/60">
            <span className="text-xl font-extrabold text-emerald-700 block">
              {sevenDayConsistencyPercent}%
            </span>
            <span className="text-3xs text-stone-500 font-medium">7-Day Rate ({thirtyDayConsistencyPercent}% 30d)</span>
          </div>

          <div className="p-2.5 rounded-xl bg-stone-50/70 border border-stone-200/60">
            <span className="text-xl font-extrabold text-stone-800 block">
              {activeLoggingDaysCount}
            </span>
            <span className="text-3xs text-stone-500 font-medium">Active Days (30d)</span>
          </div>

          <div className="p-2.5 rounded-xl bg-stone-50/70 border border-stone-200/60">
            <span className="text-xl font-extrabold text-sky-700 block">
              {hydrationGoalMetDaysCount}
            </span>
            <span className="text-3xs text-stone-500 font-medium">Water Goals Met</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
