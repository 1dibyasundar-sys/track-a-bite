'use client';

import React from 'react';
import { Card, CardContent } from '../ui/card';
import { DailyMicronutrientSummary, MicronutrientProgressItem } from '../../lib/types/analytics';

interface MicronutrientCardProps {
  summary?: DailyMicronutrientSummary;
}

export function MicronutrientCard({ summary }: MicronutrientCardProps) {
  const nutrients = summary?.nutrients;

  if (!nutrients || Object.keys(nutrients).length === 0) {
    return (
      <Card className="border border-stone-200/80 bg-white shadow-xs">
        <CardContent className="p-5 sm:p-6 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🧬</span>
            <h2 className="text-sm font-semibold text-stone-900">Essential Micronutrients</h2>
          </div>
          <p className="text-xs text-stone-500">
            Scan meals with diverse ingredients (dals, greens, fruits, eggs) to track your daily micronutrient intake.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Key micronutrients to highlight prominently
  const displayKeys: (keyof typeof nutrients)[] = [
    'ironMg',
    'calciumMg',
    'potassiumMg',
    'folateMcg',
    'vitaminDMcg',
    'sodiumMg',
  ];

  return (
    <Card className="border border-stone-200/80 bg-white shadow-xs">
      <CardContent className="p-5 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div>
            <h2 className="text-sm font-semibold text-stone-900">Essential Micronutrients</h2>
            <p className="text-2xs text-stone-500">Vitamins & minerals against reference intakes</p>
          </div>
          <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
            {summary.dataAvailability === 'sufficient' ? 'Comprehensive' : 'Tracked from Scans'}
          </span>
        </div>

        {/* Micronutrient Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {displayKeys.map((key) => {
            const item: MicronutrientProgressItem | undefined = nutrients[key];
            if (!item) return null;

            const isSodium = item.key === 'sodiumMg';
            const percent = Math.min(100, Math.max(0, item.percentage || 0));

            return (
              <div
                key={item.key}
                className="p-3 rounded-xl bg-stone-50/70 border border-stone-200/60 space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-stone-800">{item.name}</span>
                  <span className="text-2xs text-stone-500 font-medium">
                    {item.consumed} / {item.referenceTarget} {item.unit}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 w-full rounded-full bg-stone-200 overflow-hidden" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={`${item.name} intake progress`}>
                  <div
                    className={`h-full rounded-full ${
                      isSodium
                        ? item.consumed > item.referenceTarget
                          ? 'bg-amber-500'
                          : 'bg-emerald-600'
                        : percent >= 75
                        ? 'bg-emerald-600'
                        : 'bg-teal-600'
                    } transition-all duration-500`}
                    style={{ width: `${percent}%` }}
                  />
                </div>

                <div className="flex justify-between items-center text-3xs text-stone-500">
                  <span>{percent}% of ref</span>
                  <span>{isSodium ? 'Upper limit ref' : item.label}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Factual Disclaimer */}
        <p className="text-3xs text-stone-400 italic pt-1 leading-relaxed">
          {summary.disclaimer ||
            'General reference intake based on standard dietary guidelines for adults. Not intended for clinical diagnosis.'}
        </p>
      </CardContent>
    </Card>
  );
}
