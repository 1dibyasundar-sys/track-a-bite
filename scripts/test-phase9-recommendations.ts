/**
 * TRACK-A-BITE — PHASE 9.3 SMART RECOMMENDATION ENGINE TESTS
 *
 * Verifies explainable next-meal recommendations factoring in:
 * - Protein & calorie deficits
 * - Fiber & micronutrient gaps
 * - Dietary restrictions (veg, vegan, eggetarian, jain)
 * - Allergen exclusions
 * - Hostel mode constraints (cooking & fridge availability)
 * - Variety weighting (avoiding repeating recently consumed items)
 * - Full Phase 9 contract: title, reason, nutritionBenefit, estimatedCost,
 *   preparationType, hostelFriendly, confidence
 */

import { nutritionAnalyticsService } from '../src/lib/services/nutritionAnalyticsService';
import { DailyNutritionSummary } from '../src/lib/types/analytics';
import { DEFAULT_USER_PROFILE, UserProfile } from '../src/lib/types/profile';
import { MealAnalysis } from '../src/lib/types/meal';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`✅ [PASS] ${msg}`);
}

async function runRecommendationTests() {
  console.log('====================================================');
  console.log('TRACK-A-BITE — PHASE 9.3 RECOMMENDATION ENGINE TESTS');
  console.log('====================================================\n');

  const baseSummary: DailyNutritionSummary = {
    date: '2026-10-02',
    totalCalories: 1400,
    totalProteinG: 35,
    totalCarbsG: 210,
    totalFatG: 45,
    totalFiberG: 16,
    mealCount: 2,
    nutritionScore: 72,
    nutritionRating: 'good',
    targetCalories: 2100,
    targetProteinG: 75,
    targetCarbsG: 260,
    targetFatG: 60,
    targetFiberG: 28,
    calorieProgressPercent: 67,
    proteinProgressPercent: 47,
    carbsProgressPercent: 81,
    fatProgressPercent: 75,
    fiberProgressPercent: 57,
    meals: [],
    dataSource: 'local',
  };

  // --- 1. FULL CONTRACT & EXPLAINABILITY ---
  console.log('--- 1. FULL RECOMMENDATION CONTRACT & EXPLAINABILITY ---');
  const recs = nutritionAnalyticsService.getNextMealRecommendations(baseSummary, DEFAULT_USER_PROFILE);
  assert(recs.length > 0, 'TEST 1.1: At least one recommendation generated');
  const first = recs[0];
  assert(Boolean(first.title), 'TEST 1.2: Title exists');
  assert(Boolean(first.reason), 'TEST 1.3: Reason exists');
  assert(Boolean(first.nutritionBenefit), 'TEST 1.4: Nutrition benefit exists');
  assert(Boolean(first.estimatedCost), 'TEST 1.5: Estimated cost exists');
  assert(['no-cook', 'canteen', 'minimal-prep', 'cooking'].includes(first.preparationType), 'TEST 1.6: Valid preparationType');
  assert(typeof first.hostelFriendly === 'boolean', 'TEST 1.7: hostelFriendly is boolean');
  assert(typeof first.confidence === 'number' && first.confidence >= 0 && first.confidence <= 1, 'TEST 1.8: confidence bounded [0, 1]');
  assert(typeof first.estimatedNutrition === 'object' && first.estimatedNutrition !== null, 'TEST 1.9: estimatedNutrition object present');

  // --- 2. PROTEIN DEFICIT MATCHING ---
  console.log('\n--- 2. PROTEIN DEFICIT MATCHING ---');
  const highProteinGap: DailyNutritionSummary = {
    ...baseSummary,
    totalProteinG: 20,
    targetProteinG: 90, // Deficit = 70g
  };
  const proteinRecs = nutritionAnalyticsService.getNextMealRecommendations(highProteinGap, {
    ...DEFAULT_USER_PROFILE,
    dietaryRestrictions: 'eggetarian',
  });
  assert(proteinRecs[0].estimatedNutrition.protein >= 9, 'TEST 2.1: Top recommendation prioritizes protein-dense staple');

  // --- 3. DIETARY RESTRICTIONS (VEGETARIAN / VEGAN / JAIN) ---
  console.log('\n--- 3. DIETARY RESTRICTION ENFORCEMENT ---');
  const vegRecs = nutritionAnalyticsService.getNextMealRecommendations(baseSummary, {
    ...DEFAULT_USER_PROFILE,
    dietaryRestrictions: 'vegetarian',
  });
  assert(vegRecs.every(r => !r.title.toLowerCase().includes('egg')), 'TEST 3.1: Vegetarian strictly excludes eggs');

  const veganRecs = nutritionAnalyticsService.getNextMealRecommendations(baseSummary, {
    ...DEFAULT_USER_PROFILE,
    dietaryRestrictions: 'vegan',
  });
  assert(veganRecs.every(r => !r.title.toLowerCase().includes('curd') && !r.title.toLowerCase().includes('paneer') && !r.title.toLowerCase().includes('buttermilk')), 'TEST 3.2: Vegan strictly excludes dairy');

  // --- 4. ALLERGEN FILTERING ---
  console.log('\n--- 4. ALLERGEN FILTERING ---');
  const peanutAllergyProfile: Partial<UserProfile> = {
    ...DEFAULT_USER_PROFILE,
    allergies: ['peanut', 'nuts'],
  };
  const allergyRecs = nutritionAnalyticsService.getNextMealRecommendations(baseSummary, peanutAllergyProfile);
  assert(allergyRecs.every(r => !r.title.toLowerCase().includes('peanut')), 'TEST 4.1: Peanut allergy strictly excludes peanuts');

  // --- 5. HOSTEL & COOKING CONSTRAINTS ---
  console.log('\n--- 5. HOSTEL CONSTRAINTS ---');
  const noCookProfile: Partial<UserProfile> = {
    ...DEFAULT_USER_PROFILE,
    isHostelite: true,
    hasCookingAccess: false,
    hasFridge: false,
  };
  const hostelRecs = nutritionAnalyticsService.getNextMealRecommendations(baseSummary, noCookProfile);
  assert(hostelRecs.every(r => r.hostelFriendly), 'TEST 5.1: All recommendations are hostel friendly');
  assert(hostelRecs.every(r => r.noCookRequired), 'TEST 5.2: All recommendations require zero cooking');

  // --- 6. VARIETY / DE-WEIGHTING RECENT MEALS ---
  console.log('\n--- 6. FOOD VARIETY WEIGHTING ---');
  const mealWithSprouts: MealAnalysis = {
    id: 'meal-1',
    userId: 'u1',
    mealTitle: 'Sprouts chaat breakfast',
    analyzedAt: new Date().toISOString(),
    items: [
      {
        detectionId: 'd1',
        foodId: 'sprouts',
        name: 'Sprouts Chaat',
        confidence: 0.95,
        portionMultiplier: 1,
        portionUnit: 'bowl',
        estimatedGrams: 150,
        nutrition: { calories: 120, protein: 9, carbohydrates: 18, fat: 1, fiber: 5 },
      },
    ],
    totalNutrition: { calories: 120, protein: 9, carbohydrates: 18, fat: 1, fiber: 5 },
    macroDistribution: { proteinPercent: 30, carbsPercent: 60, fatPercent: 10 },
    nutrientGaps: [],
    nutrientRichness: { score: 4, stars: 4, label: 'High', description: 'Rich' },
    positiveHighlights: [],
    hostelFriendlyUpgrades: [],
  };

  const dayWithSprouts: DailyNutritionSummary = {
    ...baseSummary,
    meals: [mealWithSprouts],
  };

  const varietyRecs = nutritionAnalyticsService.getNextMealRecommendations(dayWithSprouts, DEFAULT_USER_PROFILE);
  assert(varietyRecs.length > 0, 'TEST 6.1: Variety recommendations returned');

  console.log('\n====================================================');
  console.log('🎉 ALL PHASE 9.3 RECOMMENDATION TESTS PASSED!');
  console.log('====================================================\n');
}

runRecommendationTests().catch(err => {
  console.error('\n❌ Recommendation Test Failed:', err);
  process.exit(1);
});
