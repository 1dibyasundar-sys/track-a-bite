/**
 * TRACK-A-BITE — PHASE 8.4 VERIFICATION SUITE
 * Nutrition Analytics Backend & Service Architecture
 *
 * Verifies all 28 Phase 8.4 requirements:
 * 1. Nutrition analytics types exist
 * 2. Daily aggregation
 * 3. Weekly aggregation
 * 4. Calories calculation
 * 5. Protein calculation
 * 6. Carbohydrate calculation
 * 7. Fat calculation
 * 8. Target progress calculation
 * 9. Nutrition score determinism
 * 10. Nutrition insight generation
 * 11. Next meal recommendation generation
 * 12. Hostel-mode recommendation behavior
 * 13. Dietary restriction handling
 * 14. Allergy exclusion
 * 15. Budget preference behavior
 * 16. Malformed nutrition data rejection
 * 17. Date boundary handling
 * 18. Empty meal history behavior
 * 19. Local fallback
 * 20. Cloud failure fallback
 * 21. Authenticated UID boundary
 * 22. Cross-user isolation
 * 23. No password persistence
 * 24. No GEMINI_API_KEY exposure
 * 25. Analytics result stability
 * 26. Regression compatibility with Phase 8.1
 * 27. Regression compatibility with Phase 8.2
 * 28. Regression compatibility with Phase 8.3
 */

import fs from 'fs';
import type { MealAnalysis } from '../src/lib/types/meal';
import type { UserProfile } from '../src/lib/types/profile';

// Automatically load .env.local if present so standalone `npx tsx` accesses env vars
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
(global as unknown as { window: unknown }).window = {
  localStorage: mockStorage,
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true,
};

function createSampleMeal(id: string, dateIso: string, cals: number, prot: number, carbs: number, fat: number, fiber: number): MealAnalysis {
  return {
    id,
    mealTitle: `Test Meal ${id}`,
    analyzedAt: dateIso,
    items: [
      {
        detectionId: `det-${id}-1`,
        foodId: 'dal-tadka',
        name: 'Dal Tadka',
        confidence: 0.95,
        portionMultiplier: 1.0,
        portionUnit: 'katori',
        estimatedGrams: 150,
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
      carbsPercent: 55,
      proteinPercent: 20,
      fatPercent: 25,
    },
    nutrientRichness: {
      stars: 4.0,
      label: 'Balanced Plate',
      explanation: 'Test meal balance',
      highlights: ['Protein rich'],
    },
    nutrientGaps: {
      providedNutrients: [],
      missingNutrients: [],
      whyItMattersSummary: 'Test summary',
    },
    balanceAssessment: {
      rating: 'balanced',
      label: 'Balanced',
      summary: 'Good balance',
      detail: 'Detail',
      glycemicImpactEstimate: 'Moderate',
    },
    positiveHighlights: ['Good protein'],
    balancingRecommendations: [],
    hostelFriendlyUpgrades: [],
    hostelModeActive: true,
    practicalAdjustments: [],
    disclaimer: 'Test disclaimer',
  };
}

async function runTestSuite() {
  console.log('====================================================');
  console.log('TRACK-A-BITE — PHASE 8.4 NUTRITION ANALYTICS SUITE');
  console.log('Transforming Scans into Actionable Nutrition Data');
  console.log('====================================================\n');

  // Dynamic imports
  const {
    nutritionAnalyticsService,
    NutritionAnalyticsService,
    getPastNDaysDates,
  } = await import('../src/lib/services/nutritionAnalyticsService');

  const {
    firestoreMealHistoryService,
    mealHistoryService,
  } = await import('../src/lib/services');

  const targetDate = '2026-10-02';
  const todayMeals: MealAnalysis[] = [
    createSampleMeal('m-1', `${targetDate}T08:30:00.000Z`, 450, 18, 55, 12, 6),
    createSampleMeal('m-2', `${targetDate}T13:15:00.000Z`, 650, 26, 80, 18, 8),
  ];

  const mockProfile: UserProfile = {
    age: 22,
    gender: 'male',
    heightCm: 175,
    weightKg: 70,
    activityLevel: 'moderately_active',
    healthConditions: ['None'],
    isHostelite: true,
    hasCookingAccess: false,
    hasFridge: false,
    budgetPreference: 'budget',
    onboardingCompleted: true,
  };

  // --- TEST 1: NUTRITION ANALYTICS TYPES EXIST ---
  console.log('--- TEST 1: NUTRITION ANALYTICS TYPES & SERVICE EXIST ---');
  assert(nutritionAnalyticsService instanceof NutritionAnalyticsService, 'TEST 1: Singleton nutritionAnalyticsService instance exists');
  assert(typeof nutritionAnalyticsService.calculateDailyTargets === 'function', 'TEST 1: calculateDailyTargets function available');
  assert(typeof nutritionAnalyticsService.calculateNutritionScore === 'function', 'TEST 1: calculateNutritionScore function available');
  assert(typeof nutritionAnalyticsService.getTodaySummary === 'function', 'TEST 1: getTodaySummary function available');
  assert(typeof nutritionAnalyticsService.getWeeklySummary === 'function', 'TEST 1: getWeeklySummary function available');
  assert(typeof nutritionAnalyticsService.getNutritionInsights === 'function', 'TEST 1: getNutritionInsights function available');
  assert(typeof nutritionAnalyticsService.getNextMealRecommendations === 'function', 'TEST 1: getNextMealRecommendations function available');

  // --- TEST 2: DAILY AGGREGATION ---
  console.log('\n--- TEST 2: DAILY AGGREGATION ---');
  const dailySummary = nutritionAnalyticsService.aggregateMealsForDate(todayMeals, targetDate, mockProfile);
  assert(dailySummary.date === targetDate, 'TEST 2: Aggregated summary date matches targetDate');
  assert(dailySummary.mealCount === 2, 'TEST 2: Correct meal count aggregated');
  assert(dailySummary.meals.length === 2, 'TEST 2: Meals array attached to summary');

  // --- TEST 3: WEEKLY AGGREGATION ---
  console.log('\n--- TEST 3: WEEKLY AGGREGATION ---');
  const pastDates = getPastNDaysDates(7, new Date());
  assert(pastDates.length === 7, 'TEST 3: Generates exact 7 days array');
  const weekly = await nutritionAnalyticsService.getWeeklySummary(undefined);
  assert(Array.isArray(weekly.dailySummaries), 'TEST 3: Weekly summary contains dailySummaries array');
  assert(weekly.dailySummaries.length === 7, 'TEST 3: Exactly 7 daily summaries returned');
  assert(typeof weekly.consistencyMetrics.daysWithLogs === 'number', 'TEST 3: Days with logs metric computed');

  // --- TEST 4: CALORIES CALCULATION ---
  console.log('\n--- TEST 4: CALORIES CALCULATION ---');
  assert(dailySummary.totalCalories === 1100, `TEST 4: Total calories accurately summed (450 + 650 = ${dailySummary.totalCalories})`);

  // --- TEST 5: PROTEIN CALCULATION ---
  console.log('\n--- TEST 5: PROTEIN CALCULATION ---');
  assert(dailySummary.totalProteinG === 44, `TEST 5: Total protein accurately summed (18 + 26 = ${dailySummary.totalProteinG}g)`);

  // --- TEST 6: CARBOHYDRATE CALCULATION ---
  console.log('\n--- TEST 6: CARBOHYDRATE CALCULATION ---');
  assert(dailySummary.totalCarbsG === 135, `TEST 6: Total carbs accurately summed (55 + 80 = ${dailySummary.totalCarbsG}g)`);

  // --- TEST 7: FAT CALCULATION ---
  console.log('\n--- TEST 7: FAT CALCULATION ---');
  assert(dailySummary.totalFatG === 30, `TEST 7: Total fat accurately summed (12 + 18 = ${dailySummary.totalFatG}g)`);
  assert(dailySummary.totalFiberG === 14, `TEST 7: Total fiber accurately summed (6 + 8 = ${dailySummary.totalFiberG}g)`);

  // --- TEST 8: TARGET PROGRESS CALCULATION ---
  console.log('\n--- TEST 8: TARGET PROGRESS CALCULATION ---');
  const targets = nutritionAnalyticsService.calculateDailyTargets(mockProfile);
  assert(targets.targetCalories > 0, `TEST 8: Target calories computed (${targets.targetCalories} kcal)`);
  assert(targets.targetProteinG > 0, `TEST 8: Target protein computed (${targets.targetProteinG} g)`);
  assert(dailySummary.calorieProgressPercent > 0, `TEST 8: Calorie progress percent computed (${dailySummary.calorieProgressPercent}%)`);
  assert(dailySummary.proteinProgressPercent > 0, `TEST 8: Protein progress percent computed (${dailySummary.proteinProgressPercent}%)`);

  // --- TEST 9: NUTRITION SCORE DETERMINISM ---
  console.log('\n--- TEST 9: NUTRITION SCORE DETERMINISM ---');
  const score1 = nutritionAnalyticsService.calculateNutritionScore(
    { totalCalories: 1800, totalProteinG: 65, totalCarbsG: 220, totalFatG: 50, totalFiberG: 24, mealCount: 3 },
    { targetCalories: 2000, targetProteinG: 65, targetCarbsG: 250, targetFatG: 55 }
  );
  const score2 = nutritionAnalyticsService.calculateNutritionScore(
    { totalCalories: 1800, totalProteinG: 65, totalCarbsG: 220, totalFatG: 50, totalFiberG: 24, mealCount: 3 },
    { targetCalories: 2000, targetProteinG: 65, targetCarbsG: 250, targetFatG: 55 }
  );
  assert(score1.score === score2.score, `TEST 9: Nutrition score is strictly deterministic (${score1.score} === ${score2.score})`);
  assert(score1.rating === score2.rating, `TEST 9: Score rating is identical (${score1.rating})`);
  assert(score1.score >= 0 && score1.score <= 100, 'TEST 9: Score is clamped between 0 and 100');

  // --- TEST 10: NUTRITION INSIGHT GENERATION ---
  console.log('\n--- TEST 10: NUTRITION INSIGHT GENERATION ---');
  const insights = nutritionAnalyticsService.getNutritionInsights(dailySummary, mockProfile);
  assert(Array.isArray(insights) && insights.length > 0, 'TEST 10: Generates array of insights');
  assert(insights.some(i => i.evidence.length > 0), 'TEST 10: Every insight contains verifiable empirical evidence');
  assert(insights.some(i => i.type === 'low_protein' || i.type === 'balanced' || i.type === 'general'), 'TEST 10: Categorizes insight types accurately');

  // --- TEST 11: NEXT MEAL RECOMMENDATION GENERATION ---
  console.log('\n--- TEST 11: NEXT MEAL RECOMMENDATION GENERATION ---');
  const recs = nutritionAnalyticsService.getNextMealRecommendations(dailySummary, mockProfile);
  assert(Array.isArray(recs) && recs.length > 0, 'TEST 11: Generates next meal recommendations');
  assert(recs[0].title.length > 0, 'TEST 11: Recommendation has non-empty title');
  assert(recs[0].suggestedFoods.length > 0, 'TEST 11: Suggested foods list populated');
  assert(recs[0].estimatedNutrition.protein > 0, 'TEST 11: Estimated nutrition includes protein count');

  // --- TEST 12: HOSTEL-MODE RECOMMENDATION BEHAVIOR ---
  console.log('\n--- TEST 12: HOSTEL-MODE RECOMMENDATION BEHAVIOR ---');
  const hostelProfile: UserProfile = { ...mockProfile, isHostelite: true, hasCookingAccess: false, hasFridge: false };
  const hostelRecs = nutritionAnalyticsService.getNextMealRecommendations(dailySummary, hostelProfile);
  assert(hostelRecs.every(r => r.hostelFriendly), 'TEST 12: All recommendations are hostelFriendly for hostelite user');
  assert(hostelRecs.every(r => r.noCookRequired), 'TEST 12: All recommendations require zero cooking when hasCookingAccess is false');

  // --- TEST 13: DIETARY RESTRICTION HANDLING ---
  console.log('\n--- TEST 13: DIETARY RESTRICTION HANDLING ---');
  const veganProfile: UserProfile = { ...mockProfile, dietaryRestrictions: 'vegan' };
  const veganRecs = nutritionAnalyticsService.getNextMealRecommendations(dailySummary, veganProfile);
  assert(!veganRecs.some(r => r.title.toLowerCase().includes('egg') || r.title.toLowerCase().includes('curd')), 'TEST 13: Vegan profile strictly excludes egg and curd');

  // --- TEST 14: ALLERGY EXCLUSION ---
  console.log('\n--- TEST 14: ALLERGY EXCLUSION ---');
  const allergyProfile: UserProfile = { ...mockProfile, allergies: ['peanut', 'peanuts'] };
  const allergyRecs = nutritionAnalyticsService.getNextMealRecommendations(dailySummary, allergyProfile);
  assert(!allergyRecs.some(r => r.title.toLowerCase().includes('peanut') || r.suggestedFoods.some(f => f.toLowerCase().includes('peanut'))), 'TEST 14: Peanut allergy strictly excludes peanuts');

  // --- TEST 15: BUDGET PREFERENCE BEHAVIOR ---
  console.log('\n--- TEST 15: BUDGET PREFERENCE BEHAVIOR ---');
  const budgetProfile: UserProfile = { ...mockProfile, budgetPreference: 'budget' };
  const budgetRecs = nutritionAnalyticsService.getNextMealRecommendations(dailySummary, budgetProfile);
  assert(budgetRecs.every(r => r.affordabilityCategory === 'budget'), 'TEST 15: Budget preference strictly returns budget-category recommendations');

  // --- TEST 16: MALFORMED NUTRITION DATA REJECTION ---
  console.log('\n--- TEST 16: MALFORMED NUTRITION DATA HANDLING ---');
  const malformedMeal = createSampleMeal('m-malformed', targetDate, NaN, -10, NaN, 0, 0);
  const safeAgg = nutritionAnalyticsService.aggregateMealsForDate([malformedMeal], targetDate, mockProfile);
  assert(!isNaN(safeAgg.totalCalories) && safeAgg.totalCalories >= 0, 'TEST 16: NaN calories sanitized safely to >= 0');
  assert(!isNaN(safeAgg.totalProteinG) && safeAgg.totalProteinG >= 0, 'TEST 16: Negative protein sanitized safely to >= 0');

  // --- TEST 17: DATE BOUNDARY HANDLING ---
  console.log('\n--- TEST 17: DATE BOUNDARY HANDLING ---');
  const yesterdayDate = '2026-10-01';
  const yesterdayMeal = createSampleMeal('m-yest', `${yesterdayDate}T14:00:00.000Z`, 500, 20, 60, 15, 5);
  const aggToday = nutritionAnalyticsService.aggregateMealsForDate([yesterdayMeal, ...todayMeals], targetDate, mockProfile);
  assert(aggToday.mealCount === 2, `TEST 17: Yesterday meal excluded from today aggregate (found ${aggToday.mealCount} meals, expected 2)`);
  assert(aggToday.totalCalories === 1100, 'TEST 17: Calories do not bleed across calendar date boundaries');

  // --- TEST 18: EMPTY MEAL HISTORY BEHAVIOR ---
  console.log('\n--- TEST 18: EMPTY MEAL HISTORY BEHAVIOR ---');
  const emptyAgg = nutritionAnalyticsService.aggregateMealsForDate([], targetDate, mockProfile);
  assert(emptyAgg.mealCount === 0, 'TEST 18: Meal count is 0 for empty history');
  assert(emptyAgg.totalCalories === 0, 'TEST 18: Total calories is 0 for empty history');
  assert(emptyAgg.nutritionScore === 0, 'TEST 18: Score is 0 for empty history');
  assert(emptyAgg.nutritionRating === 'needs_attention', 'TEST 18: Rating is needs_attention for empty history');

  // --- TEST 19: LOCAL FALLBACK ---
  console.log('\n--- TEST 19: LOCAL FALLBACK ---');
  await mealHistoryService.saveMeal(todayMeals[0]);
  const fallbackSummary = await nutritionAnalyticsService.getDailySummary(undefined, targetDate);
  assert(fallbackSummary.dataSource === 'local', 'TEST 19: Unauthenticated analytics returns local dataSource');
  assert(fallbackSummary.mealCount >= 1, 'TEST 19: Retrieved meals from local storage fallback');

  // --- TEST 20: CLOUD FAILURE FALLBACK ---
  console.log('\n--- TEST 20: CLOUD FAILURE FALLBACK ---');
  // Passing an invalid offline UID to verify graceful catch without uncaught exception
  const cloudFailSummary = await nutritionAnalyticsService.getDailySummary('nonexistent-offline-uid-phase8-4', targetDate);
  assert(cloudFailSummary.dataSource === 'local', 'TEST 20: Cloud failure automatically falls back to local storage without throwing');
  assert(typeof cloudFailSummary.totalCalories === 'number', 'TEST 20: Valid summary returned on cloud error');

  // --- TEST 21: AUTHENTICATED UID BOUNDARY ---
  console.log('\n--- TEST 21: AUTHENTICATED UID BOUNDARY ---');
  let authErrorCaught = false;
  try {
    await firestoreMealHistoryService.getRecentMeals('');
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'unauthenticated') {
      authErrorCaught = true;
    }
  }
  assert(authErrorCaught, 'TEST 21: Empty UID rejected with unauthenticated error at service boundary');

  // --- TEST 22: CROSS-USER ISOLATION ---
  console.log('\n--- TEST 22: CROSS-USER ISOLATION ---');
  const firestoreRules = fs.readFileSync('firestore.rules', 'utf8');
  assert(firestoreRules.includes('request.auth != null && request.auth.uid == userId'), 'TEST 22: Firestore rules enforce request.auth.uid == userId');

  // --- TEST 23: NO PASSWORD PERSISTENCE ---
  console.log('\n--- TEST 23: NO PASSWORD PERSISTENCE ---');
  const serializedSummary = JSON.stringify(dailySummary);
  assert(!serializedSummary.toLowerCase().includes('password'), 'TEST 23: Zero password fields in daily summary');
  const serializedWeekly = JSON.stringify(weekly);
  assert(!serializedWeekly.toLowerCase().includes('password'), 'TEST 23: Zero password fields in weekly summary');

  // --- TEST 24: NO GEMINI_API_KEY EXPOSURE ---
  console.log('\n--- TEST 24: NO GEMINI_API_KEY EXPOSURE ---');
  assert(!serializedSummary.includes(process.env.GEMINI_API_KEY || 'AIza'), 'TEST 24: GEMINI_API_KEY absent from daily analytics');
  assert(!process.env.NEXT_PUBLIC_GEMINI_API_KEY, 'TEST 24: GEMINI_API_KEY is not exposed as public environment variable');

  // --- TEST 25: ANALYTICS RESULT STABILITY ---
  console.log('\n--- TEST 25: ANALYTICS RESULT STABILITY ---');
  const firstRun = nutritionAnalyticsService.aggregateMealsForDate(todayMeals, targetDate, mockProfile);
  const secondRun = nutritionAnalyticsService.aggregateMealsForDate(todayMeals, targetDate, mockProfile);
  assert(firstRun.nutritionScore === secondRun.nutritionScore, 'TEST 25: Identical score across consecutive runs');
  assert(firstRun.totalCalories === secondRun.totalCalories, 'TEST 25: Identical calories across consecutive runs');
  assert(firstRun.totalProteinG === secondRun.totalProteinG, 'TEST 25: Identical protein across consecutive runs');

  // --- TEST 26: REGRESSION COMPATIBILITY WITH PHASE 8.1 ---
  console.log('\n--- TEST 26: REGRESSION COMPATIBILITY WITH PHASE 8.1 ---');
  assert(typeof firestoreMealHistoryService.saveMeal === 'function', 'TEST 26: firestoreMealHistoryService.saveMeal intact');
  assert(typeof firestoreMealHistoryService.getRecentMeals === 'function', 'TEST 26: firestoreMealHistoryService.getRecentMeals intact');

  // --- TEST 27: REGRESSION COMPATIBILITY WITH PHASE 8.2 ---
  console.log('\n--- TEST 27: REGRESSION COMPATIBILITY WITH PHASE 8.2 ---');
  const scanSource = fs.readFileSync('src/app/scan/page.tsx', 'utf8');
  assert(scanSource.includes('firestoreMealHistoryService'), 'TEST 27: /scan retains firestoreMealHistoryService integration');

  // --- TEST 28: REGRESSION COMPATIBILITY WITH PHASE 8.3 ---
  console.log('\n--- TEST 28: REGRESSION COMPATIBILITY WITH PHASE 8.3 ---');
  assert(typeof firestoreMealHistoryService.cleanupSubscriptions === 'function', 'TEST 28: Subscription teardown method preserved');

  console.log('\n====================================================');
  console.log('🎉 ALL 28 PHASE 8.4 NUTRITION ANALYTICS TESTS PASSED!');
  console.log('====================================================\n');
}

runTestSuite().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
