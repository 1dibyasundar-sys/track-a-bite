'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { DropletIcon, CheckIcon } from '../ui/icons';
import { hydrationService } from '../../lib/services/hydrationService';

interface HydrationCardProps {
  intakeMl: number;
  targetMl: number;
  loggedDrinksCount: number;
  userId?: string;
  onDrinkLogged?: () => void;
}

export function HydrationCard({
  intakeMl = 0,
  targetMl = 2200,
  loggedDrinksCount = 0,
  userId,
  onDrinkLogged,
}: HydrationCardProps) {
  const [logging, setLogging] = useState(false);
  const [customMl, setCustomMl] = useState('');
  const [justLoggedAmount, setJustLoggedAmount] = useState<number | null>(null);

  const safeTarget = Math.max(500, isFinite(targetMl) ? targetMl : 2200);
  const safeIntake = Math.max(0, isFinite(intakeMl) ? intakeMl : 0);
  const remaining = Math.max(0, safeTarget - safeIntake);
  const percent = Math.min(100, Math.max(0, Math.round((safeIntake / safeTarget) * 100)));

  const handleQuickAdd = async (amount: number) => {
    if (logging || amount <= 0) return;
    setLogging(true);
    try {
      await hydrationService.logDrink(amount, 'quick_add', undefined, userId);
      setJustLoggedAmount(amount);
      setTimeout(() => setJustLoggedAmount(null), 2500);
      if (onDrinkLogged) onDrinkLogged();
    } catch (err) {
      console.warn('[HydrationCard] Failed to log drink:', err);
    } finally {
      setLogging(false);
    }
  };

  const handleCustomAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(customMl);
    if (isNaN(amount) || amount <= 0 || amount > 5000) return;
    setLogging(true);
    try {
      await hydrationService.logDrink(amount, 'custom', undefined, userId);
      setCustomMl('');
      setJustLoggedAmount(amount);
      setTimeout(() => setJustLoggedAmount(null), 2500);
      if (onDrinkLogged) onDrinkLogged();
    } catch (err) {
      console.warn('[HydrationCard] Failed to log custom drink:', err);
    } finally {
      setLogging(false);
    }
  };

  return (
    <Card className="border border-stone-200/80 bg-white shadow-xs">
      <CardContent className="p-5 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
              <DropletIcon size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-stone-900">Daily Hydration</h2>
              <span className="text-2xs text-stone-500 font-medium">Water & fluid intake</span>
            </div>
          </div>
          <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
            {loggedDrinksCount} {loggedDrinksCount === 1 ? 'drink' : 'drinks'} logged
          </span>
        </div>

        {/* Big numbers */}
        <div className="flex items-baseline justify-between pt-1">
          <div>
            <span className="text-3xl font-extrabold text-stone-900 tracking-tight">
              {safeIntake}
            </span>
            <span className="text-sm text-stone-500 font-medium ml-1">/ {safeTarget} ml</span>
          </div>
          <div className="text-right">
            <span className="text-sm font-bold text-sky-700">{remaining} ml</span>
            <span className="text-2xs text-stone-500 block">remaining</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Daily hydration progress">
          <div className="h-2.5 w-full rounded-full bg-stone-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-400 to-sky-600 transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-2xs text-stone-500">
            <span>{percent}% achieved</span>
            <span>{safeTarget >= 3000 ? 'High hydration target' : 'Standard target'}</span>
          </div>
        </div>

        {/* Quick Add Actions */}
        <div className="pt-2 border-t border-stone-100 space-y-2.5">
          <span className="text-2xs font-bold uppercase tracking-wider text-stone-400 block">
            Quick Log Water
          </span>

          <div className="grid grid-cols-3 gap-2">
            {[250, 500, 750].map((amount) => (
              <Button
                key={amount}
                type="button"
                variant="outline"
                size="sm"
                disabled={logging}
                onClick={() => handleQuickAdd(amount)}
                className="h-9 text-xs font-semibold hover:border-sky-300 hover:bg-sky-50 text-stone-700"
              >
                +{amount} ml
              </Button>
            ))}
          </div>

          {/* Feedback banner */}
          {justLoggedAmount !== null && (
            <div className="p-2 rounded-xl bg-sky-50 text-sky-800 text-xs font-medium flex items-center gap-1.5 animate-fadeIn">
              <CheckIcon size={14} className="text-sky-600" />
              <span>Logged +{justLoggedAmount} ml water successfully!</span>
            </div>
          )}

          {/* Custom ml form */}
          <form onSubmit={handleCustomAdd} className="flex gap-2 pt-1">
            <input
              type="number"
              min="50"
              max="3000"
              step="50"
              value={customMl}
              onChange={(e) => setCustomMl(e.target.value)}
              placeholder="Custom ml..."
              aria-label="Custom hydration amount in milliliters"
              className="flex-1 h-8 px-2.5 rounded-lg border border-stone-200 text-xs bg-stone-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 text-stone-900"
            />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={logging || !customMl}
              className="h-8 text-xs font-semibold px-3"
            >
              Add
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
