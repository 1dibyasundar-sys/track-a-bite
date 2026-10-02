/**
 * Phase 6.2 Verification Suite: Intelligent Meal Composition Engine
 *
 * Verifies all required real-world tests:
 * TEST A: Rice + Dal + Curry + Papad + Pickle -> 5 separate meal components
 * TEST B: Same curry in two separate plate compartments -> 1 component with 2 source regions
 * TEST C: Two genuinely different curries -> 2 separate food components (no false merging)
 * TEST D: Same food appearing in two separated areas -> 1 normalized component
 * TEST E: Research-derived food + local foods -> clean multi-mode unified meal structure
 * TEST F: Completely unknown/ambiguous food -> preserved as separate component without forced grouping
 * Cultural Guard Tests: Sambar != Dal Tadka, Palak Paneer != Mixed Veg Curry
 */

import { mealCompositionService } from '../src/lib/services/mealCompositionService';
import { foodNormalizationService } from '../src/lib/services/foodNormalizationService';
import { FoodDetection } from '../src/lib/types/recognition';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${msg}`);
    throw new Error(msg);
  } else {
    console.log(`✅ [PASS] ${msg}`);
  }
}

async function runPhase62Tests() {
  console.log('====================================================');
  console.log('TRACK-A-BITE — PHASE 6.2 VERIFICATION SUITE');
  console.log('Intelligent Meal Composition Engine');
  console.log('====================================================\n');

  // -------------------------------------------------------------------------
  // SECTION 1: FOOD IDENTITY NORMALIZATION & CULTURAL GUARDS
  // -------------------------------------------------------------------------
  console.log('--- SECTION 1: NORMALIZATION & CULTURAL GUARDS ---');
  
  // Roti / Chapati / Phulka equivalence
  const normRoti1 = foodNormalizationService.normalize('Whole Wheat Roti');
  const normRoti2 = foodNormalizationService.normalize('Chapati');
  const normRoti3 = foodNormalizationService.normalize('Phulka');
  assert(normRoti1.normalizedName === 'Whole Wheat Roti', 'Whole Wheat Roti normalized');
  assert(normRoti2.normalizedName === 'Whole Wheat Roti', 'Chapati normalized to Whole Wheat Roti');
  assert(normRoti3.normalizedName === 'Whole Wheat Roti', 'Phulka normalized to Whole Wheat Roti');
  assert(
    foodNormalizationService.areSameFoodIdentity(
      { name: 'Chapati', foodId: 'whole-wheat-roti' },
      { name: 'Phulka', foodId: 'whole-wheat-roti' }
    ),
    'Chapati and Phulka recognized as same food identity'
  );

  // Cultural distinction guard: Sambar != Dal Tadka
  const isSambarSameAsDal = foodNormalizationService.areSameFoodIdentity(
    { name: 'South Indian Sambar', foodId: 'sambar' },
    { name: 'Dal Tadka', foodId: 'dal-tadka' }
  );
  assert(!isSambarSameAsDal, 'Cultural guard: Sambar is NEVER merged with Dal Tadka');

  // Cultural distinction guard: Paneer Curry != Mixed Veg Curry
  const isPaneerSameAsVeg = foodNormalizationService.areSameFoodIdentity(
    { name: 'Palak Paneer', foodId: 'palak-paneer' },
    { name: 'Mixed Vegetable Curry', foodId: 'vegetable-curry' }
  );
  assert(!isPaneerSameAsVeg, 'Cultural guard: Palak Paneer is NEVER merged with Mixed Vegetable Curry');

  // -------------------------------------------------------------------------
  // TEST A: RICE + DAL + CURRY + PAPAD + PICKLE (5 separate components)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST A: RICE + DAL + CURRY + PAPAD + PICKLE ---');
  const detectionsA: FoodDetection[] = [
    {
      id: 'det-rice',
      foodId: 'steamed-rice',
      name: 'Steamed Rice',
      confidence: 0.94,
      confidenceTier: 'high',
      estimatedPortion: { quantity: 180, unit: 'g', confidence: 0.9, rawGramsEquivalent: 180 },
      source: 'vision-model',
      identificationMode: 'local',
    },
    {
      id: 'det-dal',
      foodId: 'dal-tadka',
      name: 'Dal Tadka',
      confidence: 0.91,
      confidenceTier: 'high',
      estimatedPortion: { quantity: 150, unit: 'g', confidence: 0.88, rawGramsEquivalent: 150 },
      source: 'vision-model',
      identificationMode: 'local',
    },
    {
      id: 'det-curry',
      foodId: 'vegetable-curry',
      name: 'Mixed Vegetable Curry',
      confidence: 0.88,
      confidenceTier: 'high',
      estimatedPortion: { quantity: 150, unit: 'g', confidence: 0.86, rawGramsEquivalent: 150 },
      source: 'vision-model',
      identificationMode: 'local',
    },
    {
      id: 'det-papad',
      foodId: 'roasted-papad',
      name: 'Roasted Papad',
      confidence: 0.95,
      confidenceTier: 'high',
      estimatedPortion: { quantity: 1, unit: 'piece', confidence: 0.92, rawGramsEquivalent: 15 },
      source: 'vision-model',
      identificationMode: 'local',
    },
    {
      id: 'det-pickle',
      foodId: 'mango-pickle',
      name: 'Mango Pickle',
      confidence: 0.90,
      confidenceTier: 'high',
      estimatedPortion: { quantity: 15, unit: 'g', confidence: 0.88, rawGramsEquivalent: 15 },
      source: 'vision-model',
      identificationMode: 'local',
    },
  ];

  const mealA = mealCompositionService.composeMeal(detectionsA, 'img-meal-a');
  assert(mealA.totalComponents === 5, 'Meal A has exactly 5 distinct components');
  assert(mealA.totalRegions === 5, 'Meal A has 5 source regions');
  assert(mealA.components.some(c => c.normalizedName === 'Steamed Rice'), 'Contains Steamed Rice');
  assert(mealA.components.some(c => c.normalizedName === 'Dal Tadka'), 'Contains Dal Tadka');
  assert(mealA.components.some(c => c.normalizedName === 'Mixed Vegetable Curry'), 'Contains Mixed Vegetable Curry');
  assert(mealA.components.some(c => c.normalizedName === 'Roasted Papad'), 'Contains Roasted Papad');
  assert(mealA.components.some(c => c.normalizedName === 'Mango Pickle'), 'Contains Mango Pickle');

  // -------------------------------------------------------------------------
  // TEST B: SAME CURRY IN TWO SEPARATE PLATE COMPARTMENTS
  // -------------------------------------------------------------------------
  console.log('\n--- TEST B: SAME CURRY IN TWO COMPARTMENTS ---');
  const detectionsB: FoodDetection[] = [
    {
      id: 'det-curry-1',
      foodId: 'vegetable-curry',
      name: 'Mixed Vegetable Curry',
      confidence: 0.88,
      confidenceTier: 'high',
      estimatedPortion: { quantity: 80, unit: 'g', confidence: 0.85, rawGramsEquivalent: 80 },
      source: 'vision-model',
      identificationMode: 'local',
      boundingBox: { x: 10, y: 10, width: 25, height: 25 },
    },
    {
      id: 'det-curry-2',
      foodId: 'vegetable-curry',
      name: 'Mixed Vegetable Curry',
      confidence: 0.86,
      confidenceTier: 'high',
      estimatedPortion: { quantity: 70, unit: 'g', confidence: 0.84, rawGramsEquivalent: 70 },
      source: 'vision-model',
      identificationMode: 'local',
      boundingBox: { x: 45, y: 10, width: 25, height: 25 },
    },
  ];

  const mealB = mealCompositionService.composeMeal(detectionsB, 'img-meal-b');
  assert(mealB.totalComponents === 1, 'Two curry compartments consolidated into ONE Curry component');
  assert(mealB.totalRegions === 2, 'Total regions recorded is 2');
  const curryComp = mealB.components[0];
  assert(curryComp.totalRegions === 2, 'Curry component totalRegions is 2');
  assert(curryComp.regionIds.length === 2, 'Curry component contains 2 region IDs');
  assert(curryComp.portion.estimatedGrams === 150, 'Portion aggregated to 150g (80g + 70g)');
  assert(curryComp.regions[0].regionId === 'det-curry-1', 'First region preserved with regionId det-curry-1');
  assert(curryComp.regions[1].regionId === 'det-curry-2', 'Second region preserved with regionId det-curry-2');
  assert(curryComp.regions[0].portion.estimatedGrams === 80, 'Region 1 portion preserved as 80g');
  assert(curryComp.regions[1].portion.estimatedGrams === 70, 'Region 2 portion preserved as 70g');

  // -------------------------------------------------------------------------
  // TEST C: TWO GENUINELY DIFFERENT CURRIES (Must NOT be merged)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST C: TWO GENUINELY DIFFERENT CURRIES ---');
  const detectionsC: FoodDetection[] = [
    {
      id: 'det-curry-c1',
      foodId: 'vegetable-curry',
      name: 'Mixed Vegetable Curry',
      confidence: 0.88,
      confidenceTier: 'high',
      estimatedPortion: { quantity: 120, unit: 'g', confidence: 0.86, rawGramsEquivalent: 120 },
      source: 'vision-model',
      identificationMode: 'local',
    },
    {
      id: 'det-curry-c2',
      foodId: 'palak-paneer',
      name: 'Palak Paneer',
      confidence: 0.92,
      confidenceTier: 'high',
      estimatedPortion: { quantity: 130, unit: 'g', confidence: 0.89, rawGramsEquivalent: 130 },
      source: 'vision-model',
      identificationMode: 'local',
    },
  ];

  const mealC = mealCompositionService.composeMeal(detectionsC, 'img-meal-c');
  assert(mealC.totalComponents === 2, 'Different curries (Veg Curry & Palak Paneer) remain TWO separate components');
  assert(mealC.components[0].normalizedName !== mealC.components[1].normalizedName, 'Different identities preserved');

  // -------------------------------------------------------------------------
  // TEST D: SAME FOOD IN TWO SEPARATED AREAS (e.g. 2 Rice Mounds or Roti)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST D: SAME FOOD IN TWO SEPARATED AREAS ---');
  const detectionsD: FoodDetection[] = [
    {
      id: 'det-roti-1',
      foodId: 'whole-wheat-roti',
      name: 'Chapati',
      confidence: 0.94,
      confidenceTier: 'high',
      estimatedPortion: { quantity: 1, unit: 'piece', confidence: 0.9, rawGramsEquivalent: 40 },
      source: 'vision-model',
      identificationMode: 'local',
    },
    {
      id: 'det-roti-2',
      foodId: 'whole-wheat-roti',
      name: 'Whole Wheat Roti',
      confidence: 0.92,
      confidenceTier: 'high',
      estimatedPortion: { quantity: 1, unit: 'piece', confidence: 0.9, rawGramsEquivalent: 40 },
      source: 'vision-model',
      identificationMode: 'local',
    },
  ];

  const mealD = mealCompositionService.composeMeal(detectionsD, 'img-meal-d');
  assert(mealD.totalComponents === 1, 'Chapati + Whole Wheat Roti consolidated into ONE component');
  assert(mealD.components[0].normalizedName === 'Whole Wheat Roti', 'Normalized to Whole Wheat Roti');
  assert(mealD.components[0].totalRegions === 2, 'Component has 2 regions');
  assert(mealD.components[0].portion.quantity === 2, 'Aggregated quantity is 2 pieces');
  assert(mealD.components[0].portion.estimatedGrams === 80, 'Aggregated weight is 80g');

  // -------------------------------------------------------------------------
  // TEST E: RESEARCH-DERIVED FOOD + LOCAL FOODS
  // -------------------------------------------------------------------------
  console.log('\n--- TEST E: RESEARCH-DERIVED FOOD + LOCAL FOODS ---');
  const detectionsE: FoodDetection[] = [
    {
      id: 'det-e-roti',
      foodId: 'whole-wheat-roti',
      name: 'Whole Wheat Roti',
      confidence: 0.95,
      confidenceTier: 'high',
      estimatedPortion: { quantity: 2, unit: 'pieces', confidence: 0.9, rawGramsEquivalent: 80 },
      source: 'vision-model',
      identificationMode: 'local',
    },
    {
      id: 'det-e-dal',
      foodId: 'dal-tadka',
      name: 'Yellow Dal Tadka',
      confidence: 0.90,
      confidenceTier: 'high',
      estimatedPortion: { quantity: 150, unit: 'g', confidence: 0.88, rawGramsEquivalent: 150 },
      source: 'vision-model',
      identificationMode: 'local',
    },
    {
      id: 'det-e-buttermilk',
      foodId: 'buttermilk',
      name: 'Buttermilk',
      confidence: 0.84,
      confidenceTier: 'medium',
      estimatedPortion: { quantity: 200, unit: 'ml', confidence: 0.85, rawGramsEquivalent: 200 },
      source: 'vision-model',
      identificationMode: 'research',
      evidence: [
        {
          type: 'web',
          uri: 'https://en.wikipedia.org/wiki/Chaas',
          title: 'Chaas - Wikipedia',
          relevance: 'Corroborating web source from Google Search grounding',
        },
      ],
    },
  ];

  const mealE = mealCompositionService.composeMeal(detectionsE, 'img-meal-e');
  assert(mealE.totalComponents === 3, 'Meal E has 3 components');
  assert(mealE.metadata.hasResearchComponents === true, 'Metadata flags hasResearchComponents: true');
  const buttermilkComp = mealE.components.find(c => c.name === 'Buttermilk')!;
  assert(buttermilkComp !== undefined, 'Buttermilk component exists');
  assert(buttermilkComp.identificationMode === 'research', 'Buttermilk identificationMode is research');
  assert(buttermilkComp.evidence !== undefined && buttermilkComp.evidence.length > 0, 'Research evidence preserved on component');
  assert(buttermilkComp.evidence![0].type === 'web', 'Web evidence preserved');
  assert(buttermilkComp.nutritionReference.isAvailable === true, 'Nutrition reference resolved for Buttermilk');

  // -------------------------------------------------------------------------
  // TEST F: COMPLETELY UNKNOWN / AMBIGUOUS FOOD (No forced grouping)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST F: COMPLETELY UNKNOWN / AMBIGUOUS FOOD ---');
  const detectionsF: FoodDetection[] = [
    {
      id: 'det-f-rice',
      foodId: 'steamed-rice',
      name: 'Steamed Rice',
      confidence: 0.94,
      confidenceTier: 'high',
      estimatedPortion: { quantity: 180, unit: 'g', confidence: 0.9, rawGramsEquivalent: 180 },
      source: 'vision-model',
      identificationMode: 'local',
    },
    {
      id: 'det-f-unknown',
      foodId: 'unmapped-food',
      name: 'Uncertain Homestyle Sabzi',
      confidence: 0.48,
      confidenceTier: 'low',
      estimatedPortion: { quantity: 100, unit: 'g', confidence: 0.5, rawGramsEquivalent: 100 },
      source: 'vision-model',
      identificationMode: 'research',
      needsConfirmation: true,
      fallbackDescription: 'Food appears to be an Indian vegetable curry, but exact dish identification is uncertain.',
    },
  ];

  const mealF = mealCompositionService.composeMeal(detectionsF, 'img-meal-f');
  assert(mealF.totalComponents === 2, 'Uncertain food is preserved as a separate component without forced grouping');
  assert(mealF.metadata.hasUncertainComponents === true, 'Metadata flags hasUncertainComponents: true');
  const uncertainComp = mealF.components.find(c => c.needsConfirmation)!;
  assert(uncertainComp !== undefined, 'Uncertain component identified');
  assert(uncertainComp.needsConfirmation === true, 'needsConfirmation is preserved');
  assert(Boolean(uncertainComp.fallbackDescription), 'Fallback description preserved');

  console.log('\n====================================================');
  console.log('✅ ALL PHASE 6.2 MEAL COMPOSITION TESTS PASSED (100%)');
  console.log('====================================================\n');
}

runPhase62Tests();
