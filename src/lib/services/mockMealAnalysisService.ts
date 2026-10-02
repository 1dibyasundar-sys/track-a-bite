import {
  IMealAnalysisService,
  INutritionService,
  IRecommendationService,
  DetectedFoodItem,
  MealAnalysis,
  BalanceAssessment,
  MealBalanceRating,
  UserProfile,
  MealNutritionSummary,
  MealComponent,
} from '../types';
import { MockNutritionService } from './mockNutritionService';
import { MockRecommendationService } from './mockRecommendationService';
import { nutritionAnalysisService } from './nutritionAnalysisService';

export class MockMealAnalysisService implements IMealAnalysisService {
  private nutritionService: INutritionService;
  private recommendationService: IRecommendationService;

  constructor(
    nutritionService?: INutritionService,
    recommendationService?: IRecommendationService
  ) {
    this.nutritionService = nutritionService || new MockNutritionService();
    this.recommendationService = recommendationService || new MockRecommendationService();
  }

  async analyzeMeal(
    items: DetectedFoodItem[],
    mealTitle?: string,
    imageUrl?: string,
    userProfile?: UserProfile
  ): Promise<MealAnalysis> {
    const totalNutrition = this.nutritionService.aggregateNutrition(items);
    const macroDistribution = this.nutritionService.calculateMacroDistribution(totalNutrition);
    const nutrientRichness = this.nutritionService.calculateNutrientRichness(totalNutrition, items);
    const nutrientGaps = this.nutritionService.calculateNutrientGaps(totalNutrition, items);
    const isHostelMode = userProfile ? userProfile.isHostelite : true;

    // Determine balance assessment without binary "healthy/unhealthy" labels
    let rating: MealBalanceRating = 'balanced';
    let label = 'Balanced Plate';
    let summary = 'A harmonious mix of energy, protein, and essential fiber.';
    let detail =
      'This meal provides a good ratio of macronutrients with steady glucose release and satiating fiber.';
    let glycemicImpact: 'Low' | 'Moderate' | 'High' = 'Moderate';

    if (macroDistribution.carbsPercent > 65) {
      rating = 'carb-heavy';
      label = 'Carbohydrate-Dominant';
      summary = 'High proportion of carbohydrate calories with lower relative protein.';
      detail =
        'While carbohydrates supply immediate energy, adding a pulse, fermented dairy (dahi), or boiled eggs will lower the glycemic impact and prolong study focus.';
      glycemicImpact = 'High';
    } else if (macroDistribution.proteinPercent < 12) {
      rating = 'protein-light';
      label = 'Light on Protein';
      summary = 'Contains modest protein levels relative to total caloric density.';
      detail =
        'Campus grain foods provide partial amino acids; adding sprouts, curd, or eggs ensures full tissue recovery and lasting satiety.';
      glycemicImpact = 'Moderate';
    } else if (macroDistribution.fatPercent > 38) {
      rating = 'fat-heavy';
      label = 'Calorically Dense from Fats';
      summary = 'Higher percentage of energy is derived from cooking oils, deep frying, or dairy fat.';
      detail =
        'Fats enhance flavor and satiety, but pairing fried canteen snacks with raw sprouts or cooling chaas helps keep digestive fatigue low.';
      glycemicImpact = 'Moderate';
    } else if (totalNutrition.fiber >= 7) {
      rating = 'fiber-rich';
      label = 'High Fiber & Micronutrient Density';
      summary = 'Outstanding dietary fiber content supporting gut microbiome and sustained stamina.';
      detail =
        'The combination of unpolished grains, sprouts, or vegetables delivers steady energy without sharp afternoon slumps.';
      glycemicImpact = 'Low';
    }

    const balanceAssessment: BalanceAssessment = {
      rating,
      label,
      summary,
      detail,
      glycemicImpactEstimate: glycemicImpact,
    };

    // Positive Highlights
    const positiveHighlights: string[] = [];
    if (totalNutrition.protein >= 15) {
      positiveHighlights.push(`Provides ${totalNutrition.protein}g of muscle-supporting protein.`);
    }
    if (totalNutrition.fiber >= 6) {
      positiveHighlights.push(`Rich in dietary fiber (${totalNutrition.fiber}g), promoting steady energy release.`);
    }
    if (items.some(i => i.name.toLowerCase().includes('sprout') || i.foodId === 'sprouts-chaat')) {
      positiveHighlights.push('Fresh sprouts supply bioavailable vitamin C, folate, and active digestive enzymes.');
    }
    if (items.some(i => i.name.toLowerCase().includes('egg') || i.foodId === 'boiled-eggs')) {
      positiveHighlights.push('High-biological-value protein and choline for study memory and focus.');
    }
    if (items.some(i => i.name.toLowerCase().includes('curd') || i.name.toLowerCase().includes('dahi'))) {
      positiveHighlights.push('Probiotics and calcium soothe gastric heat and protect digestive lining.');
    }
    if (positiveHighlights.length === 0) {
      positiveHighlights.push('Supplies immediate carbohydrate calories for campus daily activity.');
    }

    // Balancing Recommendations
    const balancingRecommendations = await this.recommendationService.generateRecommendations({
      nutrition: totalNutrition,
      macroDistribution,
      items,
      userProfile,
    });

    const hostelFriendlyUpgrades = balancingRecommendations.filter(r => r.isHostelFriendly);

    // Practical Adjustments
    const practicalAdjustments: string[] = [];
    if (rating === 'carb-heavy') {
      practicalAdjustments.push('Pair staple grains with a ₹15 cup of dahi or 2 boiled eggs to smooth your blood sugar.');
      practicalAdjustments.push('Eat the sprouts or dal first to reduce the spike from white rice or noodles.');
    } else if (rating === 'fat-heavy') {
      practicalAdjustments.push('Pair deep-fried samosa or kachori with a banana or unsweetened chaas.');
    } else {
      practicalAdjustments.push('This meal provides balanced fuel for lectures, study sessions, or evening sports.');
    }

    // Phase 6.4: Personalized Nutrition Analysis & 5-Star Scoring
    const mealNutritionSummary: MealNutritionSummary = {
      calories: totalNutrition.calories,
      carbohydrates: totalNutrition.carbohydrates,
      protein: totalNutrition.protein,
      fat: totalNutrition.fat,
      fiber: totalNutrition.fiber,
      confidence: 0.9,
      status: 'complete',
      nutritionCompleteness: 'complete',
      disclaimer: 'Calculated from meal items',
      formattedCalories: `${totalNutrition.calories} kcal`,
    };

    const mealComponents: MealComponent[] = items.map((item, idx) => ({
      id: item.detectionId || `comp-${idx}`,
      foodId: item.foodId,
      name: item.name,
      normalizedName: item.name.toLowerCase(),
      category: 'dish',
      confidence: item.confidence,
      confidenceTier: 'high',
      totalRegions: 1,
      regionIds: [item.detectionId || `reg-${idx}`],
      regions: [],
      portion: {
        value: item.estimatedGrams,
        quantity: item.portionMultiplier,
        unit: item.portionUnit,
        estimatedGrams: item.estimatedGrams,
        status: 'estimated',
        estimationMethod: 'catalogue_default',
        confidence: item.confidence,
        userConfirmed: false,
        formattedDisplay: `≈ ${item.estimatedGrams}g`,
        isPieceBased: item.portionUnit === 'piece',
      },
      identificationMode: 'local',
      nutritionReference: {
        isAvailable: true,
        isEstimated: false,
        source: 'local_database',
      },
      needsConfirmation: false,
    }));

    const analysis = nutritionAnalysisService.analyzeMeal(
      mealNutritionSummary,
      mealComponents,
      userProfile,
      'meal'
    );

    return {
      id: `meal-${Date.now()}`,
      mealTitle: mealTitle || (items.length > 0 ? items.map(i => i.name).join(' + ') : 'Scanned Meal'),
      analyzedAt: new Date().toISOString(),
      imagePreviewUrl: imageUrl,
      items,
      totalNutrition,
      macroDistribution,
      nutrientRichness,
      nutrientGaps,
      balanceAssessment,
      positiveHighlights,
      balancingRecommendations,
      hostelFriendlyUpgrades,
      hostelModeActive: isHostelMode,
      practicalAdjustments,
      disclaimer:
        'Nutritional figures are educational estimates derived from visual portion sizing and standard culinary references. Cooking oils and canteen variations naturally differ. Not intended for clinical or medical treatment.',
      analysis,
    };
  }
}
