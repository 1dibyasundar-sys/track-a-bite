'use client';

import React from 'react';
import { Card, CardContent } from '../ui/card';

interface MacroItemProps {
  label: string;
  consumed: number;
  target: number;
  unit?: string;
  colorClass: string;
  tip?: string;
}

function MacroItem({
  label,
  consumed = 0,
  target = 100,
  unit = 'g',
  colorClass,
  tip,
}: MacroItemProps) {
  const safeTarget = Math.max(1, isFinite(target) ? target : 100);
  const safeConsumed = Math.max(0, isFinite(consumed) ? consumed : 0);
  const remaining = Math.max(0, safeTarget - safeConsumed);
  const percent = Math.min(100, Math.max(0, Math.round((safeConsumed / safeTarget) * 100)));

  return (
    <div className="space-y-1.5" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={`${label} progress`}>
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-stone-800">{label}</span>
          {tip && <span className="text-3xs text-stone-400 font-normal hidden sm:inline">({tip})</span>}
        </div>
        <div className="text-stone-600 font-medium">
          <span className="font-bold text-stone-900">{safeConsumed}</span>
          <span className="text-stone-400"> / {safeTarget}{unit}</span>
          <span className="ml-2 text-2xs font-semibold text-emerald-700">({remaining}{unit} left)</span>
        </div>
      </div>

      <div className="h-2 w-full rounded-full bg-stone-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${colorClass} transition-all duration-500`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

interface MacroProgressCardProps {
  proteinG: number;
  targetProteinG: number;
  carbsG: number;
  targetCarbsG: number;
  fatG: number;
  targetFatG: number;
  fiberG: number;
  targetFiberG: number;
}

export function MacroProgressCard({
  proteinG = 0,
  targetProteinG = 65,
  carbsG = 0,
  targetCarbsG = 250,
  fatG = 0,
  targetFatG = 60,
  fiberG = 0,
  targetFiberG = 30,
}: MacroProgressCardProps) {
  return (
    <Card className="border border-stone-200/80 bg-white shadow-xs">
      <CardContent className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div>
            <h2 className="text-sm font-semibold text-stone-900">Macronutrients & Fiber</h2>
            <p className="text-2xs text-stone-500">Daily energy and tissue repair distribution</p>
          </div>
          <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
            Today
          </span>
        </div>

        <div className="space-y-3.5 pt-1">
          <MacroItem
            label="Protein"
            consumed={proteinG}
            target={targetProteinG}
            colorClass="bg-emerald-600"
            tip="muscle & study stamina"
          />
          <MacroItem
            label="Carbohydrates"
            consumed={carbsG}
            target={targetCarbsG}
            colorClass="bg-amber-500"
            tip="mental energy"
          />
          <MacroItem
            label="Healthy Fats"
            consumed={fatG}
            target={targetFatG}
            colorClass="bg-sky-600"
            tip="hormone balance"
          />
          <MacroItem
            label="Dietary Fiber"
            consumed={fiberG}
            target={targetFiberG}
            colorClass="bg-teal-600"
            tip="gut & satiety"
          />
        </div>
      </CardContent>
    </Card>
  );
}
