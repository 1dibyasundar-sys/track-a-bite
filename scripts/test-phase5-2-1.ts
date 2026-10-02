import { groupDetectionsByFoodIdentity } from '../src/lib/services/foodGroupingService';
import { mapGeminiFoodToDatabase } from '../src/lib/server/foodMatcher';
import { FoodDatabaseService } from '../src/lib/services/foodDatabaseService';
import { NutritionService } from '../src/lib/services/nutritionService';
import { portionEstimationService } from '../src/lib/services/portionEstimationService';
import { detectionToMealItem } from '../src/lib/services/recognitionAdapter';
import { FoodDetection, getConfidenceTier } from '../src/lib/types/recognition';

const foodDb = new FoodDatabaseService();
const nutritionService = new NutritionService();

async function runPhase521Tests() {
  console.log('====================================================');
  console.log('TRACK-A-BITE — PHASE 5.2.1 VERIFICATION SUITE');
  console.log('Food Region Grouping & Multi-Compartment Correction');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
    }
  }

  // ----------------------------------------------------
  // TEST 1: CORE ARCHITECTURE - SEPARATION OF PHYSICAL REGIONS & FOOD IDENTITY
  // ----------------------------------------------------
  console.log('--- TEST 1: PHYSICAL REGIONS VS FOOD IDENTITY ---');

  const region1: FoodDetection = {
    id: 'reg-curry-1',
    foodId: 'vegetable-curry',
    name: 'Homestyle Mixed Vegetable Curry / Sabzi',
    confidence: 0.84,
    confidenceTier: getConfidenceTier(0.84),
    estimatedPortion: {
      quantity: 80,
      unit: 'g',
      confidence: 0.84,
      rawGramsEquivalent: 80,
    },
    boundingBox: { x: 10, y: 10, width: 20, height: 20 },
    source: 'vision-model',
  };

  const region2: FoodDetection = {
    id: 'reg-curry-2',
    foodId: 'vegetable-curry',
    name: 'Homestyle Mixed Vegetable Curry / Sabzi',
    confidence: 0.88,
    confidenceTier: getConfidenceTier(0.88),
    estimatedPortion: {
      quantity: 70,
      unit: 'g',
      confidence: 0.88,
      rawGramsEquivalent: 70,
    },
    boundingBox: { x: 35, y: 10, width: 20, height: 20 },
    source: 'vision-model',
  };

  const grouped = groupDetectionsByFoodIdentity([region1, region2]);

  assert(grouped.length === 1, 'Two curry regions grouped into 1 food identity (Mixed Vegetable Curry)');
  assert(grouped[0].estimatedPortion.rawGramsEquivalent === 150, 'Portions aggregated: 80g + 70g = 150g total');
  assert(grouped[0].estimatedPortion.quantity === 150 && grouped[0].estimatedPortion.unit === 'g', 'Quantity and unit aggregated cleanly (150g)');
  assert(Boolean(grouped[0].regions && grouped[0].regions.length === 2), 'Grouped item retains 2 underlying physical food regions');
  assert(grouped[0].regions![0].portion.rawGramsEquivalent === 80, 'Region 1 portion preserved (80g)');
  assert(grouped[0].regions![1].portion.rawGramsEquivalent === 70, 'Region 2 portion preserved (70g)');
  assert(grouped[0].boundingBox !== undefined, 'Bounding box encompasses constituent regions');

  // Nutrition calculated once on combined portion
  const mealItem = await detectionToMealItem(grouped[0], foodDb, nutritionService);
  const single150gResult = nutritionService.calculateNutrition(
    await foodDb.getFoodById('vegetable-curry'),
    { quantity: 150, unit: 'g', weightGrams: 150 }
  );

  assert(mealItem.estimatedGrams === 150, 'Meal item estimated grams is 150g');
  assert(mealItem.nutrition.calories === single150gResult.calories, `Nutrition calculated once: ${mealItem.nutrition.calories} kcal`);
  assert(mealItem.nutrition.protein === single150gResult.protein, `Protein calculated once: ${mealItem.nutrition.protein}g`);

  // ----------------------------------------------------
  // TEST 2: CONSERVATIVE NON-MERGING (DO NOT MERGE DIFFERENT FOODS)
  // ----------------------------------------------------
  console.log('\n--- TEST 2: CONSERVATIVE NON-MERGING ---');

  const diffFoods: FoodDetection[] = [
    {
      id: 'd1',
      foodId: 'steamed-rice',
      name: 'Steamed Rice',
      confidence: 0.95,
      confidenceTier: 'high',
      estimatedPortion: { quantity: 140, unit: 'g', confidence: 0.95, rawGramsEquivalent: 140 },
      source: 'vision-model',
    },
    {
      id: 'd2',
      foodId: 'dal-tadka',
      name: 'Dal Tadka',
      confidence: 0.90,
      confidenceTier: 'high',
      estimatedPortion: { quantity: 150, unit: 'g', confidence: 0.90, rawGramsEquivalent: 150 },
      source: 'vision-model',
    },
    {
      id: 'd3',
      foodId: 'vegetable-curry',
      name: 'Mixed Vegetable Curry',
      confidence: 0.85,
      confidenceTier: 'high',
      estimatedPortion: { quantity: 150, unit: 'g', confidence: 0.85, rawGramsEquivalent: 150 },
      source: 'vision-model',
    },
    {
      id: 'd4',
      foodId: 'aloo-curry',
      name: 'Potato Curry',
      confidence: 0.82,
      confidenceTier: 'medium',
      estimatedPortion: { quantity: 150, unit: 'g', confidence: 0.82, rawGramsEquivalent: 150 },
      source: 'vision-model',
    },
  ];

  const diffGrouped = groupDetectionsByFoodIdentity(diffFoods);
  assert(diffGrouped.length === 4, 'Different food identities are NOT merged (Rice, Dal, Veg Curry, Aloo Curry)');

  // ----------------------------------------------------
  // TEST 3: LATEST REAL-WORLD TEST IMAGE (6 REGIONS -> 5 IDENTITIES)
  // Expected: Rice, Dal, 2x Mixed Veg Curry (80g + 70g), Papad, Pickle
  // ----------------------------------------------------
  console.log('\n--- TEST 3: LATEST TEST IMAGE PIPELINE ---');

  const rawThaliVisualRegions = [
    { foodName: 'Steamed Rice', confidence: 0.94, portion: { quantity: 1.0, unit: 'serving' as const } },
    { foodName: 'Dal Tadka', confidence: 0.91, portion: { quantity: 1.0, unit: 'bowl' as const } },
    { foodName: 'Mixed Vegetable Curry', confidence: 0.86, portion: { quantity: 80, unit: 'g' as const } },
    { foodName: 'Mixed Vegetable Curry', confidence: 0.88, portion: { quantity: 70, unit: 'g' as const } },
    { foodName: 'Roasted Papad', confidence: 0.95, portion: { quantity: 1, unit: 'piece' as const } },
    { foodName: 'Mango Pickle', confidence: 0.90, portion: { quantity: 1, unit: 'serving' as const } },
  ];

  // 1. Map to food database
  const mappedDetections: FoodDetection[] = rawThaliVisualRegions.map((raw, idx) => {
    const match = mapGeminiFoodToDatabase(raw.foodName);
    const rawGramsEquivalent = portionEstimationService.calculateGrams(match.foodId, {
      quantity: raw.portion.quantity,
      unit: raw.portion.unit,
      confidence: raw.confidence,
      rawGramsEquivalent: 0,
    });
    return {
      id: `region-${idx + 1}`,
      foodId: match.foodId,
      name: match.canonicalName,
      localNameHindi: match.localNameHindi,
      confidence: raw.confidence,
      confidenceTier: getConfidenceTier(raw.confidence),
      estimatedPortion: {
        quantity: raw.portion.quantity,
        unit: raw.portion.unit,
        confidence: raw.confidence,
        rawGramsEquivalent,
      },
      source: 'vision-model',
      candidateMatches: match.candidateMatches,
    };
  });

  assert(mappedDetections.length === 6, 'Perception detected 6 physical regions');

  // 2. Group by food identity
  const consolidated = groupDetectionsByFoodIdentity(mappedDetections);
  assert(consolidated.length === 5, 'Consolidated into exactly 5 distinct food identities');

  const rice = consolidated.find(c => c.foodId === 'steamed-rice')!;
  const dal = consolidated.find(c => c.foodId === 'dal-tadka')!;
  const vegCurry = consolidated.find(c => c.foodId === 'vegetable-curry')!;
  const papad = consolidated.find(c => c.foodId === 'roasted-papad')!;
  const pickle = consolidated.find(c => c.foodId === 'mango-pickle')!;

  assert(Boolean(rice), 'Food 1: Rice present');
  assert(Boolean(dal), 'Food 2: Dal present');
  assert(Boolean(vegCurry), 'Food 3: Mixed Vegetable Curry present (combined)');
  assert(Boolean(papad), 'Food 4: Papad present');
  assert(Boolean(pickle), 'Food 5: Pickle present');

  assert(vegCurry.estimatedPortion.rawGramsEquivalent === 150, `Combined curry portion is 150g (got ${vegCurry.estimatedPortion.rawGramsEquivalent}g)`);
  assert(vegCurry.regions?.length === 2, 'Curry records both physical compartments (regions)');

  // 3. Nutrition calculation & aggregation
  const mealItems = await Promise.all(
    consolidated.map(c => detectionToMealItem(c, foodDb, nutritionService))
  );

  const curryMealItem = mealItems.find(m => m.foodId === 'vegetable-curry')!;
  assert(curryMealItem.estimatedGrams === 150, 'Curry meal item calculated on 150g');
  assert(curryMealItem.nutrition.calories === 125, `Curry nutrition matches 150g serving: ${curryMealItem.nutrition.calories} kcal`);

  const totalMealCalories = mealItems.reduce((sum, m) => sum + m.nutrition.calories, 0);
  const totalMealProtein = mealItems.reduce((sum, m) => sum + m.nutrition.protein, 0);

  // Expected nutrition: Rice (~180 kcal) + Dal (~150 kcal) + Curry 150g (~125 kcal) + Papad (~48 kcal) + Pickle (~24 kcal) = ~527 kcal
  assert(
    totalMealCalories > 480 && totalMealCalories < 580,
    `Total aggregated meal calories correct: ${totalMealCalories} kcal (Expected: Rice + Dal + Total Curry + Papad + Pickle)`
  );
  assert(
    totalMealProtein > 15,
    `Total aggregated meal protein correct: ${totalMealProtein}g`
  );

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('====================================================');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runPhase521Tests().catch(err => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
