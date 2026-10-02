import { foodDatabaseService } from '../src/lib/services/foodDatabaseService';
import { nutritionService } from '../src/lib/services/nutritionService';
import { FoodItem, PortionInput } from '../src/lib/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function runTests() {
  console.log('==================================================');
  console.log('TRACK-A-BITE PHASE 4: NUTRITION ENGINE TEST SUITE');
  console.log('==================================================\n');

  // ----------------------------------------------------------------
  // Test 1: One food - Banana
  // ----------------------------------------------------------------
  console.log('TEST 1: One food - Banana');
  const banana = await foodDatabaseService.findFoodByName('banana');
  assert(banana !== null, 'Found banana in database');
  assert(banana?.id === 'banana', `Banana ID is banana (got ${banana?.id})`);
  assert(banana?.serving.size === 1 && banana.serving.unit === 'piece', 'Banana serving is 1 piece');
  
  // 1 piece banana
  const banana1Piece = nutritionService.calculateNutrition(banana, { size: 1, unit: 'piece' });
  assert(banana1Piece.nutritionAvailable === true, 'Nutrition is available for 1 piece banana');
  assert(banana1Piece.calories === 105, `Banana 1 piece calories is 105 (got ${banana1Piece.calories})`);
  assert(banana1Piece.protein === 1.3, `Banana 1 piece protein is 1.3g (got ${banana1Piece.protein})`);
  assert(banana1Piece.carbohydrates === 27, `Banana 1 piece carbs is 27g (got ${banana1Piece.carbohydrates})`);
  assert(banana1Piece.micronutrients?.potassium === 422, `Banana 1 piece potassium is 422mg (got ${banana1Piece.micronutrients?.potassium})`);

  // 100g banana (demonstrating weight-based scaling on a piece-defined food)
  const banana100g = nutritionService.calculateNutrition(banana, { size: 100, unit: 'g' });
  assert(banana100g.calories === 89, `Banana 100g calories is 89 (got ${banana100g.calories})`);
  assert(banana100g.protein === 1.1, `Banana 100g protein is 1.1g (got ${banana100g.protein})`);
  assert(Math.abs((banana100g.micronutrients?.potassium || 0) - 358) <= 1, `Banana 100g potassium is ~358mg (got ${banana100g.micronutrients?.potassium})`);
  console.log('  Banana 1 piece nutrition:', banana1Piece);
  console.log('  Banana 100g nutrition:', banana100g);
  console.log('');

  // ----------------------------------------------------------------
  // Test 2: One food - Boiled egg
  // ----------------------------------------------------------------
  console.log('TEST 2: One food - Boiled Egg');
  const egg = (await foodDatabaseService.findFoodByAlias('boiled egg')) || (await foodDatabaseService.findFoodByName('boiled egg'));
  console.log('Egg in DB:', egg?.nutrition, egg?.serving);
  assert(egg !== null, 'Found boiled egg in database via alias/name');
  assert(egg?.id === 'boiled-eggs', 'Egg ID is boiled-eggs');
  // 1 piece egg (half of reference 2-piece serving)
  const egg1Piece = nutritionService.calculateNutrition(egg, { size: 1, unit: 'piece' });
  assert(egg1Piece.nutritionAvailable === true, 'Nutrition is available for 1 egg');
  assert(egg1Piece.calories === 72, `1 egg calories is 72 (got ${egg1Piece.calories})`);
  assert(egg1Piece.protein === 6.3, `1 egg protein is 6.3g (got ${egg1Piece.protein})`);
  assert(egg1Piece.fat === 4.9, `1 egg fat is 4.9g (got ${egg1Piece.fat})`);

  // 2 pieces egg (full reference serving)
  const egg2Pieces = nutritionService.calculateNutrition(egg, { size: 2, unit: 'piece' });
  assert(egg2Pieces.calories === 144, `2 eggs calories is 144 (got ${egg2Pieces.calories})`);
  assert(egg2Pieces.protein === 12.6, `2 eggs protein is 12.6g (got ${egg2Pieces.protein})`);
  console.log('  1 Egg nutrition:', egg1Piece);
  console.log('  2 Eggs nutrition:', egg2Pieces);
  console.log('');

  // ----------------------------------------------------------------
  // Test 3: One food - Rice
  // ----------------------------------------------------------------
  console.log('TEST 3: One food - Rice');
  const rice = (await foodDatabaseService.findFoodByName('rice')) || (await foodDatabaseService.findFoodByAlias('rice'));
  assert(rice !== null, 'Found rice in database');
  assert(rice?.serving.weightGrams === 140, 'Rice reference serving is 140g');
  // Check 140g portion (1x reference serving)
  const rice140g = nutritionService.calculateNutrition(rice, { size: 140, unit: 'g' });
  assert(rice140g.nutritionAvailable === true, 'Nutrition is available for rice');
  assert(rice140g.calories === 180, `140g Rice calories is 180 (got ${rice140g.calories})`);
  assert(rice140g.carbohydrates === 39.5, `140g Rice carbs is 39.5g (got ${rice140g.carbohydrates})`);
  assert(rice140g.protein === 3.8, `140g Rice protein is 3.8g (got ${rice140g.protein})`);
  console.log('  140g Rice nutrition:', rice140g);
  console.log('');

  // ----------------------------------------------------------------
  // Test 4: Multiple foods - Rice + Dal + Potato Curry
  // ----------------------------------------------------------------
  console.log('TEST 4: Multiple foods - Rice + Dal + Potato Curry');
  const dal = (await foodDatabaseService.findFoodByName('dal tadka')) || (await foodDatabaseService.findFoodByAlias('dal'));
  const curry = (await foodDatabaseService.findFoodByName('potato curry')) || (await foodDatabaseService.findFoodByAlias('potato curry'));
  assert(dal !== null, 'Found dal in database');
  assert(curry !== null, 'Found potato curry in database');

  const mealItems: Array<{ food: FoodItem | null; portion: PortionInput }> = [
    { food: rice!, portion: { size: 180, unit: 'g' } },
    { food: dal!, portion: { size: 120, unit: 'g' } },
    { food: curry!, portion: { size: 100, unit: 'g' } },
  ];

  const mealResult = nutritionService.calculateMealNutrition(mealItems);
  assert(mealResult.totalCalories > 0, `Total meal calories > 0: ${mealResult.totalCalories}`);
  assert(mealResult.items.length === 3, 'Meal has 3 items');
  // Verify sum matches items sum
  const sumCalories = mealResult.items.reduce((s, it) => s + it.nutrition.calories, 0);
  assert(mealResult.totalCalories === sumCalories, `Total calories (${mealResult.totalCalories}) matches items sum (${sumCalories})`);
  const sumProtein = Math.round(mealResult.items.reduce((s, it) => s + it.nutrition.protein, 0) * 10) / 10;
  assert(mealResult.totalProtein === sumProtein, `Total protein matches items sum (${sumProtein})`);
  assert(mealResult.totalFiber > 0, `Total fiber is calculated: ${mealResult.totalFiber}g`);
  assert(typeof mealResult.totalMicronutrients.iron === 'number', 'Aggregated iron is present');
  assert(typeof mealResult.totalMicronutrients.calcium === 'number', 'Aggregated calcium is present');
  console.log('  Multiple foods meal result:', {
    totalCalories: mealResult.totalCalories,
    totalProtein: mealResult.totalProtein,
    totalCarbohydrates: mealResult.totalCarbohydrates,
    totalFat: mealResult.totalFat,
    totalFiber: mealResult.totalFiber,
    micronutrients: mealResult.totalMicronutrients,
  });
  console.log('');

  // ----------------------------------------------------------------
  // Test 5: Hostel meal - Maggi + Boiled Egg
  // ----------------------------------------------------------------
  console.log('TEST 5: Hostel meal - Maggi + Boiled Egg');
  const maggi = await foodDatabaseService.findFoodByAlias('maggi');
  assert(maggi !== null, 'Found Maggi in database');
  const hostelMeal = nutritionService.calculateMealNutrition([
    { food: maggi!, portion: { size: 1, unit: 'serving' } },
    { food: egg!, portion: { size: 1, unit: 'piece' } },
  ]);
  // Maggi (310 kcal) + 1 Egg (72 kcal) = 382 kcal
  assert(hostelMeal.totalCalories === 382, `Hostel meal calories is 382 (got ${hostelMeal.totalCalories})`);
  assert(hostelMeal.totalProtein === 13.1, `Hostel meal protein is 13.1g (got ${hostelMeal.totalProtein})`);
  console.log('  Hostel meal totals:', { calories: hostelMeal.totalCalories, protein: hostelMeal.totalProtein });
  console.log('');

  // ----------------------------------------------------------------
  // Test 6: Snack - Kachori + Juice
  // ----------------------------------------------------------------
  console.log('TEST 6: Snack - Kachori + Packaged Juice');
  const kachori = await foodDatabaseService.findFoodByAlias('kachori');
  const juice = await foodDatabaseService.findFoodByAlias('packaged juice');
  assert(kachori !== null, 'Found kachori in database');
  assert(juice !== null, 'Found juice in database');
  const snackMeal = nutritionService.calculateMealNutrition([
    { food: kachori!, portion: { size: 1, unit: 'piece' } },
    { food: juice!, portion: { size: 200, unit: 'ml' } },
  ]);
  const expectedSnackCalories = kachori!.nutrition.calories + juice!.nutrition.calories;
  assert(snackMeal.totalCalories === expectedSnackCalories, `Snack calories is ${expectedSnackCalories} (got ${snackMeal.totalCalories})`);
  console.log('  Snack meal totals:', { calories: snackMeal.totalCalories, carbs: snackMeal.totalCarbohydrates, fat: snackMeal.totalFat });
  console.log('');

  // ----------------------------------------------------------------
  // Test 7: Healthy snack - Sprouts Chaat + Banana
  // ----------------------------------------------------------------
  console.log('TEST 7: Healthy snack - Sprouts Chaat + Banana');
  const sprouts = await foodDatabaseService.findFoodByAlias('sprouts chaat');
  assert(sprouts !== null, 'Found sprouts chaat in database');
  const healthySnack = nutritionService.calculateMealNutrition([
    { food: sprouts!, portion: { size: 1, unit: 'bowl' } }, // 1 bowl = 150g
    { food: banana!, portion: { size: 1, unit: 'piece' } },
  ]);
  // Sprouts 1 bowl (180g scaled from 150g ref: 174 kcal) + Banana 1 piece (105 kcal) = ~279-280 kcal
  assert(
    healthySnack.totalCalories >= 278 && healthySnack.totalCalories <= 282,
    `Healthy snack calories is ~280 (got ${healthySnack.totalCalories})`
  );
  assert(healthySnack.totalFiber >= 8, `Healthy snack has high fiber (got ${healthySnack.totalFiber}g)`);
  assert(
    (healthySnack.totalMicronutrients.vitaminC || 0) > 10,
    `Healthy snack has vitamin C (got ${healthySnack.totalMicronutrients.vitaminC}mg)`
  );
  console.log('  Healthy snack totals:', {
    calories: healthySnack.totalCalories,
    protein: healthySnack.totalProtein,
    fiber: healthySnack.totalFiber,
    vitaminC: healthySnack.totalMicronutrients.vitaminC,
  });
  console.log('');

  // ----------------------------------------------------------------
  // Test 8: Unknown food
  // ----------------------------------------------------------------
  console.log('TEST 8: Unknown food');
  const unknownResult = nutritionService.calculateNutrition(null, { size: 100, unit: 'g' });
  assert(unknownResult.nutritionAvailable === false, 'Unknown food has nutritionAvailable = false');
  assert(unknownResult.needsConfirmation === true, 'Unknown food has needsConfirmation = true');
  assert(unknownResult.calories === 0, 'Unknown food calories is 0 (not invented)');
  assert(unknownResult.protein === 0, 'Unknown food protein is 0');
  assert(unknownResult.carbohydrates === 0, 'Unknown food carbs is 0');
  console.log('  Unknown food result correctly flags unverified:', unknownResult);
  console.log('');

  // ----------------------------------------------------------------
  // Test 9: Portion changed from 100g → 200g
  // ----------------------------------------------------------------
  console.log('TEST 9: Portion changed from 100g → 200g');
  const portion100g = nutritionService.calculateNutrition(rice!, { size: 100, unit: 'g' });
  const portion200g = nutritionService.calculateNutrition(rice!, { size: 200, unit: 'g' });
  assert(portion100g.calories === 129, `100g rice is 129 kcal (got ${portion100g.calories})`);
  assert(portion200g.calories === 257, `200g rice is 257 kcal (got ${portion200g.calories})`);
  assert(Math.abs(portion200g.calories - portion100g.calories * 2) <= 1, '200g calories is approximately double 100g (within rounding)');
  assert(portion200g.protein === Math.round(portion100g.protein * 2 * 10) / 10, `200g protein is exactly double 100g (${portion200g.protein} vs ${portion100g.protein * 2})`);
  console.log('  100g vs 200g comparison passed: scaled correctly.');
  console.log('');

  // ----------------------------------------------------------------
  // Test 10: Food removed from a meal
  // ----------------------------------------------------------------
  console.log('TEST 10: Food removed from a meal');
  const initialMeal = [
    { food: rice!, portion: { size: 180, unit: 'g' as const } },
    { food: dal!, portion: { size: 120, unit: 'g' as const } },
    { food: curry!, portion: { size: 100, unit: 'g' as const } },
  ];
  const initialResult = nutritionService.calculateMealNutrition(initialMeal);
  // Remove curry
  const modifiedMeal = initialMeal.filter(item => item.food.id !== curry!.id);
  const modifiedResult = nutritionService.calculateMealNutrition(modifiedMeal);
  assert(modifiedResult.items.length === 2, 'Meal now has 2 items');
  const curryNutrition = nutritionService.calculateNutrition(curry!, { size: 100, unit: 'g' });
  assert(
    modifiedResult.totalCalories === initialResult.totalCalories - curryNutrition.calories,
    `Calories reduced by exact amount of removed curry: ${initialResult.totalCalories} -> ${modifiedResult.totalCalories}`
  );
  console.log('  Food removal recalculated meal accurately.');
  console.log('');

  // ----------------------------------------------------------------
  // Test 11: Food manually added
  // ----------------------------------------------------------------
  console.log('TEST 11: Food manually added');
  const curd = await foodDatabaseService.findFoodByAlias('curd');
  assert(curd !== null, 'Found curd in database');
  const addedMeal = [
    ...modifiedMeal,
    { food: curd!, portion: { size: 100, unit: 'g' as const } },
  ];
  const addedResult = nutritionService.calculateMealNutrition(addedMeal);
  assert(addedResult.items.length === 3, 'Meal now has 3 items again');
  const curdNutrition = nutritionService.calculateNutrition(curd!, { size: 100, unit: 'g' });
  assert(
    addedResult.totalCalories === modifiedResult.totalCalories + curdNutrition.calories,
    `Calories increased by exact amount of added curd: ${modifiedResult.totalCalories} -> ${addedResult.totalCalories}`
  );
  console.log('  Food addition recalculated meal accurately.');
  console.log('');

  console.log('==================================================');
  console.log('ALL 11 UNIT TESTS PASSED SUCCESSFULLY! ✅');
  console.log('==================================================');
}

runTests().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
