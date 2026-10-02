'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { CameraIcon } from '../ui/icons';

interface EmptyNutritionStateProps {
  onQuickDrink?: () => void;
}

export function EmptyNutritionState({ onQuickDrink }: EmptyNutritionStateProps) {
  return (
    <Card className="border border-[#E8DED2] dark:border-[#38312A] bg-white dark:bg-[#1D1A17] shadow-xs text-center">
      <CardContent className="p-8 sm:p-10 max-w-md mx-auto space-y-5">
        <div className="w-16 h-16 rounded-3xl bg-[#FEF7EE] dark:bg-[#2A1C14] text-[#E86A33] border border-[#E86A33]/20 flex items-center justify-center mx-auto text-3xl shadow-xs">
          🥗
        </div>

        <div className="space-y-2">
          <h2 className="text-lg sm:text-xl font-bold text-stone-900 dark:text-stone-100">
            No meals scanned today yet.
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
            Scan your first meal to start today&apos;s nutrition journey and track your calories, protein, and micronutrients.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link href="/scan" className="w-full sm:w-auto">
            <Button size="md" className="w-full sm:w-auto px-6 font-bold" leftIcon={<CameraIcon size={18} />}>
              Scan First Meal
            </Button>
          </Link>

          {onQuickDrink && (
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={onQuickDrink}
              className="w-full sm:w-auto px-5 font-semibold text-sky-800 border-sky-300 hover:bg-sky-50"
            >
              + Log Water (250 ml)
            </Button>
          )}
        </div>

        <div className="pt-4 border-t border-stone-100 flex items-center justify-center gap-2 text-2xs text-stone-500">
          <span>Campus tip: Mess thali, canteen snack, or street food — scan whatever you eat.</span>
        </div>
      </CardContent>
    </Card>
  );
}
