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
} from '../types';
import { nutritionService } from './nutritionService';

export class MockNutritionService implements INutritionService {
  calculateNutrition(food: FoodItem | null, portion: PortionInput): NutritionResult {
    return nutritionService.calculateNutrition(food, portion);
  }

  calculateMealNutrition(
    items: Array<{ food: FoodItem | null; portion: PortionInput }>
  ): MealNutritionResult {
    return nutritionService.calculateMealNutrition(items);
  }

  calculateItemNutrition(food: FoodItem, multiplier: number): NutritionProfile {
    const base = food.nutritionPerServing;
    const round1 = (val: number) => Math.round(val * multiplier * 10) / 10;
    const round0 = (val: number) => Math.round(val * multiplier);

    return {
      calories: round0(base.calories),
      protein: round1(base.protein),
      carbohydrates: round1(base.carbohydrates),
      fat: round1(base.fat),
      fiber: round1(base.fiber),
      sodium: base.sodium ? round0(base.sodium) : undefined,
      sugar: base.sugar ? round1(base.sugar) : undefined,
      micronutrients: base.micronutrients?.map(m => ({
        ...m,
        dailyValuePercentage: m.dailyValuePercentage
          ? Math.round(m.dailyValuePercentage * multiplier)
          : undefined,
      })),
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

  calculateNutrientRichness(nutrition: NutritionProfile, items: DetectedFoodItem[] = []): NutrientRichnessScore {
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
    const hasFermentedOrProbiotic = items.some(i =>
      i.name.toLowerCase().includes('curd') ||
      i.name.toLowerCase().includes('dahi') ||
      i.name.toLowerCase().includes('idli')
    );
    const hasSproutsOrLegume = items.some(i =>
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
    let explanation = 'Provides immediate caloric fuel, but could benefit from a protein or fiber boost.';

    if (clamped >= 4.5) {
      label = 'Nutrient Rich Powerhouse';
      explanation = 'Exceptional balance of quality protein, satiating fiber, and essential micronutrients.';
    } else if (clamped >= 3.5) {
      label = 'Well-Balanced Plate';
      explanation = 'Good source of energy and protein; pair with calcium or raw salad for complete coverage.';
    } else if (clamped >= 2.5) {
      label = 'Energy-Dense / Moderate Diversity';
      explanation = 'Reliable source of carbohydrates and energy, but protein and fiber ratios are modest.';
    } else {
      label = 'High Energy / Low Micronutrient';
      explanation = 'Heavily dominated by quick carbohydrates or fats with minimal protein or protective fiber.';
    }

    return {
      stars: clamped,
      label,
      explanation,
      highlights,
    };
  }

  calculateNutrientGaps(nutrition: NutritionProfile, items: DetectedFoodItem[] = []): NutrientGapAssessment {
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

    const hasCurd = items.some(i => i.name.toLowerCase().includes('curd') || i.name.toLowerCase().includes('dahi'));
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
        reason: 'Without fiber, carbohydrates digest very fast, causing quick blood sugar spikes and crashes.',
        priority: 'high',
        practicalSource: 'Sprouts chaat, fresh banana (₹5–10), or roasted peanuts',
      });
    }

    if (!hasCurd && !items.some(i => i.name.toLowerCase().includes('paneer') || i.name.toLowerCase().includes('ragi'))) {
      missingNutrients.push({
        name: 'Calcium & Gut Probiotics',
        reason: 'Essential for bone mineral density and preventing hostel acidity.',
        priority: 'medium',
        practicalSource: '1 small katori fresh dahi / curd (₹15–25)',
      });
    }

    if (items.some(i => i.name.toLowerCase().includes('chips') || i.name.toLowerCase().includes('maggi'))) {
      missingNutrients.push({
        name: 'Hydrating Electrolytes & Potassium',
        reason: 'High-sodium packaged snacks need natural potassium to maintain cellular fluid balance.',
        priority: 'medium',
        practicalSource: '1 fresh banana (₹5–10) or coconut water',
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
