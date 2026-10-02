/**
 * Personalized Nutrition Analysis & 5-Star Scoring Engine (Phase 6.4)
 *
 * Evaluates meal nutrition against user profile baselines and computes
 * a transparent, deterministic 5-star nutrient richness score across 5 key dimensions:
 * 1. Protein adequacy
 * 2. Fiber adequacy
 * 3. Carbohydrate balance
 * 4. Fat balance
 * 5. Overall meal balance & variety
 *
 * IMPORTANT:
 * - Deterministic: same meal + same profile => identical reproducible score
 * - Honest & respectful: zero food-shaming, conservative guidance
 * - Safe: zero medical diagnosis or clinical prescription
 */

import {
  MealPersonalizedAnalysis,
  MealContext,
  DailyEnergyEstimate,
  MealNutrientTargets,
  ScoreDimensionMap,
  DimensionStatus,
} from '../types/personalizedAnalysis';
import { MealNutritionSummary, MealComponent } from '../types/mealComposition';
import { UserProfile, validateUserProfile } from '../types/profile';
import { nutritionRecommendationService } from './nutritionRecommendationService';

export class NutritionAnalysisService {
  /**
   * Main Phase 6.4 Entrypoint:
   * Analyzes a structured meal's nutrition against user profile and meal context.
   */
  public analyzeMeal(
    nutrition: MealNutritionSummary | undefined,
    components: MealComponent[] = [],
    profile?: Partial<UserProfile> | null,
    mealContext: MealContext = 'meal'
  ): MealPersonalizedAnalysis {
    const validation = validateUserProfile(profile);
    const validProfile = validation.validatedProfile;

    // 1. Calculate Estimated Daily Energy & Meal Targets
    const dailyEnergy = this.estimateDailyEnergy(validProfile);
    const targets = this.calculateMealTargets(dailyEnergy.estimatedDailyCalories, mealContext, validProfile);

    // Safe fallback if meal nutrition is missing or empty
    const safeNutrition: MealNutritionSummary = nutrition || {
      calories: 0,
      carbohydrates: 0,
      protein: 0,
      fat: 0,
      fiber: 0,
      confidence: 0,
      status: 'unmapped',
      nutritionCompleteness: 'unmapped',
      disclaimer: 'No nutritional data available.',
      formattedCalories: '0 kcal',
    };

    // 2. Compute 5-Star Score & 5 Dimensional Breakdown
    const { dimensions, overallScore, stars, starDisplay, scoreLabel, summary, gaps, imbalances } =
      this.evaluateScore(safeNutrition, components);

    // 3. Generate Personalized, Hostel-Friendly Recommendations
    const existingFoodNames = components.map(c => c.name);
    const recResult = nutritionRecommendationService.getRecommendations({
      gaps,
      imbalances,
      existingFoodNames,
      profile: validProfile,
    });

    // 4. Health Condition Notice (Conservative safety, no diagnosis)
    let healthNotice: string | undefined;
    if (validProfile?.healthCondition && validProfile.healthCondition.toLowerCase() !== 'none') {
      healthNotice =
        'Because you indicated a health condition, consider discussing personalized dietary needs with a qualified healthcare professional. This guidance provides general nutrition heuristics and does not constitute medical advice or diagnosis.';
    }

    const isHostelite = Boolean(validProfile?.isHostelite ?? true);
    const profileStatus = validation.hasSufficientData ? 'personalized' : (profile ? 'insufficient_profile' : 'standard');

    let disclaimer = 'Nutritional analysis is based on estimated portions and standard regional food data, not laboratory measurements or clinical advice.';
    if (safeNutrition.nutritionCompleteness === 'partial') {
      disclaimer = `Analysis is partial: ${safeNutrition.disclaimer}`;
    }

    return {
      overallScore,
      stars,
      starDisplay,
      scoreLabel,
      summary,
      dailyEnergy,
      targets,
      dimensions,
      nutrientAssessment: {
        protein: { status: dimensions.protein.status, score: dimensions.protein.score, label: dimensions.protein.label },
        fiber: { status: dimensions.fiber.status, score: dimensions.fiber.score, label: dimensions.fiber.label },
        carbohydrates: { status: dimensions.carbohydrates.status, score: dimensions.carbohydrates.score, label: dimensions.carbohydrates.label },
        fat: { status: dimensions.fat.status, score: dimensions.fat.score, label: dimensions.fat.label },
        mealBalance: { status: dimensions.mealBalance.status, score: dimensions.mealBalance.score, label: dimensions.mealBalance.label },
      },
      gaps,
      imbalances,
      recommendations: recResult.all,
      primaryRecommendation: recResult.primary,
      alternativeRecommendations: recResult.alternatives,
      hostelModeActive: isHostelite,
      hostelBadgeText: isHostelite ? '🏠 HOSTEL MODE • Optimized for foods available around campus' : undefined,
      healthNotice,
      profileStatus,
      disclaimer,
    };
  }

  /**
   * Estimates baseline daily energy requirements using Mifflin-St Jeor / ICMR standards.
   */
  public estimateDailyEnergy(profile?: UserProfile): DailyEnergyEstimate {
    if (!profile || !profile.age || !profile.heightCm || !profile.weightKg) {
      return {
        estimatedDailyCalories: null,
        calculationMethod: 'insufficient_profile',
        confidence: 0,
        status: 'insufficient_profile',
        disclaimer: 'Complete your profile with age, height, and weight for personalized daily caloric estimations.',
      };
    }

    // Mifflin-St Jeor BMR formula
    let bmr = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age;
    if (profile.gender === 'male') {
      bmr += 5;
    } else if (profile.gender === 'female') {
      bmr -= 161;
    } else {
      bmr -= 78; // Neutral midpoint
    }

    // Physical activity multiplier
    let multiplier = 1.35; // Standard active student baseline
    if (profile.activityLevel === 'sedentary') multiplier = 1.2;
    else if (profile.activityLevel === 'lightly_active') multiplier = 1.375;
    else if (profile.activityLevel === 'moderately_active') multiplier = 1.55;
    else if (profile.activityLevel === 'very_active') multiplier = 1.725;

    const estimatedDailyCalories = Math.round(bmr * multiplier);

    return {
      estimatedDailyCalories,
      calculationMethod: 'mifflin_st_jeor',
      confidence: 0.85,
      status: 'calculated',
      disclaimer: 'Estimated daily requirement based on Mifflin-St Jeor standard; individual metabolic rates vary.',
    };
  }

  /**
   * Calculates realistic nutrient target ranges for a specific meal context.
   */
  public calculateMealTargets(
    dailyCalories: number | null,
    mealContext: MealContext,
    profile?: UserProfile
  ): MealNutrientTargets {
    const fractions: Record<MealContext, number> = {
      breakfast: 0.25,
      lunch: 0.35,
      dinner: 0.30,
      snack: 0.15,
      meal: 0.33,
    };

    const fraction = fractions[mealContext] || 0.33;
    const baseDailyCal = dailyCalories || 2000;
    const isPersonalized = Boolean(dailyCalories);

    const mealCal = Math.round(baseDailyCal * fraction);
    const weight = profile?.weightKg || 60;
    const dailyProtein = Math.round(weight * 0.9); // ~0.9g/kg
    const mealProtein = Math.round(dailyProtein * fraction);

    return {
      mealContext,
      allocationFraction: fraction,
      calories: {
        target: mealCal,
        min: Math.round(mealCal * 0.8),
        max: Math.round(mealCal * 1.2),
        unit: 'kcal',
      },
      protein: {
        target: Math.max(15, mealProtein),
        min: Math.max(12, Math.round(mealProtein * 0.8)),
        max: Math.round(mealProtein * 1.3),
        unit: 'g',
      },
      carbohydrates: {
        target: Math.round((mealCal * 0.55) / 4),
        min: Math.round((mealCal * 0.45) / 4),
        max: Math.round((mealCal * 0.65) / 4),
        unit: 'g',
      },
      fat: {
        target: Math.round((mealCal * 0.25) / 9),
        min: Math.round((mealCal * 0.20) / 9),
        max: Math.round((mealCal * 0.35) / 9),
        unit: 'g',
      },
      fiber: {
        target: Math.round(28 * fraction), // ~9g for major meal
        min: Math.round(20 * fraction),
        max: Math.round(35 * fraction),
        unit: 'g',
      },
      status: isPersonalized ? 'personalized' : 'standard_heuristic',
    };
  }

  /**
   * Deterministic 5-Star scoring across the 5 required dimensions:
   * 1. Protein adequacy
   * 2. Fiber adequacy
   * 3. Carbohydrate balance
   * 4. Fat balance
   * 5. Overall meal balance
   */
  private evaluateScore(
    nutrition: MealNutritionSummary,
    components: MealComponent[]
  ): {
    dimensions: ScoreDimensionMap;
    overallScore: number;
    stars: number;
    starDisplay: string;
    scoreLabel: string;
    summary: string;
    gaps: string[];
    imbalances: string[];
  } {
    const totalCal = Math.max(1, nutrition.calories);
    const proteinGrams = nutrition.protein;
    const fiberGrams = nutrition.fiber;
    const carbsGrams = nutrition.carbohydrates;
    const fatGrams = nutrition.fat;

    const carbsCalPct = ((carbsGrams * 4) / totalCal) * 100;
    const fatCalPct = ((fatGrams * 9) / totalCal) * 100;
    const proteinCalPct = ((proteinGrams * 4) / totalCal) * 100;

    const gaps: string[] = [];
    const imbalances: string[] = [];

    // --- DIMENSION 1: PROTEIN ADEQUACY (1 - 5) ---
    let proteinScore = 3;
    let proteinStatus: DimensionStatus = 'could_improve';
    let proteinLabel = 'Could improve';
    let proteinCommentary = 'Supplies modest protein; consider adding a legume or dairy source.';

    if (proteinGrams >= 20 || proteinCalPct >= 18) {
      proteinScore = 5;
      proteinStatus = 'good';
      proteinLabel = 'Good';
      proteinCommentary = 'Substantial protein support for physical stamina and sustained satiety.';
    } else if (proteinGrams >= 15 || proteinCalPct >= 14) {
      proteinScore = 4;
      proteinStatus = 'good';
      proteinLabel = 'Good';
      proteinCommentary = 'Solid protein contribution meeting recommended meal benchmarks.';
    } else if (proteinGrams >= 9) {
      proteinScore = 3;
      proteinStatus = 'could_improve';
      proteinLabel = 'Could improve';
      proteinCommentary = 'Modest protein; adding sprouts, curd, or an egg would balance the meal.';
      gaps.push('protein');
    } else {
      proteinScore = 2;
      proteinStatus = 'low';
      proteinLabel = 'Low';
      proteinCommentary = 'Low protein contribution relative to caloric density.';
      gaps.push('protein');
    }

    // --- DIMENSION 2: FIBER ADEQUACY (1 - 5) ---
    let fiberScore = 3;
    let fiberStatus: DimensionStatus = 'could_improve';
    let fiberLabel = 'Could improve';
    let fiberCommentary = 'Modest dietary fiber; could benefit from whole grains, legumes, or vegetables.';

    if (fiberGrams >= 9.5) {
      fiberScore = 5;
      fiberStatus = 'good';
      fiberLabel = 'Good';
      fiberCommentary = 'Generous dietary fiber supporting smooth digestion and prolonged satiety.';
    } else if (fiberGrams >= 6.5) {
      fiberScore = 4;
      fiberStatus = 'good';
      fiberLabel = 'Good';
      fiberCommentary = 'Satisfactory fiber content helping regulate energy release.';
    } else if (fiberGrams >= 3.5) {
      fiberScore = 3;
      fiberStatus = 'could_improve';
      fiberLabel = 'Could improve';
      fiberCommentary = 'Moderate fiber; pairing with unpeeled fruit, salad, or sprouts would elevate gut health.';
      gaps.push('fiber');
    } else {
      fiberScore = 2;
      fiberStatus = 'low';
      fiberLabel = 'Low';
      fiberCommentary = 'Low fiber; predominantly refined or concentrated calories.';
      gaps.push('fiber');
    }

    // --- DIMENSION 3: CARBOHYDRATE BALANCE (1 - 5) ---
    let carbScore = 4;
    let carbStatus: DimensionStatus = 'balanced';
    let carbLabel = 'Balanced';
    let carbCommentary = 'Balanced carbohydrate contribution providing steady study energy.';

    if (carbsCalPct >= 72 || (carbsGrams >= 90 && totalCal < 650)) {
      carbScore = 3;
      carbStatus = 'relatively_high';
      carbLabel = 'Relatively high';
      carbCommentary = 'Carbohydrate-dominant energy split; adding protein or fiber will lower glycemic impact.';
      imbalances.push('relatively_high_carbs');
    } else if (carbsCalPct >= 65) {
      carbScore = 4;
      carbStatus = 'balanced';
      carbLabel = 'Balanced';
      carbCommentary = 'Steady grain energy providing reliable study fuel.';
    } else if (carbsCalPct >= 45 && carbsCalPct < 65) {
      carbScore = 5;
      carbStatus = 'balanced';
      carbLabel = 'Balanced';
      carbCommentary = 'Ideal carbohydrate-to-calorie balance.';
    } else if (carbsCalPct < 30) {
      carbScore = 3;
      carbStatus = 'relatively_low';
      carbLabel = 'Relatively low';
      carbCommentary = 'Low carbohydrate contribution.';
    }

    // --- DIMENSION 4: FAT BALANCE (1 - 5) ---
    let fatScore = 4;
    let fatStatus: DimensionStatus = 'balanced';
    let fatLabel = 'Balanced';
    let fatCommentary = 'Moderate dietary fat supporting fat-soluble nutrient absorption.';

    if (fatCalPct > 42) {
      fatScore = 3;
      fatStatus = 'relatively_high';
      fatLabel = 'Relatively high';
      fatCommentary = 'Higher percentage of energy from fats or frying; pairing with cooling chaas or curd helps digestion.';
      imbalances.push('relatively_high_fat');
    } else if (fatCalPct >= 18 && fatCalPct <= 35) {
      fatScore = 4;
      fatStatus = 'balanced';
      fatLabel = 'Balanced';
      fatCommentary = 'Harmonious fat balance for flavor and nutrient transport.';
    } else if (fatCalPct < 15) {
      fatScore = 3;
      fatStatus = 'relatively_low';
      fatLabel = 'Relatively low';
      fatCommentary = 'Very low dietary fat.';
    }

    // --- DIMENSION 5: OVERALL MEAL BALANCE & VARIETY (1 - 5) ---
    let balanceScore = 3;
    let balanceStatus: DimensionStatus = 'could_improve';
    let balanceLabel = 'Moderate';
    let balanceCommentary = 'Good foundational meal that would benefit from greater food group diversity.';

    // Check food group diversity: grains + legumes + veggies + condiment
    const categories = new Set(components.map(c => c.category));
    const compCount = components.length;

    // Check for ultra-processed items
    const hasChipsOrSweets = components.some(c =>
      c.foodId.includes('chips') || c.foodId.includes('juice') || c.name.toLowerCase().includes('chips')
    );

    if (hasChipsOrSweets && compCount <= 2 && proteinGrams < 8) {
      balanceScore = 2;
      balanceStatus = 'could_improve';
      balanceLabel = 'Could improve';
      balanceCommentary = 'Quick energy snack with lower overall nutrient density; easily balanced with sprouts or boiled eggs.';
    } else if (categories.size >= 3 || (compCount >= 3 && proteinScore >= 4 && fiberScore >= 4)) {
      balanceScore = 5;
      balanceStatus = 'good';
      balanceLabel = 'Good';
      balanceCommentary = 'Excellent variety across complementary Indian food groups.';
    } else if (compCount >= 2 && (proteinScore >= 3 || fiberScore >= 3)) {
      balanceScore = 4;
      balanceStatus = 'good';
      balanceLabel = 'Good';
      balanceCommentary = 'Good overall balance of staple food groups.';
    }

    // Helper to generate visual text bar (e.g. ████████░░)
    const makeTextBar = (score: number): { percent: number; text: string } => {
      const clamped = Math.max(1, Math.min(5, score));
      const percent = clamped * 20;
      const filledBlocks = clamped * 2;
      const emptyBlocks = 10 - filledBlocks;
      const text = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);
      return { percent, text };
    };

    const barProtein = makeTextBar(proteinScore);
    const barFiber = makeTextBar(fiberScore);
    const barCarbs = makeTextBar(carbScore);
    const barFat = makeTextBar(fatScore);
    const barBalance = makeTextBar(balanceScore);

    const dimensions: ScoreDimensionMap = {
      protein: {
        score: proteinScore,
        status: proteinStatus,
        label: proteinLabel,
        percentBar: barProtein.percent,
        textBar: barProtein.text,
        commentary: proteinCommentary,
      },
      fiber: {
        score: fiberScore,
        status: fiberStatus,
        label: fiberLabel,
        percentBar: barFiber.percent,
        textBar: barFiber.text,
        commentary: fiberCommentary,
      },
      carbohydrates: {
        score: carbScore,
        status: carbStatus,
        label: carbLabel,
        percentBar: barCarbs.percent,
        textBar: barCarbs.text,
        commentary: carbCommentary,
      },
      fat: {
        score: fatScore,
        status: fatStatus,
        label: fatLabel,
        percentBar: barFat.percent,
        textBar: barFat.text,
        commentary: fatCommentary,
      },
      mealBalance: {
        score: balanceScore,
        status: balanceStatus,
        label: balanceLabel,
        percentBar: barBalance.percent,
        textBar: barBalance.text,
        commentary: balanceCommentary,
      },
    };

    // Calculate overall 5-star score (step 0.5)
    const rawAverage = (proteinScore + fiberScore + carbScore + fatScore + balanceScore) / 5;
    const overallScore = Math.round(rawAverage * 2) / 2; // step 0.5
    const stars = overallScore;

    // Star display string
    const fullStars = Math.floor(overallScore);
    const hasHalf = overallScore % 1 !== 0;
    const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);
    const starDisplay = '⭐'.repeat(fullStars) + (hasHalf ? '½' : '') + '☆'.repeat(emptyStars);

    // Human-readable summary
    let scoreLabel = 'Good';
    let summary = 'Good overall balance.';

    if (overallScore >= 4.5) {
      scoreLabel = 'Nutrient Rich';
      summary = 'Exceptional nutritional density with high protein, rich fiber, and balanced fuel.';
    } else if (overallScore >= 4.0) {
      scoreLabel = 'Good';
      if (proteinScore >= 4 && fiberScore < 4) {
        summary = 'Good meal overall — protein is decent, but fiber could be higher.';
      } else if (carbStatus === 'relatively_high') {
        summary = 'Good overall balance. Your meal is slightly carb-heavy and could use a little more protein.';
      } else {
        summary = 'Good overall balance. High variety across your food components.';
      }
    } else if (overallScore >= 3.0) {
      scoreLabel = 'Moderate';
      if (gaps.includes('protein')) {
        summary = 'Decent energy baseline. Your meal could use a little more protein to sustain fullness.';
      } else if (gaps.includes('fiber')) {
        summary = 'Satisfying meal. Adding fresh fiber or sprouts will support smoother digestion.';
      } else {
        summary = 'Moderate nutritional balance. Consider adding a protein or fiber side.';
      }
    } else {
      scoreLabel = 'Could improve';
      summary = 'High immediate energy with lower micronutrient density; balance it with sprouts, boiled eggs, or curd.';
    }

    return {
      dimensions,
      overallScore,
      stars,
      starDisplay,
      scoreLabel,
      summary,
      gaps,
      imbalances,
    };
  }
}

export const nutritionAnalysisService = new NutritionAnalysisService();
