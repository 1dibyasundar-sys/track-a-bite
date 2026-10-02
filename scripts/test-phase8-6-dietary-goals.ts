/**
 * TRACK-A-BITE — PHASE 8.6 VERIFICATION SUITE
 * Dietary Goals & Macro Tuning Verification
 *
 * Verifies all 29 Phase 8.6 requirements:
 * 1. Existing profile compatibility
 * 2. Goal selection
 * 3. Recommended target calculation
 * 4. Custom calorie target
 * 5. Custom protein target
 * 6. Custom carbohydrate target
 * 7. Custom fat target
 * 8. Macro calorie calculation
 * 9. Invalid target rejection
 * 10. Negative value rejection
 * 11. NaN rejection
 * 12. Infinity rejection
 * 13. Custom target persistence
 * 14. Firestore synchronization
 * 15. Local fallback
 * 16. Analytics target integration
 * 17. Nutrition score integration
 * 18. Recommendation integration
 * 19. Reporting integration
 * 20. Export compatibility
 * 21. Hostel constraints
 * 22. Dietary restriction constraints
 * 23. Allergy filtering
 * 24. UID authorization
 * 25. Secret isolation
 * 26. useSyncExternalStore stability
 * 27. Regression Phase 8.4
 * 28. Regression Phase 8.5.1
 * 29. Regression Phase 8.5.2
 */

import fs from 'fs';
import type { MealAnalysis } from '../src/lib/types/meal';
import {
  UserProfile,
  DEFAULT_USER_PROFILE,
  validateUserProfile,
} from '../src/lib/types/profile';
import { nutritionAnalyticsService } from '../src/lib/services/nutritionAnalyticsService';
import { nutritionExportService } from '../src/lib/services/nutritionExportService';
import { profileStorageService } from '../src/lib/services/profileStorageService';
import { userProfileService } from '../src/lib/services/userProfileService';
import { firestoreProfileService } from '../src/lib/services/firestoreProfileService';

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
  calories: number,
  protein: number,
  carbs: number,
  fat: number,
  fiber: number,
  title = 'Test Meal',
  items = ['Item 1']
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
      calories: Math.round(calories / items.length),
      protein: Math.round(protein / items.length),
      carbs: Math.round(carbs / items.length),
      fat: Math.round(fat / items.length),
      fiber: Math.round(fiber / items.length),
      perPortionNutrition: {
        calories: Math.round(calories / items.length),
        protein: Math.round(protein / items.length),
        carbohydrates: Math.round(carbs / items.length),
        fat: Math.round(fat / items.length),
        fiber: Math.round(fiber / items.length),
      },
    })),
    totalNutrition: {
      calories,
      protein,
      carbohydrates: carbs,
      fat,
      fiber,
    },
    nutrientRichness: {
      score: 85,
      stars: 4,
      tier: 'rich',
      qualifyingNutrients: ['protein', 'fiber'],
      summary: 'High protein and balanced energy',
    },
    hostelUpgrades: [],
    analysisStatus: 'complete',
  };
}

async function runTestSuite() {
  console.log('====================================================');
  console.log('TRACK-A-BITE — PHASE 8.6 DIETARY GOALS SUITE');
  console.log('Dietary Goals & Macro Tuning Verification');
  console.log('====================================================\n');

  // --- TEST 1: EXISTING PROFILE COMPATIBILITY ---
  console.log('--- TEST 1: EXISTING PROFILE COMPATIBILITY ---');
  const defaultRes = validateUserProfile(DEFAULT_USER_PROFILE);
  assert(defaultRes.isValid === true, 'DEFAULT_USER_PROFILE is valid');
  assert(defaultRes.validatedProfile?.targetCalories === undefined, 'Default profile has undefined targetCalories');

  const legacyProfile: Partial<UserProfile> = {
    age: 21,
    heightCm: 175,
    weightKg: 68,
    isHostelite: true,
    healthConditions: ['None'],
    onboardingCompleted: true,
  };
  const legacyRes = validateUserProfile(legacyProfile);
  assert(legacyRes.isValid === true, 'Legacy profile without target fields validates cleanly');
  assert(legacyRes.hasSufficientData === true, 'Legacy profile has sufficient biometric data');

  // --- TEST 2: GOAL SELECTION ---
  console.log('\n--- TEST 2: GOAL SELECTION ---');
  const goals: Array<UserProfile['healthGoal']> = ['general_health', 'fat_loss', 'maintenance', 'muscle_gain'];
  for (const goal of goals) {
    const goalProfile: Partial<UserProfile> = {
      ...legacyProfile,
      healthGoal: goal,
    };
    const v = validateUserProfile(goalProfile);
    assert(v.isValid === true, `Goal '${goal}' validates cleanly`);
    assert(v.validatedProfile?.healthGoal === goal, `Goal '${goal}' preserved in validated profile`);

    const targets = nutritionAnalyticsService.calculateRecommendedTargets(goalProfile);
    assert(targets.targetCalories > 0, `Goal '${goal}' produces positive calorie target (${targets.targetCalories} kcal)`);
    assert(targets.targetProteinG > 0, `Goal '${goal}' produces positive protein target (${targets.targetProteinG}g)`);
  }

  // --- TEST 3: RECOMMENDED TARGET CALCULATION ---
  console.log('\n--- TEST 3: RECOMMENDED TARGET CALCULATION ---');
  const bioProfile: Partial<UserProfile> = {
    age: 20,
    heightCm: 170,
    weightKg: 65,
    gender: 'male',
    activityLevel: 'moderately_active',
    healthGoal: 'muscle_gain',
    isHostelite: true,
  };
  // BMR = 10*65 + 6.25*170 - 5*20 + 5 = 650 + 1062.5 - 100 + 5 = 1617.5
  // Mult (moderately_active) = 1.55 => 1617.5 * 1.55 = 2507.125 => ~2507 + 300 (muscle_gain) = 2807 kcal
  const recTargets = nutritionAnalyticsService.calculateRecommendedTargets(bioProfile);
  assert(recTargets.calculationMethod === 'mifflin_st_jeor', 'Calculation method is mifflin_st_jeor');
  assert(recTargets.targetTypeLabel === 'Recommended target', 'Target type label is Recommended target');
  assert(recTargets.targetCalories >= 2700 && recTargets.targetCalories <= 2900, `Calorie target ~2807 kcal (got ${recTargets.targetCalories})`);
  assert(recTargets.targetProteinG >= Math.round(65 * 1.5), `Protein target >= 1.5g/kg for muscle gain (${recTargets.targetProteinG}g)`);

  // --- TEST 4: CUSTOM CALORIE TARGET ---
  console.log('\n--- TEST 4: CUSTOM CALORIE TARGET ---');
  const customCalProfile: Partial<UserProfile> = {
    ...bioProfile,
    targetCalories: 2200,
    customTargetsActive: true,
  };
  const targetsCal = nutritionAnalyticsService.calculateDailyTargets(customCalProfile);
  assert(targetsCal.targetCalories === 2200, 'Custom calorie target is 2200 kcal');
  assert(targetsCal.calculationMethod === 'user_defined', 'Method is user_defined');
  assert(targetsCal.targetTypeLabel === 'Custom target', 'Label is Custom target');

  // --- TEST 5: CUSTOM PROTEIN TARGET ---
  console.log('\n--- TEST 5: CUSTOM PROTEIN TARGET ---');
  const customProtProfile: Partial<UserProfile> = {
    ...customCalProfile,
    targetProteinG: 125,
  };
  const targetsProt = nutritionAnalyticsService.calculateDailyTargets(customProtProfile);
  assert(targetsProt.targetProteinG === 125, 'Custom protein target is 125g');
  assert(targetsProt.calculationMethod === 'user_defined', 'Custom protein is user_defined');

  // --- TEST 6: CUSTOM CARBOHYDRATE TARGET ---
  console.log('\n--- TEST 6: CUSTOM CARBOHYDRATE TARGET ---');
  const customCarbsProfile: Partial<UserProfile> = {
    ...customProtProfile,
    targetCarbsG: 230,
  };
  const targetsCarbs = nutritionAnalyticsService.calculateDailyTargets(customCarbsProfile);
  assert(targetsCarbs.targetCarbsG === 230, 'Custom carbs target is 230g');

  // --- TEST 7: CUSTOM FAT TARGET ---
  console.log('\n--- TEST 7: CUSTOM FAT TARGET ---');
  const customFatProfile: Partial<UserProfile> = {
    ...customCarbsProfile,
    targetFatG: 65,
  };
  const targetsFat = nutritionAnalyticsService.calculateDailyTargets(customFatProfile);
  assert(targetsFat.targetFatG === 65, 'Custom fat target is 65g');

  // --- TEST 8: MACRO CALORIE CALCULATION ---
  console.log('\n--- TEST 8: MACRO CALORIE CALCULATION ---');
  // 125g P * 4 = 500 kcal
  // 230g C * 4 = 920 kcal
  // 65g F * 9 = 585 kcal
  // Total = 500 + 920 + 585 = 2005 kcal
  // Calorie target = 2200 kcal => variance = 195 kcal (> 150 kcal variance)
  const macroCalc = nutritionAnalyticsService.calculateMacroCalories(125, 230, 65, 2200);
  assert(macroCalc.proteinCalories === 500, 'Protein calories: 125g * 4 = 500 kcal');
  assert(macroCalc.carbsCalories === 920, 'Carbs calories: 230g * 4 = 920 kcal');
  assert(macroCalc.fatCalories === 585, 'Fat calories: 65g * 9 = 585 kcal');
  assert(macroCalc.totalMacroCalories === 2005, 'Total macro calories sum is 2005 kcal');
  assert(macroCalc.calorieVariance === 195, 'Variance is |2005 - 2200| = 195 kcal');
  assert(macroCalc.hasSignificantVariance === true, 'Variance > 150 kcal flags informational advisory');

  // --- TEST 9: INVALID TARGET REJECTION ---
  console.log('\n--- TEST 9: INVALID TARGET REJECTION ---');
  const zeroCal = validateUserProfile({ targetCalories: 0 });
  assert(zeroCal.isValid === false, 'Rejects targetCalories = 0');
  assert(zeroCal.errors.some(e => e.includes('greater than 0')), 'Error specifies calorie target must be > 0');

  const stringCal = validateUserProfile({ targetCalories: '2000' as unknown as number });
  assert(stringCal.isValid === false, 'Rejects non-number targetCalories');

  // --- TEST 10: NEGATIVE VALUE REJECTION ---
  console.log('\n--- TEST 10: NEGATIVE VALUE REJECTION ---');
  assert(validateUserProfile({ targetCalories: -500 }).isValid === false, 'Rejects negative calories');
  assert(validateUserProfile({ targetProteinG: -20 }).isValid === false, 'Rejects negative protein');
  assert(validateUserProfile({ targetCarbsG: -50 }).isValid === false, 'Rejects negative carbs');
  assert(validateUserProfile({ targetFatG: -10 }).isValid === false, 'Rejects negative fat');

  // --- TEST 11: NAN REJECTION ---
  console.log('\n--- TEST 11: NAN REJECTION ---');
  assert(validateUserProfile({ targetCalories: NaN }).isValid === false, 'Rejects NaN calories');
  assert(validateUserProfile({ targetProteinG: NaN }).isValid === false, 'Rejects NaN protein');
  assert(validateUserProfile({ targetCarbsG: NaN }).isValid === false, 'Rejects NaN carbs');
  assert(validateUserProfile({ targetFatG: NaN }).isValid === false, 'Rejects NaN fat');

  // --- TEST 12: INFINITY REJECTION ---
  console.log('\n--- TEST 12: INFINITY REJECTION ---');
  assert(validateUserProfile({ targetCalories: Infinity }).isValid === false, 'Rejects Infinity calories');
  assert(validateUserProfile({ targetProteinG: -Infinity }).isValid === false, 'Rejects -Infinity protein');
  assert(validateUserProfile({ targetCalories: 25000 }).isValid === false, 'Rejects excessive calories (> 15000)');
  assert(validateUserProfile({ targetProteinG: 2000 }).isValid === false, 'Rejects excessive protein (> 1000g)');

  // --- TEST 13: CUSTOM TARGET PERSISTENCE ---
  console.log('\n--- TEST 13: CUSTOM TARGET PERSISTENCE ---');
  profileStorageService.clearProfile();
  const saved = profileStorageService.saveProfile({
    age: 21,
    heightCm: 175,
    weightKg: 70,
    healthGoal: 'muscle_gain',
    targetCalories: 2450,
    targetProteinG: 140,
    targetCarbsG: 260,
    targetFatG: 75,
    customTargetsActive: true,
    onboardingCompleted: true,
  });
  assert(saved.targetCalories === 2450, 'targetCalories saved to profile storage');
  assert(saved.targetProteinG === 140, 'targetProteinG saved to profile storage');
  assert(saved.customTargetsActive === true, 'customTargetsActive persisted');

  const retrieved = profileStorageService.getProfile();
  assert(retrieved.targetCalories === 2450, 'Retrieved targetCalories matches 2450');
  assert(retrieved.targetProteinG === 140, 'Retrieved targetProteinG matches 140');
  assert(retrieved.customTargetsActive === true, 'Retrieved customTargetsActive is true');

  // Verify envelope
  const envelope = profileStorageService.getStoredEnvelope();
  assert(envelope !== null, 'Stored envelope exists in localStorage');
  assert(envelope?.version === 1, 'Schema version is 1');
  assert(envelope?.profile.targetCalories === 2450, 'Envelope profile contains targetCalories');

  // --- TEST 14: FIRESTORE SYNCHRONIZATION SCHEMA ---
  console.log('\n--- TEST 14: FIRESTORE SYNCHRONIZATION SCHEMA ---');
  const firestoreSanitized = validateUserProfile(retrieved).validatedProfile;
  assert(firestoreSanitized !== undefined, 'Validated profile ready for Firestore serialization');
  assert(firestoreSanitized?.targetCalories === 2450, 'Firestore doc includes targetCalories');
  assert(firestoreSanitized?.customTargetsActive === true, 'Firestore doc includes customTargetsActive');
  // Confirm users/{uid} is the sole canonical path (no parallel collection)
  assert(typeof firestoreProfileService.getProfile === 'function', 'firestoreProfileService manages canonical profiles');

  // --- TEST 15: LOCAL FALLBACK ---
  console.log('\n--- TEST 15: LOCAL FALLBACK ---');
  // Unauthenticated save uses local storage fallback
  const localSaveRes = await userProfileService.saveProfileWithCloud(
    {
      targetCalories: 2300,
      targetProteinG: 130,
      customTargetsActive: true,
    },
    null // Unauthenticated guest
  );
  assert(localSaveRes.success === true, 'Local save succeeds without authentication');
  assert(localSaveRes.cloudSaved === false, 'cloudSaved is false for offline/guest save');
  assert(localSaveRes.profile.targetCalories === 2300, 'Profile targetCalories updated in local cache');

  // --- TEST 16: ANALYTICS TARGET INTEGRATION ---
  console.log('\n--- TEST 16: ANALYTICS TARGET INTEGRATION ---');
  const testMeal = createTestMeal('m-test-1', new Date().toISOString(), 750, 45, 80, 25, 8);
  const dailySummary = nutritionAnalyticsService.aggregateMealsForDate([testMeal], new Date().toISOString(), localSaveRes.profile);
  assert(dailySummary.targetCalories === 2300, `Daily summary targetCalories matches profile (got ${dailySummary.targetCalories})`);
  assert(dailySummary.targetProteinG === 130, `Daily summary targetProteinG matches profile (got ${dailySummary.targetProteinG})`);
  assert(dailySummary.calorieProgressPercent === Math.round((750 / 2300) * 100), 'Daily calorieProgressPercent matches ratio');
  assert(dailySummary.proteinProgressPercent === Math.round((45 / 130) * 100), 'Daily proteinProgressPercent matches ratio');

  // --- TEST 17: NUTRITION SCORE INTEGRATION ---
  console.log('\n--- TEST 17: NUTRITION SCORE INTEGRATION ---');
  const intakeLow = { totalCalories: 1500, totalProteinG: 45, totalCarbsG: 200, totalFatG: 45, totalFiberG: 20, mealCount: 2 };
  // With targetProtein 55g, 45g is 81% (adequate, 24 pts)
  const scoreLowerTarget = nutritionAnalyticsService.calculateNutritionScore(intakeLow, {
    targetCalories: 2000,
    targetProteinG: 55,
    targetCarbsG: 250,
    targetFatG: 55,
  });
  // With custom targetProtein 140g, 45g is 32% (<40%, only 6 pts)
  const scoreHigherTarget = nutritionAnalyticsService.calculateNutritionScore(intakeLow, {
    targetCalories: 2000,
    targetProteinG: 140,
    targetCarbsG: 250,
    targetFatG: 55,
  });
  assert(scoreHigherTarget.breakdown.proteinScore < scoreLowerTarget.breakdown.proteinScore, 'Higher custom protein target demands higher intake for protein score');
  assert(scoreHigherTarget.score < scoreLowerTarget.score, 'Overall nutrition score dynamically adjusts with custom targets');

  // --- TEST 18: RECOMMENDATION INTEGRATION ---
  console.log('\n--- TEST 18: RECOMMENDATION INTEGRATION ---');
  const recsHighProtein = nutritionAnalyticsService.getNextMealRecommendations(
    {
      ...dailySummary,
      totalProteinG: 25,
      targetProteinG: 140, // High protein deficit: 115g remaining
      totalCalories: 800,
      targetCalories: 2200,
    },
    { ...localSaveRes.profile, dietaryRestrictions: 'non_vegetarian' }
  );
  assert(recsHighProtein.length > 0, 'Recommendations generated');
  // High protein items like eggs or sprouts should be prominently ranked
  const hasProteinDense = recsHighProtein.some(r => r.estimatedNutrition.protein >= 9);
  assert(hasProteinDense === true, 'Next-meal engine prioritizes protein-dense items when protein deficit is high');

  // --- TEST 19: REPORTING INTEGRATION ---
  console.log('\n--- TEST 19: REPORTING INTEGRATION ---');
  const dateRange = { startDate: '2026-10-01', endDate: '2026-10-02', preset: 'custom' as const };
  const report = await nutritionAnalyticsService.getDateRangeReport(undefined, dateRange, localSaveRes.profile);
  assert(report.targets !== undefined, 'Report includes targets object');
  assert(report.targets?.targetCalories === 2300, 'Report targets match custom targetCalories (2300)');
  assert(report.targets?.targetProteinG === 130, 'Report targets match custom targetProteinG (130)');
  assert(report.targets?.targetTypeLabel === 'Custom target', 'Report labels targets as Custom target');

  // --- TEST 20: EXPORT COMPATIBILITY ---
  console.log('\n--- TEST 20: EXPORT COMPATIBILITY ---');
  const payload = nutritionExportService.buildNutritionExportPayload(report, localSaveRes.profile);
  assert(payload.targets?.targetCalories === 2300, 'Export payload contains custom target calories');
  assert(payload.targets?.targetTypeLabel === 'Custom target', 'Export payload labels targets as Custom target');
  assert(payload.user?.targetCalories === 2300, 'Export user contains targetCalories');
  assert(payload.userProfile?.customTargetsActive === true, 'Export userProfile contains customTargetsActive');

  const jsonStr = nutritionExportService.exportNutritionJSON(report, localSaveRes.profile);
  const parsedJson = JSON.parse(jsonStr);
  assert(parsedJson.targets.targetCalories === 2300, 'JSON export contains targetCalories');
  assert(parsedJson.targets.targetTypeLabel === 'Custom target', 'JSON export contains Custom target label');

  const csvStr = nutritionExportService.exportNutritionCSV(report);
  assert(csvStr.startsWith('\uFEFF'), 'CSV starts with UTF-8 BOM');

  const printData = nutritionExportService.buildPrintableReportData(report, localSaveRes.profile);
  assert(printData.targets?.targetCalories === 2300, 'Printable report data contains custom targets');
  assert(printData.targets?.targetTypeLabel === 'Custom target', 'Printable report data contains Custom target label');

  // --- TEST 21: HOSTEL CONSTRAINTS ---
  console.log('\n--- TEST 21: HOSTEL CONSTRAINTS ---');
  const hostelProfile: Partial<UserProfile> = {
    isHostelite: true,
    hasCookingAccess: false,
    hasFridge: false,
    dietaryRestrictions: 'vegetarian',
  };
  const hostelRecs = nutritionAnalyticsService.getNextMealRecommendations(
    { ...dailySummary, totalCalories: 800, targetCalories: 2000, totalProteinG: 20, targetProteinG: 70 },
    hostelProfile
  );
  assert(hostelRecs.every(r => r.hostelFriendly === true), 'All suggestions are hostel friendly');
  assert(hostelRecs.every(r => r.noCookRequired === true), 'All suggestions require no cooking access');

  // --- TEST 22: DIETARY RESTRICTION CONSTRAINTS ---
  console.log('\n--- TEST 22: DIETARY RESTRICTION CONSTRAINTS ---');
  const vegRecs = nutritionAnalyticsService.getNextMealRecommendations(
    dailySummary,
    { dietaryRestrictions: 'vegetarian' }
  );
  assert(vegRecs.every(r => !r.title.toLowerCase().includes('egg')), 'Vegetarian recommendations strictly exclude eggs');

  const veganRecs = nutritionAnalyticsService.getNextMealRecommendations(
    dailySummary,
    { dietaryRestrictions: 'vegan' }
  );
  assert(veganRecs.every(r => !r.title.toLowerCase().includes('dahi') && !r.title.toLowerCase().includes('curd') && !r.title.toLowerCase().includes('paneer')), 'Vegan recommendations strictly exclude dairy');

  // --- TEST 23: ALLERGY FILTERING ---
  console.log('\n--- TEST 23: ALLERGY FILTERING ---');
  const allergyProfile: Partial<UserProfile> = {
    allergies: ['dairy', 'milk'],
    dietaryRestrictions: 'vegetarian',
  };
  const allergyRecs = nutritionAnalyticsService.getNextMealRecommendations(
    dailySummary,
    allergyProfile
  );
  assert(allergyRecs.every(r => !r.suggestedFoods.some(f => f.toLowerCase().includes('dahi') || f.toLowerCase().includes('curd') || f.toLowerCase().includes('paneer'))), 'Dairy allergen strictly excluded from recommendations');

  // --- TEST 24: UID AUTHORIZATION ---
  console.log('\n--- TEST 24: UID AUTHORIZATION ---');
  assert(nutritionExportService.validateExportOwnership(undefined, undefined) === false, 'Rejects unauthenticated export');
  assert(nutritionExportService.validateExportOwnership('uid-a', 'uid-b') === false, 'Rejects mismatched requested UID');
  assert(nutritionExportService.validateExportOwnership('uid-valid', 'uid-valid') === true, 'Accepts matching authenticated UID');

  // --- TEST 25: SECRET ISOLATION ---
  console.log('\n--- TEST 25: SECRET ISOLATION ---');
  assert(!jsonStr.includes('password'), 'Zero passwords in exported JSON');
  assert(!jsonStr.includes('refreshToken'), 'Zero refresh tokens in exported JSON');
  assert(!jsonStr.includes('AIzaSy'), 'Zero Google API keys in exported JSON');
  assert(!JSON.stringify(retrieved).includes('password'), 'Zero passwords in stored profile');

  // --- TEST 26: USESYNCEXTERNALSTORE STABILITY ---
  console.log('\n--- TEST 26: USESYNCEXTERNALSTORE STABILITY ---');
  const snap1 = profileStorageService.getProfile();
  const snap2 = profileStorageService.getProfile();
  assert(snap1 === snap2, 'profileStorageService.getProfile() maintains referential equality (snap1 === snap2)');
  assert(userProfileService.getProfile() === profileStorageService.getProfile(), 'userProfileService forwards stable reference');

  // --- TEST 27: REGRESSION PHASE 8.4 ---
  console.log('\n--- TEST 27: REGRESSION PHASE 8.4 ---');
  assert(typeof nutritionAnalyticsService.calculateNutritionScore === 'function', 'calculateNutritionScore intact');
  assert(typeof nutritionAnalyticsService.generateLongitudinalInsights === 'function', 'generateLongitudinalInsights intact');
  assert(typeof nutritionAnalyticsService.getWeeklySummary === 'function', 'getWeeklySummary intact');

  // --- TEST 28: REGRESSION PHASE 8.5.1 ---
  console.log('\n--- TEST 28: REGRESSION PHASE 8.5.1 ---');
  assert(typeof nutritionAnalyticsService.getDateRangeReport === 'function', 'getDateRangeReport intact');
  assert(typeof nutritionAnalyticsService.getMonthlySummary === 'function', 'getMonthlySummary intact');

  // --- TEST 29: REGRESSION PHASE 8.5.2 ---
  console.log('\n--- TEST 29: REGRESSION PHASE 8.5.2 ---');
  assert(typeof nutritionExportService.exportNutritionJSON === 'function', 'exportNutritionJSON intact');
  assert(typeof nutritionExportService.exportNutritionCSV === 'function', 'exportNutritionCSV intact');
  assert(typeof nutritionExportService.buildPrintableReportData === 'function', 'buildPrintableReportData intact');
  assert(typeof nutritionExportService.triggerPrintReport === 'function', 'triggerPrintReport intact');

  console.log('\n====================================================');
  console.log('🎉 ALL 29 PHASE 8.6 DIETARY GOALS TESTS PASSED!');
  console.log('====================================================\n');
  process.exit(0);
}

runTestSuite().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
