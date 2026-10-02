'use client';

import React from 'react';
import { Card, CardContent } from '../ui/card';
import { NutritionProfile } from '../../lib/types/nutrition';
import { DetectedFoodItem } from '../../lib/types/meal';

interface MealQualityExplanationProps {
  nutrition: NutritionProfile;
  items?: DetectedFoodItem[];
  targetProteinG?: number;
}

export function MealQualityExplanation({
  nutrition,
  items = [],
  targetProteinG = 60,
}: MealQualityExplanationProps) {
  // Protein explanation
  let proteinNote = 'Contributes to your daily protein foundation.';
  if (nutrition.protein >= targetProteinG * 0.35) {
    proteinNote = 'High protein contribution toward your daily target.';
  } else if (nutrition.protein >= targetProteinG * 0.2) {
    proteinNote = 'Good contribution toward your daily target.';
  } else {
    proteinNote = 'Light in protein; consider pairing with curd, dal, or boiled eggs.';
  }

  // Fiber explanation
  let fiberNote = 'Supplies essential roughage for steady digestion.';
  if (nutrition.fiber >= 8) {
    fiberNote = 'Excellent gut-friendly fiber for sustained fullness.';
  } else if (nutrition.fiber >= 4) {
    fiberNote = 'Moderate fiber supporting digestive balance.';
  } else {
    fiberNote = 'Adding fruit, raw vegetables, or legumes could increase today’s fiber.';
  }

  // Calorie & Carb balance
  let energyNote = 'Balanced energy distribution.';
  const carbCalories = nutrition.carbohydrates * 4;
  const totalCals = Math.max(1, nutrition.calories);
  if ((carbCalories / totalCals) >= 0.6) {
    energyNote = 'Carbohydrate-dominant energy source; great for active study or physical stamina.';
  } else if ((nutrition.fat * 9 / totalCals) >= 0.45) {
    energyNote = 'Higher in dietary fats; provides long-lasting satiety.';
  }

  // Micronutrient explanation from items
  const richMicros: string[] = [];
  const totalIron = items.reduce((acc, i) => acc + (i.micronutrients?.iron || 0), 0);
  const totalCalcium = items.reduce((acc, i) => acc + (i.micronutrients?.calcium || 0), 0);
  const totalPotassium = items.reduce((acc, i) => acc + (i.micronutrients?.potassium || 0), 0);

  if (totalIron >= 2.5) richMicros.push('iron');
  if (totalCalcium >= 100) richMicros.push('calcium');
  if (totalPotassium >= 300) richMicros.push('potassium');

  const microNote = richMicros.length > 0
    ? `Provides noticeable ${richMicros.join(' and ')} from whole ingredients.`
    : 'Provides everyday essential minerals.';

  return (
    <Card className="border border-stone-200/80 dark:border-[#38312A] bg-white dark:bg-[#1D1A17] shadow-xs overflow-hidden">
      <CardContent className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">💡</span>
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">What Does This Mean?</h3>
          </div>
          <span className="text-3xs uppercase font-medium text-stone-400 dark:text-stone-500 tracking-wider">
            Meal Quality Context
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Protein */}
          <div className="p-3 rounded-xl bg-[#FEF7EE] dark:bg-[#251A14] border border-[#FBD5BD] dark:border-[#4D2918] space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-[#E86A33]">
                Protein ({nutrition.protein}g)
              </span>
            </div>
            <p className="text-xs text-stone-800 dark:text-stone-200 leading-relaxed">{proteinNote}</p>
          </div>

          {/* Fiber */}
          <div className="p-3 rounded-xl bg-[#F0FDF4] dark:bg-[#15251C] border border-[#3F8F68]/30 dark:border-[#3F8F68]/40 space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-[#3F8F68] dark:text-[#5FA77F]">
                Fiber ({nutrition.fiber}g)
              </span>
            </div>
            <p className="text-xs text-[#1C4332] dark:text-[#88D4A8] leading-relaxed">{fiberNote}</p>
          </div>

          {/* Energy Source */}
          <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300">
                Energy Balance ({nutrition.calories} kcal)
              </span>
            </div>
            <p className="text-xs text-amber-950 dark:text-amber-200 leading-relaxed">{energyNote}</p>
          </div>

          {/* Micronutrients */}
          <div className="p-3 rounded-xl bg-stone-50 dark:bg-[#25211D] border border-stone-200/70 dark:border-[#38312A] space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                Micronutrients
              </span>
            </div>
            <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed">{microNote}</p>
          </div>
        </div>

        <p className="text-3xs text-stone-400 dark:text-stone-500 italic pt-1">
          Nutritional context based on standard reference profiles. No medical diagnosis or claims.
        </p>
      </CardContent>
    </Card>
  );
}
