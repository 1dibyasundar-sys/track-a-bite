'use client';

import React from 'react';
import { TABContext } from '../../lib/voice/types';

interface TABContextCardProps {
  context?: TABContext | null;
  onClearProduct?: () => void;
  onClearMeal?: () => void;
}

export function TABContextCard({
  context,
  onClearProduct,
  onClearMeal,
}: TABContextCardProps) {
  if (!context) return null;

  const { currentProduct, currentMeal, userProfile } = context;

  if (!currentProduct && !currentMeal && !userProfile) {
    return null;
  }

  return (
    <div className="w-full max-w-lg mx-auto bg-stone-50 dark:bg-[#1D1A17] border border-stone-200 dark:border-[#38312A] rounded-2xl p-3 text-xs text-stone-700 dark:text-stone-300 shadow-2xs space-y-2">
      <div className="flex items-center justify-between text-3xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
        <span className="flex items-center gap-1">
          <span>🎯</span> Active Food Context
        </span>
        <span className="text-emerald-700 dark:text-emerald-400">Context Loaded</span>
      </div>

      {/* Active Packaged Product */}
      {currentProduct && (
        <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-[#25211D] border border-stone-200/80 dark:border-[#332B25]">
          <div className="space-y-0.5 min-w-0 pr-2">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">🥫</span>
              <span className="font-bold text-stone-900 dark:text-stone-100 truncate text-xs">
                {currentProduct.productName}
              </span>
              {currentProduct.brand && (
                <span className="text-3xs text-stone-500 shrink-0">({currentProduct.brand})</span>
              )}
            </div>
            <p className="text-3xs text-stone-500 dark:text-stone-400">
              {currentProduct.isNutritionAvailable
                ? `${currentProduct.calories ?? '—'} kcal • Source: ${currentProduct.nutritionSource || 'Label'}`
                : 'Nutrition unavailable'}
              {currentProduct.isPackageOcrVerified ? ' • Package OCR verified' : ''}
            </p>
          </div>
          {onClearProduct && (
            <button
              type="button"
              onClick={onClearProduct}
              className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 text-3xs p-1 cursor-pointer"
              title="Remove product context"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Active Scanned Meal */}
      {currentMeal && (
        <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-[#25211D] border border-stone-200/80 dark:border-[#332B25]">
          <div className="space-y-0.5 min-w-0 pr-2">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">🍽️</span>
              <span className="font-bold text-stone-900 dark:text-stone-100 truncate text-xs">
                {currentMeal.mealTitle}
              </span>
              <span className="text-3xs text-stone-500 shrink-0">({currentMeal.itemsCount} items)</span>
            </div>
            <p className="text-3xs text-stone-500 dark:text-stone-400">
              {currentMeal.calories} kcal • Protein: {currentMeal.proteinG}g • Carbs: {currentMeal.carbsG}g
            </p>
          </div>
          {onClearMeal && (
            <button
              type="button"
              onClick={onClearMeal}
              className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 text-3xs p-1 cursor-pointer"
              title="Remove meal context"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Active Profile Context */}
      {userProfile && !currentProduct && !currentMeal && (
        <div className="p-2 rounded-xl bg-white dark:bg-[#25211D] border border-stone-200/80 dark:border-[#332B25] flex items-center justify-between text-2xs">
          <div className="flex items-center gap-1.5">
            <span>👤</span>
            <span className="text-stone-600 dark:text-stone-300">
              {userProfile.dietaryRestrictions || 'Personalized'} mode
              {userProfile.isHostelite ? ' • Hostel / Campus' : ''}
              {userProfile.healthGoal ? ` • ${userProfile.healthGoal.replace(/_/g, ' ')}` : ''}
            </span>
          </div>
          {userProfile.targetCalories && (
            <span className="text-3xs font-mono font-semibold text-[#E86A33] dark:text-[#F4A340]">
              {userProfile.targetCalories} kcal target
            </span>
          )}
        </div>
      )}
    </div>
  );
}
