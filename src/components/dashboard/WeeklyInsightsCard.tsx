'use client';

import React from 'react';
import { Card, CardContent } from '../ui/card';
import { SparklesIcon } from '../ui/icons';

interface WeeklyInsightsCardProps {
  insights: string[];
}

export function WeeklyInsightsCard({ insights = [] }: WeeklyInsightsCardProps) {
  if (insights.length === 0) {
    return null;
  }

  const isInsufficient = insights.length === 1 && insights[0].toLowerCase().includes('not enough data');

  return (
    <Card className="border border-stone-200/80 bg-white shadow-xs overflow-hidden">
      <CardContent className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">📊</span>
            <h2 className="text-sm font-semibold text-stone-900">Weekly Nutrition Insights</h2>
          </div>
          <SparklesIcon size={14} className="text-amber-500" />
        </div>

        {isInsufficient ? (
          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/70 text-center space-y-1">
            <p className="text-xs text-stone-600 font-medium">Not enough data yet.</p>
            <p className="text-2xs text-stone-400">
              Log meals across at least two days to unlock longitudinal weekly patterns and trends.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {insights.map((insight, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-xl bg-stone-50/70 border border-stone-200/60 flex items-start gap-2.5 text-xs text-stone-700"
              >
                <span className="text-emerald-600 font-bold mt-0.5">•</span>
                <span className="leading-relaxed">{insight}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
