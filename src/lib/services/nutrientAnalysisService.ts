import {
  INutrientAnalysisService,
  MealNutritionResult,
  UserProfile,
  MealAnalysisResult,
  MealCharacteristic,
  NutrientRichnessResult,
  MealCompositionResult,
  NutrientGapItem,
  StarScore,
  StarScoreLabel,
} from '../types';
import { recommendationService } from './recommendationService';

export class NutrientAnalysisService implements INutrientAnalysisService {
  private standardDisclaimer =
    'Nutrition values and scores are quality heuristics based on standard regional reference data and portion size, not laboratory measurements or medical diagnoses. Consider speaking with a qualified professional for condition-specific dietary advice.';

  /**
   * Primary Phase 5 Method:
   * Transforms calculated meal nutrition into actionable nutritional intelligence.
   */
  analyzeMeal(
    mealNutrition: MealNutritionResult,
    userProfile?: UserProfile
  ): MealAnalysisResult {
    // 1. Unknown / Unverified Meal Handling
    const hasUnverifiedItems =
      mealNutrition.items?.some(it => it.nutrition && it.nutrition.nutritionAvailable === false) ?? false;
    const hasZeroCalories = mealNutrition.totalCalories <= 0;

    if (hasUnverifiedItems || hasZeroCalories) {
      return this.buildUnverifiedAnalysis(userProfile);
    }

    // 2. Meal Composition Determination
    const composition = this.determineMealComposition(mealNutrition);

    // 3. 5-Star Nutrient Richness Scoring (Deterministic heuristic)
    const nutrientRichness = this.calculateRichnessScore(mealNutrition, composition);

    // 4. Relative Nutrient Gaps
    const gaps = this.identifyNutrientGaps(mealNutrition, userProfile);

    // 5. Medical / Professional Guidance Notice
    const professionalGuidanceNote = this.evaluateMedicalNotice(userProfile);

    // 6. Preliminary Analysis Object
    const partialAnalysis: MealAnalysisResult = {
      nutrientRichness,
      composition,
      gaps,
      recommendations: [],
      professionalGuidanceNote,
      disclaimer: this.standardDisclaimer,
    };

    // Attach meal items to analysis for recommendation exclusion checks
    (partialAnalysis as unknown as { items: Array<{ foodId: string }> }).items =
      mealNutrition.items?.map(it => ({ foodId: it.foodId })) || [];

    // 7. Food Recommendations via RecommendationService
    const recommendations = recommendationService.getRecommendations(
      partialAnalysis,
      userProfile
    );

    return {
      ...partialAnalysis,
      recommendations,
    };
  }

  /**
   * Evaluates dominant characteristics and positive strengths of the meal.
   */
  private determineMealComposition(mealNutrition: MealNutritionResult): MealCompositionResult {
    const characteristics = new Set<MealCharacteristic>();
    const strengths: string[] = [];

    const totalKcal = Math.max(1, mealNutrition.totalCalories);
    const carbsKcal = mealNutrition.totalCarbohydrates * 4;
    const proteinKcal = mealNutrition.totalProtein * 4;
    const fatKcal = mealNutrition.totalFat * 9;

    const carbsPct = (carbsKcal / totalKcal) * 100;
    const proteinPct = (proteinKcal / totalKcal) * 100;
    const fatPct = (fatKcal / totalKcal) * 100;

    const totalProtein = mealNutrition.totalProtein;
    const totalFiber = mealNutrition.totalFiber;
    const micros = mealNutrition.totalMicronutrients || mealNutrition.micronutrients || {};

    // 1. Protein classification
    if (proteinPct >= 20 || totalProtein >= 20) {
      characteristics.add('protein-rich');
      strengths.push('Solid protein support for muscle recovery and sustained fullness');
    } else if (proteinPct < 11 && totalProtein < 10) {
      characteristics.add('low-protein');
    } else if (totalProtein >= 12) {
      strengths.push('Supplies moderate protein to support study focus and stamina');
    }

    // 2. Carbohydrate classification
    if (
      (carbsPct >= 60 && mealNutrition.totalCarbohydrates >= 35) ||
      (carbsPct >= 50 && mealNutrition.totalCarbohydrates >= 50)
    ) {
      characteristics.add('carbohydrate-heavy');
      strengths.push('Provides high-energy carbohydrate fuel for academic work');
    } else if (carbsPct >= 45 && carbsPct <= 60) {
      strengths.push('Balanced complex carbohydrates providing steady study energy');
    }

    // 3. Fat classification
    if (fatPct >= 35 || mealNutrition.totalFat >= 18) {
      characteristics.add('fat-heavy');
    }

    // 4. Fiber classification
    if (totalFiber >= 8 || (totalFiber >= 5 && totalKcal < 350)) {
      characteristics.add('fiber-rich');
      strengths.push('High dietary fiber supporting smooth digestion and prolonged satiety');
    } else if (totalFiber < 3.0 && totalKcal >= 200) {
      characteristics.add('low-fiber');
    }

    // 5. Micronutrient richness
    let highMicroCount = 0;
    if ((micros.potassium || 0) >= 300) {
      highMicroCount++;
      strengths.push('Good cellular potassium to support fluid balance and electrolyte levels');
    }
    if ((micros.iron || 0) >= 2.0) {
      highMicroCount++;
      strengths.push('Contains dietary iron essential for healthy blood oxygen delivery');
    }
    if ((micros.calcium || 0) >= 80) {
      highMicroCount++;
      strengths.push('Provides calcium for bone density');
    }
    if ((micros.vitaminC || 0) >= 15) {
      highMicroCount++;
      strengths.push('Supplies natural vitamin C to enhance immunity and iron absorption');
    }
    if ((micros.vitaminA || 0) >= 100) {
      highMicroCount++;
    }

    if (highMicroCount >= 3) {
      characteristics.add('micronutrient-rich');
    }

    // 6. Processed food detection
    const processedIds = ['potato-chips', 'packaged-juice', 'hostel-maggi', 'kachori', 'samosa'];
    const hasProcessed = mealNutrition.items?.some(it =>
      processedIds.some(pid => it.foodId?.toLowerCase().includes(pid))
    );
    if (hasProcessed) {
      characteristics.add('highly-processed');
    }

    // 7. Balanced meal classification
    const isBalanced =
      proteinPct >= 11 &&
      proteinPct <= 30 &&
      carbsPct >= 45 &&
      carbsPct <= 65 &&
      fatPct >= 15 &&
      fatPct <= 38 &&
      totalFiber >= 4.0;

    if (isBalanced) {
      characteristics.add('balanced');
      if (!strengths.some(s => s.includes('Balanced'))) {
        strengths.unshift('Well-balanced macronutrient distribution across protein, carbs, and fats');
      }
    }

    // Fallback strength if empty
    if (strengths.length === 0) {
      strengths.push('Provides immediate caloric energy for your day');
    }

    return {
      dominantNutrients: Array.from(characteristics),
      strengths: strengths.slice(0, 3), // keep top 3 readable
    };
  }

  /**
   * Computes a transparent, deterministic 1-5 star richness score.
   * Dimensions:
   * 1. Protein contribution (up to 20 pts)
   * 2. Dietary fiber contribution (up to 20 pts)
   * 3. Micronutrient & mineral coverage (up to 20 pts)
   * 4. Wholesome diversity & pulse/vegetable presence (up to 25 pts)
   * 5. Processed food deductions (up to -25 pts)
   */
  private calculateRichnessScore(
    mealNutrition: MealNutritionResult,
    composition: MealCompositionResult
  ): NutrientRichnessResult {
    // Base metabolic contribution for a caloric meal
    let points = 10;

    // --- Dimension 1: Protein Contribution (0 - 20 pts) ---
    const protein = mealNutrition.totalProtein;
    if (protein >= 20) points += 20;
    else if (protein >= 14) points += 16;
    else if (protein >= 10) points += 12;
    else if (protein >= 5) points += 7;
    else points += 2;

    // --- Dimension 2: Fiber Contribution (0 - 20 pts) ---
    const fiber = mealNutrition.totalFiber;
    if (fiber >= 8) points += 20;
    else if (fiber >= 5) points += 15;
    else if (fiber >= 3) points += 10;
    else if (fiber >= 1.5) points += 5;
    else points += 0;

    // --- Dimension 3: Micronutrient Coverage (0 - 20 pts, 4 pts each) ---
    const micros = mealNutrition.totalMicronutrients || mealNutrition.micronutrients || {};
    if ((micros.iron || 0) >= 1.5) points += 4;
    if ((micros.calcium || 0) >= 50) points += 4;
    if ((micros.vitaminC || 0) >= 10) points += 4;
    if ((micros.vitaminA || 0) >= 50) points += 4;
    if ((micros.potassium || 0) >= 200) points += 4;

    // --- Dimension 4: Wholesome Diversity & Presence (0 - 25 pts) ---
    const itemIds = mealNutrition.items?.map(it => it.foodId?.toLowerCase() || '') || [];
    const itemNames = mealNutrition.items?.map(it => it.foodName?.toLowerCase() || '') || [];

    const hasPulses = itemIds.some(id =>
      id.includes('dal') || id.includes('sprout') || id.includes('chana') || id.includes('peanut')
    );
    const hasVegetablesOrFruits =
      itemIds.some(id =>
        id.includes('curry') ||
        id.includes('palak') ||
        id.includes('banana') ||
        id.includes('guava') ||
        id.includes('papaya') ||
        id.includes('salad')
      ) || itemNames.some(n => n.includes('vegetable') || n.includes('curry'));

    const hasDairyOrEgg = itemIds.some(id =>
      id.includes('egg') || id.includes('curd') || id.includes('milk') || id.includes('paneer')
    );

    if (hasPulses) points += 8;
    if (hasVegetablesOrFruits) points += 8;
    if (hasDairyOrEgg) points += 6;
    if (itemIds.length >= 3) points += 3;

    // --- Dimension 5: Deductions for Processed Foods (-25 pts max) ---
    const processedCount = itemIds.filter(id =>
      id.includes('chips') || id.includes('juice') || id.includes('maggi') || id.includes('kachori') || id.includes('samosa')
    ).length;

    if (processedCount >= 2) {
      points -= 22;
    } else if (processedCount === 1) {
      // If there is an egg/curd/pulse balancing it, deduct less
      if (!hasPulses && !hasVegetablesOrFruits && !hasDairyOrEgg) {
        points -= 16;
      } else {
        points -= 8;
      }
    }

    // Clamp score points to 0 - 100
    points = Math.max(0, Math.min(100, points));

    // Map points to 1 - 5 stars
    let score: StarScore;
    let label: StarScoreLabel;

    if (points >= 75) {
      score = 5;
      label = 'Nutrient Rich';
    } else if (points >= 60) {
      score = 4;
      label = 'Good';
    } else if (points >= 42) {
      score = 3;
      label = 'Moderate';
    } else if (points >= 20) {
      score = 2;
      label = 'Needs Improvement';
    } else {
      score = 1;
      label = 'Very Limited';
    }

    // Dynamic, student-friendly explanation
    let explanation = '';
    if (score === 5) {
      explanation = 'Nutrient-rich meal with excellent protein, high dietary fiber, and broad essential micronutrient coverage.';
    } else if (score === 4) {
      if (fiber < 4) {
        explanation = 'Good protein and energy balance, though adding a fresh fruit or vegetable will boost dietary fiber.';
      } else {
        explanation = 'Solid wholesome meal providing steady stamina and good nutrient variety for hostel life.';
      }
    } else if (score === 3) {
      if (composition.dominantNutrients.includes('carbohydrate-heavy')) {
        explanation = 'Plenty of carbohydrate energy, but protein and protective fiber are relatively low for this meal.';
      } else if (composition.dominantNutrients.includes('highly-processed')) {
        explanation = 'Satisfies hunger quickly, but packaged foods keep fiber and fresh micronutrients moderate.';
      } else {
        explanation = 'Moderate nutritional coverage. Consider pairing with a pulse, egg, or fresh fruit for better balance.';
      }
    } else if (score === 2) {
      if (composition.dominantNutrients.includes('highly-processed')) {
        explanation = 'Calorie-dense packaged or fried food with limited dietary fiber and protein to sustain your study energy.';
      } else {
        explanation = 'Supplies basic energy, but is relatively low in multiple essential nutrients like protein and fiber.';
      }
    } else {
      explanation = 'Very limited nutritional variety—dominated by refined carbohydrates or fats with virtually no protective nutrients.';
    }

    return {
      score,
      label,
      explanation,
    };
  }

  /**
   * Evaluates relative nutrient gaps.
   * Strictly adheres to non-diagnostic terminology ("Protein is relatively low for this meal", NOT "You are deficient").
   */
  private identifyNutrientGaps(
    mealNutrition: MealNutritionResult,
    userProfile?: UserProfile
  ): NutrientGapItem[] {
    const gaps: NutrientGapItem[] = [];
    const micros = mealNutrition.totalMicronutrients || mealNutrition.micronutrients || {};
    const totalKcal = Math.max(1, mealNutrition.totalCalories);

    // 1. Protein Gap
    // Calculate benchmark based on user weight if available (~0.25g per kg per meal)
    const targetProtein = userProfile?.weightKg ? Math.round(userProfile.weightKg * 0.25) : 15;
    if (mealNutrition.totalProtein < targetProtein * 0.4) {
      gaps.push({
        nutrient: 'protein',
        severity: 'high',
        explanation: 'Protein is relatively low for this meal; adding protein slows carbohydrate digestion and keeps you full longer.',
      });
    } else if (mealNutrition.totalProtein < targetProtein * 0.75) {
      gaps.push({
        nutrient: 'protein',
        severity: 'moderate',
        explanation: 'Protein is somewhat low for optimal muscle recovery and steady energy between college lectures.',
      });
    }

    // 2. Fiber Gap
    if (mealNutrition.totalFiber < 1.5 && totalKcal >= 200) {
      gaps.push({
        nutrient: 'fiber',
        severity: 'high',
        explanation: 'Dietary fiber is relatively low; fiber prevents energy crashes and supports smooth gut health.',
      });
    } else if (mealNutrition.totalFiber < 4.0) {
      gaps.push({
        nutrient: 'fiber',
        severity: 'moderate',
        explanation: 'Dietary fiber could be higher to slow carbohydrate absorption and promote healthy digestion.',
      });
    }

    // 3. Calcium Gap
    if ((micros.calcium || 0) < 40) {
      gaps.push({
        nutrient: 'calcium',
        severity: 'moderate',
        explanation: 'Calcium is relatively low for this meal; curd or milk easily adds bone-supporting minerals.',
      });
    }

    // 4. Potassium Gap
    if ((micros.potassium || 0) < 150) {
      gaps.push({
        nutrient: 'potassium',
        severity: 'moderate',
        explanation: 'Potassium is relatively low; natural potassium helps balance out sodium from canteen foods.',
      });
    }

    // 5. Vitamin C Gap
    if ((micros.vitaminC || 0) < 5.0) {
      gaps.push({
        nutrient: 'vitaminC',
        severity: 'low',
        explanation: 'Vitamin C is relatively low; fresh seasonal fruits or sprouts aid plant iron absorption.',
      });
    }

    // 6. Iron Gap
    if ((micros.iron || 0) < 1.0) {
      gaps.push({
        nutrient: 'iron',
        severity: 'low',
        explanation: 'Iron contribution is minimal for this meal; lentils and roasted chana are easy sources to include.',
      });
    }

    // 7. Vitamin A Gap
    if ((micros.vitaminA || 0) < 40) {
      gaps.push({
        nutrient: 'vitaminA',
        severity: 'low',
        explanation: 'Vitamin A is relatively low for this meal; colorful vegetables like carrots or spinach help.',
      });
    }

    // Sort by severity (high > moderate > low)
    const severityOrder = { high: 0, moderate: 1, low: 2 };
    gaps.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return gaps;
  }

  /**
   * Generates ethical professional guidance notice when user profile contains medical considerations.
   */
  private evaluateMedicalNotice(userProfile?: UserProfile): string | undefined {
    if (!userProfile?.healthConditions || userProfile.healthConditions.length === 0) {
      return undefined;
    }

    const conditions = userProfile.healthConditions.filter(
      c => c !== 'None' && c !== 'Prefer not to say'
    );

    if (conditions.length > 0) {
      return 'You have indicated health considerations in your profile. Track-a-Bite provides general nutrition information and cannot provide condition-specific medical advice. Consider speaking with a qualified professional for condition-specific dietary advice.';
    }

    return undefined;
  }

  /**
   * Helper fallback when meal has unverified items or zero nutrition.
   */
  private buildUnverifiedAnalysis(userProfile?: UserProfile): MealAnalysisResult {
    const isHostelite = userProfile?.isHostelite ?? true;

    return {
      nutrientRichness: {
        score: 1,
        label: 'Very Limited',
        explanation:
          'Nutrition information is unverified for this dish. Please select a recognized food from our database to view your 5-star score and detailed intelligence.',
      },
      composition: {
        dominantNutrients: [],
        strengths: ['Food identified; pending database confirmation for nutrition breakdown'],
      },
      gaps: [
        {
          nutrient: 'protein',
          severity: 'moderate',
          explanation: 'Protein could not be calculated until the dish is confirmed in the database.',
        },
        {
          nutrient: 'fiber',
          severity: 'moderate',
          explanation: 'Fiber could not be calculated until the dish is confirmed in the database.',
        },
      ],
      recommendations: [
        {
          foodId: 'banana',
          foodName: 'Fresh Banana',
          reason: 'Reliable source of fiber and potassium.',
          priority: 'medium',
          affordability: 'budget',
          hostelFriendly: true,
        },
        {
          foodId: 'boiled-eggs',
          foodName: 'Boiled Egg',
          reason: 'Adds protein with minimal preparation.',
          priority: 'medium',
          affordability: 'budget',
          hostelFriendly: isHostelite,
        },
      ],
      professionalGuidanceNote: this.evaluateMedicalNotice(userProfile),
      disclaimer: this.standardDisclaimer,
    };
  }
}

export const nutrientAnalysisService = new NutrientAnalysisService();
