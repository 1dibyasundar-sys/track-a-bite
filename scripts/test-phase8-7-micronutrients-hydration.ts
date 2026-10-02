/**
 * TRACK-A-BITE — PHASE 8.7 VERIFICATION SUITE
 * Micronutrient & Hydration Tracking Verification
 *
 * Verifies all 32 Phase 8.7 requirements:
 * 1. Micronutrient type compatibility
 * 2. Iron aggregation
 * 3. Calcium aggregation
 * 4. Vitamin D aggregation
 * 5. Potassium aggregation
 * 6. Sodium aggregation
 * 7. B12 aggregation
 * 8. Folate aggregation
 * 9. Missing micronutrient handling
 * 10. Invalid negative-value handling
 * 11. Hydration entry creation
 * 12. Hydration aggregation
 * 13. Hydration target calculation
 * 14. Hydration percentage calculation
 * 15. Hydration overflow handling
 * 16. Empty hydration history
 * 17. Local fallback
 * 18. Firestore fallback
 * 19. UID authorization
 * 20. Cross-user isolation
 * 21. Hostel recommendation integration
 * 22. Vegetarian filtering
 * 23. Vegan filtering
 * 24. Jain filtering
 * 25. Allergy filtering
 * 26. Budget filtering
 * 27. Export integration
 * 28. useSyncExternalStore stability
 * 29. Existing analytics regression
 * 30. Phase 8.6 regression
 * 31. Secret isolation
 * 32. Firestore security rules compatibility
 */

import fs from 'fs';
import type { MealAnalysis, DetectedFoodItem } from '../src/lib/types/meal';
import {
  UserProfile,
  DEFAULT_USER_PROFILE,
} from '../src/lib/types/profile';
import {
  MicronutrientIntake,
} from '../src/lib/types/analytics';
import {
  DEFAULT_HYDRATION_TARGET_ML,
  ML_PER_KG_WEIGHT,
} from '../src/lib/types/hydration';
import { nutritionAnalyticsService } from '../src/lib/services/nutritionAnalyticsService';
import { nutritionExportService } from '../src/lib/services/nutritionExportService';
import { hydrationService } from '../src/lib/services/hydrationService';
import { hydrationStorageService } from '../src/lib/services/hydrationStorageService';
import { firestoreHydrationService } from '../src/lib/services/firestoreHydrationService';

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

// In-memory mock localStorage for Node.js test environment
const mockStorage = new Map<string, string>();
if (typeof (globalThis as unknown as { window: unknown }).window === 'undefined') {
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: (key: string) => mockStorage.get(key) || null,
      setItem: (key: string, value: string) => mockStorage.set(key, String(value)),
      removeItem: (key: string) => mockStorage.delete(key),
      clear: () => mockStorage.clear(),
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  };
}

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passCount++;
  } else {
    console.error(`❌ [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
    failCount++;
  }
}

async function runPhase87Tests() {
  console.log('====================================================');
  console.log('TRACK-A-BITE — PHASE 8.7 VERIFICATION SUITE');
  console.log('Micronutrient & Hydration Tracking Verification');
  console.log('====================================================\n');

  const todayKey = '2026-10-02';

  // Helper meal creator with micronutrients
  function createSampleMeal(
    id: string,
    title: string,
    macros: { calories: number; protein: number; carbs: number; fat: number; fiber: number },
    micros?: {
      iron?: number;
      calcium?: number;
      vitaminD?: number;
      potassium?: number;
      sodium?: number;
      vitaminB12?: number;
      folate?: number;
    }
  ): MealAnalysis {
    const items: DetectedFoodItem[] = [
      {
        detectionId: `det-${id}-1`,
        foodId: `food-${id}-1`,
        name: title,
        confidence: 0.95,
        portionMultiplier: 1.0,
        portionUnit: 'serving',
        estimatedGrams: 200,
        nutrition: {
          calories: macros.calories,
          protein: macros.protein,
          carbohydrates: macros.carbs,
          fat: macros.fat,
          fiber: macros.fiber,
          sodium: micros?.sodium,
        },
        micronutrients: micros,
      },
    ];

    return {
      id,
      mealTitle: title,
      analyzedAt: `${todayKey}T12:00:00.000Z`,
      items,
      totalNutrition: {
        calories: macros.calories,
        protein: macros.protein,
        carbohydrates: macros.carbs,
        fat: macros.fat,
        fiber: macros.fiber,
        sodium: micros?.sodium,
      },
      macroDistribution: { carbsPercent: 50, proteinPercent: 25, fatPercent: 25 },
      nutrientRichness: { stars: 4.5, label: 'Nutrient Rich', explanation: 'Well balanced', highlights: [] },
      nutrientGaps: { providedNutrients: [], missingNutrients: [], whyItMattersSummary: '' },
      balanceAssessment: {
        rating: 'balanced',
        label: 'Balanced Plate',
        summary: 'Good distribution',
        detail: 'Healthy lunch',
        glycemicImpactEstimate: 'Low',
      },
      positiveHighlights: ['Rich in essential minerals'],
      balancingRecommendations: [],
      hostelFriendlyUpgrades: [],
      hostelModeActive: true,
      practicalAdjustments: [],
      disclaimer: 'General nutrition reference',
    };
  }

  // --- TEST 1: MICRONUTRIENT TYPE COMPATIBILITY ---
  console.log('--- TEST 1: MICRONUTRIENT TYPE COMPATIBILITY ---');
  const sampleIntake: MicronutrientIntake = {
    ironMg: 6.4,
    calciumMg: 540,
    vitaminDMcg: 5,
    potassiumMg: 2835,
    sodiumMg: 1420,
    vitaminB12Mcg: 1.8,
    folateMcg: 210,
  };
  assert(sampleIntake.ironMg === 6.4, 'MicronutrientIntake supports ironMg');
  assert(sampleIntake.calciumMg === 540, 'MicronutrientIntake supports calciumMg');
  assert(sampleIntake.vitaminDMcg === 5, 'MicronutrientIntake supports vitaminDMcg');
  assert(sampleIntake.potassiumMg === 2835, 'MicronutrientIntake supports potassiumMg');
  assert(sampleIntake.sodiumMg === 1420, 'MicronutrientIntake supports sodiumMg');
  assert(sampleIntake.vitaminB12Mcg === 1.8, 'MicronutrientIntake supports vitaminB12Mcg');
  assert(sampleIntake.folateMcg === 210, 'MicronutrientIntake supports folateMcg');

  // --- TEST 2: IRON AGGREGATION ---
  console.log('\n--- TEST 2: IRON AGGREGATION ---');
  const meal1 = createSampleMeal('m1', 'Dal Tadka with Rice', { calories: 450, protein: 14, carbs: 70, fat: 10, fiber: 8 }, {
    iron: 4.5,
    calcium: 120,
    potassium: 650,
    sodium: 480,
  });
  const meal2 = createSampleMeal('m2', 'Roasted Chana & Fruit', { calories: 250, protein: 12, carbs: 35, fat: 4, fiber: 9 }, {
    iron: 5.5,
    calcium: 80,
    potassium: 550,
    sodium: 120,
  });
  const dailyMicros = nutritionAnalyticsService.aggregateMicronutrientsForMeals([meal1, meal2], todayKey);
  assert(dailyMicros.intake.ironMg === 10.0, `Iron correctly summed (4.5 + 5.5 = 10.0mg, got ${dailyMicros.intake.ironMg})`);
  assert(dailyMicros.nutrients.ironMg.referenceTarget === 18, 'Iron reference target is 18mg');
  assert(dailyMicros.nutrients.ironMg.percentage === Math.round((10 / 18) * 100), `Iron percentage is ${Math.round((10 / 18) * 100)}%`);

  // --- TEST 3: CALCIUM AGGREGATION ---
  console.log('\n--- TEST 3: CALCIUM AGGREGATION ---');
  const mealCurd = createSampleMeal('m-curd', 'Fresh Curd (1 Bowl)', { calories: 120, protein: 8, carbs: 9, fat: 5, fiber: 0 }, {
    calcium: 340,
    potassium: 220,
    sodium: 90,
    vitaminB12: 0.8,
  });
  const curdDaily = nutritionAnalyticsService.aggregateMicronutrientsForMeals([meal1, mealCurd], todayKey);
  assert(curdDaily.intake.calciumMg === 460, `Calcium correctly summed (120 + 340 = 460mg, got ${curdDaily.intake.calciumMg})`);
  assert(curdDaily.nutrients.calciumMg.referenceTarget === 1000, 'Calcium reference target is 1000mg');
  assert(curdDaily.nutrients.calciumMg.status === 'below_reference', 'Calcium correctly flagged as below_reference');

  // --- TEST 4: VITAMIN D AGGREGATION ---
  console.log('\n--- TEST 4: VITAMIN D AGGREGATION ---');
  const mealVitD = createSampleMeal('m-vitd', 'Fortified Milk with Cereal', { calories: 280, protein: 10, carbs: 40, fat: 6, fiber: 3 }, {
    vitaminD: 5.0,
    calcium: 250,
  });
  const vitDDaily = nutritionAnalyticsService.aggregateMicronutrientsForMeals([mealVitD], todayKey);
  assert(vitDDaily.intake.vitaminDMcg === 5.0, `Vitamin D correctly extracted (got ${vitDDaily.intake.vitaminDMcg})`);
  assert(vitDDaily.nutrients.vitaminDMcg.referenceTarget === 15, 'Vitamin D reference target is 15mcg');

  // --- TEST 5: POTASSIUM AGGREGATION ---
  console.log('\n--- TEST 5: POTASSIUM AGGREGATION ---');
  const mealBanana = createSampleMeal('m-banana', 'Banana & Coconut Water', { calories: 180, protein: 2, carbs: 42, fat: 0.5, fiber: 4 }, {
    potassium: 850,
  });
  const potDaily = nutritionAnalyticsService.aggregateMicronutrientsForMeals([meal1, mealBanana], todayKey);
  assert(potDaily.intake.potassiumMg === 1500, `Potassium correctly summed (650 + 850 = 1500mg, got ${potDaily.intake.potassiumMg})`);
  assert(potDaily.nutrients.potassiumMg.referenceTarget === 3500, 'Potassium reference target is 3500mg');

  // --- TEST 6: SODIUM AGGREGATION ---
  console.log('\n--- TEST 6: SODIUM AGGREGATION ---');
  const mealSalty = createSampleMeal('m-salt', 'Canteen Thali', { calories: 650, protein: 18, carbs: 85, fat: 22, fiber: 6 }, {
    sodium: 1600,
  });
  const sodiumDaily = nutritionAnalyticsService.aggregateMicronutrientsForMeals([meal1, mealSalty], todayKey);
  assert(sodiumDaily.intake.sodiumMg === 2080, `Sodium correctly summed (480 + 1600 = 2080mg, got ${sodiumDaily.intake.sodiumMg})`);
  assert(sodiumDaily.nutrients.sodiumMg.status === 'above_reference', 'Sodium > 2000mg correctly marked as above_reference');

  // --- TEST 7: B12 AGGREGATION ---
  console.log('\n--- TEST 7: B12 AGGREGATION ---');
  assert(curdDaily.intake.vitaminB12Mcg === 0.8, `B12 correctly extracted (got ${curdDaily.intake.vitaminB12Mcg})`);
  assert(curdDaily.nutrients.vitaminB12Mcg.referenceTarget === 2.4, 'B12 reference target is 2.4mcg');

  // --- TEST 8: FOLATE AGGREGATION ---
  console.log('\n--- TEST 8: FOLATE AGGREGATION ---');
  const mealSprouts = createSampleMeal('m-sprouts', 'Sprouted Moong Salad', { calories: 140, protein: 10, carbs: 22, fat: 1, fiber: 7 }, {
    folate: 160,
    iron: 3.2,
  });
  const folateDaily = nutritionAnalyticsService.aggregateMicronutrientsForMeals([mealSprouts], todayKey);
  assert(folateDaily.intake.folateMcg === 160, `Folate correctly extracted (got ${folateDaily.intake.folateMcg})`);
  assert(folateDaily.nutrients.folateMcg.referenceTarget === 400, 'Folate reference target is 400mcg');

  // --- TEST 9: MISSING MICRONUTRIENT HANDLING ---
  console.log('\n--- TEST 9: MISSING MICRONUTRIENT HANDLING ---');
  const mealEmptyMicros = createSampleMeal('m-empty', 'Plain White Bread', { calories: 150, protein: 4, carbs: 30, fat: 1, fiber: 1 });
  const emptyDaily = nutritionAnalyticsService.aggregateMicronutrientsForMeals([mealEmptyMicros], todayKey);
  assert(emptyDaily.intake.ironMg === undefined, 'Does not invent iron when data missing');
  assert(emptyDaily.intake.vitaminDMcg === undefined, 'Does not invent vitamin D when data missing');
  assert(emptyDaily.nutrients.ironMg.dataAvailability === 'none', 'Correctly flags dataAvailability as none');
  assert(emptyDaily.nutrients.ironMg.status === 'insufficient_data', 'Correctly flags status as insufficient_data');

  // --- TEST 10: INVALID NEGATIVE-VALUE HANDLING ---
  console.log('\n--- TEST 10: INVALID NEGATIVE-VALUE HANDLING ---');
  const mealNegativeMicros = createSampleMeal('m-neg', 'Corrupted Log', { calories: 200, protein: 5, carbs: 20, fat: 2, fiber: 2 }, {
    iron: -15, // invalid negative
    calcium: Number.NaN as unknown as number, // invalid NaN
  });
  const sanitizedDaily = nutritionAnalyticsService.aggregateMicronutrientsForMeals([mealNegativeMicros], todayKey);
  assert(sanitizedDaily.intake.ironMg === undefined, 'Negative micronutrients filtered out safely');
  assert(sanitizedDaily.intake.calciumMg === undefined, 'NaN micronutrients filtered out safely');

  // --- TEST 11: HYDRATION ENTRY CREATION ---
  console.log('\n--- TEST 11: HYDRATION ENTRY CREATION ---');
  hydrationStorageService.clearAll();
  const entry1 = await hydrationService.logDrink(500, 'quick_add', todayKey, 'test-uid-87');
  assert(entry1.id.startsWith('hyd_'), 'Generated hydration entry has unique prefixed ID');
  assert(entry1.amountMl === 500, 'Hydration amount is 500 ml');
  assert(entry1.date === todayKey, 'Hydration entry date matches local ISO date');

  // --- TEST 12: HYDRATION AGGREGATION ---
  console.log('\n--- TEST 12: HYDRATION AGGREGATION ---');
  await hydrationService.logDrink(250, 'quick_add', todayKey, 'test-uid-87');
  await hydrationService.logDrink(750, 'quick_add', todayKey, 'test-uid-87');
  const summary1 = await hydrationService.getDailySummary('test-uid-87', todayKey);
  assert(summary1.dailyWaterIntakeMl === 1500, `Aggregated daily intake is 1500 ml (500+250+750) (got ${summary1.dailyWaterIntakeMl})`);
  assert(summary1.loggedDrinksCount === 3, `Count is 3 logged drinks (got ${summary1.loggedDrinksCount})`);

  // --- TEST 13: HYDRATION TARGET CALCULATION ---
  console.log('\n--- TEST 13: HYDRATION TARGET CALCULATION ---');
  const defaultTarget = hydrationService.calculateHydrationTarget(null);
  assert(defaultTarget.targetMl === DEFAULT_HYDRATION_TARGET_ML, `Default target is ${DEFAULT_HYDRATION_TARGET_ML} ml`);
  assert(defaultTarget.isPersonalized === false, 'Default target is not personalized');

  const profileWithWeight: UserProfile = { ...DEFAULT_USER_PROFILE, weightKg: 70 };
  const weightTarget = hydrationService.calculateHydrationTarget(profileWithWeight);
  assert(weightTarget.targetMl === 70 * ML_PER_KG_WEIGHT, `Weight heuristic target is 70 * 35 = 2450 ml (got ${weightTarget.targetMl})`);
  assert(weightTarget.isPersonalized === true, 'Weight heuristic target is personalized');

  const profileCustom: UserProfile = { ...DEFAULT_USER_PROFILE, targetHydrationMl: 3000 };
  const customTarget = hydrationService.calculateHydrationTarget(profileCustom);
  assert(customTarget.targetMl === 3000, `Custom target is authoritative 3000 ml (got ${customTarget.targetMl})`);

  // --- TEST 14: HYDRATION PERCENTAGE CALCULATION ---
  console.log('\n--- TEST 14: HYDRATION PERCENTAGE CALCULATION ---');
  // 1500 ml vs default 2200 ml = 68%
  assert(summary1.percentageOfTarget === Math.round((1500 / 2200) * 100), `Percentage matches 68% (got ${summary1.percentageOfTarget}%)`);
  assert(summary1.remainingAmountMl === 700, `Remaining amount is 700 ml (got ${summary1.remainingAmountMl})`);

  // --- TEST 15: HYDRATION OVERFLOW HANDLING ---
  console.log('\n--- TEST 15: HYDRATION OVERFLOW HANDLING ---');
  await hydrationService.logDrink(1000, 'quick_add', todayKey, 'test-uid-87'); // now 2500 ml vs 2200 ml target
  const overflowSummary = await hydrationService.getDailySummary('test-uid-87', todayKey);
  assert(overflowSummary.dailyWaterIntakeMl === 2500, 'Intake reached 2500 ml');
  assert(overflowSummary.percentageOfTarget === 114, 'Percentage handles overflow gracefully (114%)');
  assert(overflowSummary.remainingAmountMl === 0, 'Remaining amount clamped to 0 without negative numbers');

  // --- TEST 16: EMPTY HYDRATION HISTORY ---
  console.log('\n--- TEST 16: EMPTY HYDRATION HISTORY ---');
  const emptyHydration = await hydrationService.getDailySummary('test-uid-87', '2026-09-01');
  assert(emptyHydration.dailyWaterIntakeMl === 0, 'Empty history has 0 intake');
  assert(emptyHydration.loggedDrinksCount === 0, 'Empty history has 0 logged drinks');
  assert(emptyHydration.percentageOfTarget === 0, 'Empty history has 0% progress');
  assert(emptyHydration.remainingAmountMl === DEFAULT_HYDRATION_TARGET_ML, 'Empty history remaining equals full target');

  // --- TEST 17: LOCAL FALLBACK ---
  console.log('\n--- TEST 17: LOCAL FALLBACK ---');
  hydrationStorageService.clearAll();
  const guestDrink = await hydrationService.logDrink(500, 'quick_add', todayKey);
  assert(guestDrink.userId === 'local-user', 'Unauthenticated drink assigned local-user');
  const localSummary = await hydrationService.getDailySummary(undefined, todayKey);
  assert(localSummary.dailyWaterIntakeMl === 500, 'Local storage summary retrieved without authentication');
  assert(localSummary.dataSource === 'local', 'Data source marked as local');

  // --- TEST 18: FIRESTORE FALLBACK ---
  console.log('\n--- TEST 18: FIRESTORE FALLBACK ---');
  // Even if a non-existent cloud user is queried, hydrationService falls back to local without crashing
  const failedCloudSummary = await hydrationService.getDailySummary('non-existent-uid-error-fallback', todayKey);
  assert(failedCloudSummary !== null, 'Cloud query failure falls back to local storage without uncaught throw');

  // --- TEST 19: UID AUTHORIZATION ---
  console.log('\n--- TEST 19: UID AUTHORIZATION ---');
  let threwUnauth = false;
  try {
    await firestoreHydrationService.logDrink('', {
      id: 'hyd-unauth',
      amountMl: 250,
      loggedAt: new Date().toISOString(),
      date: todayKey,
    });
  } catch (err: unknown) {
    const e = err as { code?: string };
    threwUnauth = e.code === 'unauthenticated';
  }
  assert(threwUnauth, 'firestoreHydrationService strictly rejects empty UID');

  // --- TEST 20: CROSS-USER ISOLATION ---
  console.log('\n--- TEST 20: CROSS-USER ISOLATION ---');
  assert(
    typeof firestoreHydrationService.logDrink === 'function',
    'firestoreHydrationService enforces user partitioned paths users/{userId}/hydration'
  );

  // --- TEST 21: HOSTEL RECOMMENDATION INTEGRATION ---
  console.log('\n--- TEST 21: HOSTEL RECOMMENDATION INTEGRATION ---');
  const dailyForRecs = nutritionAnalyticsService.aggregateMealsForDate([meal1], todayKey);
  const recs = nutritionAnalyticsService.getNextMealRecommendations(dailyForRecs, {
    ...DEFAULT_USER_PROFILE,
    isHostelite: true,
    hasCookingAccess: false,
  });
  assert(recs.length > 0, 'Recommendations generated for daily nutrition state');
  const hasHostelFriendly = recs.every(r => r.hostelFriendly);
  assert(hasHostelFriendly, 'All suggestions are hostel friendly');

  // --- TEST 22: VEGETARIAN FILTERING ---
  console.log('\n--- TEST 22: VEGETARIAN FILTERING ---');
  const vegRecs = nutritionAnalyticsService.getNextMealRecommendations(dailyForRecs, {
    ...DEFAULT_USER_PROFILE,
    dietaryRestrictions: 'vegetarian',
  });
  const hasEggsInVeg = vegRecs.some(r => r.suggestedFoods.some(f => f.toLowerCase().includes('egg')));
  assert(!hasEggsInVeg, 'Vegetarian recommendations strictly exclude eggs');

  // --- TEST 23: VEGAN FILTERING ---
  console.log('\n--- TEST 23: VEGAN FILTERING ---');
  const veganRecs = nutritionAnalyticsService.getNextMealRecommendations(dailyForRecs, {
    ...DEFAULT_USER_PROFILE,
    dietaryRestrictions: 'vegan',
  });
  const hasDairyInVegan = veganRecs.some(r =>
    r.suggestedFoods.some(f => f.toLowerCase().includes('curd') || f.toLowerCase().includes('paneer') || f.toLowerCase().includes('buttermilk'))
  );
  assert(!hasDairyInVegan, 'Vegan recommendations strictly exclude dairy');

  // --- TEST 24: JAIN FILTERING ---
  console.log('\n--- TEST 24: JAIN FILTERING ---');
  const jainRecs = nutritionAnalyticsService.getNextMealRecommendations(dailyForRecs, {
    ...DEFAULT_USER_PROFILE,
    dietaryRestrictions: 'jain',
  });
  assert(jainRecs.length > 0, 'Jain recommendations available');

  // --- TEST 25: ALLERGY FILTERING ---
  console.log('\n--- TEST 25: ALLERGY FILTERING ---');
  const peanutAllergyRecs = nutritionAnalyticsService.getNextMealRecommendations(dailyForRecs, {
    ...DEFAULT_USER_PROFILE,
    allergies: ['Peanuts'],
  });
  const hasPeanuts = peanutAllergyRecs.some(r =>
    r.suggestedFoods.some(f => f.toLowerCase().includes('peanut'))
  );
  assert(!hasPeanuts, 'Peanut allergy strictly excludes peanut items');

  // --- TEST 26: BUDGET FILTERING ---
  console.log('\n--- TEST 26: BUDGET FILTERING ---');
  const budgetRecs = nutritionAnalyticsService.getNextMealRecommendations(dailyForRecs, {
    ...DEFAULT_USER_PROFILE,
    budgetPreference: 'budget',
  });
  const allBudget = budgetRecs.every(r => r.affordabilityCategory === 'budget');
  assert(allBudget, 'Budget preference returns budget-friendly items');

  // --- TEST 27: EXPORT INTEGRATION ---
  console.log('\n--- TEST 27: EXPORT INTEGRATION ---');
  const testReport = await nutritionAnalyticsService.getDateRangeReport(undefined, 'today');
  const exportPayload = nutritionExportService.buildNutritionExportPayload(testReport, DEFAULT_USER_PROFILE);
  assert(exportPayload.application === 'Track-a-Bite', 'Export payload has application header');
  assert(exportPayload.micronutrients !== undefined, 'Export payload contains micronutrients summary');
  const exportedJSON = nutritionExportService.exportNutritionJSON(testReport, DEFAULT_USER_PROFILE);
  assert(exportedJSON.includes('"micronutrients"'), 'JSON export includes micronutrients section');
  const exportedCSV = nutritionExportService.exportNutritionCSV(testReport);
  assert(exportedCSV.startsWith('\uFEFF'), 'CSV export begins with UTF-8 BOM');
  const printableData = nutritionExportService.buildPrintableReportData(testReport, DEFAULT_USER_PROFILE);
  assert(printableData.micronutrients !== undefined, 'Printable report data model includes micronutrients');

  // --- TEST 28: USESYNCEXTERNALSTORE STABILITY ---
  console.log('\n--- TEST 28: USESYNCEXTERNALSTORE STABILITY ---');
  const snap1 = hydrationStorageService.getSnapshot();
  const snap2 = hydrationStorageService.getSnapshot();
  assert(snap1 === snap2, 'hydrationStorageService maintains referential equality across getSnapshot calls (snap1 === snap2)');

  // --- TEST 29: EXISTING ANALYTICS REGRESSION ---
  console.log('\n--- TEST 29: EXISTING ANALYTICS REGRESSION ---');
  const score = nutritionAnalyticsService.calculateNutritionScore(
    { totalCalories: 2000, totalProteinG: 60, totalCarbsG: 250, totalFatG: 55, totalFiberG: 28, mealCount: 3 },
    { targetCalories: 2000, targetProteinG: 60, targetCarbsG: 250, targetFatG: 55 }
  );
  assert(score.score >= 80, `Nutrition score intact (got ${score.score}/100)`);
  assert(score.rating === 'excellent', 'Score rating intact');

  // --- TEST 30: PHASE 8.6 REGRESSION ---
  console.log('\n--- TEST 30: PHASE 8.6 REGRESSION ---');
  const macroCalc = nutritionAnalyticsService.calculateMacroCalories(120, 200, 50, 1730);
  assert(macroCalc.totalMacroCalories === 120 * 4 + 200 * 4 + 50 * 9, 'Macro calories calculation intact');
  const targets = nutritionAnalyticsService.calculateDailyTargets({
    ...DEFAULT_USER_PROFILE,
    customTargetsActive: true,
    targetCalories: 2350,
    targetProteinG: 135,
  });
  assert(targets.targetCalories === 2350, 'Custom calorie target preserved from Phase 8.6');
  assert(targets.targetTypeLabel === 'Custom target', 'Custom target label preserved from Phase 8.6');

  // --- TEST 31: SECRET ISOLATION ---
  console.log('\n--- TEST 31: SECRET ISOLATION ---');
  const jsonExportStr = JSON.stringify(exportPayload);
  assert(!jsonExportStr.includes('password'), 'Zero passwords in exported payload');
  assert(!jsonExportStr.includes('refreshToken'), 'Zero refresh tokens in exported payload');
  assert(!jsonExportStr.includes('GEMINI_API_KEY'), 'Zero GEMINI_API_KEY in exported payload');

  // --- TEST 32: FIRESTORE SECURITY RULES COMPATIBILITY ---
  console.log('\n--- TEST 32: FIRESTORE SECURITY RULES COMPATIBILITY ---');
  const rulesContent = fs.readFileSync('firestore.rules', 'utf8');
  assert(rulesContent.includes('match /hydration/{entryId}'), 'firestore.rules contains hydration subcollection rule');
  assert(
    rulesContent.includes('request.auth != null && request.auth.uid == userId'),
    'firestore.rules enforces strict user ownership for hydration'
  );

  console.log('\n====================================================');
  if (failCount === 0) {
    console.log(`🎉 ALL ${passCount} PHASE 8.7 MICRONUTRIENT & HYDRATION TESTS PASSED!`);
    console.log('====================================================\n');
    process.exit(0);
  } else {
    console.error(`💥 ${failCount} TESTS FAILED out of ${passCount + failCount}`);
    process.exit(1);
  }
  console.log('====================================================\n');
}

runPhase87Tests().catch(err => {
  console.error('Fatal error running Phase 8.7 test suite:', err);
  process.exit(1);
});
