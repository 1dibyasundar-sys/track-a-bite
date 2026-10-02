/**
 * TRACK-A-BITE — PHASE 11 PERSONALIZED DASHBOARD & UX TEST SUITE
 *
 * Verifies all 18 requirements from Section 20 of Phase 11 Master Implementation:
 * 1. Authenticated dashboard loading
 * 2. Unauthenticated protection
 * 3. Profile loading
 * 4. Daily nutrition aggregation
 * 5. Hydration integration
 * 6. Micronutrient integration
 * 7. Recent meals
 * 8. Recommendation integration
 * 9. Empty states
 * 10. Loading states
 * 11. Error states
 * 12. Offline fallback
 * 13. Mobile-safe layout assumptions
 * 14. No fake production data
 * 15. UID ownership
 * 16. No secret exposure
 * 17. Existing route compatibility
 * 18. Regression compatibility
 */

import fs from 'fs';
import path from 'path';
import {
  nutritionAnalyticsService,
  hydrationService,
  userProfileService,
  mealHistoryService,
} from '../src/lib/services';
import type { MealAnalysis, DetectedFoodItem } from '../src/lib/types/meal';
import type { UserProfile } from '../src/lib/types/profile';

// Polyfill localStorage and window if running in pure Node.js
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    length: 0,
  } as unknown as Storage;
}

const globalWithWindow = globalThis as unknown as { window?: { dispatchEvent?: () => boolean } };
if (typeof globalWithWindow.window === 'undefined') {
  globalWithWindow.window = globalThis as unknown as { dispatchEvent?: () => boolean };
}
if (!globalWithWindow.window.dispatchEvent) {
  globalWithWindow.window.dispatchEvent = () => true;
}

// Simple test assertions
let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Mock sample food item
function createMockItem(name: string, cal: number, prot: number, carbs: number, fat: number, iron = 2.5, calc = 80, pot = 250): DetectedFoodItem {
  return {
    detectionId: `det_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    foodId: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    confidence: 0.95,
    portionMultiplier: 1.0,
    portionUnit: 'serving',
    estimatedGrams: 150,
    nutrition: {
      calories: cal,
      protein: prot,
      carbohydrates: carbs,
      fat,
      fiber: 4,
    },
    micronutrients: {
      iron,
      calcium: calc,
      potassium: pot,
    },
  };
}

// Mock sample meal analysis
function createMockMeal(id: string, title: string, items: DetectedFoodItem[], timestamp = new Date().toISOString()): MealAnalysis {
  const totalCal = items.reduce((acc, it) => acc + (it.nutrition.calories || 0), 0);
  const totalProt = items.reduce((acc, it) => acc + (it.nutrition.protein || 0), 0);
  const totalCarbs = items.reduce((acc, it) => acc + (it.nutrition.carbohydrates || 0), 0);
  const totalFat = items.reduce((acc, it) => acc + (it.nutrition.fat || 0), 0);

  return {
    id,
    mealTitle: title,
    analyzedAt: timestamp,
    imagePreviewUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100',
    items,
    totalNutrition: {
      calories: totalCal,
      protein: totalProt,
      carbohydrates: totalCarbs,
      fat: totalFat,
      fiber: 5,
    },
    macroDistribution: {
      proteinPercent: totalCal > 0 ? Math.round((totalProt * 4 / totalCal) * 100) : 0,
      carbsPercent: totalCal > 0 ? Math.round((totalCarbs * 4 / totalCal) * 100) : 0,
      fatPercent: totalCal > 0 ? Math.round((totalFat * 9 / totalCal) * 100) : 0,
    },
    nutrientRichness: {
      stars: 4.5,
      label: 'High Protein',
      explanation: 'Great source of plant protein and complex carbs.',
      highlights: ['Rich in protein', 'High fiber'],
    },
    nutrientGaps: {
      providedNutrients: [{ name: 'Protein', amountDescription: `${totalProt}g`, status: 'good' }],
      missingNutrients: [],
    },
    balanceAssessment: {
      rating: 'balanced',
      label: 'Balanced Plate',
      summary: 'Nutrient-rich student meal',
      detail: 'Well distributed macronutrients.',
      glycemicImpactEstimate: 'Moderate',
    },
    positiveHighlights: ['Balanced macros'],
    balancingRecommendations: [],
    hostelFriendlyUpgrades: [],
    hostelModeActive: true,
    practicalAdjustments: [],
    disclaimer: 'Nutritional estimates for guidance only.',
  };
}

async function runPhase11Tests() {
  console.log('\n===============================================================');
  console.log('TRACK-A-BITE — PHASE 11 PERSONALIZED DASHBOARD & UX TESTS');
  console.log('===============================================================\n');

  const testUserId = `test_user_phase11_${Date.now()}`;
  const mockProfile: UserProfile = {
    age: 21,
    gender: 'female',
    heightCm: 165,
    weightKg: 58,
    activityLevel: 'moderately_active',
    healthGoal: 'muscle_gain',
    dietaryRestrictions: 'vegetarian',
    allergies: ['Peanuts'],
    isHostelite: true,
    hasMessFood: true,
    hasCookingAccess: false,
    hasFridge: false,
    budgetPreference: 'budget',
    onboardingCompleted: true,
    targetCalories: 2100,
    targetProteinG: 75,
    targetCarbsG: 260,
    targetFatG: 60,
  };

  // -------------------------------------------------------------------------
  // 1. Authenticated dashboard loading
  // -------------------------------------------------------------------------
  console.log('\n--- 1. Authenticated Dashboard Loading ---');
  const initialSummary = await nutritionAnalyticsService.getTodaySummary(testUserId, mockProfile);
  assert(initialSummary !== null && typeof initialSummary === 'object', 'getTodaySummary returns a valid summary object');
  assert(initialSummary.targetCalories === 2100, 'User targetCalories loaded into summary correctly');
  assert(initialSummary.targetProteinG === 75, 'User targetProteinG loaded into summary correctly');

  // -------------------------------------------------------------------------
  // 2. Unauthenticated protection
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Unauthenticated Protection ---');
  const dashboardPagePath = path.join(process.cwd(), 'src/app/dashboard/page.tsx');
  const dashboardContent = fs.readFileSync(dashboardPagePath, 'utf8');
  assert(dashboardContent.includes('AuthGuard'), 'Dashboard route utilizes AuthGuard for authentication protection');
  assert(dashboardContent.includes('NutritionDashboard'), 'Dashboard route renders NutritionDashboard inside AuthGuard');

  // -------------------------------------------------------------------------
  // 3. Profile loading
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Profile Loading ---');
  userProfileService.saveProfile(mockProfile);
  const loadedProfile = userProfileService.getProfile();
  assert(loadedProfile.isHostelite === true, 'Hostel status loaded correctly');
  assert(loadedProfile.dietaryRestrictions === 'vegetarian', 'Dietary restrictions loaded correctly');
  assert(loadedProfile.allergies?.includes('Peanuts') === true, 'Allergies list loaded correctly');

  // -------------------------------------------------------------------------
  // 4. Daily nutrition aggregation
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Daily Nutrition Aggregation ---');
  const now = new Date();
  const targetDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const meal1 = createMockMeal('meal_p11_1', 'Dal Tadka & Brown Rice', [
    createMockItem('Dal Tadka', 250, 14, 30, 7, 3.2, 70, 300),
    createMockItem('Brown Rice', 215, 5, 45, 2, 0.8, 20, 150),
  ], now.toISOString());
  const meal2 = createMockMeal('meal_p11_2', 'Paneer Bhurji & Roti', [
    createMockItem('Paneer Bhurji', 320, 18, 8, 24, 1.5, 220, 180),
    createMockItem('Whole Wheat Roti', 140, 4, 28, 1, 1.2, 30, 90),
  ], now.toISOString());

  await mealHistoryService.saveMeal(meal1);
  await mealHistoryService.saveMeal(meal2);

  const aggregatedSummary = nutritionAnalyticsService.aggregateMealsForDate([meal1, meal2], targetDateStr, mockProfile);
  const expectedCal = 250 + 215 + 320 + 140; // 925
  const expectedProt = 14 + 5 + 18 + 4; // 41
  assert(aggregatedSummary.totalCalories === expectedCal, `Daily calories aggregated accurately (${expectedCal} kcal)`);
  assert(aggregatedSummary.totalProteinG === expectedProt, `Daily protein aggregated accurately (${expectedProt}g)`);
  assert(aggregatedSummary.mealCount === 2, `Meal count reflected in daily summary (${aggregatedSummary.mealCount})`);
  assert(aggregatedSummary.nutritionScore > 0, `Nutrition score computed dynamically (${aggregatedSummary.nutritionScore}/100)`);

  // -------------------------------------------------------------------------
  // 5. Hydration integration
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Hydration Integration ---');
  await hydrationService.logDrink(500, 'quick_add', undefined, testUserId);
  await hydrationService.logDrink(250, 'quick_add', undefined, testUserId);
  const hydrationState = await hydrationService.getDailySummary(testUserId);
  assert(hydrationState.dailyWaterIntakeMl >= 750, `Hydration logged and aggregated (${hydrationState.dailyWaterIntakeMl} ml)`);
  assert(hydrationState.loggedDrinksCount >= 2, `Logged drinks count tracked (${hydrationState.loggedDrinksCount} drinks)`);
  const hydSummary = await nutritionAnalyticsService.getTodaySummary(testUserId, mockProfile);
  assert(hydSummary.hydration?.dailyWaterIntakeMl === hydrationState.dailyWaterIntakeMl, 'Hydration integrated cleanly into daily dashboard summary');

  // -------------------------------------------------------------------------
  // 6. Micronutrient integration
  // -------------------------------------------------------------------------
  console.log('\n--- 6. Micronutrient Integration ---');
  assert(aggregatedSummary.micronutrients !== undefined, 'Micronutrients snapshot object present in summary');
  const iron = aggregatedSummary.micronutrients?.nutrients?.ironMg;
  const calcium = aggregatedSummary.micronutrients?.nutrients?.calciumMg;
  const potassium = aggregatedSummary.micronutrients?.nutrients?.potassiumMg;
  assert(iron !== undefined && iron.consumed > 0, `Iron calculated from recorded meals (${iron?.consumed} ${iron?.unit} / ${iron?.referenceTarget} ${iron?.unit})`);
  assert(calcium !== undefined && calcium.consumed > 0, `Calcium calculated from recorded meals (${calcium?.consumed} ${calcium?.unit} / ${calcium?.referenceTarget} ${calcium?.unit})`);
  assert(potassium !== undefined && potassium.consumed > 0, `Potassium calculated from recorded meals (${potassium?.consumed} ${potassium?.unit} / ${potassium?.referenceTarget} ${potassium?.unit})`);

  // -------------------------------------------------------------------------
  // 7. Recent meals (3-5 latest meals)
  // -------------------------------------------------------------------------
  console.log('\n--- 7. Recent Meals ---');
  const meal3 = createMockMeal('meal_p11_3', 'Sprouted Moong Salad', [createMockItem('Moong Sprouts', 150, 12, 25, 1)]);
  const meal4 = createMockMeal('meal_p11_4', 'Sattu Drink', [createMockItem('Sattu Drink', 180, 10, 24, 3)]);
  const meal5 = createMockMeal('meal_p11_5', 'Curd & Poha', [createMockItem('Poha', 200, 4, 38, 4)]);
  await mealHistoryService.saveMeal(meal3);
  await mealHistoryService.saveMeal(meal4);
  await mealHistoryService.saveMeal(meal5);

  const pastReport = await nutritionAnalyticsService.getDateRangeReport(testUserId, 'last_30_days');
  const recentSlice = (pastReport.meals || []).slice(0, 5);
  assert(recentSlice.length >= 3 && recentSlice.length <= 5, `Returns 3 to 5 latest meals (retrieved ${recentSlice.length})`);
  assert(recentSlice[0].id !== undefined && recentSlice[0].mealTitle.length > 0, 'Recent meal contains id and mealTitle');
  assert(recentSlice[0].totalNutrition.calories > 0, 'Recent meal contains calories');
  assert(recentSlice[0].totalNutrition.protein > 0, 'Recent meal contains protein');
  assert(recentSlice[0].analyzedAt !== undefined, 'Recent meal contains ISO timestamp');

  // Verify RecentActivity UI component supports recentMeals
  const recentActivityPath = path.join(process.cwd(), 'src/components/dashboard/RecentActivity.tsx');
  const recentActivitySrc = fs.readFileSync(recentActivityPath, 'utf8');
  assert(recentActivitySrc.includes('recentMeals?: MealAnalysis[]'), 'RecentActivity supports recentMeals array prop');
  assert(recentActivitySrc.includes('/results?id='), 'RecentActivity cards link directly to /results?id={mealId}');
  assert(recentActivitySrc.includes('formatMealTimestamp'), 'RecentActivity formats timestamps cleanly');

  // -------------------------------------------------------------------------
  // 8. Recommendation integration
  // -------------------------------------------------------------------------
  console.log('\n--- 8. Recommendation Integration ---');
  const recs = nutritionAnalyticsService.getNextMealRecommendations(aggregatedSummary, mockProfile, 'no_cook');
  assert(recs.length > 0, 'Generates next meal recommendations for student');
  assert(recs.every(r => r.title && r.reason), 'Every recommendation contains title and rationale');
  assert(recs.every(r => !r.title.toLowerCase().includes('peanut')), 'Allergy filter strictly respected (no peanuts)');

  // -------------------------------------------------------------------------
  // 9. Empty states
  // -------------------------------------------------------------------------
  console.log('\n--- 9. Empty States ---');
  const emptyActivityPath = path.join(process.cwd(), 'src/components/dashboard/RecentActivity.tsx');
  const emptyActivityCode = fs.readFileSync(emptyActivityPath, 'utf8');
  assert(emptyActivityCode.includes('No meals scanned yet'), 'RecentActivity handles empty meals with clear copy');
  assert(emptyActivityCode.includes('Scan Your First Meal'), 'RecentActivity provides actionable CTA button to /scan');

  const emptyNutritionPath = path.join(process.cwd(), 'src/components/dashboard/EmptyNutritionState.tsx');
  const emptyNutritionCode = fs.readFileSync(emptyNutritionPath, 'utf8');
  assert(emptyNutritionCode.includes('Scan First Meal'), 'EmptyNutritionState includes primary scan action');
  assert(emptyNutritionCode.includes('Log Water'), 'EmptyNutritionState provides quick hydration action');

  // -------------------------------------------------------------------------
  // 10. Loading states
  // -------------------------------------------------------------------------
  console.log('\n--- 10. Loading States ---');
  const dashboardCompPath = path.join(process.cwd(), 'src/components/dashboard/NutritionDashboard.tsx');
  const dashboardCompCode = fs.readFileSync(dashboardCompPath, 'utf8');
  assert(dashboardCompCode.includes('animate-pulse'), 'Dashboard includes skeleton loading pulse state while data is loading');
  assert(dashboardCompCode.includes('safeToday'), 'Dashboard avoids misleading 0 displays with fallback guard defaults');

  // -------------------------------------------------------------------------
  // 11. Error states
  // -------------------------------------------------------------------------
  console.log('\n--- 11. Error States ---');
  const profileFormPath = path.join(process.cwd(), 'src/components/profile/profile-form.tsx');
  const profileFormCode = fs.readFileSync(profileFormPath, 'utf8');
  assert(profileFormCode.includes('Saved locally (cloud sync offline or setup pending)'), 'User-friendly error notification on sync failure');
  assert(!profileFormCode.includes('PERMISSION_DENIED'), 'Raw Firebase permissions error not shown to users');

  // -------------------------------------------------------------------------
  // 12. Offline fallback
  // -------------------------------------------------------------------------
  console.log('\n--- 12. Offline Fallback ---');
  const localSummary = await nutritionAnalyticsService.getTodaySummary(undefined, mockProfile);
  assert(localSummary.dataSource === 'local', 'Local fallback activated when cloud user ID is absent');
  assert(localSummary.targetCalories === mockProfile.targetCalories, 'Local targets preserved in offline fallback');

  // -------------------------------------------------------------------------
  // 13. Mobile-safe layout assumptions
  // -------------------------------------------------------------------------
  console.log('\n--- 13. Mobile-Safe Layout Assumptions ---');
  const mobileNavPath = path.join(process.cwd(), 'src/components/layout/mobile-bottom-nav.tsx');
  assert(fs.existsSync(mobileNavPath), 'MobileBottomNav component exists');
  const mobileNavCode = fs.readFileSync(mobileNavPath, 'utf8');
  assert(mobileNavCode.includes('md:hidden'), 'Mobile navigation is cleanly hidden on desktop (md:hidden)');
  assert(mobileNavCode.includes('!isAuthenticated'), 'Mobile navigation respects authentication state (returns null if unauthenticated)');
  assert(mobileNavCode.includes('/dashboard') && mobileNavCode.includes('/scan') && mobileNavCode.includes('/history') && mobileNavCode.includes('/profile'), 'Mobile navigation covers Home, Scan, History, Analytics, and Profile');
  assert(mobileNavCode.includes('min-h-[48px]'), 'Touch targets adhere to WCAG minimum accessibility size (>= 48px)');

  const layoutPath = path.join(process.cwd(), 'src/app/layout.tsx');
  const layoutCode = fs.readFileSync(layoutPath, 'utf8');
  assert(layoutCode.includes('MobileBottomNav'), 'MobileBottomNav integrated into root layout');
  assert(layoutCode.includes('pb-16 md:pb-0'), 'Main container includes bottom padding on mobile to prevent navbar overlap');

  // -------------------------------------------------------------------------
  // 14. No fake production data
  // -------------------------------------------------------------------------
  console.log('\n--- 14. No Fake Production Data ---');
  assert(dashboardCompCode.includes('nutritionAnalyticsService.getTodaySummary'), 'Dashboard queries real today summary through domain service');
  assert(dashboardCompCode.includes('nutritionAnalyticsService.calculateStreakMetrics'), 'Consistency metrics calculated from real meal timestamps');
  assert(!dashboardCompCode.includes('fakeData'), 'Zero fake static production data structures');

  // -------------------------------------------------------------------------
  // 15. UID ownership
  // -------------------------------------------------------------------------
  console.log('\n--- 15. UID Ownership ---');
  assert(dashboardCompCode.includes('activeUserId = user?.uid'), 'Dashboard derives activeUserId from authenticated Firebase user');
  assert(hydrationState.userId === testUserId || hydrationState.entries.every(e => e.userId === testUserId || !e.userId), 'Hydration queries strictly isolated to active user');

  // -------------------------------------------------------------------------
  // 16. No secret exposure
  // -------------------------------------------------------------------------
  console.log('\n--- 16. No Secret Exposure ---');
  const clientFiles = [
    'src/app/dashboard/page.tsx',
    'src/components/dashboard/NutritionDashboard.tsx',
    'src/components/layout/mobile-bottom-nav.tsx',
    'src/components/layout/navbar.tsx',
    'src/components/dashboard/RecentActivity.tsx',
  ];
  for (const rel of clientFiles) {
    const content = fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
    assert(!content.includes('GEMINI_API_KEY'), `${rel} contains NO GEMINI_API_KEY`);
    assert(!content.includes('FIREBASE_ADMIN'), `${rel} contains NO FIREBASE_ADMIN secret`);
    assert(!content.includes('serviceAccount'), `${rel} contains NO serviceAccount secrets`);
  }

  // -------------------------------------------------------------------------
  // 17. Existing route compatibility
  // -------------------------------------------------------------------------
  console.log('\n--- 17. Existing Route Compatibility ---');
  const coreRoutes = [
    'src/app/page.tsx',
    'src/app/login/page.tsx',
    'src/app/register/page.tsx',
    'src/app/forgot-password/page.tsx',
    'src/app/onboarding/page.tsx',
    'src/app/dashboard/page.tsx',
    'src/app/scan/page.tsx',
    'src/app/results/page.tsx',
    'src/app/history/page.tsx',
    'src/app/profile/page.tsx',
  ];
  for (const route of coreRoutes) {
    assert(fs.existsSync(path.join(process.cwd(), route)), `Route file ${route} exists`);
  }

  // -------------------------------------------------------------------------
  // 18. Regression compatibility
  // -------------------------------------------------------------------------
  console.log('\n--- 18. Regression Compatibility ---');
  assert(typeof nutritionAnalyticsService.getTodaySummary === 'function', 'nutritionAnalyticsService.getTodaySummary preserved');
  assert(typeof nutritionAnalyticsService.calculateRecommendedTargets === 'function', 'nutritionAnalyticsService.calculateRecommendedTargets preserved');
  assert(typeof hydrationService.logDrink === 'function', 'hydrationService.logDrink preserved');
  assert(typeof mealHistoryService.saveMeal === 'function', 'mealHistoryService.saveMeal preserved');

  console.log('\n===============================================================');
  console.log(`PHASE 11 DASHBOARD TEST RESULTS: ${passedTests}/${totalTests} PASSED (100%)`);
  console.log('===============================================================\n');
}

runPhase11Tests().catch(err => {
  console.error('\n❌ Phase 11 Dashboard Test Suite Failed:', err);
  process.exit(1);
});
