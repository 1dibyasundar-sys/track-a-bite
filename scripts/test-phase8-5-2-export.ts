/**
 * TRACK-A-BITE — PHASE 8.5.2 EXPORT & REPORTING VERIFICATION SUITE
 * Project: track-a-bite
 *
 * Verifies production export and reporting implementation:
 * 1. Export service exists
 * 2. JSON generation
 * 3. JSON structure
 * 4. CSV generation
 * 5. CSV escaping
 * 6. Meal ordering
 * 7. Date range filtering
 * 8. Nutrition aggregation
 * 9. Empty history
 * 10. Local fallback
 * 11. Auth boundary
 * 12. UID boundary
 * 13. Password exclusion
 * 14. Gemini secret exclusion
 * 15. Firebase credential exclusion
 * 16. Timestamp normalization
 * 17. Large dataset handling
 * 18. Deterministic output
 * 19. Printable report generation
 * 20. Regression compatibility
 */

import fs from 'fs';
import type { MealAnalysis } from '../src/lib/types/meal';
import type { UserProfile } from '../src/lib/types/profile';
import type { NutritionExportPayload } from '../src/lib/types/reporting';

// Load .env.local BEFORE initializing services
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
  calories: number,
  protein: number,
  carbs: number,
  fat: number,
  fiber: number,
  title = 'Test Meal',
  items = ['Food Item']
): MealAnalysis {
  return {
    id,
    mealTitle: title,
    analyzedAt,
    items: items.map((name, i) => ({
      detectionId: `det-${id}-${i}`,
      foodId: `food-${id}-${i}`,
      name,
      confidence: 0.95,
      portionMultiplier: 1.0,
      portionUnit: 'serving',
      estimatedGrams: 100,
      nutrition: {
        calories: Math.round(calories / items.length),
        protein: Math.round((protein / items.length) * 10) / 10,
        carbohydrates: Math.round((carbs / items.length) * 10) / 10,
        fat: Math.round((fat / items.length) * 10) / 10,
        fiber: Math.round((fiber / items.length) * 10) / 10,
      },
    })),
    totalNutrition: { calories, protein, carbohydrates: carbs, fat, fiber },
    macroDistribution: { carbsPercent: 50, proteinPercent: 25, fatPercent: 25 },
    nutrientRichness: { stars: 4, label: 'Balanced', explanation: 'Good macros', highlights: ['Protein'] },
    nutrientGaps: { providedNutrients: ['Protein'], missingNutrients: [], whyItMattersSummary: 'Solid' },
    balanceAssessment: { rating: 'balanced', label: 'Balanced', summary: 'Good', detail: 'Good', glycemicImpactEstimate: 'Moderate' },
    positiveHighlights: ['Adequate protein'],
    balancingRecommendations: [],
    hostelFriendlyUpgrades: [],
    hostelModeActive: true,
    practicalAdjustments: [],
    disclaimer: 'Calculated nutritional values are estimates for reference.',
  };
}

async function runSuite() {
  console.log('====================================================');
  console.log('TRACK-A-BITE — PHASE 8.5.2 EXPORT & REPORTING SUITE');
  console.log('Production Export Service & Report Verification');
  console.log('====================================================\n');

  // Dynamic import of services AFTER window/storage mocks
  const { nutritionExportService } = await import('../src/lib/services/nutritionExportService');
  const { nutritionAnalyticsService } = await import('../src/lib/services/nutritionAnalyticsService');
  const { firestoreMealHistoryService } = await import('../src/lib/services/firestoreMealHistoryService');

  const mockProfile: UserProfile = {
    age: 21,
    gender: 'male',
    heightCm: 178,
    weightKg: 70,
    activityLevel: 'moderately_active',
    healthGoal: 'muscle_gain',
    dietaryRestrictions: 'vegetarian',
    allergies: ['peanuts'],
    isHostelite: true,
    hasCookingAccess: false,
    hasFridge: false,
    budgetPreference: 'budget',
    healthConditions: ['None'],
    onboardingCompleted: true,
  };

  // 1. EXPORT SERVICE EXISTS
  console.log('--- TEST 1: EXPORT SERVICE EXISTS & API SURFACE ---');
  assert(Boolean(nutritionExportService), 'TEST 1: Singleton nutritionExportService exists');
  assert(typeof nutritionExportService.exportNutritionJSON === 'function', 'TEST 1: exportNutritionJSON method exists');
  assert(typeof nutritionExportService.exportNutritionCSV === 'function', 'TEST 1: exportNutritionCSV method exists');
  assert(typeof nutritionExportService.buildNutritionExportPayload === 'function', 'TEST 1: buildNutritionExportPayload method exists');
  assert(typeof nutritionExportService.buildPrintableReportData === 'function', 'TEST 1: buildPrintableReportData method exists');
  assert(typeof nutritionExportService.validateExportOwnership === 'function', 'TEST 1: validateExportOwnership method exists');
  assert(typeof nutritionExportService.downloadJSON === 'function', 'TEST 1: downloadJSON method exists');
  assert(typeof nutritionExportService.downloadCSV === 'function', 'TEST 1: downloadCSV method exists');
  assert(typeof nutritionExportService.triggerPrintReport === 'function', 'TEST 1: triggerPrintReport method exists');

  // Seed test dataset in local storage
  const now = new Date();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const fifteenDaysAgo = new Date(now);
  fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

  const d1 = new Date(now);
  d1.setHours(9, 30, 0, 0);
  const meal1 = createTestMeal('m-exp-1', d1.toISOString(), 550, 25, 60, 18, 5, 'Special "Hostel" Paratha', ['Paratha', 'Pickle, Spicy']);

  const d2 = new Date(now);
  d2.setHours(13, 30, 0, 0);
  const meal2 = createTestMeal('m-exp-2', d2.toISOString(), 650, 30, 85, 15, 8, 'Rajma, Rice & Curd', ['Rajma Masala', 'Steamed Rice', 'Curd']);

  const d3 = new Date(yesterday);
  d3.setHours(20, 0, 0, 0);
  const meal3 = createTestMeal('m-exp-3', d3.toISOString(), 500, 22, 65, 12, 6, 'Dal Tadka Dinner', ['Yellow Dal', 'Whole Wheat Roti']);

  const dOld = new Date(fifteenDaysAgo);
  dOld.setHours(12, 0, 0, 0);
  const mealOld = createTestMeal('m-exp-old', dOld.toISOString(), 700, 35, 90, 20, 10, 'Ancient Feast', ['Feast Item']);

  const testMeals = [meal1, meal2, meal3, mealOld];
  mockStorage.setItem('track_a_bite_meal_history', JSON.stringify(testMeals));

  // Generate 7-day report
  const report7Days = await nutritionAnalyticsService.getDateRangeReport(undefined, 'last_7_days', mockProfile);

  // 2. JSON GENERATION
  console.log('\n--- TEST 2: JSON GENERATION ---');
  const jsonOutput = nutritionExportService.exportNutritionJSON(report7Days, mockProfile);
  assert(typeof jsonOutput === 'string' && jsonOutput.length > 50, 'TEST 2: JSON export returns non-empty string');
  let parsedJson: NutritionExportPayload;
  try {
    parsedJson = JSON.parse(jsonOutput) as NutritionExportPayload;
    assert(true, 'TEST 2: JSON parses successfully');
  } catch {
    assert(false, 'TEST 2: JSON failed to parse');
    return;
  }

  // 3. JSON STRUCTURE
  console.log('\n--- TEST 3: JSON STRUCTURE ---');
  assert(parsedJson.application === 'Track-a-Bite', 'TEST 3: application is Track-a-Bite');
  assert(parsedJson.exportVersion === '1.0', 'TEST 3: exportVersion is 1.0');
  assert(typeof parsedJson.generatedAt === 'string', 'TEST 3: generatedAt is timestamp string');
  assert(Boolean(parsedJson.period?.startDate) && Boolean(parsedJson.period?.endDate), 'TEST 3: period has start and end date');
  assert(parsedJson.summary.totalMeals === 3, 'TEST 3: summary.totalMeals is 3 (excludes 15-day-old meal)');
  assert(parsedJson.summary.totalCalories === 1700, 'TEST 3: summary.totalCalories is 1700 (550 + 650 + 500)');
  assert(parsedJson.summary.averageCalories === 850, 'TEST 3: summary.averageCalories is 850 (1700 / 2 active days)');
  assert(parsedJson.user.healthGoal === 'muscle_gain', 'TEST 3: user.healthGoal matches profile');
  assert(Array.isArray(parsedJson.meals) && parsedJson.meals.length === 3, 'TEST 3: meals array contains 3 sanitized items');
  assert(parsedJson.meals[0].id && typeof parsedJson.meals[0].calories === 'number', 'TEST 3: meal item has required fields');

  // 4. CSV GENERATION
  console.log('\n--- TEST 4: CSV GENERATION ---');
  const csvOutput = nutritionExportService.exportNutritionCSV(report7Days);
  assert(csvOutput.startsWith('\uFEFF'), 'TEST 4: CSV begins with UTF-8 BOM for Excel compatibility');
  const csvLines = csvOutput.replace('\uFEFF', '').split('\r\n').filter(l => l.trim().length > 0);
  assert(csvLines.length === 4, 'TEST 4: CSV has 1 header row + 3 data rows (total 4 lines)');
  assert(csvLines[0].includes('Calories (kcal)'), 'TEST 4: Header contains Calories (kcal)');
  assert(csvLines[0].includes('Protein (g)'), 'TEST 4: Header contains Protein (g)');

  // 5. CSV ESCAPING
  console.log('\n--- TEST 5: CSV ESCAPING ---');
  // meal1 had double quotes: 'Special "Hostel" Paratha' -> must be escaped as '""Hostel""'
  assert(csvOutput.includes('""Hostel""'), 'TEST 5: Embedded double quotes escaped as double quotes');
  // meal2 had commas: 'Rajma, Rice & Curd' -> must be wrapped in quotes
  assert(csvOutput.includes('"Rajma, Rice & Curd"'), 'TEST 5: Field containing comma is wrapped in quotes');

  // 6. MEAL ORDERING
  console.log('\n--- TEST 6: DETERMINISTIC MEAL ORDERING ---');
  // Meals must be chronologically ordered newest first: meal2 (13:30 today) > meal1 (9:30 today) > meal3 (yesterday)
  assert(parsedJson.meals[0].id === 'm-exp-2', 'TEST 6: Newest meal (m-exp-2) appears first');
  assert(parsedJson.meals[1].id === 'm-exp-1', 'TEST 6: Middle meal (m-exp-1) appears second');
  assert(parsedJson.meals[2].id === 'm-exp-3', 'TEST 6: Oldest meal (m-exp-3) appears third');

  // 7. DATE RANGE FILTERING
  console.log('\n--- TEST 7: DATE RANGE FILTERING ---');
  assert(!parsedJson.meals.some(m => m.id === 'm-exp-old'), 'TEST 7: 15-day-old meal strictly excluded from 7-day export');
  assert(!csvOutput.includes('Ancient Feast'), 'TEST 7: Out-of-range meal strictly excluded from CSV');

  // 8. NUTRITION AGGREGATION
  console.log('\n--- TEST 8: NUTRITION AGGREGATION ACCURACY ---');
  const expectedTotalCal = 550 + 650 + 500;
  const expectedTotalProt = 25 + 30 + 22;
  assert(parsedJson.summary.totalCalories === expectedTotalCal, `TEST 8: Total calories equals sum (${expectedTotalCal})`);
  assert(parsedJson.summary.totalProteinG === expectedTotalProt, `TEST 8: Total protein equals sum (${expectedTotalProt}g)`);

  // 9. EMPTY HISTORY
  console.log('\n--- TEST 9: EMPTY HISTORY HANDLING ---');
  mockStorage.setItem('track_a_bite_meal_history', JSON.stringify([]));
  const emptyReport = await nutritionAnalyticsService.getDateRangeReport(undefined, 'last_7_days', mockProfile);
  const emptyJson = nutritionExportService.exportNutritionJSON(emptyReport, mockProfile);
  const parsedEmpty = JSON.parse(emptyJson);
  assert(parsedEmpty.summary.totalMeals === 0, 'TEST 9: Empty history totalMeals is 0');
  assert(parsedEmpty.meals.length === 0, 'TEST 9: Empty history meals array is empty');
  const emptyCsv = nutritionExportService.exportNutritionCSV(emptyReport);
  const emptyCsvLines = emptyCsv.replace('\uFEFF', '').split('\r\n').filter(l => l.trim().length > 0);
  assert(emptyCsvLines.length === 1, 'TEST 9: Empty history CSV contains header row only');

  // Restore test dataset
  mockStorage.setItem('track_a_bite_meal_history', JSON.stringify(testMeals));

  // 10. LOCAL FALLBACK
  console.log('\n--- TEST 10: LOCAL FALLBACK ---');
  assert(report7Days.dataSource === 'local', 'TEST 10: Unauthenticated report marks dataSource as local');
  assert(parsedJson.meals.length > 0, 'TEST 10: Local storage records successfully exported');

  // 11. AUTH BOUNDARY
  console.log('\n--- TEST 11: AUTHENTICATION BOUNDARY ---');
  assert(!nutritionExportService.validateExportOwnership(undefined, undefined), 'TEST 11: Rejects unauthenticated empty authUid');
  assert(!nutritionExportService.validateExportOwnership('', ''), 'TEST 11: Rejects whitespace authUid');
  assert(nutritionExportService.validateExportOwnership('uid-active-user', 'uid-active-user'), 'TEST 11: Accepts valid matching authUid');

  // 12. UID BOUNDARY
  console.log('\n--- TEST 12: UID BOUNDARY & CROSS-USER ISOLATION ---');
  assert(!nutritionExportService.validateExportOwnership('target-victim-uid', 'attacker-auth-uid'), 'TEST 12: Rejects cross-user export request');

  // 13. PASSWORD EXCLUSION
  console.log('\n--- TEST 13: PASSWORD EXCLUSION ---');
  assert(!jsonOutput.toLowerCase().includes('password'), 'TEST 13: Zero passwords in exported JSON');
  assert(!csvOutput.toLowerCase().includes('password'), 'TEST 13: Zero passwords in exported CSV');

  // 14. GEMINI SECRET EXCLUSION
  console.log('\n--- TEST 14: GEMINI SECRET EXCLUSION ---');
  assert(!jsonOutput.includes('AIza'), 'TEST 14: Zero Gemini API key tokens in exported JSON');
  assert(!csvOutput.includes('AIza'), 'TEST 14: Zero Gemini API key tokens in exported CSV');
  assert(!process.env.NEXT_PUBLIC_GEMINI_API_KEY, 'TEST 14: GEMINI_API_KEY is not public');

  // 15. FIREBASE CREDENTIAL EXCLUSION
  console.log('\n--- TEST 15: FIREBASE CREDENTIAL EXCLUSION ---');
  assert(!jsonOutput.includes('refreshToken'), 'TEST 15: Zero refreshToken in JSON');
  assert(!jsonOutput.includes('accessToken'), 'TEST 15: Zero accessToken in JSON');
  assert(!jsonOutput.includes('private_key'), 'TEST 15: Zero private_key in JSON');

  // 16. TIMESTAMP NORMALIZATION
  console.log('\n--- TEST 16: TIMESTAMP NORMALIZATION ---');
  for (const m of parsedJson.meals) {
    assert(typeof m.analyzedAt === 'string', 'TEST 16: analyzedAt is string');
    assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(m.analyzedAt), 'TEST 16: Timestamp matches ISO 8601 pattern');
    assert(!m.analyzedAt.includes('seconds'), 'TEST 16: No raw Firestore Timestamp seconds object');
  }

  // 17. LARGE DATASET HANDLING
  console.log('\n--- TEST 17: LARGE DATASET HANDLING ---');
  const largeMeals: MealAnalysis[] = [];
  for (let i = 0; i < 500; i++) {
    const d = new Date(now);
    d.setMinutes(d.getMinutes() - i * 10);
    largeMeals.push(createTestMeal(`m-large-${i}`, d.toISOString(), 250, 15, 30, 8, 3, `Bulk Meal #${i}`));
  }
  const largeReport = {
    ...report7Days,
    totalMeals: largeMeals.length,
    meals: largeMeals,
  };
  const t0 = Date.now();
  const largeJson = nutritionExportService.exportNutritionJSON(largeReport, mockProfile);
  const largeCsv = nutritionExportService.exportNutritionCSV(largeReport);
  const elapsed = Date.now() - t0;
  assert(largeJson.length > 50000, 'TEST 17: Large JSON export generated');
  assert(largeCsv.length > 20000, 'TEST 17: Large CSV export generated');
  assert(elapsed < 1000, `TEST 17: 500 meals exported in ${elapsed}ms (< 1000ms target)`);

  // 18. DETERMINISTIC OUTPUT
  console.log('\n--- TEST 18: DETERMINISTIC OUTPUT ---');
  const out1 = nutritionExportService.exportNutritionCSV(report7Days);
  const out2 = nutritionExportService.exportNutritionCSV(report7Days);
  assert(out1 === out2, 'TEST 18: CSV generation is 100% deterministic');

  // 19. PRINTABLE REPORT GENERATION
  console.log('\n--- TEST 19: PRINTABLE REPORT MODEL GENERATION ---');
  const printData = nutritionExportService.buildPrintableReportData(report7Days, mockProfile);
  assert(printData.title === 'Track-a-Bite Nutrition Report', 'TEST 19: Title matches Track-a-Bite Nutrition Report');
  assert(printData.summary.totalMeals === 3, 'TEST 19: Printable report summary totalMeals matches');
  assert(Array.isArray(printData.recommendations) && printData.recommendations.length > 0, 'TEST 19: Printable report includes next-meal suggestions');
  assert(printData.period.startDate === report7Days.dateRange.startDate, 'TEST 19: Period startDate matches');

  // 20. REGRESSION COMPATIBILITY
  console.log('\n--- TEST 20: REGRESSION COMPATIBILITY ---');
  const dailyTargets = nutritionAnalyticsService.calculateDailyTargets(mockProfile);
  assert(dailyTargets.targetCalories > 0, 'TEST 20: calculateDailyTargets intact');
  assert(typeof firestoreMealHistoryService.saveMeal === 'function', 'TEST 20: firestoreMealHistoryService.saveMeal intact');
  assert(typeof firestoreMealHistoryService.cleanupSubscriptions === 'function', 'TEST 20: cleanupSubscriptions intact');

  console.log('\n====================================================');
  console.log('🎉 ALL 20 PHASE 8.5.2 EXPORT TESTS PASSED!');
  console.log('====================================================\n');
  process.exit(0);
}

runSuite().catch(err => {
  console.error('\n❌ TEST SUITE FAILURE:', err);
  process.exit(1);
});
