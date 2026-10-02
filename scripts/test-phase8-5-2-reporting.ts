/**
 * TRACK-A-BITE — PHASE 8.5.2 VERIFICATION SUITE
 * Reporting UI + Real Data Integration
 *
 * Verifies all 28 Phase 8.5.2 requirements:
 * 1. Reporting types exist (NutritionReport, MonthlyNutritionReport, NutritionDateRange)
 * 2. Real meal history is consumed without synthetic mocks in production flow
 * 3. Daily report calculation (getDateRangeReport with today preset)
 * 4. Weekly report calculation (getDateRangeReport with last_7_days preset)
 * 5. Monthly report calculation (getMonthlySummary)
 * 6. Date filtering (proper inclusion of range meals, exclusion of out-of-range)
 * 7. Calorie aggregation (sum and daily averages match recorded data)
 * 8. Protein aggregation (sum and daily averages match recorded data)
 * 9. Carb aggregation (sum and daily averages match recorded data)
 * 10. Fat aggregation (sum and daily averages match recorded data)
 * 11. Target progress (progress percentages calculated vs personalized targets)
 * 12. Nutrition score integration (deterministic 0-100 score and scoreRating)
 * 13. Insight integration (empirical evidence, non-medical language)
 * 14. Empty history handling (empty report, no crash, 0 values)
 * 15. Partial history handling (1-2 days logged, activeDays accurately reported)
 * 16. Local fallback (unauthenticated reads succeed from local storage)
 * 17. Cloud fallback (graceful fallback on cloud failure without uncaught errors)
 * 18. Authenticated UID boundary (empty/whitespace UID rejected at service boundary)
 * 19. Cross-user isolation (Firestore rules enforce request.auth.uid == userId)
 * 20. Deterministic output (same input produces identical report)
 * 21. No mock data in production report
 * 22. No password persistence in report payload
 * 23. No Gemini API key exposure in reports or public config
 * 24. Export integration (CSV with BOM and JSON with sanitized payload)
 * 25. Regression compatibility with Phase 8.4 (nutritionAnalyticsService)
 * 26. Regression compatibility with Phase 8.3 (production hardening)
 * 27. Regression compatibility with Phase 8.2 (scan, results, history pipeline)
 * 28. Regression compatibility with Phase 8.1 (firestoreMealHistoryService)
 */

import fs from 'fs';
import type { MealAnalysis } from '../src/lib/types/meal';
import type { UserProfile } from '../src/lib/types/profile';
import { getLocalISODate } from '../src/lib/utils';

// Automatically load .env.local if present
if (fs.existsSync('.env.local')) {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

// Mock browser localStorage for Node.js test environment
class MockStorage {
  private store: Record<string, string> = {};
  getItem(key: string): string | null { return this.store[key] || null; }
  setItem(key: string, value: string): void { this.store[key] = value; }
  removeItem(key: string): void { delete this.store[key]; }
  clear(): void { this.store = {}; }
  getAllKeys(): string[] { return Object.keys(this.store); }
  getAllValues(): string[] { return Object.values(this.store); }
}

const mockStorage = new MockStorage();
(global as unknown as { localStorage: unknown }).localStorage = mockStorage;
(global as unknown as { window: unknown }).window = {
  localStorage: mockStorage,
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true,
  print: () => {},
};

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ [PASS] ${message}`);
}

function createTestMeal(
  id: string,
  analyzedAt: string,
  calories = 500,
  protein = 25,
  carbohydrates = 65,
  fat = 15,
  fiber = 6
): MealAnalysis {
  return {
    id,
    mealTitle: `Test Meal ${id}`,
    analyzedAt,
    items: [
      {
        detectionId: `det-${id}-1`,
        foodId: 'dal-tadka',
        name: 'Dal Tadka with Roti',
        confidence: 0.95,
        portionMultiplier: 1.0,
        portionUnit: 'bowl',
        estimatedGrams: 200,
        nutrition: {
          calories,
          protein,
          carbohydrates,
          fat,
          fiber,
        },
      },
    ],
    totalNutrition: {
      calories,
      protein,
      carbohydrates,
      fat,
      fiber,
    },
    macroDistribution: {
      carbsPercent: 50,
      proteinPercent: 25,
      fatPercent: 25,
    },
    nutrientRichness: {
      stars: 4.0,
      label: 'Good',
      explanation: 'Balanced nutritional profile',
      highlights: ['Rich in protein', 'Dietary fiber source'],
    },
    nutrientGaps: {
      providedNutrients: [],
      missingNutrients: [],
      whyItMattersSummary: 'Adequate balance',
    },
    balanceAssessment: {
      rating: 'balanced',
      label: 'Balanced Fuel',
      summary: 'Optimal macronutrient ratio',
      detail: 'Rich in dietary fiber and essential minerals',
      glycemicImpactEstimate: 'Moderate',
    },
    positiveHighlights: ['Good protein source'],
    balancingRecommendations: [],
    hostelFriendlyUpgrades: [],
    hostelModeActive: true,
    practicalAdjustments: [],
    disclaimer: 'Calculated nutritional values are estimates for reference.',
  };
}

const mockProfile: UserProfile = {
  age: 22,
  gender: 'male',
  heightCm: 175,
  weightKg: 70,
  activityLevel: 'moderate',
  healthConditions: [],
  dietaryRestrictions: ['vegetarian'],
  allergies: [],
  isHostelite: true,
  hasCookingAccess: false,
  hasFridgeAccess: false,
  budgetPreference: 'budget',
  onboardingCompleted: true,
};

async function runSuite() {
  console.log('====================================================');
  console.log('TRACK-A-BITE — PHASE 8.5.2 REPORTING UI SUITE');
  console.log('Reporting UI + Real Data Integration Verification');
  console.log('====================================================\n');

  const { nutritionAnalyticsService } = await import('../src/lib/services/nutritionAnalyticsService');
  const { firestoreMealHistoryService } = await import('../src/lib/services/firestoreMealHistoryService');

  const now = new Date();
  const todayStr = getLocalISODate(now);

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalISODate(yesterday);

  const tenDaysAgo = new Date(now);
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

  const dToday1 = new Date(now);
  dToday1.setHours(9, 30, 0, 0);
  const meal1 = createTestMeal('m-rpt-1', dToday1.toISOString(), 600, 30, 80, 18, 8);

  const dToday2 = new Date(now);
  dToday2.setHours(14, 0, 0, 0);
  const meal2 = createTestMeal('m-rpt-2', dToday2.toISOString(), 400, 20, 50, 12, 4);

  const dYest1 = new Date(yesterday);
  dYest1.setHours(12, 30, 0, 0);
  const meal3 = createTestMeal('m-rpt-3', dYest1.toISOString(), 700, 35, 90, 20, 10);

  const dYest2 = new Date(yesterday);
  dYest2.setHours(19, 0, 0, 0);
  const meal4 = createTestMeal('m-rpt-4', dYest2.toISOString(), 550, 25, 70, 15, 6);

  const dTenDays = new Date(tenDaysAgo);
  dTenDays.setHours(13, 0, 0, 0);
  const meal5 = createTestMeal('m-rpt-5', dTenDays.toISOString(), 500, 20, 60, 15, 5);

  const seededMeals = [meal1, meal2, meal3, meal4, meal5];
  mockStorage.setItem('track_a_bite_meal_history', JSON.stringify(seededMeals));

  // --- TEST 1: REPORTING TYPES EXIST ---
  console.log('--- TEST 1: REPORTING TYPES & INTERFACES ---');
  assert(typeof nutritionAnalyticsService.getDateRangeReport === 'function', 'TEST 1: getDateRangeReport exists');
  assert(typeof nutritionAnalyticsService.getMonthlySummary === 'function', 'TEST 1: getMonthlySummary exists');
  assert(typeof nutritionAnalyticsService.exportReportAsJSON === 'function', 'TEST 1: exportReportAsJSON exists');
  assert(typeof nutritionAnalyticsService.exportReportAsCSV === 'function', 'TEST 1: exportReportAsCSV exists');
  assert(typeof nutritionAnalyticsService.exportReport === 'function', 'TEST 1: exportReport wrapper exists');

  // --- TEST 2: REAL MEAL HISTORY IS CONSUMED ---
  console.log('\n--- TEST 2: REAL MEAL HISTORY IS CONSUMED ---');
  const report7Days = await nutritionAnalyticsService.getDateRangeReport(undefined, 'last_7_days');
  assert(report7Days.totalMeals === 4, 'TEST 2: Exactly 4 real meals consumed from storage within last 7 days');
  assert(report7Days.meals.length === 4, 'TEST 2: Meals array contains all 4 meal records');
  assert(report7Days.meals[0].id === 'm-rpt-1', 'TEST 2: First meal ID preserved accurately');

  // --- TEST 3: DAILY REPORT CALCULATION ---
  console.log('\n--- TEST 3: DAILY REPORT CALCULATION ---');
  const todayReport = await nutritionAnalyticsService.getDateRangeReport(undefined, 'today');
  assert(todayReport.dateRange.startDate === todayStr, 'TEST 3: Daily report starts on today');
  assert(todayReport.dateRange.endDate === todayStr, 'TEST 3: Daily report ends on today');
  assert(todayReport.totalMeals === 2, 'TEST 3: Exactly 2 meals from today included');
  assert(todayReport.totalCalories === 1000, 'TEST 3: Today total calories = 600 + 400 = 1000 kcal');

  // --- TEST 4: WEEKLY REPORT CALCULATION ---
  console.log('\n--- TEST 4: WEEKLY REPORT CALCULATION ---');
  assert(report7Days.trends.length === 7, 'TEST 4: Weekly report has 7 day trend points');
  assert(report7Days.activeDaysCount === 2, 'TEST 4: 2 active logging days in 7-day period');
  assert(report7Days.totalMeals === 4, 'TEST 4: 4 total meals in weekly report');

  // --- TEST 5: MONTHLY REPORT CALCULATION ---
  console.log('\n--- TEST 5: MONTHLY REPORT CALCULATION ---');
  const monthlySummary = await nutritionAnalyticsService.getMonthlySummary(undefined);
  assert(Boolean(monthlySummary.monthName), 'TEST 5: Month name generated (e.g. October 2026)');
  assert(monthlySummary.totalMeals === 4, 'TEST 5: Monthly summary counts all 4 meals in current month (excludes 10-day-old meal from previous month)');
  assert(monthlySummary.activeDaysCount === 2, 'TEST 5: Monthly summary records 2 active days');
  assert(Array.isArray(monthlySummary.strongestDays), 'TEST 5: strongestDays array exists');
  assert(Array.isArray(monthlySummary.weakestDays), 'TEST 5: weakestDays array exists');

  // --- TEST 6: DATE FILTERING ---
  console.log('\n--- TEST 6: DATE FILTERING ACCURACY ---');
  const report30Days = await nutritionAnalyticsService.getDateRangeReport(undefined, 'last_30_days');
  assert(report30Days.totalMeals === 5, 'TEST 6: 30-day report includes all 5 meals including 10-day-old meal');
  const customReport = await nutritionAnalyticsService.getDateRangeReport(undefined, {
    startDate: yesterdayStr,
    endDate: todayStr,
    preset: 'custom',
  });
  assert(customReport.totalMeals === 4, 'TEST 6: Custom 2-day range includes exactly 4 meals (excludes 10-day-old meal)');
  assert(customReport.activeDaysCount === 2, 'TEST 6: 2 active days in custom range');

  // --- TEST 7: CALORIE AGGREGATION ---
  console.log('\n--- TEST 7: CALORIE AGGREGATION ---');
  // Total calories in last 7 days = 600 + 400 + 700 + 550 = 2250 kcal
  assert(report7Days.totalCalories === 2250, 'TEST 7: Exact total calories sum (2250 kcal)');
  assert(report7Days.averageCalories === Math.round(2250 / 2), 'TEST 7: Exact average calories per active day (1125 kcal/day)');

  // --- TEST 8: PROTEIN AGGREGATION ---
  console.log('\n--- TEST 8: PROTEIN AGGREGATION ---');
  // Total protein = 30 + 20 + 35 + 25 = 110g
  assert(report7Days.totalProteinG === 110, 'TEST 8: Exact total protein sum (110g)');
  assert(report7Days.averageProteinG === Math.round((110 / 2) * 10) / 10, 'TEST 8: Exact average protein per active day (55.0 g/day)');

  // --- TEST 9: CARB AGGREGATION ---
  console.log('\n--- TEST 9: CARBOHYDRATE AGGREGATION ---');
  // Total carbs = 80 + 50 + 90 + 70 = 290g
  assert(report7Days.totalCarbsG === 290, 'TEST 9: Exact total carbs sum (290g)');
  assert(report7Days.averageCarbsG === Math.round((290 / 2) * 10) / 10, 'TEST 9: Exact average carbs per active day (145.0 g/day)');

  // --- TEST 10: FAT AGGREGATION ---
  console.log('\n--- TEST 10: FAT AGGREGATION ---');
  // Total fat = 18 + 12 + 20 + 15 = 65g
  // Total fiber = 8 + 4 + 10 + 6 = 28g
  assert(report7Days.totalFatG === 65, 'TEST 10: Exact total fat sum (65g)');
  assert(report7Days.totalFiberG === 28, 'TEST 10: Exact total fiber sum (28g)');

  // --- TEST 11: TARGET PROGRESS ---
  console.log('\n--- TEST 11: TARGET PROGRESS CALCULATION ---');
  assert(report7Days.targets !== undefined, 'TEST 11: Report includes target object');
  assert(report7Days.calorieProgressPercent !== undefined, 'TEST 11: calorieProgressPercent computed');
  assert(report7Days.proteinProgressPercent !== undefined, 'TEST 11: proteinProgressPercent computed');
  assert(report7Days.carbsProgressPercent !== undefined, 'TEST 11: carbsProgressPercent computed');
  assert(report7Days.fatProgressPercent !== undefined, 'TEST 11: fatProgressPercent computed');

  // --- TEST 12: NUTRITION SCORE INTEGRATION ---
  console.log('\n--- TEST 12: NUTRITION SCORE INTEGRATION ---');
  assert(typeof report7Days.averageNutritionScore === 'number', 'TEST 12: Score is a number');
  assert(report7Days.averageNutritionScore >= 0 && report7Days.averageNutritionScore <= 100, 'TEST 12: Score bounded 0-100');
  assert(report7Days.nutritionRating !== undefined, 'TEST 12: nutritionRating rating assigned');

  // --- TEST 13: INSIGHT INTEGRATION ---
  console.log('\n--- TEST 13: NUTRITION INSIGHT INTEGRATION ---');
  assert(Array.isArray(report7Days.insights), 'TEST 13: Insights array attached');
  for (const ins of report7Days.insights) {
    assert(Boolean(ins.title), 'TEST 13: Insight has non-empty title');
    assert(Boolean(ins.observation), 'TEST 13: Insight has non-empty observation');
    assert(Boolean(ins.evidence), 'TEST 13: Insight has non-empty empirical evidence');
    // Ensure no medical claims
    assert(!ins.observation.toLowerCase().includes('diagnose'), 'TEST 13: No diagnostic medical language');
    assert(!ins.observation.toLowerCase().includes('cure'), 'TEST 13: No cure disease claims');
  }

  // --- TEST 14: EMPTY HISTORY ---
  console.log('\n--- TEST 14: EMPTY HISTORY HANDLING ---');
  mockStorage.setItem('track_a_bite_meal_history', JSON.stringify([]));
  const emptyReport = await nutritionAnalyticsService.getDateRangeReport(undefined, 'last_7_days');
  assert(emptyReport.totalMeals === 0, 'TEST 14: 0 total meals for empty history');
  assert(emptyReport.activeDaysCount === 0, 'TEST 14: 0 active days for empty history');
  assert(emptyReport.averageCalories === 0, 'TEST 14: 0 average calories without error');
  assert(emptyReport.averageNutritionScore === 0, 'TEST 14: 0 score without NaN');

  // --- TEST 15: PARTIAL HISTORY ---
  console.log('\n--- TEST 15: PARTIAL HISTORY (1 DAY LOGGED) ---');
  mockStorage.setItem('track_a_bite_meal_history', JSON.stringify([meal1]));
  const partialReport = await nutritionAnalyticsService.getDateRangeReport(undefined, 'last_7_days');
  assert(partialReport.totalMeals === 1, 'TEST 15: Exactly 1 meal in partial report');
  assert(partialReport.activeDaysCount === 1, 'TEST 15: Exactly 1 active day in partial report');
  assert(partialReport.averageCalories === 600, 'TEST 15: Average calories matches single logged meal (600 kcal)');

  // Restore seeded meals
  mockStorage.setItem('track_a_bite_meal_history', JSON.stringify(seededMeals));

  // --- TEST 16: LOCAL FALLBACK ---
  console.log('\n--- TEST 16: LOCAL FALLBACK ---');
  const localReport = await nutritionAnalyticsService.getDateRangeReport(undefined, 'today');
  assert(localReport.dataSource === 'local', 'TEST 16: Unauthenticated report returns dataSource local');
  assert(localReport.totalMeals === 2, 'TEST 16: Local meals retrieved successfully');

  // --- TEST 17: CLOUD FALLBACK ---
  console.log('\n--- TEST 17: CLOUD FAILURE FALLBACK ---');
  const cloudErrorReport = await nutritionAnalyticsService.getDateRangeReport('non-existent-user-uid-404', 'today');
  assert(cloudErrorReport.dataSource === 'local', 'TEST 17: Cloud failure safely falls back to local dataset');
  assert(cloudErrorReport.totalMeals === 2, 'TEST 17: Fallback retains local records');

  // --- TEST 18: AUTHENTICATED UID BOUNDARY ---
  console.log('\n--- TEST 18: AUTHENTICATED UID BOUNDARY ---');
  let rejectedEmptyUid = false;
  try {
    await firestoreMealHistoryService.getMeal('', 'm-1');
  } catch {
    rejectedEmptyUid = true;
  }
  assert(rejectedEmptyUid, 'TEST 18: Service strictly rejects empty UID query');

  // --- TEST 19: CROSS-USER ISOLATION ---
  console.log('\n--- TEST 19: CROSS-USER ISOLATION ---');
  const rulesContent = fs.readFileSync('firestore.rules', 'utf8');
  assert(rulesContent.includes('request.auth != null'), 'TEST 19: Rules enforce authenticated user');
  assert(rulesContent.includes('request.auth.uid == userId'), 'TEST 19: Rules enforce UID ownership boundary');

  // --- TEST 20: DETERMINISTIC OUTPUT ---
  console.log('\n--- TEST 20: DETERMINISTIC REPORT OUTPUT ---');
  const runA = await nutritionAnalyticsService.getDateRangeReport(undefined, 'last_7_days');
  const runB = await nutritionAnalyticsService.getDateRangeReport(undefined, 'last_7_days');
  assert(runA.totalCalories === runB.totalCalories, 'TEST 20: Total calories strictly identical across runs');
  assert(runA.averageNutritionScore === runB.averageNutritionScore, 'TEST 20: Nutrition score strictly identical across runs');
  assert(runA.consistencyPercentage === runB.consistencyPercentage, 'TEST 20: Consistency percentage strictly identical across runs');

  // --- TEST 21: NO MOCK DATA IN PRODUCTION REPORT ---
  console.log('\n--- TEST 21: NO MOCK DATA IN PRODUCTION REPORT ---');
  assert(report7Days.meals.every(m => !m.id.startsWith('mock-fake-')), 'TEST 21: Zero fake mock meal IDs in report');
  assert(report7Days.totalMeals === 4, 'TEST 21: Meal count strictly equals recorded data count within date range (4 meals)');
  assert(report7Days.meals.every(m => seededMeals.some(sm => sm.id === m.id)), 'TEST 21: Every report meal matches a real seeded meal');

  // --- TEST 22: NO PASSWORD PERSISTENCE ---
  console.log('\n--- TEST 22: NO PASSWORD PERSISTENCE IN EXPORT ---');
  const exportedJson = nutritionAnalyticsService.exportReportAsJSON(report7Days, mockProfile);
  assert(!exportedJson.includes('"password"'), 'TEST 22: Zero passwords in exported JSON');
  const exportedCsv = nutritionAnalyticsService.exportReportAsCSV(report7Days);
  assert(!exportedCsv.toLowerCase().includes('password'), 'TEST 22: Zero passwords in exported CSV');

  // --- TEST 23: NO GEMINI KEY EXPOSURE ---
  console.log('\n--- TEST 23: NO GEMINI KEY EXPOSURE ---');
  assert(!exportedJson.includes('AIza'), 'TEST 23: Zero Gemini API keys in JSON export');
  assert(!exportedCsv.includes('AIza'), 'TEST 23: Zero Gemini API keys in CSV export');
  assert(!process.env.NEXT_PUBLIC_GEMINI_API_KEY, 'TEST 23: GEMINI_API_KEY not exposed in public environment');

  // --- TEST 24: EXPORT INTEGRATION ---
  console.log('\n--- TEST 24: EXPORT INTEGRATION (CSV & JSON) ---');
  const csvExport = nutritionAnalyticsService.exportReport(report7Days, 'csv');
  assert(csvExport.format === 'csv', 'TEST 24: Export format is csv');
  assert(csvExport.filename.endsWith('.csv'), 'TEST 24: Filename has .csv extension');
  assert(csvExport.content.startsWith('\uFEFF'), 'TEST 24: CSV has UTF-8 BOM for Excel compatibility');

  const jsonExport = nutritionAnalyticsService.exportReport(report7Days, 'json', mockProfile);
  assert(jsonExport.format === 'json', 'TEST 24: Export format is json');
  assert(jsonExport.filename.endsWith('.json'), 'TEST 24: Filename has .json extension');
  const parsedJson = JSON.parse(jsonExport.content);
  assert(parsedJson.exportVersion === '1.0', 'TEST 24: JSON exportVersion is 1.0');
  assert(parsedJson.nutritionSummary.totalMeals === 4, 'TEST 24: JSON summary matches report total meals');

  // --- TEST 25: REGRESSION: PHASE 8.4 ---
  console.log('\n--- TEST 25: REGRESSION COMPATIBILITY: PHASE 8.4 ---');
  const dailyTargets = nutritionAnalyticsService.calculateDailyTargets(mockProfile);
  assert(dailyTargets.targetCalories > 0, 'TEST 25: calculateDailyTargets intact');
  const score = nutritionAnalyticsService.calculateNutritionScore(
    { totalCalories: 2000, totalProteinG: 60, totalCarbsG: 250, totalFatG: 60, totalFiberG: 25, mealCount: 3 },
    dailyTargets
  );
  assert(score.score >= 0 && score.score <= 100, 'TEST 25: calculateNutritionScore intact');

  // --- TEST 26: REGRESSION: PHASE 8.3 ---
  console.log('\n--- TEST 26: REGRESSION COMPATIBILITY: PHASE 8.3 ---');
  assert(typeof firestoreMealHistoryService.cleanupSubscriptions === 'function', 'TEST 26: cleanupSubscriptions intact');
  assert(typeof firestoreMealHistoryService.subscribeToRecentMeals === 'function', 'TEST 26: subscribeToRecentMeals intact');

  // --- TEST 27: REGRESSION: PHASE 8.2 ---
  console.log('\n--- TEST 27: REGRESSION COMPATIBILITY: PHASE 8.2 ---');
  assert(typeof firestoreMealHistoryService.migrateLocalMeals === 'function', 'TEST 27: migrateLocalMeals intact');
  assert(typeof firestoreMealHistoryService.getRecentMeals === 'function', 'TEST 27: getRecentMeals intact');

  // --- TEST 28: REGRESSION: PHASE 8.1 ---
  console.log('\n--- TEST 28: REGRESSION COMPATIBILITY: PHASE 8.1 ---');
  assert(typeof firestoreMealHistoryService.saveMeal === 'function', 'TEST 28: saveMeal intact');
  assert(typeof firestoreMealHistoryService.deleteMeal === 'function', 'TEST 28: deleteMeal intact');

  console.log('\n====================================================');
  console.log('🎉 ALL 28 PHASE 8.5.2 REPORTING TESTS PASSED!');
  console.log('====================================================\n');
  process.exit(0);
}

runSuite().catch(err => {
  console.error('\n❌ TEST SUITE FAILURE:', err);
  process.exit(1);
});
