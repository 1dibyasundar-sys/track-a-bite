import {
  INutritionService,
  FoodItem,
  NutritionProfile,
  DetectedFoodItem,
  MacroDistribution,
  NutrientRichnessScore,
  NutrientGapAssessment,
  ProvidedNutrient,
  MissingNutrient,
  PortionInput,
  NutritionResult,
  MealNutritionResult,
  MealNutritionItem,
  MicronutrientMap,
} from '../types';

export class NutritionService implements INutritionService {
  private standardDisclaimer =
    'Nutrition values are estimates based on standard regional reference food data and portion size, not laboratory measurements.';

  /**
   * Primary Phase 4 method:
   * Calculates scaled nutrition for a food item and portion.
   * If food is unmapped or null, returns nutritionAvailable: false and needsConfirmation: true.
   */
  calculateNutrition(food: FoodItem | null, portion: PortionInput): NutritionResult {
    const effectiveQty =
      portion.quantity !== undefined
        ? Number(portion.quantity)
        : portion.size !== undefined
          ? Number(portion.size)
          : 1;

    // 1. Unknown / Unmapped food handling
    if (!food || food.id === 'unmapped-food') {
      return {
        calories: 0,
        carbohydrates: 0,
        protein: 0,
        fat: 0,
        fiber: 0,
        micronutrients: {},
        serving: {
          quantity: effectiveQty,
          unit: portion.unit || 'serving',
          weightGrams: portion.weightGrams || 0,
          description: `${effectiveQty} ${portion.unit || 'serving'}`,
        },
        nutritionAvailable: false,
        needsConfirmation: true,
        isApproximate: true,
        disclaimer:
          'Nutrition information unavailable for this dish. Please select a recognized food from our database to view nutrition.',
      };
    }

    // 2. Compute portion scale factor relative to reference serving
    const scaleFactor = this.calculateScaleFactor(food, portion);

    // 3. Scale macronutrients with sensible precision (no false precision)
    const calories = Math.round(food.nutrition.calories * scaleFactor);
    const carbohydrates = Math.round(food.nutrition.carbohydrates * scaleFactor * 10) / 10;
    const protein = Math.round(food.nutrition.protein * scaleFactor * 10) / 10;
    const fat = Math.round(food.nutrition.fat * scaleFactor * 10) / 10;
    const fiber = Math.round(food.nutrition.fiber * scaleFactor * 10) / 10;

    // 4. Scale micronutrients where available
    const micronutrients: MicronutrientMap = {};
    if (food.nutrition.iron !== undefined) {
      micronutrients.iron = Math.round(food.nutrition.iron * scaleFactor * 10) / 10;
    }
    if (food.nutrition.calcium !== undefined) {
      micronutrients.calcium = Math.round(food.nutrition.calcium * scaleFactor);
    }
    if (food.nutrition.vitaminC !== undefined) {
      micronutrients.vitaminC = Math.round(food.nutrition.vitaminC * scaleFactor * 10) / 10;
    }
    if (food.nutrition.vitaminA !== undefined) {
      micronutrients.vitaminA = Math.round(food.nutrition.vitaminA * scaleFactor);
    }
    if (food.nutrition.potassium !== undefined) {
      micronutrients.potassium = Math.round(food.nutrition.potassium * scaleFactor);
    }

    // 5. Serving weight in grams
    const refWeight = food.serving.weightGrams || food.weightGramsPerUnit || 100;
    const calculatedWeightGrams = Math.round(refWeight * scaleFactor);

    return {
      calories,
      carbohydrates,
      protein,
      fat,
      fiber,
      micronutrients,
      serving: {
        quantity: effectiveQty,
        unit: portion.unit,
        weightGrams: calculatedWeightGrams,
        description: `${effectiveQty} ${portion.unit} (~${calculatedWeightGrams}g)`,
      },
      nutritionAvailable: true,
      needsConfirmation: false,
      isApproximate: food.nutrition.isApproximate ?? false,
      disclaimer: this.standardDisclaimer,
    };
  }

  /**
   * Determines scale factor between the user's portion input and the food's reference serving.
   */
  private calculateScaleFactor(food: FoodItem, portion: PortionInput): number {
    const rawQty =
      portion.quantity !== undefined
        ? Number(portion.quantity)
        : portion.size !== undefined
          ? Number(portion.size)
          : 1;
    const qty = Math.max(0.01, isNaN(rawQty) ? 1 : rawQty);
    const unit = (portion.unit || '').toLowerCase().trim();
    const refUnit = food.serving.unit.toLowerCase().trim();
    const refSize = Math.max(1, food.serving.size);
    const refGrams = Math.max(1, food.serving.weightGrams || food.weightGramsPerUnit || 100);

    // If explicit weight in grams is provided in PortionInput
    if (portion.weightGrams && portion.weightGrams > 0) {
      return Math.round((portion.weightGrams / refGrams) * 1000) / 1000;
    }

    // Direct unit match with reference serving
    if (unit === refUnit) {
      return Math.round((qty / refSize) * 1000) / 1000;
    }

    // User specifies weight in grams ('g' or 'grams')
    if (unit === 'g' || unit === 'grams' || unit === 'gram') {
      return Math.round((qty / refGrams) * 1000) / 1000;
    }

    // User specifies volume in ml ('ml' or 'milliliters')
    if (unit === 'ml' || unit === 'milliliter') {
      return Math.round((qty / refGrams) * 1000) / 1000;
    }

    // Household unit: 'piece' or 'pieces'
    if (unit === 'piece' || unit === 'pieces') {
      if (refUnit === 'piece' || refUnit === 'pieces') {
        return Math.round((qty / refSize) * 1000) / 1000;
      }
      // Weight of 1 piece
      const pieceWeight = food.weightGramsPerUnit || refGrams;
      return Math.round(((qty * pieceWeight) / refGrams) * 1000) / 1000;
    }

    // Household unit: 'bowl' or 'katori'
    if (unit === 'bowl' || unit === 'katori') {
      if (refUnit === 'bowl' || refUnit === 'katori') {
        return Math.round((qty / refSize) * 1000) / 1000;
      }
      // Standard Indian bowl/katori is ~150g (or ~180g for chaat)
      const bowlWeight = food.id.includes('chaat') ? 180 : 150;
      return Math.round(((qty * bowlWeight) / refGrams) * 1000) / 1000;
    }

    // Household unit: 'cup'
    if (unit === 'cup' || unit === 'cups') {
      const cupWeight = 200;
      return Math.round(((qty * cupWeight) / refGrams) * 1000) / 1000;
    }

    // Household unit: 'serving' or 'plate'
    if (unit === 'serving' || unit === 'servings' || unit === 'plate') {
      return Math.round(qty * 1000) / 1000;
    }

    // Fallback: ratio against reference size
    return Math.round((qty / refSize) * 1000) / 1000;
  }

  /**
   * Aggregates nutrition across all foods in a full meal.
   * Calculates total calories, carbohydrates, protein, fat, fiber, and micronutrients.
   */
  calculateMealNutrition(
    items: Array<{ food: FoodItem | null; portion: PortionInput }>
  ): MealNutritionResult {
    let totalCalories = 0;
    let totalCarbs = 0;
    let totalProtein = 0;
    let totalFat = 0;
    let totalFiber = 0;

    let ironSum = 0;
    let calciumSum = 0;
    let vitaminCSum = 0;
    let vitaminASum = 0;
    let potassiumSum = 0;

    const resultItems: MealNutritionItem[] = [];

    for (const item of items) {
      const nutrition = this.calculateNutrition(item.food, item.portion);
      resultItems.push({
        foodId: item.food ? item.food.id : 'unknown',
        foodName: item.food ? item.food.name : 'Unknown Food',
        portion: item.portion,
        nutrition,
      });

      if (nutrition.nutritionAvailable) {
        totalCalories += nutrition.calories;
        totalCarbs += nutrition.carbohydrates;
        totalProtein += nutrition.protein;
        totalFat += nutrition.fat;
        totalFiber += nutrition.fiber;

        if (nutrition.micronutrients.iron !== undefined) ironSum += nutrition.micronutrients.iron;
        if (nutrition.micronutrients.calcium !== undefined) calciumSum += nutrition.micronutrients.calcium;
        if (nutrition.micronutrients.vitaminC !== undefined) vitaminCSum += nutrition.micronutrients.vitaminC;
        if (nutrition.micronutrients.vitaminA !== undefined) vitaminASum += nutrition.micronutrients.vitaminA;
        if (nutrition.micronutrients.potassium !== undefined) potassiumSum += nutrition.micronutrients.potassium;
      }
    }

    const totalMicronutrients: MicronutrientMap = {};
    if (ironSum > 0) totalMicronutrients.iron = Math.round(ironSum * 10) / 10;
    if (calciumSum > 0) totalMicronutrients.calcium = Math.round(calciumSum);
    if (vitaminCSum > 0) totalMicronutrients.vitaminC = Math.round(vitaminCSum * 10) / 10;
    if (vitaminASum > 0) totalMicronutrients.vitaminA = Math.round(vitaminASum);
    if (potassiumSum > 0) totalMicronutrients.potassium = Math.round(potassiumSum);

    return {
      totalCalories: Math.round(totalCalories),
      totalCarbohydrates: Math.round(totalCarbs * 10) / 10,
      totalProtein: Math.round(totalProtein * 10) / 10,
      totalFat: Math.round(totalFat * 10) / 10,
      totalFiber: Math.round(totalFiber * 10) / 10,
      totalMicronutrients,
      micronutrients: totalMicronutrients,
      items: resultItems,
      disclaimer: this.standardDisclaimer,
    };
  }

  // --- Backwards-compatible methods preserving existing page and service interfaces ---

  calculateItemNutrition(food: FoodItem, multiplier: number): NutritionProfile {
    const base = food.nutrition;
    const round1 = (val: number) => Math.round(val * multiplier * 10) / 10;
    const round0 = (val: number) => Math.round(val * multiplier);

    const micronutrients = food.nutritionPerServing.micronutrients?.map(m => ({
      ...m,
      dailyValuePercentage: m.dailyValuePercentage
        ? Math.round(m.dailyValuePercentage * multiplier)
        : undefined,
    }));

    return {
      calories: round0(base.calories),
      protein: round1(base.protein),
      carbohydrates: round1(base.carbohydrates),
      fat: round1(base.fat),
      fiber: round1(base.fiber),
      sodium: base.sodium ? round0(base.sodium) : undefined,
      sugar: base.sugar ? round1(base.sugar) : undefined,
      micronutrients,
    };
  }

  aggregateNutrition(items: DetectedFoodItem[]): NutritionProfile {
    let calories = 0;
    let protein = 0;
    let carbohydrates = 0;
    let fat = 0;
    let fiber = 0;
    let sodium = 0;
    let sugar = 0;

    for (const item of items) {
      if (item.nutritionAvailable === false) continue;
      calories += item.nutrition.calories;
      protein += item.nutrition.protein;
      carbohydrates += item.nutrition.carbohydrates;
      fat += item.nutrition.fat;
      fiber += item.nutrition.fiber;
      if (item.nutrition.sodium) sodium += item.nutrition.sodium;
      if (item.nutrition.sugar) sugar += item.nutrition.sugar;
    }

    const round1 = (val: number) => Math.round(val * 10) / 10;

    return {
      calories: Math.round(calories),
      protein: round1(protein),
      carbohydrates: round1(carbohydrates),
      fat: round1(fat),
      fiber: round1(fiber),
      sodium: Math.round(sodium),
      sugar: round1(sugar),
    };
  }

  calculateMacroDistribution(nutrition: NutritionProfile): MacroDistribution {
    const carbKcal = nutrition.carbohydrates * 4;
    const proteinKcal = nutrition.protein * 4;
    const fatKcal = nutrition.fat * 9;
    const totalMacroKcal = carbKcal + proteinKcal + fatKcal;

    if (totalMacroKcal <= 0) {
      return { carbsPercent: 50, proteinPercent: 20, fatPercent: 30 };
    }

    const carbsPercent = Math.round((carbKcal / totalMacroKcal) * 100);
    const proteinPercent = Math.round((proteinKcal / totalMacroKcal) * 100);
    const fatPercent = Math.max(0, 100 - carbsPercent - proteinPercent);

    return {
      carbsPercent,
      proteinPercent,
      fatPercent,
    };
  }

  calculateNutrientRichness(
    nutrition: NutritionProfile,
    items: DetectedFoodItem[] = []
  ): NutrientRichnessScore {
    let score = 2.5;
    const highlights: string[] = [];

    // Protein contribution
    if (nutrition.protein >= 15) {
      score += 1.0;
      highlights.push('Rich in muscle-supporting protein');
    } else if (nutrition.protein >= 8) {
      score += 0.5;
      highlights.push('Moderate protein content');
    } else {
      score -= 0.5;
    }

    // Fiber contribution
    if (nutrition.fiber >= 7) {
      score += 1.0;
      highlights.push('High in digestive soluble fiber');
    } else if (nutrition.fiber >= 4) {
      score += 0.5;
      highlights.push('Good digestive fiber');
    } else {
      score -= 0.5;
    }

    // Food diversity check (sprouts, curd, eggs, greens, millets)
    const hasFermentedOrProbiotic = items.some(
      i =>
        i.name.toLowerCase().includes('curd') ||
        i.name.toLowerCase().includes('dahi') ||
        i.name.toLowerCase().includes('idli')
    );
    const hasSproutsOrLegume = items.some(
      i =>
        i.name.toLowerCase().includes('sprout') ||
        i.name.toLowerCase().includes('chana') ||
        i.name.toLowerCase().includes('dal')
    );
    const hasEgg = items.some(i => i.name.toLowerCase().includes('egg'));

    if (hasFermentedOrProbiotic || hasSproutsOrLegume || hasEgg) {
      score += 0.5;
    }

    // Heavy sodium or refined fat penalty
    if (nutrition.sodium && nutrition.sodium > 750) {
      score -= 0.5;
    }
    const fatRatio = (nutrition.fat * 9) / Math.max(nutrition.calories, 1);
    if (fatRatio > 0.45 && nutrition.fiber < 3) {
      score -= 0.5;
    }

    // Clamp score to 1.0 - 5.0 with 0.5 steps
    const clamped = Math.min(5.0, Math.max(1.0, Math.round(score * 2) / 2));

    let label = 'Moderate Richness';
    let explanation =
      'Provides immediate caloric fuel, but could benefit from a protein or fiber boost.';

    if (clamped >= 4.5) {
      label = 'Nutrient Rich Powerhouse';
      explanation =
        'Exceptional balance of quality protein, satiating fiber, and essential micronutrients.';
    } else if (clamped >= 3.5) {
      label = 'Well-Balanced Plate';
      explanation =
        'Good source of energy and protein; pair with calcium or raw salad for complete coverage.';
    } else if (clamped >= 2.5) {
      label = 'Energy-Dense / Moderate Diversity';
      explanation =
        'Reliable source of carbohydrates and energy, but protein and fiber ratios are modest.';
    } else {
      label = 'High Energy / Low Micronutrient';
      explanation =
        'Heavily dominated by quick carbohydrates or fats with minimal protein or protective fiber.';
    }

    return {
      stars: clamped,
      label,
      explanation,
      highlights,
    };
  }

  calculateNutrientGaps(
    nutrition: NutritionProfile,
    items: DetectedFoodItem[] = []
  ): NutrientGapAssessment {
    const providedNutrients: ProvidedNutrient[] = [];
    const missingNutrients: MissingNutrient[] = [];

    // Provided checks
    if (nutrition.carbohydrates >= 20) {
      providedNutrients.push({
        name: 'Sustained Carbohydrates',
        amountDescription: `${nutrition.carbohydrates}g for lecture & study energy`,
        status: 'good',
      });
    }

    if (nutrition.protein >= 12) {
      providedNutrients.push({
        name: 'Adequate Protein',
        amountDescription: `${nutrition.protein}g for tissue repair & satiety`,
        status: 'good',
      });
    } else if (nutrition.protein >= 6) {
      providedNutrients.push({
        name: 'Modest Protein',
        amountDescription: `${nutrition.protein}g present`,
        status: 'moderate',
      });
    }

    if (nutrition.fiber >= 6) {
      providedNutrients.push({
        name: 'High Dietary Fiber',
        amountDescription: `${nutrition.fiber}g for smooth digestion`,
        status: 'good',
      });
    } else if (nutrition.fiber >= 3) {
      providedNutrients.push({
        name: 'Some Fiber',
        amountDescription: `${nutrition.fiber}g present`,
        status: 'moderate',
      });
    }

    const hasCurd = items.some(
      i => i.name.toLowerCase().includes('curd') || i.name.toLowerCase().includes('dahi')
    );
    if (hasCurd) {
      providedNutrients.push({
        name: 'Active Probiotics',
        amountDescription: 'Lactobacillus cultures for gut barrier',
        status: 'good',
      });
    }

    // Missing checks
    if (nutrition.protein < 12) {
      missingNutrients.push({
        name: 'More Complete Protein',
        reason: 'Low protein causes rapid post-meal hunger and sluggish afternoon focus.',
        priority: nutrition.protein < 6 ? 'high' : 'medium',
        practicalSource: '2 Boiled eggs (₹15–25), Sprouts (₹20), or Curd (₹15)',
      });
    }

    if (nutrition.fiber < 5) {
      missingNutrients.push({
        name: 'Protective Dietary Fiber',
        reason:
          'Without fiber, carbohydrates digest very fast, causing quick blood sugar spikes and crashes.',
        priority: 'high',
        practicalSource: 'Sprouts chaat, fresh banana (₹5–10), or roasted peanuts',
      });
    }

    if (
      !hasCurd &&
      !items.some(
        i =>
          i.name.toLowerCase().includes('paneer') ||
          i.name.toLowerCase().includes('milk') ||
          i.name.toLowerCase().includes('ragi')
      )
    ) {
      missingNutrients.push({
        name: 'Calcium & Gut Health',
        reason: 'Essential for bone mineral density and preventing hostel acidity.',
        priority: 'medium',
        practicalSource: '1 small katori fresh dahi / curd (₹15–25) or fresh milk',
      });
    }

    if (
      items.some(
        i => i.name.toLowerCase().includes('chips') || i.name.toLowerCase().includes('maggi')
      )
    ) {
      missingNutrients.push({
        name: 'Hydrating Electrolytes & Potassium',
        reason:
          'High-sodium packaged snacks need natural potassium to maintain cellular fluid balance.',
        priority: 'medium',
        practicalSource: '1 fresh banana (₹5–10) or fresh guava',
      });
    }

    const whyItMattersSummary =
      missingNutrients.length > 0
        ? `Adding just one simple item like ${missingNutrients[0].practicalSource.split(',')[0]} will stabilize your study energy and keep you full 2x longer.`
        : 'This meal provides steady stamina and good nutritional coverage for college life.';

    return {
      providedNutrients,
      missingNutrients,
      whyItMattersSummary,
    };
  }
}

export const nutritionService = new NutritionService();
