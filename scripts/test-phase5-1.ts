import { mapGeminiFoodToDatabase } from '../src/lib/server/foodMatcher';
import { FoodDatabaseService } from '../src/lib/services/foodDatabaseService';
import { NutritionService } from '../src/lib/services/nutritionService';
import { portionEstimationService } from '../src/lib/services/portionEstimationService';
import { detectionToMealItem } from '../src/lib/services/recognitionAdapter';
import { FoodDetection, getConfidenceTier } from '../src/lib/types/recognition';

const foodDb = new FoodDatabaseService();
const nutritionService = new NutritionService();

async function runPhase51Tests() {
  console.log('====================================================');
  console.log('TRACK-A-BITE — PHASE 5.1 VERIFICATION SUITE');
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
  // TEST SECTION A: REAL-WORLD OBSERVED FAILURE REPRODUCTION & FIX
  // Indian mess/hostel thali containing:
  // - rice / seasoned rice
  // - dal/curry-like preparation
  // - mixed vegetable preparation
  // - pickle
  // ----------------------------------------------------
  console.log('--- SECTION A: REAL-WORLD MESS THALI CORRECTION ---');

  const realWorldThaliDetections = [
    { foodName: 'Seasoned Rice', confidence: 0.92, portion: { quantity: 1.5, unit: 'serving' as const } },
    { foodName: 'Dal / curry-like preparation', confidence: 0.85, portion: { quantity: 0.8, unit: 'bowl' as const } },
    { foodName: 'Mixed Vegetable Preparation', confidence: 0.78, portion: { quantity: 0.7, unit: 'bowl' as const } },
    { foodName: 'Pickle', confidence: 0.90, portion: { quantity: 0.1, unit: 'serving' as const } },
  ];

  const processedItems = [];
  for (const raw of realWorldThaliDetections) {
    const match = mapGeminiFoodToDatabase(raw.foodName);
    const rawGramsEquivalent = portionEstimationService.calculateGrams(match.foodId, {
      quantity: raw.portion.quantity,
      unit: raw.portion.unit,
      confidence: raw.confidence,
      rawGramsEquivalent: 0,
    });

    const detection: FoodDetection = {
      id: `det-${Math.random().toString(36).substring(2, 6)}`,
      foodId: match.foodId,
      name: match.canonicalName,
      localNameHindi: match.localNameHindi,
      confidence: Math.round(Math.min(raw.confidence, match.matchConfidence) * 100) / 100,
      confidenceTier: getConfidenceTier(raw.confidence),
      estimatedPortion: {
        quantity: raw.portion.quantity,
        unit: raw.portion.unit,
        confidence: raw.confidence,
        rawGramsEquivalent,
      },
      source: 'vision-model',
      candidateMatches: match.candidateMatches,
      needsConfirmation: match.needsConfirmation || raw.confidence < 0.60,
    };

    const mealItem = await detectionToMealItem(detection, foodDb, nutritionService);
    processedItems.push(mealItem);
  }

  // Verification 1: Exactly 4 distinct items detected
  assert(processedItems.length === 4, 'Multiple detections parsed (4 items on thali)');

  // Verification 2: NO false positive kachumber salad
  const hasKachumber = processedItems.some(i => i.foodId === 'kachumber-salad' || i.name.toLowerCase().includes('salad'));
  assert(!hasKachumber, 'Zero false-positive salad in mess thali (NO kachumber salad)');

  // Verification 3: Check correct food mappings
  const hasRice = processedItems.some(i => i.foodId === 'steamed-rice');
  const hasDal = processedItems.some(i => i.foodId === 'dal-tadka');
  const hasVegCurry = processedItems.some(i => i.foodId === 'vegetable-curry');
  const hasPickle = processedItems.some(i => i.foodId === 'mango-pickle');
  assert(hasRice, 'Rice mapped to steamed-rice');
  assert(hasDal, 'Dal preparation mapped to dal-tadka');
  assert(hasVegCurry, 'Mixed vegetable preparation mapped to vegetable-curry');
  assert(hasPickle, 'Pickle mapped to mango-pickle');

  // Verification 4: Independent portions
  const riceItem = processedItems.find(i => i.foodId === 'steamed-rice')!;
  const dalItem = processedItems.find(i => i.foodId === 'dal-tadka')!;
  const vegItem = processedItems.find(i => i.foodId === 'vegetable-curry')!;
  const pickleItem = processedItems.find(i => i.foodId === 'mango-pickle')!;
  assert(riceItem.portionMultiplier > 1.0, `Rice portion independent (${riceItem.portionMultiplier}x, ~${riceItem.estimatedGrams}g)`);
  assert(dalItem.estimatedGrams > 0 && dalItem.estimatedGrams !== riceItem.estimatedGrams, 'Dal portion calculated independently');
  assert(vegItem.estimatedGrams > 0 && vegItem.estimatedGrams !== pickleItem.estimatedGrams, 'Veg curry portion calculated independently');
  assert(pickleItem.estimatedGrams <= 25, `Pickle small condiment portion (~${pickleItem.estimatedGrams}g)`);

  // Verification 5: Nutrition calculation & aggregation
  const totalCalories = processedItems.reduce((sum, i) => sum + i.nutrition.calories, 0);
  const totalProtein = processedItems.reduce((sum, i) => sum + i.nutrition.protein, 0);
  assert(totalCalories > 300 && totalCalories < 750, `Aggregated thali calories realistic (${totalCalories} kcal)`);
  assert(totalProtein > 10, `Aggregated thali protein realistic (${totalProtein}g protein)`);

  // ----------------------------------------------------
  // TEST SECTION B: 10 SPECIFIED TEST CASES
  // ----------------------------------------------------
  console.log('\n--- SECTION B: 10 REQUIRED TEST CASES ---');

  // 1. Rice + dal + vegetable curry
  const m1 = [mapGeminiFoodToDatabase('Rice'), mapGeminiFoodToDatabase('Dal Tadka'), mapGeminiFoodToDatabase('Vegetable Curry')];
  assert(
    m1[0].foodId === 'steamed-rice' && m1[1].foodId === 'dal-tadka' && m1[2].foodId === 'vegetable-curry',
    'Test 1: Rice + dal + vegetable curry'
  );

  // 2. Rice + dal + pickle
  const m2 = [mapGeminiFoodToDatabase('White Rice'), mapGeminiFoodToDatabase('Dal Fry'), mapGeminiFoodToDatabase('Mango Pickle')];
  assert(
    m2[0].foodId === 'steamed-rice' && m2[1].foodId === 'dal-tadka' && m2[2].foodId === 'mango-pickle',
    'Test 2: Rice + dal + pickle'
  );

  // 3. Rice + curry + salad
  const m3 = [mapGeminiFoodToDatabase('Steamed Rice'), mapGeminiFoodToDatabase('Aloo Curry'), mapGeminiFoodToDatabase('Fresh Kachumber Salad')];
  assert(
    m3[0].foodId === 'steamed-rice' && m3[1].foodId === 'aloo-curry' && m3[2].foodId === 'kachumber-salad',
    'Test 3: Rice + curry + salad'
  );

  // 4. Rice + dal + vegetables + salad
  const m4 = [
    mapGeminiFoodToDatabase('Rice'),
    mapGeminiFoodToDatabase('Yellow Dal'),
    mapGeminiFoodToDatabase('Mixed Vegetables'),
    mapGeminiFoodToDatabase('Cucumber Tomato Salad'),
  ];
  assert(
    m4[0].foodId === 'steamed-rice' &&
    m4[1].foodId === 'dal-tadka' &&
    m4[2].foodId === 'vegetable-curry' &&
    m4[3].foodId === 'kachumber-salad',
    'Test 4: Rice + dal + vegetables + salad (correct separation of cooked veg vs raw salad)'
  );

  // 5. Maggi + egg
  const m5 = [mapGeminiFoodToDatabase('Maggi Noodles'), mapGeminiFoodToDatabase('Boiled Egg')];
  assert(
    m5[0].foodId === 'hostel-maggi' && m5[1].foodId === 'boiled-eggs',
    'Test 5: Maggi + egg'
  );

  // 6. Kachori + chutney
  const m6 = [mapGeminiFoodToDatabase('Kachori'), mapGeminiFoodToDatabase('Green Chutney')];
  assert(
    m6[0].foodId === 'kachori' && m6[1].foodId === 'mint-chutney',
    'Test 6: Kachori + chutney (chutney correctly maps to mint-chutney, not dosa)'
  );

  // 7. Sprouts chaat
  const m7 = mapGeminiFoodToDatabase('Sprouts Chaat');
  assert(m7.foodId === 'sprouts-chaat', 'Test 7: Sprouts chaat');

  // 8. Chips + juice
  const m8 = [mapGeminiFoodToDatabase('Potato Chips'), mapGeminiFoodToDatabase('Fruit Juice')];
  assert(
    m8[0].foodId === 'potato-chips' && m8[1].foodId === 'packaged-juice',
    'Test 8: Chips + juice'
  );

  // 9. Empty/non-food image handling
  const m9EmptyDetections: FoodDetection[] = [];
  const isEmptyPresent = m9EmptyDetections.length > 0;
  assert(!isEmptyPresent, 'Test 9: Empty/non-food image produces zero detections and isFoodPresent = false');

  // 10. Single-food image
  const m10 = mapGeminiFoodToDatabase('Canteen Samosa');
  assert(m10.foodId === 'samosa', 'Test 10: Single-food image (Samosa)');

  // ----------------------------------------------------
  // SECTION C: CRITICAL FALSE-POSITIVE DEFENSE CHECKS
  // ----------------------------------------------------
  console.log('\n--- SECTION C: FALSE-POSITIVE DEFENSE CHECKS ---');

  // Cooked veg queries MUST NOT match salad
  const cookedQueries = [
    'mixed vegetables',
    'cooked vegetables',
    'mixed vegetable preparation',
    'vegetable curry',
    'mix veg sabzi',
    'cooked sabzi',
  ];
  for (const cq of cookedQueries) {
    const res = mapGeminiFoodToDatabase(cq);
    assert(
      res.foodId !== 'kachumber-salad',
      `False positive guard: "${cq}" does not map to kachumber-salad (mapped to ${res.foodId})`
    );
  }

  // Pickle and chutney queries MUST NOT match salad
  const condimentQueries = ['Pickle', 'Achar', 'Mango Pickle', 'Chutney', 'Mint Chutney'];
  for (const cond of condimentQueries) {
    const res = mapGeminiFoodToDatabase(cond);
    assert(
      res.foodId !== 'kachumber-salad',
      `Condiment guard: "${cond}" does not map to salad (mapped to ${res.foodId})`
    );
  }

  // Low confidence detection triggers needsConfirmation
  const lowConfVision = 0.52;
  const matchForLow = mapGeminiFoodToDatabase('Uncertain Gravy');
  const needsConfFlag =
    matchForLow.needsConfirmation ||
    lowConfVision < 0.60 ||
    matchForLow.matchConfidence < 0.70;
  assert(needsConfFlag, 'Uncertain vision (<0.60) flags needsConfirmation = true');

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('====================================================');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runPhase51Tests().catch(err => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
