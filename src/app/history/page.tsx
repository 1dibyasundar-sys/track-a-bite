'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Container } from '../../components/layout/container';
import { SectionHeading } from '../../components/common/section-heading';
import { EmptyState } from '../../components/common/empty-state';
import { Card, CardContent } from '../../components/ui/card';
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
        <div className="flex items-center gap-2 p-1 rounded-xl bg-stone-100 border border-stone-200 w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('meals')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'meals'
                ? 'bg-white text-emerald-950 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            📋 Meal History ({meals.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'analytics'
                ? 'bg-white text-emerald-950 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-2xl bg-white border border-stone-200/90 shadow-2xs">
            <div>
              <span className="block text-2xs font-semibold text-stone-500 uppercase tracking-wider">
                Total Meals Scanned
              </span>
              <span className="text-xl sm:text-2xl font-extrabold text-stone-900 mt-1 block">
                {totalScans}
              </span>
            </div>
            <div>
              <span className="block text-2xs font-semibold text-stone-500 uppercase tracking-wider">
                Avg. Calories / Meal
              </span>
              <span className="text-xl sm:text-2xl font-extrabold text-stone-900 mt-1 block">
                {avgCalories} <span className="text-xs font-normal text-stone-500">kcal</span>
              </span>
            </div>
            <div>
              <span className="block text-2xs font-semibold text-emerald-800 uppercase tracking-wider">
                Avg. Protein / Meal
              </span>
              <span className="text-xl sm:text-2xl font-extrabold text-emerald-800 mt-1 block">
                {avgProtein} <span className="text-xs font-normal text-emerald-600">g</span>
              </span>
            </div>
            <div>
              <span className="block text-2xs font-semibold text-teal-800 uppercase tracking-wider">
                Avg. Fiber / Meal
              </span>
              <span className="text-xl sm:text-2xl font-extrabold text-teal-800 mt-1 block">
                {avgFiber} <span className="text-xs font-normal text-teal-600">g</span>
              </span>
            </div>
          </div>
        )}

        {/* List of Previous Meals */}
        {isLoading ? (
          <div className="py-20 text-center">
            <div className="inline-block w-8 h-8 border-3 border-emerald-700 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs text-stone-500 font-medium">Loading history...</p>
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
            {meals.map(meal => (
              <Link
                key={meal.id}
                href={`/results?id=${meal.id}`}
                className="block group focus:outline-none"
              >
                <Card className="hover:border-emerald-300 transition-all duration-200">
                  <CardContent className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Meal info & items */}
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-2xs text-stone-500 font-medium">
                          {formatDate(meal.analyzedAt)}
                        </span>
                        <span className="text-stone-300">•</span>
                        {meal.nutrientRichness && (
                          <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                            ★ {meal.nutrientRichness.stars.toFixed(1)} / 5.0
                          </span>
                        )}
                        <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800">
                          {meal.balanceAssessment.label}
                        </span>
                        {meal.source === 'barcode' ? (
                          <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                            🔳 Packaged Food
                          </span>
                        ) : meal.hostelModeActive && (
                          <span className="text-2xs font-medium px-1.5 py-0.2 rounded bg-stone-100 text-stone-600">
                            Hostel Scan
                          </span>
                        )}
                        {meal.expiryStatus === 'EXPIRED' && (
                          <span className="text-2xs font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                            🔴 Expired
                          </span>
                        )}
                        {meal.expiryStatus === 'EXPIRING_SOON' && (
                          <span className="text-2xs font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                            🟡 Expiring Soon
                          </span>
                        )}
                        {meal.expiryStatus === 'VALID' && (
                          <span className="text-2xs font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                            🟢 Valid
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-stone-900 group-hover:text-emerald-900 transition-colors">
                        {meal.mealTitle}
                      </h3>

                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-stone-600">
                        {meal.items.map((item, idx) => (
                          <span
                            key={idx}
                            className="bg-stone-100 text-stone-700 px-2 py-0.5 rounded-md text-2xs font-medium"
                          >
                            {item.name} ({item.portionMultiplier}x)
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Nutrition pills & delete action */}
                    <div className="flex items-center justify-between md:justify-end gap-5 pt-3 md:pt-0 border-t md:border-t-0 border-stone-100">
                      <div className="grid grid-cols-4 gap-2 text-center text-xs">
                        <div className="px-2 py-1 rounded bg-stone-50">
                          <span className="block text-3xs text-stone-500">Calories</span>
                          <span className="font-bold text-stone-900">
                            {meal.totalNutrition.calories}
                          </span>
                        </div>
                        <div className="px-2 py-1 rounded bg-emerald-50 text-emerald-900">
                          <span className="block text-3xs text-emerald-700">Protein</span>
                          <span className="font-bold">{meal.totalNutrition.protein}g</span>
                        </div>
                        <div className="px-2 py-1 rounded bg-amber-50 text-amber-900">
                          <span className="block text-3xs text-amber-700">Carbs</span>
                          <span className="font-bold">{meal.totalNutrition.carbohydrates}g</span>
                        </div>
                        <div className="px-2 py-1 rounded bg-teal-50 text-teal-900">
                          <span className="block text-3xs text-teal-700">Fiber</span>
                          <span className="font-bold">{meal.totalNutrition.fiber}g</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={e => handleDelete(meal.id, e)}
                          title="Delete meal record"
                          className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <TrashIcon size={16} />
                        </button>
                        <div className="p-2 rounded-lg bg-stone-100 group-hover:bg-emerald-800 group-hover:text-white text-stone-600 transition-colors">
                          <ArrowRightIcon size={16} />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}

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
