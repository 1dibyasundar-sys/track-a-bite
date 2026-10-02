/**
 * TRACK-A-BITE — PHASE 6.4 VERIFICATION SUITE
 * Personalized Nutrition Analysis + 5-Star Score + Hostel Recommendations
 *
 * Verifies:
 * - TEST A: Balanced meal -> High score
 * - TEST B: Rice-heavy meal -> Carbohydrate imbalance detected
 * - TEST C: Protein-light hostel meal -> Protein gap + hostel-friendly recommendations
 * - TEST D: Chips + packaged juice -> Lower score, NO food shaming
 * - TEST E: Traditional / local meal -> Not penalized for being regional
 * - TEST F: Hostelite = true -> Hostel recommendations prioritized
 * - TEST G: Hostelite = false -> Normal recommendation ranking
 * - TEST H: Missing profile -> General analysis works, personalization marked unavailable
 * - TEST I: Health condition present -> Conservative guidance, health disclaimer, NO diagnosis
 * - TEST J: Unknown nutrition component -> Analysis confidence reduced, completeness respected
 * - TEST K: Deterministic scoring -> Identical inputs produce identical outputs
 */

import { mealCompositionService } from '../src/lib/services/mealCompositionService';
import { nutritionAnalysisService } from '../src/lib/services/nutritionAnalysisService';
import { FoodDetection } from '../src/lib/types/recognition';
import { UserProfile } from '../src/lib/types/profile';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ [PASS] ${message}`);
  }
}

console.log('====================================================');
console.log('TRACK-A-BITE — PHASE 6.4 VERIFICATION SUITE');
console.log('Personalized Nutrition Analysis + 5-Star Score + Hostel');
console.log('====================================================\n');

const standardStudentProfile: UserProfile = {
  age: 20,
  heightCm: 172,
  weightKg: 64,
  gender: 'male',
  activityLevel: 'moderately_active',
  isHostelite: true,
  healthConditions: ['None'],
  onboardingCompleted: true,
};

// ---------------------------------------------------------------------------
// TEST A: Balanced meal -> High score
// ---------------------------------------------------------------------------
console.log('--- TEST A: BALANCED MEAL (ROTI + DAL + VEG CURRY + CURD) ---');

const detectionsBalanced: FoodDetection[] = [
  {
    id: 'det-roti',
    foodId: 'whole-wheat-roti',
    name: 'Whole Wheat Roti',
    confidence: 0.95,
    confidenceTier: 'high',
    estimatedPortion: { quantity: 2, unit: 'piece', confidence: 0.9, rawGramsEquivalent: 60 },
    source: 'vision-model',
    identificationMode: 'local',
  },
  {
    id: 'det-dal',
    foodId: 'dal-tadka',
    name: 'Dal Tadka',
    confidence: 0.92,
    confidenceTier: 'high',
    estimatedPortion: { quantity: 1, unit: 'katori', confidence: 0.88, rawGramsEquivalent: 150 },
    source: 'vision-model',
    identificationMode: 'local',
  },
  {
    id: 'det-curry',
    foodId: 'vegetable-curry',
    name: 'Mixed Vegetable Curry',
    confidence: 0.89,
    confidenceTier: 'high',
    estimatedPortion: { quantity: 1, unit: 'katori', confidence: 0.85, rawGramsEquivalent: 150 },
    source: 'vision-model',
    identificationMode: 'local',
  },
  {
    id: 'det-curd',
    foodId: 'fresh-curd',
    name: 'Fresh Curd',
    confidence: 0.94,
    confidenceTier: 'high',
    estimatedPortion: { quantity: 1, unit: 'katori', confidence: 0.9, rawGramsEquivalent: 120 },
    source: 'vision-model',
    identificationMode: 'local',
  },
];

const mealA = mealCompositionService.composeMeal(detectionsBalanced, 'meal-test-a', standardStudentProfile, 'lunch');

console.log(`Meal A Score: ${mealA.analysis?.overallScore} / 5 (${mealA.analysis?.starDisplay})`);
console.log(`Meal A Summary: "${mealA.analysis?.summary}"`);
console.log(`Meal A Calories: ${mealA.nutrition?.calories} kcal, Protein: ${mealA.nutrition?.protein}g, Fiber: ${mealA.nutrition?.fiber}g`);

assert(Boolean(mealA.analysis), 'TEST A: analysis object is present in StructuredMeal');
assert((mealA.analysis?.overallScore ?? 0) >= 4.0, `TEST A: Balanced meal achieves high score >= 4.0 (got ${mealA.analysis?.overallScore})`);
assert(mealA.analysis?.dimensions.protein.status === 'good', 'TEST A: Protein dimension is rated good');
assert(mealA.analysis?.dimensions.mealBalance.status === 'good', 'TEST A: Meal balance variety is rated good');

// ---------------------------------------------------------------------------
// TEST B: Rice-heavy meal -> Carbohydrate imbalance detected
// ---------------------------------------------------------------------------
console.log('\n--- TEST B: RICE-HEAVY MEAL (LARGE RICE WITH TINY SIDE) ---');

const detectionsRiceHeavy: FoodDetection[] = [
  {
    id: 'det-huge-rice',
    foodId: 'steamed-rice',
    name: 'Steamed White Rice',
    confidence: 0.96,
    confidenceTier: 'high',
    estimatedPortion: { quantity: 350, unit: 'g', confidence: 0.9, rawGramsEquivalent: 350 },
    source: 'vision-model',
    identificationMode: 'local',
  },
];

const mealB = mealCompositionService.composeMeal(detectionsRiceHeavy, 'meal-test-b', standardStudentProfile, 'lunch');

console.log(`Meal B Carbs: ${mealB.nutrition?.carbohydrates}g, Calories: ${mealB.nutrition?.calories} kcal`);
console.log(`Meal B Imbalances: ${JSON.stringify(mealB.analysis?.imbalances)}`);
console.log(`Meal B Carb Status: ${mealB.analysis?.dimensions.carbohydrates.status} (${mealB.analysis?.dimensions.carbohydrates.label})`);

assert(
  mealB.analysis?.imbalances.includes('relatively_high_carbs') ||
    mealB.analysis?.dimensions.carbohydrates.status === 'relatively_high',
  'TEST B: Carbohydrate imbalance correctly detected for rice-heavy meal'
);
assert(
  !mealB.analysis?.summary.toLowerCase().includes('bad') &&
    !mealB.analysis?.summary.toLowerCase().includes('junk'),
  'TEST B: No food-shaming terms used in carb-heavy summary'
);

// ---------------------------------------------------------------------------
// TEST C: Protein-light hostel meal -> Protein gap + hostel recommendations
// ---------------------------------------------------------------------------
console.log('\n--- TEST C: PROTEIN-LIGHT HOSTEL MEAL (WHITE RICE ALONE) ---');

const mealC = mealCompositionService.composeMeal(
  [
    {
      id: 'det-plain-rice',
      foodId: 'steamed-rice',
      name: 'Steamed White Rice',
      confidence: 0.93,
      confidenceTier: 'high',
      estimatedPortion: { quantity: 150, unit: 'g', confidence: 0.88, rawGramsEquivalent: 150 },
      source: 'vision-model',
      identificationMode: 'local',
    },
  ],
  'meal-test-c',
  standardStudentProfile,
  'dinner'
);

console.log(`Meal C Protein: ${mealC.nutrition?.protein}g`);
console.log(`Meal C Gaps: ${JSON.stringify(mealC.analysis?.gaps)}`);
console.log(`Meal C Primary Rec: ${mealC.analysis?.primaryRecommendation?.food} (Best for: ${mealC.analysis?.primaryRecommendation?.bestFor})`);

assert(Boolean(mealC.analysis?.gaps.includes('protein')), 'TEST C: Protein gap correctly detected');
assert((mealC.analysis?.dimensions.protein.score ?? 5) <= 3, 'TEST C: Protein score reflects gap (<= 3)');
assert(Boolean(mealC.analysis?.primaryRecommendation?.hostelFriendly), 'TEST C: Primary recommendation is hostel-friendly');

// ---------------------------------------------------------------------------
// TEST D: Chips + Packaged Juice -> Lower score, NO food shaming
// ---------------------------------------------------------------------------
console.log('\n--- TEST D: CHIPS + PACKAGED JUICE (NO FOOD SHAMING) ---');

const detectionsSnack: FoodDetection[] = [
  {
    id: 'det-chips',
    foodId: 'potato-chips',
    name: 'Packaged Potato Chips',
    confidence: 0.95,
    confidenceTier: 'high',
    estimatedPortion: { quantity: 1, unit: 'packet', confidence: 0.95, rawGramsEquivalent: 30 },
    source: 'vision-model',
    identificationMode: 'local',
  },
  {
    id: 'det-juice',
    foodId: 'packaged-juice',
    name: 'Packaged Fruit Juice',
    confidence: 0.92,
    confidenceTier: 'high',
    estimatedPortion: { quantity: 1, unit: 'ml', confidence: 0.95, rawGramsEquivalent: 200 },
    source: 'vision-model',
    identificationMode: 'local',
  },
];

const mealD = mealCompositionService.composeMeal(detectionsSnack, 'meal-test-d', standardStudentProfile, 'snack');

console.log(`Meal D Score: ${mealD.analysis?.overallScore} / 5`);
console.log(`Meal D Summary: "${mealD.analysis?.summary}"`);

assert(
  (mealD.analysis?.overallScore ?? 0) <= 3.5,
  `TEST D: Score reflects lower nutrient density (<= 3.5, got ${mealD.analysis?.overallScore})`
);
const summaryLower = (mealD.analysis?.summary || '').toLowerCase();
const bannedTerms = ['bad food', 'junk person', 'unhealthy person', 'you shouldn\'t eat this', 'forbidden', 'guilt'];
for (const term of bannedTerms) {
  assert(!summaryLower.includes(term), `TEST D: Banned judgmental phrase "${term}" is absent`);
}
assert(
  summaryLower.includes('balance') || summaryLower.includes('energy') || summaryLower.includes('sprouts'),
  'TEST D: Constructive, supportive guidance is provided'
);

// ---------------------------------------------------------------------------
// TEST E: Traditional / Regional meal -> Not penalized for being regional
// ---------------------------------------------------------------------------
console.log('\n--- TEST E: TRADITIONAL / REGIONAL MEAL (PAKHALA BHATA + DALMA) ---');

const detectionsRegional: FoodDetection[] = [
  {
    id: 'det-pakhala',
    foodId: 'pakhala-bhata',
    name: 'Pakhala Bhata',
    confidence: 0.91,
    confidenceTier: 'high',
    estimatedPortion: { quantity: 1, unit: 'bowl', confidence: 0.88, rawGramsEquivalent: 300 },
    source: 'vision-model',
    identificationMode: 'research',
  },
  {
    id: 'det-dalma',
    foodId: 'dalma',
    name: 'Odia Dalma',
    confidence: 0.9,
    confidenceTier: 'high',
    estimatedPortion: { quantity: 1, unit: 'katori', confidence: 0.85, rawGramsEquivalent: 150 },
    source: 'vision-model',
    identificationMode: 'research',
  },
];

const mealE = mealCompositionService.composeMeal(detectionsRegional, 'meal-test-e', standardStudentProfile, 'lunch');

console.log(`Meal E Score: ${mealE.analysis?.overallScore} / 5 (${mealE.analysis?.starDisplay})`);
console.log(`Meal E Calories: ${mealE.nutrition?.calories} kcal, Protein: ${mealE.nutrition?.protein}g`);

assert((mealE.analysis?.overallScore ?? 0) >= 3.5, 'TEST E: Traditional meal receives healthy, fair score (>= 3.5)');
assert(
  mealE.components.some(c => c.identificationMode === 'research'),
  'TEST E: Research identification preserved for regional components'
);

// ---------------------------------------------------------------------------
// TEST F: Hostelite = true -> Hostel recommendations prioritized
// ---------------------------------------------------------------------------
console.log('\n--- TEST F: HOSTELITE = TRUE (HOSTEL RECOMMENDATIONS PRIORITIZED) ---');

const hostelProfile: UserProfile = {
  ...standardStudentProfile,
  isHostelite: true,
};

const mealF = mealCompositionService.composeMeal(detectionsRiceHeavy, 'meal-test-f', hostelProfile, 'lunch');

console.log(`Hostel Mode Active: ${mealF.analysis?.hostelModeActive}`);
console.log(`Hostel Badge: ${mealF.analysis?.hostelBadgeText}`);
console.log(`Top 3 Recs: ${mealF.analysis?.recommendations.slice(0, 3).map(r => `${r.food} (${r.availabilityNote})`).join(', ')}`);

assert(mealF.analysis?.hostelModeActive === true, 'TEST F: hostelModeActive is true');
assert(Boolean(mealF.analysis?.hostelBadgeText?.includes('HOSTEL MODE')), 'TEST F: Hostel mode badge is present');
assert(
  mealF.analysis?.recommendations.every(r => r.hostelFriendly) ?? false,
  'TEST F: All top recommendations are campus / hostel-friendly'
);

// ---------------------------------------------------------------------------
// TEST G: Hostelite = false -> Normal recommendation ranking
// ---------------------------------------------------------------------------
console.log('\n--- TEST G: HOSTELITE = FALSE (STANDARD RANKING) ---');

const dayScholarProfile: UserProfile = {
  ...standardStudentProfile,
  isHostelite: false,
};

const mealG = mealCompositionService.composeMeal(detectionsRiceHeavy, 'meal-test-g', dayScholarProfile, 'lunch');

console.log(`Hostel Mode Active: ${mealG.analysis?.hostelModeActive}`);
assert(mealG.analysis?.hostelModeActive === false, 'TEST G: hostelModeActive is false for day scholar');
assert(mealG.analysis?.hostelBadgeText === undefined, 'TEST G: No hostel badge for day scholar');

// ---------------------------------------------------------------------------
// TEST H: Missing profile -> General analysis works, personalization unavailable
// ---------------------------------------------------------------------------
console.log('\n--- TEST H: MISSING PROFILE (GRACEFUL GENERAL ANALYSIS) ---');

const mealH = mealCompositionService.composeMeal(detectionsBalanced, 'meal-test-h', null, 'meal');

console.log(`Meal H Status: ${mealH.analysis?.profileStatus}`);
console.log(`Daily Energy Status: ${mealH.analysis?.dailyEnergy?.status}`);
console.log(`Score still calculated: ${mealH.analysis?.overallScore} / 5`);

assert(Boolean(mealH.analysis), 'TEST H: Analysis does not fail when profile is missing');
assert(mealH.analysis?.dailyEnergy?.status === 'insufficient_profile', 'TEST H: Daily energy marked insufficient_profile');
assert(mealH.analysis?.profileStatus === 'standard', 'TEST H: Profile status is standard');
assert((mealH.analysis?.overallScore ?? 0) >= 4.0, 'TEST H: General 5-star score is still reliably calculated');

// ---------------------------------------------------------------------------
// TEST I: Health condition present -> Conservative guidance & NO diagnosis
// ---------------------------------------------------------------------------
console.log('\n--- TEST I: HEALTH CONDITION PRESENT (CONSERVATIVE SAFETY) ---');

const diabeticProfile: UserProfile = {
  ...standardStudentProfile,
  healthCondition: 'Diabetes / Pre-diabetes',
  healthConditions: ['Diabetes / Pre-diabetes'],
};

const mealI = mealCompositionService.composeMeal(detectionsBalanced, 'meal-test-i', diabeticProfile, 'lunch');

console.log(`Health Notice: "${mealI.analysis?.healthNotice}"`);

assert(Boolean(mealI.analysis?.healthNotice), 'TEST I: Gentle health condition notice is present');
const noticeLower = (mealI.analysis?.healthNotice || '').toLowerCase();
assert(
  noticeLower.includes('discussing personalized dietary needs with a qualified healthcare professional') ||
    noticeLower.includes('doctor') ||
    noticeLower.includes('dietitian'),
  'TEST I: Healthcare professional consultation disclaimer is included'
);
const bannedDiagTerms = ['diagnose', 'prescribe', 'cure', 'treat your diabetes', 'insulin dosage'];
for (const term of bannedDiagTerms) {
  assert(!noticeLower.includes(term), `TEST I: Medical diagnosis phrase "${term}" is strictly forbidden`);
}

// ---------------------------------------------------------------------------
// TEST J: Unknown nutrition component -> Completeness respected
// ---------------------------------------------------------------------------
console.log('\n--- TEST J: UNKNOWN NUTRITION COMPONENT (HONEST COMPLETENESS) ---');

const detectionsUnknown: FoodDetection[] = [
  {
    id: 'det-mystery',
    foodId: 'unknown-tribal-herb',
    name: 'Unknown Tribal Herb Delicacy',
    confidence: 0.55,
    confidenceTier: 'low',
    estimatedPortion: { quantity: 1, unit: 'bowl', confidence: 0.5, rawGramsEquivalent: 100 },
    source: 'vision-model',
    identificationMode: 'research',
    needsConfirmation: true,
  },
];

const mealJ = mealCompositionService.composeMeal(detectionsUnknown, 'meal-test-j', standardStudentProfile, 'meal');

console.log(`Meal J Completeness: ${mealJ.nutrition?.nutritionCompleteness}`);
console.log(`Meal J Disclaimer: "${mealJ.analysis?.disclaimer}"`);

assert(mealJ.nutrition?.nutritionCompleteness === 'unmapped' || mealJ.nutrition?.nutritionCompleteness === 'partial',
  'TEST J: Nutrition completeness correctly flagged as unmapped/partial'
);
assert(Boolean(mealJ.analysis), 'TEST J: Analysis service does not throw or crash on unknown foods');

// ---------------------------------------------------------------------------
// TEST K: Deterministic scoring -> Exact reproducible outputs
// ---------------------------------------------------------------------------
console.log('\n--- TEST K: DETERMINISTIC SCORING CHECK ---');

const run1 = nutritionAnalysisService.analyzeMeal(mealA.nutrition, mealA.components, standardStudentProfile, 'lunch');
const run2 = nutritionAnalysisService.analyzeMeal(mealA.nutrition, mealA.components, standardStudentProfile, 'lunch');

console.log(`Run 1 Score: ${run1.overallScore}, Stars: ${run1.starDisplay}`);
console.log(`Run 2 Score: ${run2.overallScore}, Stars: ${run2.starDisplay}`);

assert(run1.overallScore === run2.overallScore, 'TEST K: Scores are 100% identical');
assert(run1.starDisplay === run2.starDisplay, 'TEST K: Star displays are 100% identical');
assert(JSON.stringify(run1.dimensions) === JSON.stringify(run2.dimensions), 'TEST K: Dimension breakdowns are 100% identical');
assert(JSON.stringify(run1.gaps) === JSON.stringify(run2.gaps), 'TEST K: Nutrient gaps are 100% identical');
assert(
  JSON.stringify(run1.recommendations.map(r => r.food)) === JSON.stringify(run2.recommendations.map(r => r.food)),
  'TEST K: Recommendation ranking is 100% identical'
);

console.log('\n====================================================');
console.log('✅ ALL PHASE 6.4 VERIFICATION TESTS PASSED (100%)');
console.log('====================================================');
