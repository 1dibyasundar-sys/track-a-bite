/**
 * TRACK-A-BITE — PHASE 8.5 VERIFICATION SUITE
 * Longitudinal Nutrition Insights, Monthly Summaries, Date-Range Analytics & Dietary Journal Export
 *
 * Verifies all 29 Phase 8.5 requirements:
 * 1. Reporting types exist
 * 2. Date range validation
 * 3. Today aggregation
 * 4. 7-day aggregation
 * 5. 30-day aggregation
 * 6. Monthly aggregation
 * 7. Empty history
 * 8. Longitudinal trend calculation
 * 9. Score trend calculation
 * 10. Consistency calculation
 * 11. Insight generation
 * 12. JSON export
 * 13. CSV export
 * 14. Unicode CSV handling
 * 15. Export sanitization
 * 16. Password exclusion
 * 17. Auth token exclusion
 * 18. GEMINI_API_KEY exclusion
 * 19. Cross-user isolation
 * 20. Local fallback
 * 21. Firestore failure fallback
 * 22. Date boundary handling
 * 23. Future date handling
 * 24. Deterministic report generation
 * 25. Existing analytics regression
 * 26. Phase 8.1 regression
 * 27. Phase 8.2 regression
 * 28. Phase 8.3 regression
 * 29. Phase 8.4 regression
 */

import fs from 'fs';
import type { MealAnalysis } from '../src/lib/types/meal';
import type { UserProfile } from '../src/lib/types/profile';

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

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`✅ [PASS] ${message}`);
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

function createSampleMeal(
  id: string,
  dateIso: string,
  title: string,
  cals: number,
  prot: number,
  carbs: number,
  fat: number,
  fiber: number
): MealAnalysis {
  return {
    id,
    mealTitle: title,
    analyzedAt: dateIso,
    items: [
      {
        detectionId: `det-${id}-1`,
        foodId: 'dal-tadka',
        name: title,
        confidence: 0.95,
        portionMultiplier: 1.0,
        portionUnit: 'serving',
        estimatedGrams: 200,
        nutrition: {
          calories: cals,
          protein: prot,
          carbohydrates: carbs,
          fat,
          fiber,
        },
      },
    ],
    totalNutrition: {
      calories: cals,
      protein: prot,
      carbohydrates: carbs,
      fat,
      fiber,
    },
    macroDistribution: {
      carbsPercent: 50,
      proteinPercent: 25,
      fatPercent: 25,
    },
    nutrientRichness: {
      stars: 4.5,
      label: 'Nutrient Dense',
      explanation: 'Balanced meal',
      highlights: ['High Protein', 'Rich in Fiber'],
    },
    nutrientGaps: {
      providedNutrients: ['Iron', 'Protein'],
      missingNutrients: [],
      whyItMattersSummary: 'Good nutrient profile',
    },
    balanceAssessment: {
      rating: 'balanced',
      label: 'Balanced',
      summary: 'Well rounded meal',
      detail: 'Optimal macros',
      glycemicImpactEstimate: 'Moderate',
    },
    positiveHighlights: ['High protein'],
    balancingRecommendations: [],
    hostelFriendlyUpgrades: [],
    hostelModeActive: true,
    practicalAdjustments: [],
    disclaimer: 'Informational only',
  };
}

async function runPhase85Suite() {
  console.log('====================================================');
  console.log('TRACK-A-BITE — PHASE 8.5 REPORTING & INSIGHTS SUITE');
  console.log('Longitudinal Analytics, Summaries, Exports & Reports');
  console.log('====================================================\n');

  // Dynamic imports
  const {
    nutritionAnalyticsService,
    NutritionAnalyticsService,
    getLocalISODate,
  } = await import('../src/lib/services/nutritionAnalyticsService');

  const {
    firestoreMealHistoryService,
  } = await import('../src/lib/services');

  const mockProfile: UserProfile = {
    age: 21,
    gender: 'male',
    heightCm: 175,
    weightKg: 68,
    activityLevel: 'moderately_active',
    healthConditions: ['None'],
    isHostelite: true,
    hasCookingAccess: false,
    hasFridge: false,
    budgetPreference: 'budget',
    onboardingCompleted: true,
  };

  const todayStr = getLocalISODate(new Date());

  // Setup multi-day sample meals
  const meal1 = createSampleMeal('m-1', `${todayStr}T08:30:00.000Z`, 'Breakfast Poha', 380, 12, 58, 8, 4);
  const meal2 = createSampleMeal('m-2', `${todayStr}T13:30:00.000Z`, 'Dal Tadka & Rice', 580, 24, 75, 14, 7);
  
  // Past dates
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalISODate(yesterday);
  const meal3 = createSampleMeal('m-3', `${yesterdayStr}T12:30:00.000Z`, 'Roti & Chana Masala', 520, 20, 70, 12, 9);

  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
  const fiveDaysAgoStr = getLocalISODate(fiveDaysAgo);
  const meal4 = createSampleMeal('m-4', `${fiveDaysAgoStr}T19:30:00.000Z`, 'Paneer Bhurji & Roti', 620, 28, 48, 26, 6);

  const twentyDaysAgo = new Date();
  twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);
  const twentyDaysAgoStr = getLocalISODate(twentyDaysAgo);
  const meal5 = createSampleMeal('m-5', `${twentyDaysAgoStr}T13:00:00.000Z`, 'Khichdi & Curd', 450, 16, 65, 10, 5);

  const sampleMeals: MealAnalysis[] = [meal1, meal2, meal3, meal4, meal5];

  // Populate local storage for fallback tests
  mockStorage.setItem('track_a_bite_meal_history', JSON.stringify(sampleMeals));

  // --- TEST 1: REPORTING TYPES EXIST ---
  console.log('--- TEST 1: REPORTING TYPES & METHODS EXIST ---');
  assert(nutritionAnalyticsService instanceof NutritionAnalyticsService, 'TEST 1: Singleton nutritionAnalyticsService instance exists');
  assert(typeof nutritionAnalyticsService.resolveDateRange === 'function', 'TEST 1: resolveDateRange method exists');
  assert(typeof nutritionAnalyticsService.getLongitudinalTrends === 'function', 'TEST 1: getLongitudinalTrends method exists');
  assert(typeof nutritionAnalyticsService.generateLongitudinalInsights === 'function', 'TEST 1: generateLongitudinalInsights method exists');
  assert(typeof nutritionAnalyticsService.getDateRangeReport === 'function', 'TEST 1: getDateRangeReport method exists');
  assert(typeof nutritionAnalyticsService.getMonthlySummary === 'function', 'TEST 1: getMonthlySummary method exists');
  assert(typeof nutritionAnalyticsService.exportReportAsJSON === 'function', 'TEST 1: exportReportAsJSON method exists');
  assert(typeof nutritionAnalyticsService.exportReportAsCSV === 'function', 'TEST 1: exportReportAsCSV method exists');
  assert(typeof nutritionAnalyticsService.exportReport === 'function', 'TEST 1: exportReport method exists');

  // --- TEST 2: DATE RANGE VALIDATION ---
  console.log('\n--- TEST 2: DATE RANGE VALIDATION ---');
  const last7 = nutritionAnalyticsService.resolveDateRange('last_7_days');
  assert(Boolean(last7.startDate && last7.endDate), 'TEST 2: last_7_days resolves start and end date');
  assert(last7.endDate === todayStr, 'TEST 2: last_7_days ends on today');
  
  // Custom range inverted test (endDate < startDate should be handled gracefully / swapped)
  const invertedRange = nutritionAnalyticsService.resolveDateRange('custom', {
    startDate: '2026-10-10',
    endDate: '2026-10-01',
  });
  assert(invertedRange.startDate <= invertedRange.endDate, 'TEST 2: Inverted date range normalized so startDate <= endDate');

  // Malformed date strings handled without crashing
  const safeFallback = nutritionAnalyticsService.resolveDateRange('custom', {
    startDate: 'invalid-date',
    endDate: 'not-a-date',
  });
  assert(Boolean(safeFallback.startDate && safeFallback.endDate), 'TEST 2: Invalid dates fallback safely without throwing');

  // --- TEST 3: TODAY AGGREGATION ---
  console.log('\n--- TEST 3: TODAY AGGREGATION ---');
  const todayReport = await nutritionAnalyticsService.getDateRangeReport(undefined, 'today');
  assert(todayReport.dateRange.startDate === todayStr, 'TEST 3: Today report starts on today');
  assert(todayReport.dateRange.endDate === todayStr, 'TEST 3: Today report ends on today');
  assert(todayReport.trend.length === 1, 'TEST 3: Today report has 1 trend point');
  assert(todayReport.totalMeals === 2, 'TEST 3: Today report aggregates 2 meals from today');
  assert(todayReport.averageCalories === 960, 'TEST 3: Today average calories equals sum of today meals (380+580=960)');

  // --- TEST 4: 7-DAY AGGREGATION ---
  console.log('\n--- TEST 4: 7-DAY AGGREGATION ---');
  const report7 = await nutritionAnalyticsService.getDateRangeReport(undefined, 'last_7_days');
  assert(report7.trend.length === 7, 'TEST 4: 7-day report includes 7 daily trend points');
  // In last 7 days: meal1, meal2 (today), meal3 (yesterday), meal4 (5 days ago) = 4 meals
  assert(report7.totalMeals === 4, 'TEST 4: 7-day report counts all 4 meals within last 7 days');
  assert(report7.activeDays === 3, 'TEST 4: 7-day report has 3 active logging days');

  // --- TEST 5: 30-DAY AGGREGATION ---
  console.log('\n--- TEST 5: 30-DAY AGGREGATION ---');
  const report30 = await nutritionAnalyticsService.getDateRangeReport(undefined, 'last_30_days');
  assert(report30.trend.length === 30, 'TEST 5: 30-day report includes 30 daily trend points');
  // Includes meal5 (20 days ago) as well => 5 meals total
  assert(report30.totalMeals === 5, 'TEST 5: 30-day report counts all 5 recorded meals');
  assert(report30.activeDays === 4, 'TEST 5: 30-day report counts 4 active logging days');

  // --- TEST 6: MONTHLY AGGREGATION ---
  console.log('\n--- TEST 6: MONTHLY AGGREGATION ---');
  const monthlySummary = await nutritionAnalyticsService.getMonthlySummary(undefined);
  assert(Boolean(monthlySummary.startDate && monthlySummary.endDate), 'TEST 6: Monthly summary has valid start and end dates');
  assert(typeof monthlySummary.averageMealsPerDay === 'number', 'TEST 6: Monthly summary calculates averageMealsPerDay');
  assert(typeof monthlySummary.consistencyPercentage === 'number', 'TEST 6: Monthly summary calculates consistencyPercentage');
  assert(typeof monthlySummary.averageNutritionScore === 'number', 'TEST 6: Monthly summary calculates averageNutritionScore');
  assert(Boolean(monthlySummary.scoreDistribution), 'TEST 6: Score distribution exists (excellent, good, needsWork)');
  assert(Array.isArray(monthlySummary.insights), 'TEST 6: Monthly summary contains insights array');
  assert(Array.isArray(monthlySummary.strongestDays), 'TEST 6: Monthly summary contains strongestDays');
  assert(Array.isArray(monthlySummary.weakestDays), 'TEST 6: Monthly summary contains weakestDays');

  // --- TEST 7: EMPTY HISTORY ---
  console.log('\n--- TEST 7: EMPTY HISTORY BEHAVIOR ---');
  // Provide empty meal set directly to trend calculation
  const emptyRange = { startDate: '2026-08-01', endDate: '2026-08-07' };
  const emptyTrends = nutritionAnalyticsService.getLongitudinalTrends([], emptyRange, mockProfile);
  assert(emptyTrends.length === 7, 'TEST 7: Empty history still yields daily points across range');
  assert(emptyTrends.every(p => p.mealCount === 0 && p.calories === 0), 'TEST 7: All empty trend points have 0 meals & 0 calories');
  const emptyInsights = nutritionAnalyticsService.generateLongitudinalInsights(emptyTrends, 0, 0, 0, nutritionAnalyticsService.calculateDailyTargets(mockProfile));
  assert(emptyInsights.length > 0, 'TEST 7: Helpful non-punitive insights generated for empty history');
  assert(emptyInsights[0].type === 'info' || emptyInsights[0].type === 'tip', 'TEST 7: Empty history insight is encouraging/informative');

  // --- TEST 8: LONGITUDINAL TREND CALCULATION ---
  console.log('\n--- TEST 8: LONGITUDINAL TREND CALCULATION ---');
  const trends = nutritionAnalyticsService.getLongitudinalTrends(sampleMeals, report7.dateRange, mockProfile);
  assert(trends.length === 7, 'TEST 8: Trend points match number of days in range');
  // Check ordering is chronological
  for (let i = 0; i < trends.length - 1; i++) {
    assert(trends[i].date < trends[i + 1].date, `TEST 8: Trend points strictly chronological (${trends[i].date} < ${trends[i + 1].date})`);
  }
  const todayPoint = trends.find(t => t.date === todayStr);
  assert(Boolean(todayPoint), 'TEST 8: Today trend point present in longitudinal series');
  assert(todayPoint!.mealCount === 2, 'TEST 8: Correct meal count on today trend point');
  assert(todayPoint!.proteinG === 36, 'TEST 8: Correct protein total on today trend point (12 + 24 = 36g)');

  // --- TEST 9: SCORE TREND CALCULATION ---
  console.log('\n--- TEST 9: SCORE TREND CALCULATION ---');
  assert(typeof todayPoint!.nutritionScore === 'number' && todayPoint!.nutritionScore >= 0 && todayPoint!.nutritionScore <= 100, 'TEST 9: Daily nutritionScore is bounded between 0 and 100');
  assert(report7.averageNutritionScore >= 0 && report7.averageNutritionScore <= 100, 'TEST 9: Report average score bounded between 0 and 100');

  // --- TEST 10: CONSISTENCY CALCULATION ---
  console.log('\n--- TEST 10: CONSISTENCY CALCULATION ---');
  // In 7 days, 3 active days => (3 / 7) * 100 ≈ 42.9%
  const expectedConsistency = Math.round((3 / 7) * 100);
  assert(report7.consistencyPercentage === expectedConsistency, `TEST 10: Consistency accurately calculated (${report7.consistencyPercentage}% vs expected ${expectedConsistency}%)`);

  // --- TEST 11: INSIGHT GENERATION ---
  console.log('\n--- TEST 11: INSIGHT GENERATION ---');
  const reportInsights = nutritionAnalyticsService.generateLongitudinalInsights(
    report7.trend,
    report7.totalMeals,
    report7.consistencyPercentage,
    report7.averageNutritionScore,
    nutritionAnalyticsService.calculateDailyTargets(mockProfile)
  );
  assert(Array.isArray(reportInsights) && reportInsights.length > 0, 'TEST 11: Longitudinal insights generated');
  // Verify factual, non-medical language
  const combinedText = reportInsights.map(i => `${i.title} ${i.description}`).join(' ').toLowerCase();
  assert(!combinedText.includes('you are unhealthy'), 'TEST 11: No judgmental phrasing ("you are unhealthy")');
  assert(!combinedText.includes('disease') && !combinedText.includes('diagnos'), 'TEST 11: Zero medical diagnosis or disease claims');

  // --- TEST 12: JSON EXPORT ---
  console.log('\n--- TEST 12: JSON EXPORT ---');
  const jsonExportStr = nutritionAnalyticsService.exportReportAsJSON(report7, sampleMeals, mockProfile);
  const parsedJSON = JSON.parse(jsonExportStr);
  assert(parsedJSON.exportVersion === '1.0', 'TEST 12: exportVersion is 1.0');
  assert(Boolean(parsedJSON.generatedAt), 'TEST 12: generatedAt timestamp present');
  assert(Boolean(parsedJSON.dateRange), 'TEST 12: dateRange present in JSON export');
  assert(Boolean(parsedJSON.nutritionSummary), 'TEST 12: nutritionSummary present in JSON export');
  assert(Array.isArray(parsedJSON.meals) && parsedJSON.meals.length > 0, 'TEST 12: meals array present in JSON export');

  // --- TEST 13: CSV EXPORT ---
  console.log('\n--- TEST 13: CSV EXPORT ---');
  const csvExportStr = nutritionAnalyticsService.exportReportAsCSV(report7, sampleMeals);
  assert(typeof csvExportStr === 'string' && csvExportStr.length > 0, 'TEST 13: CSV export produced non-empty string');
  const csvLines = csvExportStr.replace(/^\uFEFF/, '').trim().split('\n');
  assert(csvLines.length >= 5, 'TEST 13: CSV contains header and meal rows');
  assert(csvLines[0].includes('Date') && csvLines[0].includes('Meal') && csvLines[0].includes('Calories'), 'TEST 13: CSV header row formatted correctly');

  // --- TEST 14: UNICODE CSV HANDLING ---
  console.log('\n--- TEST 14: UNICODE CSV HANDLING ---');
  const unicodeMeal = createSampleMeal(
    'm-uni',
    `${todayStr}T20:00:00.000Z`,
    'मसालेदार "Paneer" & Roti, Special',
    500,
    22,
    60,
    15,
    5
  );
  const unicodeCSV = nutritionAnalyticsService.exportReportAsCSV(report7, [unicodeMeal]);
  assert(unicodeCSV.startsWith('\uFEFF'), 'TEST 14: CSV prepends UTF-8 BOM for Excel compatibility');
  assert(unicodeCSV.includes('मसालेदार'), 'TEST 14: Unicode Devanagari characters preserved');
  assert(unicodeCSV.includes('""Paneer""'), 'TEST 14: Embedded quotes properly escaped as double quotes');
  assert(unicodeCSV.includes('"मसालेदार ""Paneer"" & Roti, Special"'), 'TEST 14: Fields with commas properly wrapped in quotes');

  // --- TEST 15: EXPORT SANITIZATION ---
  console.log('\n--- TEST 15: EXPORT SANITIZATION ---');
  // Check parsed JSON user profile
  assert(parsedJSON.userProfile.age === 21, 'TEST 15: Public profile field age preserved');
  assert(parsedJSON.userProfile.gender === 'male', 'TEST 15: Public profile field gender preserved');
  assert(!parsedJSON.userProfile._internalUid, 'TEST 15: No internal UID injected into public profile payload');

  // --- TEST 16: PASSWORD EXCLUSION ---
  console.log('\n--- TEST 16: PASSWORD EXCLUSION ---');
  assert(!jsonExportStr.toLowerCase().includes('password'), 'TEST 16: JSON export strictly excludes "password"');
  assert(!csvExportStr.toLowerCase().includes('password'), 'TEST 16: CSV export strictly excludes "password"');

  // --- TEST 17: AUTH TOKEN EXCLUSION ---
  console.log('\n--- TEST 17: AUTH TOKEN EXCLUSION ---');
  assert(!jsonExportStr.includes('refreshToken'), 'TEST 17: JSON export does not contain refreshToken');
  assert(!jsonExportStr.includes('accessToken'), 'TEST 17: JSON export does not contain accessToken');
  assert(!jsonExportStr.includes('sessionToken'), 'TEST 17: JSON export does not contain sessionToken');

  // --- TEST 18: GEMINI_API_KEY EXCLUSION ---
  console.log('\n--- TEST 18: GEMINI_API_KEY EXCLUSION ---');
  const geminiKey = process.env.GEMINI_API_KEY || 'AIzaFakePlaceholderKey';
  assert(!jsonExportStr.includes(geminiKey), 'TEST 18: JSON export does not expose GEMINI_API_KEY');
  assert(!csvExportStr.includes(geminiKey), 'TEST 18: CSV export does not expose GEMINI_API_KEY');
  assert(!process.env.NEXT_PUBLIC_GEMINI_API_KEY, 'TEST 18: No GEMINI_API_KEY as public env var');

  // --- TEST 19: CROSS-USER ISOLATION ---
  console.log('\n--- TEST 19: CROSS-USER ISOLATION ---');
  const firestoreRules = fs.readFileSync('firestore.rules', 'utf8');
  assert(
    firestoreRules.includes('request.auth != null && request.auth.uid == userId'),
    'TEST 19: Firestore rules strictly enforce request.auth.uid == userId'
  );
  // Ensure service requires authenticated UID for cloud calls
  let caughtUnauthorized = false;
  try {
    // Calling firestoreMealHistoryService without userId or empty string
    await firestoreMealHistoryService.getRecentMeals('', 10);
  } catch (err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      (('code' in err && (err as { code: string }).code === 'unauthenticated') ||
        (err as Error).message?.includes('Authentication') ||
        (err as Error).message?.includes('UID') ||
        (err as Error).message?.includes('userId'))
    ) {
      caughtUnauthorized = true;
    }
  }
  assert(caughtUnauthorized, 'TEST 19: firestoreMealHistoryService rejects unauthenticated/empty userId');

  // --- TEST 20: LOCAL FALLBACK ---
  console.log('\n--- TEST 20: LOCAL FALLBACK ---');
  // Calling getDateRangeReport without userId falls back to localStorage
  const fallbackReport = await nutritionAnalyticsService.getDateRangeReport(undefined, 'last_7_days');
  assert(fallbackReport.totalMeals > 0, 'TEST 20: Unauthenticated report successfully sources data from local storage');

  // --- TEST 21: FIRESTORE FAILURE FALLBACK ---
  console.log('\n--- TEST 21: FIRESTORE FAILURE FALLBACK ---');
  // Pass an invalid userId that triggers cloud failure or error, verify fallback handles it
  let didNotCrash = false;
  try {
    const errorFallback = await nutritionAnalyticsService.getDateRangeReport('non-existent-user-xyz-404', 'last_7_days');
    assert(typeof errorFallback.totalMeals === 'number', 'TEST 21: Report safely returned even when cloud lookup returns empty/fails');
    didNotCrash = true;
  } catch {
    didNotCrash = false;
  }
  assert(didNotCrash, 'TEST 21: Safe fallback without uncaught exceptions on missing/failed cloud user');

  // --- TEST 22: DATE BOUNDARY HANDLING ---
  console.log('\n--- TEST 22: DATE BOUNDARY HANDLING ---');
  const midnightMeal = createSampleMeal('m-midnight', `${todayStr}T00:00:01.000Z`, 'Midnight Snack', 150, 4, 20, 3, 1);
  const boundaryTrends = nutritionAnalyticsService.getLongitudinalTrends([midnightMeal], { startDate: todayStr, endDate: todayStr }, mockProfile);
  assert(boundaryTrends[0].mealCount === 1, 'TEST 22: Midnight boundary (00:00:01) correctly attributed to calendar date');

  // --- TEST 23: FUTURE DATE HANDLING ---
  console.log('\n--- TEST 23: FUTURE DATE HANDLING ---');
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 10);
  const futureDateStr = getLocalISODate(futureDate);
  const futureRange = nutritionAnalyticsService.resolveDateRange('custom', {
    startDate: todayStr,
    endDate: futureDateStr,
  });
  // Future dates should be clamped to today
  assert(futureRange.endDate <= todayStr, 'TEST 23: Future date clamped to today to prevent fabricated statistics');

  // --- TEST 24: DETERMINISTIC REPORT GENERATION ---
  console.log('\n--- TEST 24: DETERMINISTIC REPORT GENERATION ---');
  const rep1 = nutritionAnalyticsService.getLongitudinalTrends(sampleMeals, report7.dateRange, mockProfile);
  const rep2 = nutritionAnalyticsService.getLongitudinalTrends(sampleMeals, report7.dateRange, mockProfile);
  assert(JSON.stringify(rep1) === JSON.stringify(rep2), 'TEST 24: Longitudinal report is 100% deterministic across multiple runs');

  // --- TEST 25: EXISTING ANALYTICS REGRESSION ---
  console.log('\n--- TEST 25: EXISTING ANALYTICS REGRESSION ---');
  const todaySummary = await nutritionAnalyticsService.getTodaySummary(undefined);
  assert(todaySummary.date === todayStr, 'TEST 25: getTodaySummary returns valid date');
  const weeklySummary = await nutritionAnalyticsService.getWeeklySummary(undefined);
  assert(weeklySummary.dailySummaries.length === 7, 'TEST 25: getWeeklySummary returns 7 days');
  const ins = nutritionAnalyticsService.getNutritionInsights(todaySummary, mockProfile);
  assert(Array.isArray(ins), 'TEST 25: getNutritionInsights functional');
  const recs = nutritionAnalyticsService.getNextMealRecommendations(todaySummary, mockProfile);
  assert(Array.isArray(recs), 'TEST 25: getNextMealRecommendations functional');

  // --- TEST 26: PHASE 8.1 REGRESSION ---
  console.log('\n--- TEST 26: PHASE 8.1 REGRESSION ---');
  assert(typeof firestoreMealHistoryService.saveMeal === 'function', 'TEST 26: firestoreMealHistoryService.saveMeal preserved');
  assert(typeof firestoreMealHistoryService.getRecentMeals === 'function', 'TEST 26: firestoreMealHistoryService.getRecentMeals preserved');
  assert(typeof firestoreMealHistoryService.getMeal === 'function', 'TEST 26: firestoreMealHistoryService.getMeal preserved');

  // --- TEST 27: PHASE 8.2 REGRESSION ---
  console.log('\n--- TEST 27: PHASE 8.2 REGRESSION ---');
  const resultsPage = fs.readFileSync('src/app/results/page.tsx', 'utf8');
  assert(resultsPage.includes('mealHistoryService'), 'TEST 27: /results preserves mealHistoryService integration');
  const historyPage = fs.readFileSync('src/app/history/page.tsx', 'utf8');
  assert(historyPage.includes('NutritionAnalyticsDashboard'), 'TEST 27: /history integrates NutritionAnalyticsDashboard');

  // --- TEST 28: PHASE 8.3 REGRESSION ---
  console.log('\n--- TEST 28: PHASE 8.3 REGRESSION ---');
  assert(typeof firestoreMealHistoryService.cleanupSubscriptions === 'function', 'TEST 28: cleanupSubscriptions preserved');
  assert(typeof firestoreMealHistoryService.subscribeToRecentMeals === 'function', 'TEST 28: subscribeToRecentMeals preserved');

  // --- TEST 29: PHASE 8.4 REGRESSION ---
  console.log('\n--- TEST 29: PHASE 8.4 REGRESSION ---');
  assert(typeof nutritionAnalyticsService.calculateDailyTargets === 'function', 'TEST 29: calculateDailyTargets preserved');
  assert(typeof nutritionAnalyticsService.calculateNutritionScore === 'function', 'TEST 29: calculateNutritionScore preserved');
  const scoreResult = nutritionAnalyticsService.calculateNutritionScore(todaySummary, nutritionAnalyticsService.calculateDailyTargets(mockProfile));
  assert(typeof scoreResult.score === 'number' && scoreResult.score >= 0 && scoreResult.score <= 100, 'TEST 29: calculateNutritionScore produces valid score');

  console.log('\n====================================================');
  console.log('🎉 ALL 29 PHASE 8.5 REPORTING & ANALYTICS TESTS PASSED!');
  console.log('====================================================\n');
  process.exit(0);
}

runPhase85Suite().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
