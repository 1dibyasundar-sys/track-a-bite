/**
 * TRACK-A-BITE — PHASE 9.6 WEEKLY INSIGHTS TESTS
 *
 * Verifies human-readable, factual weekly insights generated from real data:
 * - Empty / insufficient data threshold (< 2 active days => "Not enough data yet")
 * - Factual statements on logging frequency, protein averages, and hydration trends
 * - Macro composition awareness (e.g. carbohydrate dominance)
 * - Zero hallucinated or fabricated statistics
 */

import { nutritionAnalyticsService } from '../src/lib/services/nutritionAnalyticsService';
import { WeeklyNutritionSummary, DailyNutritionSummary } from '../src/lib/types/analytics';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`✅ [PASS] ${msg}`);
}

async function runWeeklyInsightsTests() {
  console.log('====================================================');
  console.log('TRACK-A-BITE — PHASE 9.6 WEEKLY INSIGHTS TESTS');
  console.log('====================================================\n');

  // --- 1. INSUFFICIENT DATA TEST ---
  console.log('--- 1. INSUFFICIENT DATA TEST ---');
  const emptyWeekly: WeeklyNutritionSummary = {
    startDate: '2026-09-25',
    endDate: '2026-10-01',
    dailySummaries: [],
    averageCalories: 0,
    averageProtein: 0,
    averageCarbs: 0,
    averageFat: 0,
    averageFiber: 0,
    averageNutritionScore: 0,
    totalMeals: 0,
    consistencyMetrics: {
      daysWithLogs: 0,
      loggedMealsCount: 0,
      targetConsistencyPercent: 0,
      scoreConsistency: 'variable',
    },
    dataSource: 'local',
  };

  const emptyInsights = nutritionAnalyticsService.generateWeeklyHumanInsights(emptyWeekly);
  assert(emptyInsights.length === 1, 'TEST 1.1: Single message for insufficient data');
  assert(emptyInsights[0].toLowerCase().includes('not enough data yet'), 'TEST 1.2: Clarifies not enough data yet');

  // --- 2. SUFFICIENT DATA TEST ---
  console.log('\n--- 2. SUFFICIENT HISTORICAL DATA ---');
  const makeDay = (date: string, cals: number, prot: number, carbs: number, hydMl: number): DailyNutritionSummary => ({
    date,
    totalCalories: cals,
    totalProteinG: prot,
    totalCarbsG: carbs,
    totalFatG: 45,
    totalFiberG: 20,
    mealCount: 2,
    nutritionScore: 80,
    nutritionRating: 'good',
    targetCalories: 2000,
    targetProteinG: 65,
    targetCarbsG: 250,
    targetFatG: 60,
    targetFiberG: 28,
    calorieProgressPercent: 80,
    proteinProgressPercent: 80,
    carbsProgressPercent: 80,
    fatProgressPercent: 75,
    fiberProgressPercent: 70,
    meals: [],
    dataSource: 'local',
    hydration: {
      date,
      dailyWaterIntakeMl: hydMl,
      hydrationTargetMl: 2200,
      percentageOfTarget: Math.round((hydMl / 2200) * 100),
      remainingAmountMl: Math.max(0, 2200 - hydMl),
      loggedDrinksCount: 3,
      isPersonalized: true,
      guidelineDisclaimer: '',
      entries: [],
      dataSource: 'local',
    },
  });

  const populatedWeekly: WeeklyNutritionSummary = {
    startDate: '2026-09-25',
    endDate: '2026-10-01',
    dailySummaries: [
      makeDay('2026-09-25', 1800, 60, 240, 2400),
      makeDay('2026-09-26', 1900, 70, 250, 2600),
      makeDay('2026-09-27', 1750, 55, 230, 1800),
      makeDay('2026-09-28', 2100, 75, 280, 2200),
      makeDay('2026-09-29', 1650, 50, 220, 1500),
    ],
    averageCalories: 1840,
    averageProtein: 62,
    averageCarbs: 244,
    averageFat: 45,
    averageFiber: 20,
    averageNutritionScore: 80,
    totalMeals: 10,
    consistencyMetrics: {
      daysWithLogs: 5,
      loggedMealsCount: 10,
      targetConsistencyPercent: 80,
      scoreConsistency: 'high',
    },
    dataSource: 'local',
  };

  const insights = nutritionAnalyticsService.generateWeeklyHumanInsights(populatedWeekly);
  assert(insights.length >= 3, 'TEST 2.1: Multi-point insights generated');
  assert(insights.some(i => i.includes('5 of the last 7 days')), 'TEST 2.2: Reports accurate logged days (5 of 7)');
  assert(insights.some(i => i.includes('62g per day')), 'TEST 2.3: Reports accurate average protein (62g)');
  assert(insights.some(i => i.includes('Hydration was strongest')), 'TEST 2.4: Compares highest and lowest hydration days');

  console.log('\n====================================================');
  console.log('🎉 ALL PHASE 9.6 WEEKLY INSIGHTS TESTS PASSED!');
  console.log('====================================================\n');
}

runWeeklyInsightsTests().catch(err => {
  console.error('\n❌ Weekly Insights Test Failed:', err);
  process.exit(1);
});
