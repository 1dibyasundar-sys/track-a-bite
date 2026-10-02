'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '../ui/card';
import { MealAnalysis } from '../../lib/types/meal';
import { HydrationLogEntry } from '../../lib/types/hydration';
import { ArrowRightIcon, CameraIcon, DropletIcon } from '../ui/icons';

interface RecentActivityProps {
  recentMeals?: MealAnalysis[];
  latestMeal?: MealAnalysis;
  latestHydration?: HydrationLogEntry;
  latestScore?: number;
}

function formatMealTimestamp(isoString?: string): string {
  if (!isoString) return 'Earlier today';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'Earlier today';

    const now = new Date();
    const isToday = now.toDateString() === date.toDateString();
    
    // Check if yesterday
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = yesterday.toDateString() === date.toDateString();

    const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (isToday) return `Today, ${timeStr}`;
    if (isYesterday) return `Yesterday, ${timeStr}`;
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
  } catch {
    return 'Earlier today';
  }
}

export function RecentActivity({
  recentMeals,
  latestMeal,
  latestHydration,
  latestScore,
}: RecentActivityProps) {
  // Aggregate recent meals: prefer recentMeals array, fallback to latestMeal
  const meals: MealAnalysis[] = recentMeals && recentMeals.length > 0
    ? recentMeals.slice(0, 5)
    : latestMeal
    ? [latestMeal]
    : [];

  // If no meals and no hydration, display actionable empty state
  if (meals.length === 0 && !latestHydration) {
    return (
      <Card className="border border-stone-200/80 bg-white shadow-xs">
        <CardContent className="p-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-500 flex items-center justify-center mx-auto text-xl">
            🍽️
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-stone-900">No meals scanned yet</h3>
            <p className="text-2xs text-stone-500 max-w-sm mx-auto">
              Scan your meals to see live macro analytics, 5-star richness scoring, and hostel-friendly tips.
            </p>
          </div>
          <div className="pt-1">
            <Link
              href="/scan"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#E86A33] text-white text-xs font-semibold hover:bg-[#d65f2c] transition-colors shadow-2xs"
            >
              <CameraIcon size={14} />
              <span>Scan Your First Meal</span>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-stone-200/80 bg-white shadow-xs">
      <CardContent className="p-5 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-stone-900">Recent Meals & Activity</h2>
            <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
              {meals.length} {meals.length === 1 ? 'meal' : 'meals'}
            </span>
          </div>
          {latestScore !== undefined && (
            <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-[#F0FDF4] text-[#2E6B4E] border border-[#3F8F68]/30">
              Score: {latestScore}/100
            </span>
          )}
        </div>

        {/* Recent Meals List (3-5 meals) */}
        <div className="space-y-2.5">
          {meals.map((meal) => {
            const calories = Math.round(meal.totalNutrition?.calories || 0);
            const protein = Math.round(meal.totalNutrition?.protein || 0);
            const timeLabel = formatMealTimestamp(meal.analyzedAt);
            const starScore = meal.nutrientRichness?.stars;
            const scoreLabel = meal.nutrientRichness?.label;

            return (
              <div
                key={meal.id}
                className="p-3 rounded-xl bg-stone-50/80 border border-stone-200/70 hover:border-[#E86A33]/40 hover:bg-[#FEF7EE]/30 transition-all flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Thumbnail or Fallback Icon */}
                  {meal.imagePreviewUrl ? (
                    <div className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 border border-stone-200 bg-stone-100">
                      <Image
                        src={meal.imagePreviewUrl}
                        alt={meal.mealTitle || 'Scanned meal'}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="w-11 h-11 rounded-lg bg-[#FEF7EE] text-[#E86A33] flex items-center justify-center shrink-0 border border-[#FBD5BD]">
                      <CameraIcon size={18} />
                    </div>
                  )}

                  {/* Meal Details */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-stone-900 text-xs sm:text-sm truncate">
                        {meal.mealTitle || 'Scanned Meal'}
                      </h4>
                      {starScore !== undefined && (
                        <span className="text-3xs font-extrabold px-1.5 py-0.2 rounded bg-[#FEF7EE] text-[#E86A33] shrink-0">
                          {starScore}★ {scoreLabel ? `• ${scoreLabel}` : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-2xs text-stone-500 mt-0.5">
                      <span>{timeLabel}</span>
                      <span>•</span>
                      <span className="font-semibold text-stone-700">{calories} kcal</span>
                      <span>•</span>
                      <span className="font-semibold text-[#E86A33]">{protein}g protein</span>
                    </div>
                  </div>
                </div>

                {/* View Details Link */}
                <Link
                  href={`/results?id=${encodeURIComponent(meal.id)}`}
                  className="shrink-0 px-3 py-1.5 text-2xs font-bold text-[#E86A33] bg-white border border-stone-200/90 rounded-lg hover:bg-[#E86A33] hover:text-white hover:border-[#E86A33] transition-all flex items-center gap-1 shadow-2xs group-hover:bg-[#E86A33] group-hover:text-white group-hover:border-[#E86A33]"
                  aria-label={`View full nutritional analysis for ${meal.mealTitle || 'meal'}`}
                >
                  <span>View</span>
                  <ArrowRightIcon size={12} />
                </Link>
              </div>
            );
          })}

          {/* Hydration Activity Card */}
          {latestHydration && (
            <div className="p-3 rounded-xl bg-sky-50/60 border border-sky-200/60 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-sky-100 text-sky-800 flex items-center justify-center shrink-0">
                  <DropletIcon size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-stone-900 text-xs">Hydration Intake</h4>
                  <span className="text-2xs text-stone-600 block">
                    +{latestHydration.amountMl} ml logged • Keep drinking throughout the day
                  </span>
                </div>
              </div>
              <span className="text-2xs font-bold text-sky-800 bg-sky-100/80 px-2 py-0.5 rounded-md">
                Logged
              </span>
            </div>
          )}
        </div>

        {/* View full history footer link */}
        <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-2xs">
          <span className="text-stone-500 font-medium">
            Looking for older logs?
          </span>
          <Link
            href="/history"
            className="font-bold text-[#E86A33] hover:text-[#d65f2c] flex items-center gap-1"
          >
            <span>Browse Full History</span>
            <ArrowRightIcon size={12} />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
