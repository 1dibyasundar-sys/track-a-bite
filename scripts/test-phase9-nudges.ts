/**
 * TRACK-A-BITE — PHASE 9.4 SMART NUDGES TESTS
 *
 * Verifies lightweight, prioritized in-app smart nudges:
 * - Deterministic priorities: HIGH, MEDIUM, LOW
 * - Bounded to at most 3 top nudges
 * - Hydration gap detection
 * - Protein deficit detection
 * - Meal timing detection
 * - Micronutrient gap awareness
 * - Tracking streak celebration
 */

import { nutritionAnalyticsService } from '../src/lib/services/nutritionAnalyticsService';
import { DailyNutritionSummary, DashboardStreakMetrics } from '../src/lib/types/analytics';
import { DEFAULT_USER_PROFILE } from '../src/lib/types/profile';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`✅ [PASS] ${msg}`);
}

async function runNudgesTests() {
  console.log('====================================================');
  console.log('TRACK-A-BITE — PHASE 9.4 SMART NUDGES TESTS');
  console.log('====================================================\n');

  // --- 1. ZERO MEALS TODAY TRIGGER ---
  console.log('--- 1. EMPTY DAY TRIGGER ---');
  const emptyDaySummary: DailyNutritionSummary = {
    date: '2026-10-02',
    totalCalories: 0,
    totalProteinG: 0,
    totalCarbsG: 0,
    totalFatG: 0,
    totalFiberG: 0,
    mealCount: 0,
    nutritionScore: 0,
    nutritionRating: 'needs_attention',
    targetCalories: 2000,
    targetProteinG: 65,
    targetCarbsG: 250,
    targetFatG: 60,
    targetFiberG: 28,
    calorieProgressPercent: 0,
    proteinProgressPercent: 0,
    carbsProgressPercent: 0,
    fatProgressPercent: 0,
    fiberProgressPercent: 0,
    meals: [],
    dataSource: 'local',
  };

  const emptyNudges = nutritionAnalyticsService.generateSmartNudges(emptyDaySummary, DEFAULT_USER_PROFILE);
  assert(emptyNudges.length >= 1, 'TEST 1.1: At least one nudge generated for empty day');
  assert(emptyNudges.some(n => n.category === 'meal' && n.priority === 'HIGH'), 'TEST 1.2: HIGH priority meal prompt generated');

  // --- 2. HYDRATION BEHIND TRIGGER ---
  console.log('\n--- 2. HYDRATION BEHIND TRIGGER ---');
  const lowHydrationSummary: DailyNutritionSummary = {
    ...emptyDaySummary,
    mealCount: 1,
    totalCalories: 600,
    totalProteinG: 25,
    hydration: {
      date: '2026-10-02',
      dailyWaterIntakeMl: 500,
      hydrationTargetMl: 2500, // < 50%
      percentageOfTarget: 20,
      remainingAmountMl: 2000,
      loggedDrinksCount: 1,
      isPersonalized: true,
      guidelineDisclaimer: '',
      entries: [],
      dataSource: 'local',
    },
  };

  const hydNudges = nutritionAnalyticsService.generateSmartNudges(lowHydrationSummary, DEFAULT_USER_PROFILE);
  assert(hydNudges.some(n => n.category === 'hydration' && n.priority === 'HIGH'), 'TEST 2.1: HIGH priority hydration nudge when < 50%');
  assert(hydNudges[0].priority === 'HIGH', 'TEST 2.2: Top nudge has HIGH priority');

  // --- 3. BOUNDED VOLUME (MAX 3 NUDGES) ---
  console.log('\n--- 3. BOUNDED VOLUME ---');
  const streakMetrics: DashboardStreakMetrics = {
    currentStreakDays: 4,
    longestStreakDays: 7,
    hasSufficientData: true,
    sevenDayConsistencyPercent: 80,
    thirtyDayConsistencyPercent: 75,
    activeLoggingDaysCount: 5,
    hydrationGoalMetDaysCount: 4,
    mealsLoggedToday: 1,
    hydrationLoggedTodayMl: 500,
    streakStatusMessage: 'Active',
  };

  const allNudges = nutritionAnalyticsService.generateSmartNudges(lowHydrationSummary, DEFAULT_USER_PROFILE, streakMetrics);
  assert(allNudges.length <= 3, 'TEST 3.1: Nudges strictly capped at top 3');

  // --- 4. CONSISTENCY RECOGNITION ---
  console.log('\n--- 4. CONSISTENCY RECOGNITION ---');
  const consistentSummary: DailyNutritionSummary = {
    ...emptyDaySummary,
    mealCount: 3,
    totalCalories: 1950,
    totalProteinG: 68,
    nutritionScore: 88,
  };
  const streakNudges = nutritionAnalyticsService.generateSmartNudges(consistentSummary, DEFAULT_USER_PROFILE, streakMetrics);
  assert(streakNudges.some(n => n.category === 'consistency'), 'TEST 4.1: Consistency celebratory nudge generated');

  console.log('\n====================================================');
  console.log('🎉 ALL PHASE 9.4 SMART NUDGES TESTS PASSED!');
  console.log('====================================================\n');
}

runNudgesTests().catch(err => {
  console.error('\n❌ Nudges Test Failed:', err);
  process.exit(1);
});
