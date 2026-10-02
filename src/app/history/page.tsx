'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Container } from '../../components/layout/container';
import { SectionHeading } from '../../components/common/section-heading';
import { EmptyState } from '../../components/common/empty-state';
import { Button } from '../../components/ui/button';
import { AuthGuard } from '../../components/auth/AuthGuard';
import { useAuth } from '../../components/auth/AuthProvider';
import { mealHistoryService, firestoreMealHistoryService } from '../../lib/services';
import { MealAnalysis } from '../../lib/types';
import { formatDate } from '../../lib/utils';
import type { DocumentSnapshot } from 'firebase/firestore';
import {
  CameraIcon,
  HistoryIcon,
  TrashIcon,
  ArrowRightIcon,
} from '../../components/ui/icons';
import { NutritionAnalyticsDashboard } from '../../components/nutrition/nutrition-analytics-dashboard';

export default function HistoryPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [meals, setMeals] = useState<MealAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastVisibleDoc, setLastVisibleDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [activeTab, setActiveTab] = useState<'meals' | 'analytics'>('meals');

  useEffect(() => {
    let isCancelled = false;

    async function loadHistory() {
      if (authLoading) return;
      setIsLoading(true);

      // Authenticated user: Firestore is authoritative
      if (user?.uid) {
        try {
          const res = await firestoreMealHistoryService.getRecentMeals(user.uid, 20);
          if (!isCancelled) {
            setMeals(res.meals);
            setLastVisibleDoc(res.lastDoc);
            setHasMore(res.hasMore && res.meals.length > 0);
            setIsLoading(false);
            return;
          }
        } catch (err) {
          console.warn('[HistoryPage] Cloud history fetch failed, falling back to local storage:', err);
        }
      }

      // Unauthenticated or cloud fallback: localStorage
      const localData = await mealHistoryService.getRecentMeals();
      if (!isCancelled) {
        setMeals(localData);
        setHasMore(false);
        setIsLoading(false);
      }
    }

    loadHistory();

    return () => {
      isCancelled = true;
    };
  }, [user?.uid, authLoading]);

  const handleLoadMore = async () => {
    if (!user?.uid || !lastVisibleDoc || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const res = await firestoreMealHistoryService.getRecentMeals(user.uid, 20, lastVisibleDoc);
      setMeals(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const newMeals = res.meals.filter(m => !existingIds.has(m.id));
        return [...prev, ...newMeals];
      });
      setLastVisibleDoc(res.lastDoc);
      setHasMore(res.hasMore && res.meals.length > 0);
    } catch (err) {
      console.warn('[HistoryPage] Load more failed:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // 1. Optimistic removal from UI
    setMeals(prev => prev.filter(m => m.id !== id));

    // 2. Remove from local storage cache
    await mealHistoryService.deleteMeal(id);

    // 3. Remove from Firestore if authenticated
    if (user?.uid) {
      try {
        await firestoreMealHistoryService.deleteMeal(user.uid, id);
      } catch (err) {
        console.warn('[HistoryPage] Cloud deletion notice:', err);
      }
    }
  };

  // Compute daily / weekly average stats if history exists
  const totalScans = meals.length;
  const avgCalories = totalScans > 0
    ? Math.round(meals.reduce((acc, m) => acc + m.totalNutrition.calories, 0) / totalScans)
    : 0;
  const avgProtein = totalScans > 0
    ? Math.round((meals.reduce((acc, m) => acc + m.totalNutrition.protein, 0) / totalScans) * 10) / 10
    : 0;
  const avgFiber = totalScans > 0
    ? Math.round((meals.reduce((acc, m) => acc + m.totalNutrition.fiber, 0) / totalScans) * 10) / 10
    : 0;

  return (
    <AuthGuard>
      <div className="py-8 sm:py-12 space-y-8">
        <Container size="lg">
        <SectionHeading
          eyebrow="Meal Journal"
          title="Previous Meal Analyses"
          description="Review your past plate scans, track your daily protein and fiber trends, and revisit practical balancing suggestions."
          action={
            <Link href="/scan">
              <Button size="sm" leftIcon={<CameraIcon size={16} />}>
                Scan New Meal
              </Button>
            </Link>
          }
        />

        {/* Segmented View Switcher: Meals Journal vs Nutrition Analytics */}
        <div className="flex items-center gap-2 p-1 rounded-xl bg-stone-100 dark:bg-[#131d16] border border-stone-200 dark:border-[#23382b] w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('meals')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'meals'
                ? 'bg-white dark:bg-[#1e3024] text-emerald-950 dark:text-emerald-300 shadow-2xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            📋 Meal History ({meals.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'analytics'
                ? 'bg-white dark:bg-[#1e3024] text-emerald-950 dark:text-emerald-300 shadow-2xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            📊 Nutrition Report &amp; Analytics
          </button>
        </div>

        {activeTab === 'analytics' ? (
          <NutritionAnalyticsDashboard userId={user?.uid} initialMeals={meals} />
        ) : (
          <>
            {/* History Trends Summary Card */}
        {meals.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-2xl bg-white dark:bg-[#131d16] border border-stone-200/90 dark:border-[#23382b] shadow-2xs">
            <div>
              <span className="block text-2xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                Total Meals Scanned
              </span>
              <span className="text-xl sm:text-2xl font-extrabold text-stone-900 dark:text-stone-100 mt-1 block">
                {totalScans}
              </span>
            </div>
            <div>
              <span className="block text-2xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                Avg. Calories / Meal
              </span>
              <span className="text-xl sm:text-2xl font-extrabold text-stone-900 dark:text-stone-100 mt-1 block">
                {avgCalories} <span className="text-xs font-normal text-stone-500 dark:text-stone-400">kcal</span>
              </span>
            </div>
            <div>
              <span className="block text-2xs font-semibold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">
                Avg. Protein / Meal
              </span>
              <span className="text-xl sm:text-2xl font-extrabold text-emerald-800 dark:text-emerald-400 mt-1 block">
                {avgProtein} <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400">g</span>
              </span>
            </div>
            <div>
              <span className="block text-2xs font-semibold text-teal-800 dark:text-teal-400 uppercase tracking-wider">
                Avg. Fiber / Meal
              </span>
              <span className="text-xl sm:text-2xl font-extrabold text-teal-800 dark:text-teal-400 mt-1 block">
                {avgFiber} <span className="text-xs font-normal text-teal-600 dark:text-teal-400">g</span>
              </span>
            </div>
          </div>
        )}

        {/* List of Previous Meals */}
        {isLoading ? (
          <div className="py-20 text-center">
            <div className="inline-block w-8 h-8 border-3 border-emerald-700 dark:border-emerald-400 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">Loading history...</p>
          </div>
        ) : meals.length === 0 ? (
          <EmptyState
            icon={<HistoryIcon size={24} />}
            title="No meals scanned yet"
            description="When you point your camera at your meal or test a sample thali, your analysis results will appear here for future reference."
            actionLabel="Scan Your First Meal"
            onAction={() => router.push('/scan')}
          />
        ) : (
          <div className="space-y-4">
            {meals.map(meal => {
              const itemImg = meal.imagePreviewUrl || (meal.mealTitle.toLowerCase().includes('paneer')
                ? '/images/food/grilled-paneer.jpg'
                : meal.mealTitle.toLowerCase().includes('sprouts') || meal.mealTitle.toLowerCase().includes('chaat') || meal.mealTitle.toLowerCase().includes('banana')
                ? '/images/food/sprouts-chaat.jpg'
                : meal.mealTitle.toLowerCase().includes('samosa') || meal.mealTitle.toLowerCase().includes('snack')
                ? '/images/food/canteen-samosa.jpg'
                : '/images/food/hostel-mess-thali.jpg');

              const score = meal.nutrientRichness?.stars
                ? Math.round(meal.nutrientRichness.stars * 20)
                : 82;

              return (
                <Link
                  key={meal.id}
                  href={`/results?id=${meal.id}`}
                  className="block group focus:outline-none"
                >
                  <div className="card-3d-interactive overflow-hidden bg-white dark:bg-[#131d16] border border-stone-200/90 dark:border-[#23382b] flex flex-col sm:flex-row items-stretch">
                    {/* Food Image Thumbnail */}
                    <div className="relative w-full sm:w-44 md:w-52 aspect-16/10 sm:aspect-auto shrink-0 bg-stone-900 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={itemImg}
                        alt={meal.mealTitle}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent sm:hidden" />
                      <div className="absolute top-2.5 left-2.5">
                        <span className="text-3xs font-extrabold uppercase px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-emerald-300 border border-emerald-500/40">
                          {score}/100
                        </span>
                      </div>
                    </div>

                    {/* Meal Journal Body */}
                    <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap text-2xs text-stone-500 dark:text-stone-400 mb-1">
                          <span className="font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 font-mono">
                            {formatDate(meal.analyzedAt)}
                          </span>
                          <span>•</span>
                          <span className="font-semibold text-stone-700 dark:text-stone-300">
                            {meal.balanceAssessment.label}
                          </span>
                          {meal.source === 'barcode' && (
                            <span className="text-3xs font-bold px-1.5 py-0.2 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300">
                              📦 Packaged
                            </span>
                          )}
                        </div>

                        <h3 className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100 group-hover:text-emerald-800 dark:group-hover:text-emerald-300 transition-colors">
                          {meal.mealTitle}
                        </h3>

                        {/* Quick Insights tags */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
                          {meal.totalNutrition.protein >= 15 && (
                            <span className="text-3xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                              ✓ Good protein ({meal.totalNutrition.protein}g)
                            </span>
                          )}
                          {meal.totalNutrition.fiber >= 5 && (
                            <span className="text-3xs font-semibold px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300">
                              ✓ High fiber
                            </span>
                          )}
                          {meal.items.slice(0, 3).map((item, idx) => (
                            <span
                              key={idx}
                              className="text-3xs px-2 py-0.5 rounded-md bg-stone-100 dark:bg-[#19271e] text-stone-600 dark:text-stone-400"
                            >
                              {item.name}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Bottom Info Bar: Calories & Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-stone-100 dark:border-[#23382b] text-xs">
                        <div className="flex items-center gap-4">
                          <span className="font-black text-stone-900 dark:text-stone-100 text-sm">
                            {meal.totalNutrition.calories} <span className="text-3xs font-normal text-stone-500">kcal</span>
                          </span>
                          <span className="text-stone-400 dark:text-stone-600">|</span>
                          <span className="font-bold text-emerald-700 dark:text-emerald-400 text-xs">
                            {meal.totalNutrition.protein}g protein
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={e => handleDelete(meal.id, e)}
                            title="Delete meal record"
                            className="p-1.5 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                          >
                            <TrashIcon size={15} />
                          </button>
                          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                            <span>Details</span>
                            <ArrowRightIcon size={14} />
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}

            {hasMore && (
              <div className="pt-4 text-center">
                <Button
                  variant="outline"
                  size="md"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? 'Loading more meals...' : 'Load Older Meals'}
                </Button>
              </div>
            )}
          </div>
        )}
        </>
      )}
      </Container>
    </div>
    </AuthGuard>
  );
}
