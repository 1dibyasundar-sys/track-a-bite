'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Container } from '../layout/container';
import { useAuth } from '../auth/AuthProvider';
import { useUserProfile } from '../../lib/services/userProfileService';
import { nutritionAnalyticsService } from '../../lib/services/nutritionAnalyticsService';
import { hydrationService } from '../../lib/services/hydrationService';
import {
  DailyNutritionSummary,
  NextMealRecommendation,
  DashboardStreakMetrics,
  SmartNudge,
  GoalProgressSummary,
  SupportedHealthGoal,
  HostelFilterMode,
} from '../../lib/types/analytics';
import { MealAnalysis } from '../../lib/types/meal';
import { HydrationLogEntry } from '../../lib/types/hydration';
import { NutritionGoalCard } from './NutritionGoalCard';
import { MacroProgressCard } from './MacroProgressCard';
import { HydrationCard } from './HydrationCard';
import { NutritionScoreCard } from './NutritionScoreCard';
import { DailyNutritionTimeline } from './DailyNutritionTimeline';
import { NextMealCard } from './NextMealCard';
import { MicronutrientCard } from './MicronutrientCard';
import { ConsistencyCard } from './ConsistencyCard';
import { RecentActivity } from './RecentActivity';
import { CloudSyncStatus } from './CloudSyncStatus';
import { EmptyNutritionState } from './EmptyNutritionState';
import { SmartNudgesCard } from './SmartNudgesCard';
import { GoalProgressCard } from './GoalProgressCard';
import { WeeklyInsightsCard } from './WeeklyInsightsCard';
import { CameraIcon } from '../ui/icons';

interface NutritionDashboardProps {
  initialUserId?: string;
  initialMeals?: MealAnalysis[];
}

export function NutritionDashboard({
  initialUserId,
  initialMeals,
}: NutritionDashboardProps) {
  const { user, isAuthenticated } = useAuth();
  const profile = useUserProfile();
  const activeUserId = user?.uid || initialUserId;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [todaySummary, setTodaySummary] = useState<DailyNutritionSummary | null>(null);
  const [recommendations, setRecommendations] = useState<NextMealRecommendation[]>([]);
  const [streakMetrics, setStreakMetrics] = useState<DashboardStreakMetrics | null>(null);
  const [allRecentMeals, setAllRecentMeals] = useState<MealAnalysis[]>([]);
  const [hydrationEntries, setHydrationEntries] = useState<HydrationLogEntry[]>([]);
  const [nudges, setNudges] = useState<SmartNudge[]>([]);
  const [goalSummaries, setGoalSummaries] = useState<GoalProgressSummary[]>([]);
  const [weeklyInsights, setWeeklyInsights] = useState<string[]>([]);
  const [hostelFilter, setHostelFilter] = useState<HostelFilterMode>('all');

  // Profile completeness check
  const isProfileIncomplete = !profile.heightCm || !profile.weightKg || !profile.healthGoal;

  useEffect(() => {
    let isCancelled = false;

    async function fetchData() {
      try {
        // 1. Get today's summary (incorporates meals, hydration, targets, score)
        const today = await nutritionAnalyticsService.getTodaySummary(activeUserId, profile);
        if (isCancelled) return;
        setTodaySummary(today);

        // 2. Fetch past 30 days meals for longitudinal streak calculation
        const past30Report = await nutritionAnalyticsService.getDateRangeReport(activeUserId, 'last_30_days');
        if (isCancelled) return;
        const recentMeals = past30Report.meals || initialMeals || today.meals || [];
        setAllRecentMeals(recentMeals);

        // 3. Get hydration entries for today
        const hyd = today.hydration?.entries || [];
        setHydrationEntries(hyd);

        // 4. Calculate streak & consistency metrics
        const targetHydration = today.hydration?.hydrationTargetMl || 2200;
        const streaks = nutritionAnalyticsService.calculateStreakMetrics(
          recentMeals,
          hyd,
          targetHydration
        );
        setStreakMetrics(streaks);

        // 5. Generate smart next-meal recommendations
        const recs = nutritionAnalyticsService.getNextMealRecommendations(today, profile, hostelFilter);
        setRecommendations(recs);

        // 6. Generate prioritized in-app smart nudges
        const smartNudges = nutritionAnalyticsService.generateSmartNudges(today, profile, streaks);
        setNudges(smartNudges);

        // 7. Calculate goal progress summaries
        const supportedGoals: SupportedHealthGoal[] = [
          'general_health',
          'muscle_gain',
          'weight_management',
          'nutrition_consistency',
          'hydration_consistency',
        ];
        const goals = supportedGoals.map(g =>
          nutritionAnalyticsService.calculateGoalProgress(g, today, profile, streaks)
        );
        setGoalSummaries(goals);

        // 8. Generate weekly human-readable insights
        const weekly = await nutritionAnalyticsService.getWeeklySummary(activeUserId);
        if (weekly && !isCancelled) {
          const insights = nutritionAnalyticsService.generateWeeklyHumanInsights(weekly);
          setWeeklyInsights(insights);
        }
      } catch (err) {
        console.warn('[NutritionDashboard] Failed to load dashboard data:', err);
      } finally {
        if (!isCancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    void fetchData();

    return () => {
      isCancelled = true;
    };
  }, [activeUserId, profile, initialMeals, refreshTrigger, hostelFilter]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleQuickDrinkFromEmptyState = async () => {
    try {
      await hydrationService.logDrink(250, 'quick_add', undefined, activeUserId);
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      console.warn('[NutritionDashboard] Quick drink failed:', err);
    }
  };

  const handleHostelFilterChange = (mode: HostelFilterMode) => {
    setHostelFilter(mode);
    if (todaySummary) {
      const filteredRecs = nutritionAnalyticsService.getNextMealRecommendations(todaySummary, profile, mode);
      setRecommendations(filteredRecs);
    }
  };

  const handleNudgeAction = async (nudge: SmartNudge) => {
    if (nudge.category === 'hydration') {
      try {
        await hydrationService.logDrink(250, 'quick_add', undefined, activeUserId);
        setRefreshTrigger(prev => prev + 1);
      } catch (err) {
        console.warn('[NutritionDashboard] Nudge drink log failed:', err);
      }
    }
  };

  if (loading && !todaySummary) {
    return (
      <Container size="lg" className="py-12">
        <div className="space-y-6 animate-pulse">
          <div className="h-8 bg-stone-200 rounded-lg w-1/3" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="h-44 bg-stone-200 rounded-2xl" />
            <div className="h-44 bg-stone-200 rounded-2xl" />
          </div>
          <div className="h-64 bg-stone-200 rounded-2xl" />
        </div>
      </Container>
    );
  }

  const safeToday = todaySummary || {
    date: new Date().toISOString().split('T')[0],
    totalCalories: 0,
    totalProteinG: 0,
    totalCarbsG: 0,
    totalFatG: 0,
    totalFiberG: 0,
    mealCount: 0,
    nutritionScore: 0,
    nutritionRating: 'needs_attention' as const,
    targetCalories: profile.targetCalories || 2000,
    targetProteinG: profile.targetProteinG || 65,
    targetCarbsG: profile.targetCarbsG || 250,
    targetFatG: profile.targetFatG || 60,
    targetFiberG: 30,
    calorieProgressPercent: 0,
    proteinProgressPercent: 0,
    carbsProgressPercent: 0,
    fatProgressPercent: 0,
    fiberProgressPercent: 0,
    meals: [],
    dataSource: 'local' as const,
  };

  const latestMeal = allRecentMeals[0] || safeToday.meals[safeToday.meals.length - 1];
  const latestHydration = hydrationEntries[hydrationEntries.length - 1];
  const calorieGap = Math.max(0, safeToday.targetCalories - safeToday.totalCalories);
  const proteinGap = Math.max(0, safeToday.targetProteinG - safeToday.totalProteinG);

  // Phase 11: Personalized Greeting & Display Name
  const displayName = user?.displayName || (user?.email ? user.email.split('@')[0] : 'Campus Foodie');
  const currentHour = new Date().getHours();
  const timeGreeting = currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening';
  const greeting = `${timeGreeting}, ${displayName}`;

  // Contextual status message without meaningless filler
  let greetingContext = 'Live overview for ' + new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  if (safeToday.mealCount === 0) {
    greetingContext = "No meals logged yet today. Scan your first meal to calculate calories, protein, and micro-balance.";
  } else if (proteinGap > 25) {
    greetingContext = `You are ${Math.round(proteinGap)}g away from your protein target. Check recommendations below to balance your day.`;
  } else if (safeToday.calorieProgressPercent >= 70 && safeToday.calorieProgressPercent <= 110) {
    greetingContext = `Great consistency today! You've logged ${safeToday.mealCount} ${safeToday.mealCount === 1 ? 'meal' : 'meals'} and are on track with your goals.`;
  }

  return (
    <div className="pb-16 sm:pb-24 pt-4 sm:pt-6">
      <Container size="lg" className="space-y-6 sm:space-y-8">
        {/* TOP STATUS BAR: Cloud Sync + Quick Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CloudSyncStatus
            dataSource={safeToday.dataSource}
            isAuthenticated={isAuthenticated}
            onRefresh={handleManualRefresh}
            isRefreshing={refreshing}
          />

          <div className="flex items-center gap-2">
            <Link
              href="/scan"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-xs transition-colors"
            >
              <CameraIcon size={16} />
              <span>Scan Food</span>
            </Link>
          </div>
        </div>

        {/* PROFILE COMPLETION BANNER */}
        {isProfileIncomplete && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-start sm:items-center gap-2.5">
              <span className="text-xl">⚠️</span>
              <div>
                <h3 className="text-xs sm:text-sm font-bold">Complete your nutrition profile</h3>
                <p className="text-2xs sm:text-xs text-amber-800">
                  Add height, weight, and health goals to unlock personalized Mifflin-St Jeor target recommendations.
                </p>
              </div>
            </div>
            <Link
              href="/profile"
              className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shrink-0 text-center"
            >
              Update Profile
            </Link>
          </div>
        )}

        {/* HEADER: Personalized Contextual Greeting & Student Tags (Phase 11.1.A) */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-stone-200/80 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200/60">
                Personal Nutrition Companion
              </span>
              {profile.isHostelite && (
                <span className="text-xs font-bold text-amber-900 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200/60">
                  🏠 Hostel Mode
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-stone-900 tracking-tight">
              {greeting}
            </h1>
            <p className="text-xs sm:text-sm text-stone-600">
              {greetingContext}
            </p>
          </div>

          {/* Quick Dietary Profile Tags */}
          <div className="flex flex-wrap items-center gap-1.5 text-2xs text-stone-600 font-medium">
            <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 capitalize">
              Diet: {profile.dietaryRestrictions || 'Vegetarian'}
            </span>
            {profile.allergies && profile.allergies.length > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700">
                Allergies: {profile.allergies.join(', ')}
              </span>
            )}
            <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 capitalize">
              Budget: {profile.budgetPreference || 'Budget'}
            </span>
          </div>
        </div>

        {/* PRIMARY SCAN CTA HERO BANNER (Phase 11.1.G) */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-stone-900 text-white p-5 sm:p-7 shadow-md">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-2 max-w-xl">
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-700/60 border border-emerald-500/40 text-emerald-200 text-2xs font-bold uppercase tracking-wider">
                <span>⚡ Quick Scan</span>
                <span>•</span>
                <span>AI Food Intelligence</span>
              </div>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white">
                Scan Your Meal
              </h2>
              <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed font-normal">
                Take a quick photo of your plate, mess thali, or canteen snack. Instant macro breakdown, Indian dish detection, and personalized balance recommendations in seconds.
              </p>
            </div>

            <div className="shrink-0 flex items-center gap-3">
              <Link
                href="/scan"
                className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-white text-emerald-950 font-bold text-sm shadow-md hover:bg-emerald-50 active:scale-98 transition-all cursor-pointer group"
                aria-label="Scan food with camera"
              >
                <CameraIcon size={20} className="text-emerald-800 group-hover:scale-110 transition-transform" />
                <span>Scan Food Now</span>
              </Link>
            </div>
          </div>
        </div>

        {/* SMART NUDGES (Phase 9.4) */}
        {nudges.length > 0 && (
          <section aria-label="Smart Nudges">
            <SmartNudgesCard nudges={nudges} onActionClick={handleNudgeAction} />
          </section>
        )}

        {/* PRIMARY COMMAND GRID: Calories + Score */}
        <section aria-label="Daily Nutrition Progress" className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
          <NutritionGoalCard
            caloriesConsumed={safeToday.totalCalories}
            targetCalories={safeToday.targetCalories}
            targetTypeLabel={profile.customTargetsActive ? 'Custom target' : 'Recommended target'}
          />

          <NutritionScoreCard
            score={safeToday.nutritionScore}
            rating={safeToday.nutritionRating}
            caloriesPercent={safeToday.calorieProgressPercent}
            proteinPercent={safeToday.proteinProgressPercent}
            hydrationPercent={safeToday.hydration?.percentageOfTarget || 0}
            fiberPercent={safeToday.fiberProgressPercent}
            mealCount={safeToday.mealCount}
          />
        </section>

        {/* GOAL PROGRESS ENGINE (Phase 9.5) */}
        {goalSummaries.length > 0 && (
          <section aria-label="Goal Progress">
            <GoalProgressCard
              goalSummaries={goalSummaries}
              activeGoal={(profile.healthGoal as SupportedHealthGoal) || 'general_health'}
            />
          </section>
        )}

        {/* SECONDARY GRID: Macros + Hydration */}
        <section aria-label="Macronutrients and Hydration" className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
          <MacroProgressCard
            proteinG={safeToday.totalProteinG}
            targetProteinG={safeToday.targetProteinG}
            carbsG={safeToday.totalCarbsG}
            targetCarbsG={safeToday.targetCarbsG}
            fatG={safeToday.totalFatG}
            targetFatG={safeToday.targetFatG}
            fiberG={safeToday.totalFiberG}
            targetFiberG={safeToday.targetFiberG}
          />

          <HydrationCard
            intakeMl={safeToday.hydration?.dailyWaterIntakeMl || 0}
            targetMl={safeToday.hydration?.hydrationTargetMl || 2200}
            loggedDrinksCount={safeToday.hydration?.loggedDrinksCount || 0}
            userId={activeUserId}
            onDrinkLogged={handleManualRefresh}
          />
        </section>

        {/* NEXT MEAL PLANNER & SMART RECOMMENDATION WITH HOSTEL FILTERS (Phase 9.3 & 9.7) */}
        <section aria-label="Smart Next Meal">
          <NextMealCard
            recommendations={recommendations}
            proteinGapG={proteinGap}
            calorieGapKcal={calorieGap}
            isHostelite={profile.isHostelite}
            onFilterChange={handleHostelFilterChange}
          />
        </section>

        {/* DAILY NUTRITION JOURNEY (Phase 9.2) */}
        <section aria-label="Today's Nutrition Journey">
          {safeToday.mealCount === 0 && hydrationEntries.length === 0 ? (
            <EmptyNutritionState onQuickDrink={handleQuickDrinkFromEmptyState} />
          ) : (
            <DailyNutritionTimeline
              meals={safeToday.meals}
              hydrationEntries={hydrationEntries}
              proteinDeficitG={proteinGap}
            />
          )}
        </section>

        {/* MICRONUTRIENT VISIBILITY (Phase 9.1 & 9.7) */}
        <section aria-label="Micronutrient Progress">
          <MicronutrientCard summary={safeToday.micronutrients} />
        </section>

        {/* HABITS, CONSISTENCY & WEEKLY INSIGHTS (Phase 9.6 & 9.8) */}
        <section aria-label="Habits and Weekly Insights" className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
          {streakMetrics && <ConsistencyCard metrics={streakMetrics} />}
          <WeeklyInsightsCard insights={weeklyInsights} />
        </section>

        {/* RECENT ACTIVITY (Phase 11: latest 3-5 meals) */}
        <section aria-label="Recent Activity">
          <RecentActivity
            recentMeals={allRecentMeals.slice(0, 5)}
            latestMeal={latestMeal}
            latestHydration={latestHydration}
            latestScore={safeToday.nutritionScore}
          />
        </section>
      </Container>
    </div>
  );
}
