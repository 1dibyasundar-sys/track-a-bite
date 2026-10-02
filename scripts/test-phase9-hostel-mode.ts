/**
 * TRACK-A-BITE — PHASE 9.7 HOSTEL MODE TESTS
 *
 * Verifies first-class hostel experience:
 * - Hostel mode prioritization when isHostelite === true
 * - Filter: [ No Cook ]
 * - Filter: [ Budget ]
 * - Filter: [ High Protein ]
 * - Filter: [ Mess Friendly ]
 * - Filter: [ No Fridge ]
 * - Dietary & allergen restrictions preserved across all filter modes
 */

import { nutritionAnalyticsService } from '../src/lib/services/nutritionAnalyticsService';
import { DailyNutritionSummary } from '../src/lib/types/analytics';
import { DEFAULT_USER_PROFILE, UserProfile } from '../src/lib/types/profile';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`✅ [PASS] ${msg}`);
}

async function runHostelModeTests() {
  console.log('====================================================');
  console.log('TRACK-A-BITE — PHASE 9.7 HOSTEL MODE TESTS');
  console.log('====================================================\n');

  const baseSummary: DailyNutritionSummary = {
    date: '2026-10-02',
    totalCalories: 1200,
    totalProteinG: 30,
    totalCarbsG: 180,
    totalFatG: 40,
    totalFiberG: 12,
    mealCount: 1,
    nutritionScore: 65,
    nutritionRating: 'fair',
    targetCalories: 2100,
    targetProteinG: 75,
    targetCarbsG: 260,
    targetFatG: 60,
    targetFiberG: 28,
    calorieProgressPercent: 57,
    proteinProgressPercent: 40,
    carbsProgressPercent: 69,
    fatProgressPercent: 67,
    fiberProgressPercent: 43,
    meals: [],
    dataSource: 'local',
  };

  const hostelProfile: Partial<UserProfile> = {
    ...DEFAULT_USER_PROFILE,
    isHostelite: true,
    hasCookingAccess: false,
    hasFridge: false,
    budgetPreference: 'budget',
  };

  // --- 1. DEFAULT HOSTEL RECOMMENDATIONS ---
  console.log('--- 1. DEFAULT HOSTEL RECOMMENDATIONS ---');
  const defaultRecs = nutritionAnalyticsService.getNextMealRecommendations(baseSummary, hostelProfile);
  assert(defaultRecs.length > 0, 'TEST 1.1: Hostel recommendations generated');
  assert(defaultRecs.every(r => r.hostelFriendly), 'TEST 1.2: All default items are hostel friendly');

  // --- 2. FILTER: [ NO COOK ] ---
  console.log('\n--- 2. FILTER: [ NO COOK ] ---');
  const noCookRecs = nutritionAnalyticsService.getNextMealRecommendations(baseSummary, hostelProfile, 'no_cook');
  assert(noCookRecs.length > 0, 'TEST 2.1: No cook recommendations found');
  assert(noCookRecs.every(r => r.noCookRequired), 'TEST 2.2: All returned items require zero cooking');

  // --- 3. FILTER: [ BUDGET ] ---
  console.log('\n--- 3. FILTER: [ BUDGET ] ---');
  const budgetRecs = nutritionAnalyticsService.getNextMealRecommendations(baseSummary, hostelProfile, 'budget');
  assert(budgetRecs.length > 0, 'TEST 3.1: Budget recommendations found');
  assert(budgetRecs.every(r => r.affordabilityCategory === 'budget'), 'TEST 3.2: All returned items in budget tier');

  // --- 4. FILTER: [ HIGH PROTEIN ] ---
  console.log('\n--- 4. FILTER: [ HIGH PROTEIN ] ---');
  const highProteinRecs = nutritionAnalyticsService.getNextMealRecommendations(baseSummary, hostelProfile, 'high_protein');
  assert(highProteinRecs.length > 0, 'TEST 4.1: High protein recommendations found');
  assert(highProteinRecs.every(r => r.estimatedNutrition.protein >= 8), 'TEST 4.2: All items provide >= 8g protein');

  // --- 5. FILTER: [ MESS FRIENDLY ] ---
  console.log('\n--- 5. FILTER: [ MESS FRIENDLY ] ---');
  const messRecs = nutritionAnalyticsService.getNextMealRecommendations(baseSummary, hostelProfile, 'mess_friendly');
  assert(messRecs.length > 0, 'TEST 5.1: Mess friendly recommendations found');
  assert(messRecs.every(r => r.messFriendly === true), 'TEST 5.2: All items are mess/canteen friendly');

  // --- 6. FILTER: [ NO FRIDGE ] ---
  console.log('\n--- 6. FILTER: [ NO FRIDGE ] ---');
  const noFridgeRecs = nutritionAnalyticsService.getNextMealRecommendations(baseSummary, hostelProfile, 'no_fridge');
  assert(noFridgeRecs.length > 0, 'TEST 6.1: No fridge recommendations found');
  assert(noFridgeRecs.every(r => r.requiresFridge === false), 'TEST 6.2: Zero refrigeration needed');

  // --- 7. FILTER ENFORCING ALLERGENS SIMULTANEOUSLY ---
  console.log('\n--- 7. ALLERGEN ENFORCEMENT UNDER HOSTEL FILTERS ---');
  const dairyAllergyHostel: Partial<UserProfile> = {
    ...hostelProfile,
    allergies: ['dairy', 'milk', 'lactose'],
  };
  const dairyFreeMess = nutritionAnalyticsService.getNextMealRecommendations(baseSummary, dairyAllergyHostel, 'mess_friendly');
  assert(dairyFreeMess.every(r => !r.title.toLowerCase().includes('curd') && !r.title.toLowerCase().includes('paneer') && !r.title.toLowerCase().includes('buttermilk')), 'TEST 7.1: Mess items respect dairy allergy');

  console.log('\n====================================================');
  console.log('🎉 ALL PHASE 9.7 HOSTEL MODE TESTS PASSED!');
  console.log('====================================================\n');
}

runHostelModeTests().catch(err => {
  console.error('\n❌ Hostel Mode Test Failed:', err);
  process.exit(1);
});
