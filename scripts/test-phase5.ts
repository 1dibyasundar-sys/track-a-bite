import { foodDatabaseService } from '../src/lib/services/foodDatabaseService';
import { nutritionService } from '../src/lib/services/nutritionService';
import { nutrientAnalysisService } from '../src/lib/services/nutrientAnalysisService';
import { recommendationService } from '../src/lib/services/recommendationService';
import { UserProfile } from '../src/lib/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function runPhase5Tests() {
  console.log('====================================================');
  console.log('TRACK-A-BITE PHASE 5: NUTRIENT INTELLIGENCE TESTS');
  console.log('====================================================\n');

  // Load common test foods from database
  const rice = await foodDatabaseService.findFoodByAlias('rice');
  const dal = await foodDatabaseService.findFoodByAlias('dal');
  const curry = await foodDatabaseService.findFoodByAlias('potato curry');
  const maggi = await foodDatabaseService.findFoodByAlias('maggi');
  const egg = await foodDatabaseService.findFoodByAlias('boiled egg');
  const kachori = await foodDatabaseService.findFoodByAlias('kachori');
  const juice = await foodDatabaseService.findFoodByAlias('packaged juice');
  const sprouts = await foodDatabaseService.findFoodByAlias('sprouts chaat');
  const banana = await foodDatabaseService.findFoodByAlias('banana');
  const chips = await foodDatabaseService.findFoodByAlias('chips');
  const curd = await foodDatabaseService.findFoodByAlias('curd');
  const peanuts = await foodDatabaseService.findFoodByAlias('peanuts');
  const chana = await foodDatabaseService.findFoodByAlias('roasted chana');
  const guava = await foodDatabaseService.findFoodByAlias('guava');
  const vegCurry = await foodDatabaseService.findFoodByAlias('vegetable curry');

  const defaultHostelProfile: UserProfile = {
    age: 20,
    heightCm: 170,
    weightKg: 65,
    isHostelite: true,
    healthConditions: ['None'],
    onboardingCompleted: true,
  };

  const defaultNonHostelProfile: UserProfile = {
    age: 24,
    heightCm: 175,
    weightKg: 70,
    isHostelite: false,
    healthConditions: ['None'],
    onboardingCompleted: true,
  };

  // ------------------------------------------------------------------
  // Test 1: Rice + Dal + Curry
  // ------------------------------------------------------------------
  console.log('TEST 1: Rice + Dal + Curry');
  const meal1 = nutritionService.calculateMealNutrition([
    { food: rice!, portion: { size: 180, unit: 'g' } },
    { food: dal!, portion: { size: 120, unit: 'g' } },
    { food: curry!, portion: { size: 100, unit: 'g' } },
  ]);
  const analysis1 = nutrientAnalysisService.analyzeMeal(meal1, defaultHostelProfile);
  assert(analysis1.nutrientRichness.score >= 3 && analysis1.nutrientRichness.score <= 4, `Meal 1 score is 3 or 4 (got ${analysis1.nutrientRichness.score})`);
  assert(analysis1.composition.dominantNutrients.length > 0, 'Dominant nutrients identified');
  assert(analysis1.composition.strengths.length > 0, 'Strengths identified');
  assert(analysis1.recommendations.length > 0, 'Recommendations generated');
  console.log('  Score:', `${analysis1.nutrientRichness.score}/5 (${analysis1.nutrientRichness.label})`);
  console.log('  Composition:', analysis1.composition.dominantNutrients);
  console.log('  Top Recommendation:', analysis1.recommendations[0]?.foodName, `(${analysis1.recommendations[0]?.reason})`);
  console.log('');

  // ------------------------------------------------------------------
  // Test 2: Hostel Meal - Maggi + Boiled Egg
  // ------------------------------------------------------------------
  console.log('TEST 2: Hostel Meal - Maggi + Boiled Egg');
  const meal2 = nutritionService.calculateMealNutrition([
    { food: maggi!, portion: { size: 1, unit: 'serving' } },
    { food: egg!, portion: { size: 1, unit: 'piece' } },
  ]);
  const analysis2 = nutrientAnalysisService.analyzeMeal(meal2, defaultHostelProfile);
  assert(analysis2.composition.dominantNutrients.includes('highly-processed'), 'Recognized processed instant noodles');
  assert(analysis2.nutrientRichness.score >= 2 && analysis2.nutrientRichness.score <= 4, `Maggi+Egg score is 2-4 (got ${analysis2.nutrientRichness.score})`);
  assert(analysis2.gaps.some(g => g.nutrient === 'fiber'), 'Identified fiber gap for Maggi+Egg');
  assert(analysis2.recommendations.some(r => r.hostelFriendly === true), 'Recommends hostel-friendly options');
  console.log('  Score:', `${analysis2.nutrientRichness.score}/5 (${analysis2.nutrientRichness.label})`);
  console.log('  Gaps:', analysis2.gaps.map(g => `${g.nutrient} (${g.severity})`));
  console.log('');

  // ------------------------------------------------------------------
  // Test 3: Snack - Kachori + Juice
  // ------------------------------------------------------------------
  console.log('TEST 3: Snack - Kachori + Juice');
  const meal3 = nutritionService.calculateMealNutrition([
    { food: kachori!, portion: { size: 1, unit: 'piece' } },
    { food: juice!, portion: { size: 200, unit: 'ml' } },
  ]);
  const analysis3 = nutrientAnalysisService.analyzeMeal(meal3, defaultHostelProfile);
  assert(analysis3.nutrientRichness.score <= 2, `Kachori+Juice has low score <= 2 (got ${analysis3.nutrientRichness.score})`);
  assert(analysis3.composition.dominantNutrients.includes('highly-processed'), 'Classified as highly-processed');
  assert(analysis3.composition.dominantNutrients.includes('carbohydrate-heavy'), 'Classified as carbohydrate-heavy');
  assert(analysis3.gaps.some(g => g.nutrient === 'protein'), 'High protein gap flagged');
  assert(analysis3.gaps.some(g => g.nutrient === 'fiber'), 'Fiber gap flagged');
  console.log('  Score:', `${analysis3.nutrientRichness.score}/5 (${analysis3.nutrientRichness.label})`);
  console.log('  Explanation:', analysis3.nutrientRichness.explanation);
  console.log('');

  // ------------------------------------------------------------------
  // Test 4: Healthy Snack - Sprouts Chaat + Banana
  // ------------------------------------------------------------------
  console.log('TEST 4: Healthy Snack - Sprouts Chaat + Banana');
  const meal4 = nutritionService.calculateMealNutrition([
    { food: sprouts!, portion: { size: 1, unit: 'bowl' } },
    { food: banana!, portion: { size: 1, unit: 'piece' } },
  ]);
  const analysis4 = nutrientAnalysisService.analyzeMeal(meal4, defaultHostelProfile);
  assert(analysis4.nutrientRichness.score >= 4, `Sprouts+Banana score >= 4 (got ${analysis4.nutrientRichness.score})`);
  assert(analysis4.composition.dominantNutrients.includes('fiber-rich'), 'Classified as fiber-rich');
  assert(analysis4.composition.dominantNutrients.includes('micronutrient-rich'), 'Classified as micronutrient-rich');
  console.log('  Score:', `${analysis4.nutrientRichness.score}/5 (${analysis4.nutrientRichness.label})`);
  console.log('  Strengths:', analysis4.composition.strengths);
  console.log('');

  // ------------------------------------------------------------------
  // Test 5: Junk Snack - Chips + Juice
  // ------------------------------------------------------------------
  console.log('TEST 5: Junk Snack - Chips + Juice');
  const meal5 = nutritionService.calculateMealNutrition([
    { food: chips!, portion: { size: 1, unit: 'serving' } },
    { food: juice!, portion: { size: 200, unit: 'ml' } },
  ]);
  const analysis5 = nutrientAnalysisService.analyzeMeal(meal5, defaultHostelProfile);
  assert(analysis5.nutrientRichness.score === 1, `Chips+Juice score is 1 star (got ${analysis5.nutrientRichness.score})`);
  assert(analysis5.nutrientRichness.label === 'Very Limited', 'Score label is Very Limited');
  assert(analysis5.composition.dominantNutrients.includes('low-protein'), 'Classified as low-protein');
  assert(analysis5.composition.dominantNutrients.includes('low-fiber'), 'Classified as low-fiber');
  console.log('  Score:', `${analysis5.nutrientRichness.score}/5 (${analysis5.nutrientRichness.label})`);
  console.log('');

  // ------------------------------------------------------------------
  // Test 6: Balanced Meal - Rice + Dal + Veg Curry + Curd
  // ------------------------------------------------------------------
  console.log('TEST 6: Balanced Meal - Rice + Dal + Veg Curry + Curd');
  const meal6 = nutritionService.calculateMealNutrition([
    { food: rice!, portion: { size: 140, unit: 'g' } },
    { food: dal!, portion: { size: 150, unit: 'g' } },
    { food: vegCurry!, portion: { size: 150, unit: 'g' } },
    { food: curd!, portion: { size: 100, unit: 'g' } },
  ]);
  const analysis6 = nutrientAnalysisService.analyzeMeal(meal6, defaultHostelProfile);
  assert(analysis6.nutrientRichness.score === 5, `Balanced full meal score is 5 stars (got ${analysis6.nutrientRichness.score})`);
  assert(analysis6.composition.dominantNutrients.includes('balanced'), 'Composition contains balanced');
  console.log('  Score:', `${analysis6.nutrientRichness.score}/5 (${analysis6.nutrientRichness.label})`);
  console.log('  Strengths:', analysis6.composition.strengths);
  console.log('');

  // ------------------------------------------------------------------
  // Test 7: Protein-heavy Meal
  // ------------------------------------------------------------------
  console.log('TEST 7: Protein-heavy Meal - 2 Boiled Eggs + Dal + Peanuts');
  const meal7 = nutritionService.calculateMealNutrition([
    { food: egg!, portion: { size: 2, unit: 'piece' } },
    { food: dal!, portion: { size: 150, unit: 'g' } },
    { food: peanuts!, portion: { size: 30, unit: 'g' } },
  ]);
  const analysis7 = nutrientAnalysisService.analyzeMeal(meal7, defaultHostelProfile);
  assert(analysis7.composition.dominantNutrients.includes('protein-rich'), 'Classified as protein-rich');
  assert(analysis7.nutrientRichness.score >= 4, `High protein meal score >= 4 (got ${analysis7.nutrientRichness.score})`);
  console.log('  Composition:', analysis7.composition.dominantNutrients);
  console.log('  Total Protein:', `${meal7.totalProtein}g`);
  console.log('');

  // ------------------------------------------------------------------
  // Test 8: High-fiber Meal - Sprouts + Guava + Chana
  // ------------------------------------------------------------------
  console.log('TEST 8: High-fiber Meal - Sprouts + Guava + Roasted Chana');
  const meal8 = nutritionService.calculateMealNutrition([
    { food: sprouts!, portion: { size: 1, unit: 'bowl' } },
    { food: guava!, portion: { size: 1, unit: 'piece' } },
    { food: chana!, portion: { size: 50, unit: 'g' } },
  ]);
  const analysis8 = nutrientAnalysisService.analyzeMeal(meal8, defaultHostelProfile);
  assert(analysis8.composition.dominantNutrients.includes('fiber-rich'), 'Classified as fiber-rich');
  assert(analysis8.nutrientRichness.score === 5, `High fiber meal score is 5 stars (got ${analysis8.nutrientRichness.score})`);
  console.log('  Composition:', analysis8.composition.dominantNutrients);
  console.log('  Total Fiber:', `${meal8.totalFiber}g`);
  console.log('');

  // ------------------------------------------------------------------
  // Test 9: Unknown Food
  // ------------------------------------------------------------------
  console.log('TEST 9: Unknown Food');
  const meal9 = nutritionService.calculateMealNutrition([
    { food: null, portion: { size: 100, unit: 'g' } },
  ]);
  const analysis9 = nutrientAnalysisService.analyzeMeal(meal9, defaultHostelProfile);
  assert(analysis9.nutrientRichness.score === 1, 'Unknown food score is 1');
  assert(analysis9.nutrientRichness.label === 'Very Limited', 'Unknown food label is Very Limited');
  assert(analysis9.nutrientRichness.explanation.includes('unverified'), 'Explanation notes unverified status');
  console.log('  Score:', `${analysis9.nutrientRichness.score}/5 (${analysis9.nutrientRichness.label})`);
  console.log('  Explanation:', analysis9.nutrientRichness.explanation);
  console.log('');

  // ------------------------------------------------------------------
  // Test 10: Hostelite Recommendations
  // ------------------------------------------------------------------
  console.log('TEST 10: Hostelite Recommendations (Prioritizes cheap, no-cook, room-friendly)');
  const hostelRecommendations = recommendationService.getRecommendations(
    analysis3, // Kachori + Juice (needs protein & fiber)
    defaultHostelProfile
  );
  assert(hostelRecommendations.length > 0, 'Generated hostel recommendations');
  // First recommendation should be hostel friendly and budget
  assert(hostelRecommendations[0].hostelFriendly === true, `Top recommendation (${hostelRecommendations[0].foodName}) is hostel friendly`);
  assert(hostelRecommendations[0].affordability === 'budget', `Top recommendation (${hostelRecommendations[0].foodName}) is budget`);
  console.log('  Hostel Recs:', hostelRecommendations.map(r => `${r.foodName} [${r.affordability}, hostel:${r.hostelFriendly}] - "${r.reason}"`));
  console.log('');

  // ------------------------------------------------------------------
  // Test 11: Non-Hostelite Recommendations
  // ------------------------------------------------------------------
  console.log('TEST 11: Non-Hostelite Recommendations');
  const nonHostelRecommendations = recommendationService.getRecommendations(
    analysis1, // Rice + Dal + Curry
    defaultNonHostelProfile
  );
  assert(nonHostelRecommendations.length > 0, 'Generated non-hostel recommendations');
  console.log('  Non-Hostel Recs:', nonHostelRecommendations.map(r => `${r.foodName} [${r.affordability}] - "${r.reason}"`));
  console.log('');

  // Check Medical Notice behavior
  console.log('BONUS CHECK: Medical Considerations Disclaimer');
  const medicalProfile: UserProfile = {
    ...defaultHostelProfile,
    healthConditions: ['Diabetes / Pre-diabetes'],
  };
  const medicalAnalysis = nutrientAnalysisService.analyzeMeal(meal1, medicalProfile);
  assert(medicalAnalysis.professionalGuidanceNote !== undefined, 'Medical guidance notice is present when profile has conditions');
  assert(medicalAnalysis.professionalGuidanceNote?.includes('professional'), 'Notice advises professional guidance');
  console.log('  Health Notice:', medicalAnalysis.professionalGuidanceNote);
  console.log('');

  console.log('====================================================');
  console.log('ALL 11 PHASE 5 TEST CASES PASSED SUCCESSFULLY! ✅');
  console.log('====================================================');
}

runPhase5Tests().catch(err => {
  console.error('Phase 5 test suite error:', err);
  process.exit(1);
});
