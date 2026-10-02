/**
 * TRACK-A-BITE — PHASE 9.5 GOAL PROGRESS TESTS
 *
 * Verifies deterministic goal progress tracking across supported health goals:
 * - General Health
 * - Weight Management / Fat Loss
 * - Muscle Gain / Protein Consistency
 * - Hydration Consistency
 * - Nutrition Logging Consistency
 *
 * Enforces:
 * - Clamped progress [0, 100]%
 * - Zero division protection
 * - Non-diagnostic, factual guidance
 */

import { nutritionAnalyticsService } from '../src/lib/services/nutritionAnalyticsService';
import { DailyNutritionSummary, SupportedHealthGoal, DashboardStreakMetrics } from '../src/lib/types/analytics';
import { DEFAULT_USER_PROFILE } from '../src/lib/types/profile';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`✅ [PASS] ${msg}`);
}

async function runGoalProgressTests() {
  console.log('====================================================');
  console.log('TRACK-A-BITE — PHASE 9.5 GOAL PROGRESS TESTS');
  console.log('====================================================\n');

  const baseSummary: DailyNutritionSummary = {
    date: '2026-10-02',
    totalCalories: 1750,
    totalProteinG: 62,
    totalCarbsG: 220,
    totalFatG: 50,
    totalFiberG: 22,
    mealCount: 3,
    nutritionScore: 82,
    nutritionRating: 'good',
    targetCalories: 2000,
    targetProteinG: 70,
    targetCarbsG: 250,
    targetFatG: 60,
    targetFiberG: 28,
    calorieProgressPercent: 88,
    proteinProgressPercent: 89,
    carbsProgressPercent: 88,
    fatProgressPercent: 83,
    fiberProgressPercent: 79,
    meals: [],
    dataSource: 'local',
    hydration: {
      date: '2026-10-02',
      dailyWaterIntakeMl: 2100,
      hydrationTargetMl: 2450,
      percentageOfTarget: 86,
      remainingAmountMl: 350,
      loggedDrinksCount: 4,
      isPersonalized: true,
      guidelineDisclaimer: '',
      entries: [],
      dataSource: 'local',
    },
  };

  const streakMetrics: DashboardStreakMetrics = {
    currentStreakDays: 5,
    longestStreakDays: 8,
    hasSufficientData: true,
    sevenDayConsistencyPercent: 85,
    thirtyDayConsistencyPercent: 80,
    activeLoggingDaysCount: 6,
    hydrationGoalMetDaysCount: 5,
    mealsLoggedToday: 3,
    hydrationLoggedTodayMl: 2100,
    streakStatusMessage: 'Active',
  };

  const testGoals: SupportedHealthGoal[] = [
    'general_health',
    'weight_management',
    'fat_loss',
    'muscle_gain',
    'protein_consistency',
    'hydration_consistency',
    'nutrition_consistency',
  ];

  for (const g of testGoals) {
    const summary = nutritionAnalyticsService.calculateGoalProgress(g, baseSummary, DEFAULT_USER_PROFILE, streakMetrics);

    assert(Boolean(summary.goalLabel), `Goal ${g}: label exists`);
    assert(typeof summary.currentValue === 'number' && !isNaN(summary.currentValue), `Goal ${g}: currentValue valid number`);
    assert(summary.targetValue > 0 && isFinite(summary.targetValue), `Goal ${g}: targetValue positive and finite`);
    assert(summary.progressPercent >= 0 && summary.progressPercent <= 100, `Goal ${g}: progress clamped [0, 100]% (got ${summary.progressPercent}%)`);
    assert(['improving', 'stable', 'needs_attention'].includes(summary.weeklyTrend), `Goal ${g}: valid weeklyTrend enum`);
    assert(Boolean(summary.weeklyTrendDescription), `Goal ${g}: weeklyTrendDescription exists`);
    assert(Boolean(summary.recommendedAction), `Goal ${g}: recommendedAction exists`);
  }

  // --- DIVISION BY ZERO / EMPTY CHECK ---
  console.log('\n--- ZERO TARGET IMMUNITY ---');
  const zeroDaySummary: DailyNutritionSummary = {
    ...baseSummary,
    totalProteinG: 0,
    targetProteinG: 0,
    totalCalories: 0,
    targetCalories: 0,
    hydration: undefined,
  };

  const safeMuscleGoal = nutritionAnalyticsService.calculateGoalProgress('muscle_gain', zeroDaySummary, DEFAULT_USER_PROFILE);
  assert(safeMuscleGoal.progressPercent === 0, 'Zero targets clamped to 0% progress without error');
  assert(!isNaN(safeMuscleGoal.progressPercent), 'No NaN produced on zero targets');

  console.log('\n====================================================');
  console.log('🎉 ALL PHASE 9.5 GOAL PROGRESS TESTS PASSED!');
  console.log('====================================================\n');
}

runGoalProgressTests().catch(err => {
  console.error('\n❌ Goal Progress Test Failed:', err);
  process.exit(1);
});
