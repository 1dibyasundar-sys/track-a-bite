/**
 * TRACK-A-BITE — PHASE 6.3 VERIFICATION SUITE
 * Intelligent Portion Estimation + Nutrition Preparation
 *
 * Verifies:
 * 1. TEST A: Multi-food plate (Rice + Dal + Curry + Papad + Pickle)
 * 2. TEST B: Multi-compartment curry portion aggregation & single nutrition calculation
 * 3. TEST C: Piece-based foods (2 Rotis + 1 Papad) without unnecessary false gram precision
 * 4. TEST D: Research-derived food (Buttermilk) retains identificationMode: 'research' with independent nutrition
 * 5. TEST E: Unknown food produces nutrition status: 'unmapped' and meal completeness: 'partial'
 * 6. TEST F: Honest uncertainty & estimation methods (never claims exact weights from 2D photos)
 * 7. TEST G: User portion correction flow (user_confirmed status & nutrition recalculation)
 */

import { mealCompositionService } from '../src/lib/services/mealCompositionService';
import { intelligentPortionService } from '../src/lib/services/intelligentPortionService';
import { FoodDetection } from '../src/lib/types/recognition';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ [PASS] ${message}`);
  }
}

console.log('====================================================');
console.log('TRACK-A-BITE — PHASE 6.3 VERIFICATION SUITE');
console.log('Intelligent Portion Estimation + Nutrition Preparation');
console.log('====================================================\n');

// ---------------------------------------------------------------------------
// TEST A: Rice + Dal + Curry + Papad + Pickle
// ---------------------------------------------------------------------------
console.log('--- TEST A: RICE + DAL + CURRY + PAPAD + PICKLE ---');

const detectionsPlateA: FoodDetection[] = [
  {
    id: 'det-rice-1',
    foodId: 'steamed-rice',
    name: 'Steamed White Rice',
    confidence: 0.94,
    confidenceTier: 'high',
    estimatedPortion: { quantity: 180, unit: 'g', confidence: 0.85, rawGramsEquivalent: 180 },
    source: 'vision-model',
    identificationMode: 'local',
    boundingBox: { x: 10, y: 10, width: 40, height: 40 },
  },
  {
    id: 'det-dal-1',
    foodId: 'dal-tadka',
    name: 'Dal Tadka',
    confidence: 0.91,
    confidenceTier: 'high',
    estimatedPortion: { quantity: 120, unit: 'ml', confidence: 0.82, rawGramsEquivalent: 150 },
    source: 'vision-model',
    identificationMode: 'local',
  },
  {
    id: 'det-curry-1',
    foodId: 'mixed-vegetable-curry',
    name: 'Mixed Vegetable Curry',
    confidence: 0.88,
    confidenceTier: 'high',
    estimatedPortion: { quantity: 1, unit: 'bowl', confidence: 0.80, rawGramsEquivalent: 150 },
    source: 'vision-model',
    identificationMode: 'local',
  },
  {
    id: 'det-papad-1',
    foodId: 'roasted-papad',
    name: 'Roasted Papad',
    confidence: 0.95,
    confidenceTier: 'high',
    estimatedPortion: { quantity: 1, unit: 'piece', confidence: 0.90, rawGramsEquivalent: 15 },
    source: 'vision-model',
    identificationMode: 'local',
  },
  {
    id: 'det-pickle-1',
    foodId: 'mango-pickle',
    name: 'Mango Pickle',
    confidence: 0.90,
    confidenceTier: 'high',
    estimatedPortion: { quantity: 1, unit: 'serving', confidence: 0.85, rawGramsEquivalent: 15 },
    source: 'vision-model',
    identificationMode: 'local',
  },
];

const mealA = mealCompositionService.composeMeal(detectionsPlateA, 'plate-a');

assert(mealA.components.length === 5, 'Meal A contains exactly 5 components');

// Verify portions per component
const compRice = mealA.components.find(c => c.foodId === 'steamed-rice')!;
const compDal = mealA.components.find(c => c.foodId === 'dal-tadka')!;
const compCurry = mealA.components.find(c => c.foodId === 'mixed-vegetable-curry')!;
const compPapad = mealA.components.find(c => c.foodId === 'roasted-papad')!;
const compPickle = mealA.components.find(c => c.foodId === 'mango-pickle')!;

assert(compRice.portion.status === 'estimated', 'Rice portion status is estimated');
assert(compRice.portion.estimatedGrams === 180, 'Rice portion is 180g');
assert(compRice.portion.estimationMethod === 'visual_area_estimate', 'Rice estimation method is visual_area_estimate');
assert(compRice.portion.formattedDisplay.includes('180g'), 'Rice portion display shows 180g');

assert(compDal.portion.estimatedGrams === 150, 'Dal portion is 150g (from 120ml density)');
assert(compDal.portion.estimationMethod === 'container_reference', 'Dal estimation method is container_reference');

assert(compCurry.portion.estimatedGrams === 150, 'Curry portion is 150g');
assert(compCurry.portion.estimationMethod === 'container_reference', 'Curry estimation method is container_reference');

assert(compPapad.portion.isPieceBased === true, 'Papad is flagged as piece-based');
assert(compPapad.portion.quantity === 1, 'Papad count is 1 piece');
assert(compPapad.portion.estimationMethod === 'piece_count_estimate', 'Papad estimation method is piece_count_estimate');

assert(compPickle.portion.estimatedGrams === 15, 'Pickle portion is 15g');
assert(compPickle.portion.unit === 'serving', 'Pickle unit is serving');

// Verify nutrition calculated per component
assert(compRice.nutrition !== undefined, 'Rice has nutrition calculated');
assert(compRice.nutrition?.calories !== null && compRice.nutrition!.calories > 200, 'Rice calories calculated (~234 kcal)');
assert(compRice.nutrition?.carbohydrates !== null && compRice.nutrition!.carbohydrates > 40, 'Rice carbs calculated');

assert(compDal.nutrition !== undefined, 'Dal has nutrition calculated');
assert(compDal.nutrition?.calories === 145, 'Dal calories match reference serving (145 kcal)');
assert(compDal.nutrition?.protein === 8.5, 'Dal protein matches reference serving (8.5g)');

// Verify total meal nutrition
assert(mealA.nutrition !== undefined, 'Meal A has overall nutrition summary');
assert(mealA.nutrition?.nutritionCompleteness === 'complete', 'Meal A nutrition completeness is complete');
assert(mealA.nutrition?.calories !== undefined && mealA.nutrition.calories > 450, `Meal A total calories calculated: ${mealA.nutrition?.calories} kcal`);
assert(mealA.nutrition?.protein !== undefined && mealA.nutrition.protein > 15, `Meal A total protein calculated: ${mealA.nutrition?.protein}g`);
console.log(`Meal A totals: ${mealA.nutrition?.calories} kcal, ${mealA.nutrition?.protein}g protein, ${mealA.nutrition?.carbohydrates}g carbs, ${mealA.nutrition?.fat}g fat`);

// ---------------------------------------------------------------------------
// TEST B: Multi-compartment Same Curry
// ---------------------------------------------------------------------------
console.log('\n--- TEST B: SAME CURRY IN TWO COMPARTMENTS ---');

const detectionsCurryMultiRegion: FoodDetection[] = [
  {
    id: 'det-curry-comp-1',
    foodId: 'mixed-vegetable-curry',
    name: 'Mixed Vegetable Curry',
    confidence: 0.88,
    confidenceTier: 'high',
    estimatedPortion: { quantity: 80, unit: 'g', confidence: 0.82, rawGramsEquivalent: 80 },
    source: 'vision-model',
    identificationMode: 'local',
  },
  {
    id: 'det-curry-comp-2',
    foodId: 'mixed-vegetable-curry',
    name: 'Mixed Vegetable Curry',
    confidence: 0.86,
    confidenceTier: 'high',
    estimatedPortion: { quantity: 70, unit: 'g', confidence: 0.80, rawGramsEquivalent: 70 },
    source: 'vision-model',
    identificationMode: 'local',
  },
];

const mealB = mealCompositionService.composeMeal(detectionsCurryMultiRegion, 'plate-b');

assert(mealB.components.length === 1, 'Two curry compartments consolidated into ONE component');
const curryB = mealB.components[0];
assert(curryB.totalRegions === 2, 'Curry records 2 source regions');
assert(curryB.regions.length === 2, 'Curry retains 2 region records');
assert(curryB.regions[0].portion.estimatedGrams === 80, 'Region 1 preserves 80g');
assert(curryB.regions[1].portion.estimatedGrams === 70, 'Region 2 preserves 70g');
assert(curryB.portion.estimatedGrams === 150, 'Total aggregated curry portion is exactly 150g (80 + 70)');
assert(curryB.nutrition !== undefined, 'Curry has component nutrition');
assert(curryB.nutrition?.calories === 125, 'Nutrition calculated ONCE for the combined 150g portion (125 kcal)');
assert(mealB.nutrition?.calories === 125, 'Meal B total calories matches single combined curry (125 kcal)');

// ---------------------------------------------------------------------------
// TEST C: Piece-Based Foods (2 Rotis + 1 Papad)
// ---------------------------------------------------------------------------
console.log('\n--- TEST C: PIECE-BASED MEAL (2 ROTIS + 1 PAPAD) ---');

const detectionsPieceBased: FoodDetection[] = [
  {
    id: 'det-roti-1',
    foodId: 'whole-wheat-roti',
    name: 'Whole Wheat Roti',
    confidence: 0.95,
    confidenceTier: 'high',
    estimatedPortion: { quantity: 2, unit: 'piece', confidence: 0.90, rawGramsEquivalent: 80 },
    source: 'vision-model',
    identificationMode: 'local',
    visualNotes: '2 freshly made wheat rotis',
  },
  {
    id: 'det-papad-1',
    foodId: 'roasted-papad',
    name: 'Roasted Papad',
    confidence: 0.94,
    confidenceTier: 'high',
    estimatedPortion: { quantity: 1, unit: 'piece', confidence: 0.92, rawGramsEquivalent: 15 },
    source: 'vision-model',
    identificationMode: 'local',
  },
];

const mealC = mealCompositionService.composeMeal(detectionsPieceBased, 'plate-c');

assert(mealC.components.length === 2, 'Meal C has 2 components');
const rotiC = mealC.components.find(c => c.foodId === 'whole-wheat-roti')!;
const papadC = mealC.components.find(c => c.foodId === 'roasted-papad')!;

assert(rotiC.portion.isPieceBased === true, 'Roti is piece-based');
assert(rotiC.portion.quantity === 2, 'Roti quantity is 2 pieces');
assert(rotiC.portion.unit === 'piece', 'Roti unit is piece');
assert(rotiC.portion.formattedDisplay.includes('2 pieces'), 'Roti formatted display shows "2 pieces (≈ 80g)"');
assert(rotiC.portion.estimationMethod === 'piece_count_estimate', 'Roti uses piece_count_estimate');
assert(rotiC.nutrition?.calories === 140, '2 Rotis nutrition is 140 kcal (standard 2-piece serving in catalog)');
assert(rotiC.nutrition?.protein === 4.8, '2 Rotis protein is 4.8g');

assert(papadC.portion.isPieceBased === true, 'Papad is piece-based');
assert(papadC.portion.quantity === 1, 'Papad quantity is 1 piece');
assert(papadC.portion.formattedDisplay.includes('1 piece'), 'Papad display shows "1 piece (≈ 15g)"');
assert(papadC.nutrition?.calories === 48, '1 Papad nutrition is 48 kcal');

// ---------------------------------------------------------------------------
// TEST D: Research-Derived Food (Roti + Dal + Buttermilk)
// ---------------------------------------------------------------------------
console.log('\n--- TEST D: RESEARCH-DERIVED FOOD + LOCAL FOODS ---');

const detectionsResearchMeal: FoodDetection[] = [
  {
    id: 'det-roti-local',
    foodId: 'whole-wheat-roti',
    name: 'Whole Wheat Roti',
    confidence: 0.95,
    confidenceTier: 'high',
    estimatedPortion: { quantity: 2, unit: 'piece', confidence: 0.90, rawGramsEquivalent: 80 },
    source: 'vision-model',
    identificationMode: 'local',
  },
  {
    id: 'det-dal-local',
    foodId: 'dal-tadka',
    name: 'Dal Tadka',
    confidence: 0.92,
    confidenceTier: 'high',
    estimatedPortion: { quantity: 120, unit: 'ml', confidence: 0.85, rawGramsEquivalent: 150 },
    source: 'vision-model',
    identificationMode: 'local',
  },
  {
    id: 'det-buttermilk-research',
    foodId: 'buttermilk',
    name: 'Chaas / Spiced Buttermilk',
    confidence: 0.84,
    confidenceTier: 'high',
    estimatedPortion: { quantity: 200, unit: 'ml', confidence: 0.80, rawGramsEquivalent: 200 },
    source: 'vision-model',
    identificationMode: 'research', // Research derived
    evidence: [
      { type: 'web', title: 'Indian spiced buttermilk recipe', uri: 'https://example.com/chaas' },
    ],
  },
];

const mealD = mealCompositionService.composeMeal(detectionsResearchMeal, 'plate-d');

assert(mealD.components.length === 3, 'Meal D has 3 components');
assert(mealD.metadata.hasResearchComponents === true, 'Metadata flags hasResearchComponents');

const buttermilkComp = mealD.components.find(c => c.foodId === 'buttermilk')!;
assert(buttermilkComp !== undefined, 'Buttermilk component exists');
assert(buttermilkComp.identificationMode === 'research', 'Buttermilk preserves identificationMode: research');
assert(buttermilkComp.nutritionReference.source === 'regional_reference', 'Buttermilk links regional ICMR-NIN reference');
assert(buttermilkComp.nutrition !== undefined, 'Buttermilk has nutrition computed');
assert(buttermilkComp.nutrition?.calories === 40, 'Buttermilk calories scaled to 40 kcal (200ml serving)');
assert(buttermilkComp.nutrition?.status === 'estimated_fallback', 'Nutrition status is estimated_fallback');
assert(buttermilkComp.identificationMode === 'research', 'identificationMode NOT downgraded by nutrition');

// ---------------------------------------------------------------------------
// TEST E: Unknown Food with No Nutrition Reference
// ---------------------------------------------------------------------------
console.log('\n--- TEST E: UNKNOWN FOOD WITH NO NUTRITION REFERENCE ---');

const detectionsUnknownFood: FoodDetection[] = [
  {
    id: 'det-rice-known',
    foodId: 'steamed-rice',
    name: 'Steamed Rice',
    confidence: 0.94,
    confidenceTier: 'high',
    estimatedPortion: { quantity: 180, unit: 'g', confidence: 0.85, rawGramsEquivalent: 180 },
    source: 'vision-model',
    identificationMode: 'local',
  },
  {
    id: 'det-mystery-dish',
    foodId: 'err-unidentified-dish',
    name: 'Unidentified Herbal Preparation',
    confidence: 0.45,
    confidenceTier: 'low',
    estimatedPortion: { quantity: 0, unit: 'serving', confidence: 0.30, rawGramsEquivalent: 0 },
    source: 'vision-model',
    identificationMode: 'research',
    needsConfirmation: true,
  },
];

const mealE = mealCompositionService.composeMeal(detectionsUnknownFood, 'plate-e');

assert(mealE.components.length === 2, 'Meal E contains 2 components');
const mysteryComp = mealE.components.find(c => c.foodId === 'err-unidentified-dish')!;
assert(mysteryComp.nutritionReference.isAvailable === false, 'Mystery dish nutrition reference is unavailable');
assert(mysteryComp.nutrition?.status === 'unmapped', 'Mystery dish nutrition status is unmapped');
assert(mysteryComp.nutrition?.calories === null, 'Mystery dish calories is null (not fabricated)');
assert(mysteryComp.portion.status === 'pending', 'Mystery dish portion status is pending');
assert(mysteryComp.portion.estimationMethod === 'unavailable', 'Mystery dish estimation method is unavailable');

// Check meal-level nutrition completeness
assert(mealE.nutrition !== undefined, 'Meal E nutrition exists');
assert(mealE.nutrition?.nutritionCompleteness === 'partial', 'Meal nutritionCompleteness is "partial"');
assert(mealE.nutrition?.status === 'partial', 'Meal nutrition status is "partial"');
assert(mealE.nutrition?.missingNutritionFoods?.includes('Unidentified Herbal Preparation') === true, 'Missing nutrition foods lists the unidentified dish');
assert(mealE.nutrition?.disclaimer.includes('partial'), 'Disclaimer honestly notes partial completeness');
console.log(`Meal E disclaimer: "${mealE.nutrition?.disclaimer}"`);

// ---------------------------------------------------------------------------
// TEST F: Honest Uncertainty & Non-Photographic Exactness
// ---------------------------------------------------------------------------
console.log('\n--- TEST F: HONEST UNCERTAINTY & APPROXIMATIONS ---');

assert(compRice.portion.formattedDisplay.startsWith('≈'), 'Rice portion display starts with ≈');
assert(compRice.nutrition?.formattedCalories.startsWith('≈'), 'Rice calories display starts with ≈');
assert(compRice.portion.uncertaintyRange !== undefined, 'Rice portion includes uncertainty range');
assert(compRice.portion.uncertaintyRange!.minGrams < 180 && compRice.portion.uncertaintyRange!.maxGrams > 180, 'Uncertainty range spans around 180g');

// ---------------------------------------------------------------------------
// TEST G: User Portion Correction Flow
// ---------------------------------------------------------------------------
console.log('\n--- TEST G: USER PORTION CORRECTION FLOW ---');

const originalRicePortion = compRice.portion;
const updatedRicePortion = intelligentPortionService.applyUserPortionCorrection(
  originalRicePortion,
  250, // user adjusted to 250g
  'g',
  250
);

assert(updatedRicePortion.userConfirmed === true, 'userConfirmed is set to true');
assert(updatedRicePortion.status === 'confirmed', 'status is confirmed');
assert(updatedRicePortion.estimationMethod === 'user_confirmed', 'estimationMethod is user_confirmed');
assert(updatedRicePortion.estimatedGrams === 250, 'estimatedGrams updated to 250');
assert(updatedRicePortion.formattedDisplay === '250g', 'Formatted display shows exact user confirmed 250g');

// Recalculate nutrition with confirmed portion
const updatedRiceComp = {
  ...compRice,
  portion: updatedRicePortion,
};
const updatedNutrition = intelligentPortionService.calculateComponentNutrition(updatedRiceComp);
assert(updatedNutrition.isApproximate === false, 'User confirmed nutrition is no longer flagged as approximate');
assert(updatedNutrition.calories !== null && updatedNutrition.calories > compRice.nutrition!.calories!, `Calories scaled up from ${compRice.nutrition!.calories} to ${updatedNutrition.calories} kcal`);
console.log(`User confirmed rice nutrition: ${updatedNutrition.calories} kcal (${updatedNutrition.formattedCalories})`);

console.log('\n====================================================');
console.log('✅ ALL PHASE 6.3 TESTS PASSED (100%)');
console.log('====================================================\n');
