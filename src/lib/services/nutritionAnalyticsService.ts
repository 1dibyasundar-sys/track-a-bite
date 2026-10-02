/**
 * Nutrition Analytics Service (Phase 8.4)
 *
 * Transforms stored meal scans into personalized nutrition analytics,
 * daily and weekly aggregations, target progress metrics, deterministic
 * nutrition scoring, evidence-based insights, and hostel-aware next-meal recommendations.
 *
 * Architectural Guarantees:
 * - Deterministic: identical meals + profile => identical analytics & scores
 * - Authoritative: Firestore primary for authenticated users, local storage fallback
 * - Resilient: zero unhandled crashes on network/Firestore failure
 * - Safe: zero medical diagnoses or clinical prescriptions
 * - Security: authenticated UID context enforcement, zero credentials persisted
 */

import { MealAnalysis } from '../types/meal';
import { UserProfile, validateUserProfile } from '../types/profile';
import {
  DailyNutritionSummary,
  WeeklyNutritionSummary,
  NutritionInsight,
  NextMealRecommendation,
  NutritionTarget,
  NutritionScoreResult,
  NutritionScoreBreakdown,
  NutritionScoreRating,
  ConsistencyMetrics,
  MicronutrientIntake,
  MicronutrientDataAvailability,
  MicronutrientStatus,
  MicronutrientProgressItem,
  DailyMicronutrientSummary,
  DashboardStreakMetrics,
  SmartNudge,
  NudgePriority,
  GoalProgressSummary,
  SupportedHealthGoal,
  HostelFilterMode,
  RecommendationPrepType,
  RecommendationAffordabilityCategory,
} from '../types/analytics';
import { HydrationSummary } from '../types/hydration';
import { hydrationService } from './hydrationService';
import {
  NutritionDateRange,
  NutritionDateRangePreset,
  NutritionTrendPoint,
  LongitudinalInsight,
  MonthlyNutritionReport,
  NutritionReport,
  ScoreDistribution,
  DayScorePoint,
  SanitizedExportPayload,
  SanitizedExportMealItem,
  NutritionExportResult,
} from '../types/reporting';
import { firestoreMealHistoryService } from './firestoreMealHistoryService';
import { mealHistoryService } from './index';

/**
 * Normalizes any Date or ISO string to the local calendar day format YYYY-MM-DD.
 * Prevents UTC timezone shift errors when meals are logged near midnight.
 */
export function getLocalISODate(dateInput: Date | string = new Date()): string {
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
}

/**
 * Generates an array of YYYY-MM-DD date strings for the past N calendar days up to referenceDate.
 */
export function getPastNDaysDates(n: number = 7, referenceDate: Date | string = new Date()): string[] {
  const dates: string[] = [];
  const ref = typeof referenceDate === 'string' ? new Date(referenceDate) : new Date(referenceDate);
  if (isNaN(ref.getTime())) return dates;

  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(ref);
    d.setDate(ref.getDate() - i);
    dates.push(getLocalISODate(d));
  }
  return dates;
}

export const MICRONUTRIENT_REFERENCE_TARGETS: Record<
  keyof MicronutrientIntake,
  { name: string; unit: 'mg' | 'mcg'; reference: number }
> = {
  ironMg: { name: 'Iron', unit: 'mg', reference: 18 },
  calciumMg: { name: 'Calcium', unit: 'mg', reference: 1000 },
  vitaminDMcg: { name: 'Vitamin D', unit: 'mcg', reference: 15 },
  potassiumMg: { name: 'Potassium', unit: 'mg', reference: 3500 },
  sodiumMg: { name: 'Sodium', unit: 'mg', reference: 2000 },
  vitaminB12Mcg: { name: 'Vitamin B12', unit: 'mcg', reference: 2.4 },
  folateMcg: { name: 'Folate', unit: 'mcg', reference: 400 },
};

export class NutritionAnalyticsService {
  /**
   * Aggregates micronutrient intake across meals for a given calendar date.
   * Handles optional/nullable items without inventing data.
   */
  public aggregateMicronutrientsForMeals(
    meals: MealAnalysis[],
    dateKey: string
  ): DailyMicronutrientSummary {
    const rawSums: Record<keyof MicronutrientIntake, number> = {
      ironMg: 0,
      calciumMg: 0,
      vitaminDMcg: 0,
      potassiumMg: 0,
      sodiumMg: 0,
      vitaminB12Mcg: 0,
      folateMcg: 0,
    };

    const providedCounts: Record<keyof MicronutrientIntake, number> = {
      ironMg: 0,
      calciumMg: 0,
      vitaminDMcg: 0,
      potassiumMg: 0,
      sodiumMg: 0,
      vitaminB12Mcg: 0,
      folateMcg: 0,
    };

    let totalItemsScanned = 0;

    for (const m of meals) {
      if (Array.isArray(m.items) && m.items.length > 0) {
        for (const it of m.items) {
          totalItemsScanned++;
          const micros =
            it.micronutrients ||
            (it.nutritionResult?.micronutrients as Record<string, number | undefined>) ||
            {};

          const checkNutrient = (key: keyof MicronutrientIntake, ...aliases: (string | undefined)[]) => {
            for (const alias of aliases) {
              if (alias !== undefined && typeof (micros as Record<string, unknown>)[alias] === 'number') {
                const val = Number((micros as Record<string, unknown>)[alias]);
                if (!isNaN(val) && isFinite(val) && val >= 0) {
                  rawSums[key] += val;
                  providedCounts[key]++;
                  return;
                }
              }
            }
          };

          checkNutrient('ironMg', 'iron', 'ironMg');
          checkNutrient('calciumMg', 'calcium', 'calciumMg');
          checkNutrient('vitaminDMcg', 'vitaminD', 'vitaminDMcg');
          checkNutrient('potassiumMg', 'potassium', 'potassiumMg');

          if (
            typeof it.nutrition?.sodium === 'number' &&
            !isNaN(it.nutrition.sodium) &&
            isFinite(it.nutrition.sodium) &&
            it.nutrition.sodium >= 0
          ) {
            rawSums.sodiumMg += it.nutrition.sodium;
            providedCounts.sodiumMg++;
          } else {
            checkNutrient('sodiumMg', 'sodium', 'sodiumMg');
          }

          checkNutrient('vitaminB12Mcg', 'vitaminB12', 'vitaminB12Mcg');
          checkNutrient('folateMcg', 'folate', 'folateMcg');
        }
      } else if (m.totalNutrition) {
        totalItemsScanned++;
        if (
          typeof m.totalNutrition.sodium === 'number' &&
          !isNaN(m.totalNutrition.sodium) &&
          isFinite(m.totalNutrition.sodium) &&
          m.totalNutrition.sodium >= 0
        ) {
          rawSums.sodiumMg += m.totalNutrition.sodium;
          providedCounts.sodiumMg++;
        }
      }
    }

    const intake: MicronutrientIntake = {};
    const nutrients: Record<keyof MicronutrientIntake, MicronutrientProgressItem> = {} as Record<
      keyof MicronutrientIntake,
      MicronutrientProgressItem
    >;

    let overallRecordedCount = 0;

    for (const [keyStr, refInfo] of Object.entries(MICRONUTRIENT_REFERENCE_TARGETS)) {
      const key = keyStr as keyof MicronutrientIntake;
      const consumedRaw = rawSums[key];
      const itemsWithData = providedCounts[key];
      const consumed = Math.round(consumedRaw * 10) / 10;

      let dataAvailability: MicronutrientDataAvailability = 'none';
      if (itemsWithData > 0) {
        intake[key] = consumed;
        overallRecordedCount++;
        if (totalItemsScanned > 0 && itemsWithData >= totalItemsScanned) {
          dataAvailability = 'sufficient';
        } else {
          dataAvailability = 'limited';
        }
      }

      const percentage =
        refInfo.reference > 0 ? Math.round((consumed / refInfo.reference) * 100) : 0;

      let status: MicronutrientStatus = 'insufficient_data';
      if (dataAvailability !== 'none') {
        if (key === 'sodiumMg') {
          status = consumed > refInfo.reference ? 'above_reference' : 'on_track';
        } else {
          status = percentage >= 90 ? 'on_track' : 'below_reference';
        }
      }

      nutrients[key] = {
        key,
        name: refInfo.name,
        unit: refInfo.unit,
        consumed,
        referenceTarget: refInfo.reference,
        percentage,
        dataAvailability,
        status,
        label: 'Reference intake',
      };
    }

    const overallAvailability: MicronutrientDataAvailability =
      overallRecordedCount >= 4 ? 'sufficient' : overallRecordedCount > 0 ? 'limited' : 'none';

    return {
      date: dateKey,
      intake,
      nutrients,
      dataAvailability: overallAvailability,
      recordedItemsCount: overallRecordedCount,
      disclaimer:
        'General reference intake based on standard dietary guidelines for adults. Not intended for clinical diagnosis or medical treatment.',
    };
  }
  /**
   * Calculates recommended daily nutritional targets using Mifflin-St Jeor formula
   * or safe application baseline heuristic, taking into account biometric metrics,
   * activity level, and health goals.
   */
  public calculateRecommendedTargets(profile?: Partial<UserProfile> | null): NutritionTarget {
    const validation = validateUserProfile(profile);
    const validProfile = validation.validatedProfile;

    // 1. Compute via Mifflin-St Jeor formula if biometric metrics exist
    if (validProfile?.weightKg && validProfile?.heightCm && validProfile?.age) {
      let bmr = 10 * validProfile.weightKg + 6.25 * validProfile.heightCm - 5 * validProfile.age;
      if (validProfile.gender === 'male') {
        bmr += 5;
      } else if (validProfile.gender === 'female') {
        bmr -= 161;
      } else {
        bmr -= 78;
      }

      // Activity multiplier
      let multiplier = 1.35; // Standard active student baseline
      if (validProfile.activityLevel === 'sedentary') multiplier = 1.2;
      else if (validProfile.activityLevel === 'lightly_active') multiplier = 1.375;
      else if (validProfile.activityLevel === 'moderately_active') multiplier = 1.55;
      else if (validProfile.activityLevel === 'very_active') multiplier = 1.725;

      let targetCalories = Math.round(bmr * multiplier);

      // Health goal adjustments
      if (validProfile.healthGoal === 'fat_loss') {
        targetCalories = Math.max(1200, targetCalories - 300);
      } else if (validProfile.healthGoal === 'muscle_gain') {
        targetCalories += 300;
      }

      // Protein target based on bodyweight & goal
      let proteinMultiplier = 0.9; // Baseline RDA for adults (~0.8-1.0 g/kg)
      if (validProfile.healthGoal === 'muscle_gain') proteinMultiplier = 1.5;
      else if (validProfile.healthGoal === 'fat_loss') proteinMultiplier = 1.2;

      const targetProteinG = Math.max(45, Math.round(validProfile.weightKg * proteinMultiplier));
      const targetCarbsG = Math.round((targetCalories * 0.50) / 4);
      const targetFatG = Math.round((targetCalories * 0.25) / 9);

      return {
        targetCalories,
        targetProteinG,
        targetCarbsG,
        targetFatG,
        targetFiberG: 28,
        isPersonalized: true,
        calculationMethod: 'mifflin_st_jeor',
        targetTypeLabel: 'Recommended target',
      };
    }

    // 2. Fallback standard heuristic guidelines adjusted for goal
    let baseCalories = 2000;
    let baseProtein = 55;
    if (validProfile?.healthGoal === 'muscle_gain') {
      baseCalories = 2300;
      baseProtein = 75;
    } else if (validProfile?.healthGoal === 'fat_loss') {
      baseCalories = 1700;
      baseProtein = 65;
    }

    return {
      targetCalories: baseCalories,
      targetProteinG: baseProtein,
      targetCarbsG: Math.round((baseCalories * 0.50) / 4),
      targetFatG: Math.round((baseCalories * 0.25) / 9),
      targetFiberG: 28,
      isPersonalized: false,
      calculationMethod: 'standard_heuristic',
      targetTypeLabel: 'Recommended target',
    };
  }

  /**
   * Helper to calculate macro calorie contribution and variance from calorie target.
   * Protein = 4 kcal/g, Carbs = 4 kcal/g, Fat = 9 kcal/g.
   */
  public calculateMacroCalories(
    proteinG: number,
    carbsG: number,
    fatG: number,
    targetCalories?: number
  ): {
    proteinCalories: number;
    carbsCalories: number;
    fatCalories: number;
    totalMacroCalories: number;
    calorieVariance: number;
    hasSignificantVariance: boolean;
  } {
    const proteinCalories = Math.round(Math.max(0, proteinG) * 4);
    const carbsCalories = Math.round(Math.max(0, carbsG) * 4);
    const fatCalories = Math.round(Math.max(0, fatG) * 9);
    const totalMacroCalories = proteinCalories + carbsCalories + fatCalories;
    const calorieVariance =
      targetCalories !== undefined && targetCalories > 0
        ? Math.abs(totalMacroCalories - targetCalories)
        : 0;
    const hasSignificantVariance = calorieVariance > 150;

    return {
      proteinCalories,
      carbsCalories,
      fatCalories,
      totalMacroCalories,
      calorieVariance,
      hasSignificantVariance,
    };
  }

  /**
   * Calculates daily nutritional targets.
   * Priority:
   * 1. Explicit user-defined custom targets from profile if active.
   * 2. Mifflin-St Jeor BMR formula adjusted for activity and health goal.
   * 3. Standard heuristic baselines if profile data is insufficient.
   */
  public calculateDailyTargets(profile?: Partial<UserProfile> | null): NutritionTarget {
    const validation = validateUserProfile(profile);
    const validProfile = validation.validatedProfile;

    // 1. Check for explicit user-specified custom targets
    const hasCustomActive =
      validProfile?.customTargetsActive === true ||
      (validProfile?.customTargetsActive !== false &&
        Boolean(
          validProfile?.targetCalories &&
          validProfile.targetCalories > 0 &&
          validProfile?.targetProteinG !== undefined
        ));

    if (
      hasCustomActive &&
      validProfile?.targetCalories &&
      validProfile.targetCalories > 0
    ) {
      const targetCalories = Math.round(validProfile.targetCalories);
      const targetProteinG =
        validProfile.targetProteinG !== undefined
          ? Math.round(validProfile.targetProteinG)
          : Math.round((targetCalories * 0.20) / 4);
      const targetCarbsG =
        validProfile.targetCarbsG !== undefined
          ? Math.round(validProfile.targetCarbsG)
          : Math.round((targetCalories * 0.50) / 4);
      const targetFatG =
        validProfile.targetFatG !== undefined
          ? Math.round(validProfile.targetFatG)
          : Math.round((targetCalories * 0.25) / 9);

      return {
        targetCalories,
        targetProteinG,
        targetCarbsG,
        targetFatG,
        targetFiberG: 28,
        isPersonalized: true,
        calculationMethod: 'user_defined',
        targetTypeLabel: 'Custom target',
      };
    }

    // 2 & 3. Compute recommended targets via Mifflin-St Jeor or safe heuristics
    return this.calculateRecommendedTargets(validProfile);
  }

  /**
   * Deterministic 0-100 Nutrition Score Calculation.
   *
   * Scoring Breakdown (100 total points):
   * 1. Calorie Alignment (0-25 pts): How appropriately energy intake matches target.
   * 2. Protein Adequacy (0-30 pts): How effectively protein goals are met.
   * 3. Macronutrient Balance (0-25 pts): Proportionality between carbs, protein, and fat.
   * 4. Fiber & Dietary Diversity (0-20 pts): Adequate dietary fiber and multi-meal consistency.
   */
  public calculateNutritionScore(
    intake: {
      totalCalories: number;
      totalProteinG: number;
      totalCarbsG: number;
      totalFatG: number;
      totalFiberG?: number;
      mealCount: number;
    },
    targets: {
      targetCalories: number;
      targetProteinG: number;
      targetCarbsG: number;
      targetFatG: number;
    }
  ): NutritionScoreResult {
    if (intake.mealCount === 0 || intake.totalCalories === 0) {
      return {
        score: 0,
        rating: 'needs_attention',
        breakdown: { caloriesScore: 0, proteinScore: 0, macroBalanceScore: 0, fiberDiversityScore: 0 },
        explanation: 'No meal data logged for this date yet.',
      };
    }

    // 1. Calorie Alignment Score (0 - 25)
    let caloriesScore = 5;
    const calRatio = targets.targetCalories > 0 ? intake.totalCalories / targets.targetCalories : 1.0;
    if (calRatio >= 0.85 && calRatio <= 1.15) {
      caloriesScore = 25;
    } else if ((calRatio >= 0.70 && calRatio < 0.85) || (calRatio > 1.15 && calRatio <= 1.30)) {
      caloriesScore = 18;
    } else if ((calRatio >= 0.50 && calRatio < 0.70) || (calRatio > 1.30 && calRatio <= 1.50)) {
      caloriesScore = 12;
    } else {
      caloriesScore = 6;
    }

    // 2. Protein Adequacy Score (0 - 30)
    let proteinScore = 6;
    const protRatio = targets.targetProteinG > 0 ? intake.totalProteinG / targets.targetProteinG : 1.0;
    if (protRatio >= 0.90) {
      proteinScore = 30;
    } else if (protRatio >= 0.75) {
      proteinScore = 24;
    } else if (protRatio >= 0.60) {
      proteinScore = 18;
    } else if (protRatio >= 0.40) {
      proteinScore = 12;
    } else {
      proteinScore = 6;
    }

    // 3. Macronutrient Balance Score (0 - 25)
    let macroBalanceScore = 12;
    const totalEnergyFromMacros =
      intake.totalProteinG * 4 + intake.totalCarbsG * 4 + intake.totalFatG * 9;

    if (totalEnergyFromMacros > 0) {
      const pRatio = (intake.totalProteinG * 4) / totalEnergyFromMacros;
      const cRatio = (intake.totalCarbsG * 4) / totalEnergyFromMacros;
      const fRatio = (intake.totalFatG * 9) / totalEnergyFromMacros;

      // Ideal range: Protein 15-30%, Carbs 40-65%, Fat 20-35%
      const pGood = pRatio >= 0.12 && pRatio <= 0.35;
      const cGood = cRatio >= 0.38 && cRatio <= 0.68;
      const fGood = fRatio >= 0.15 && fRatio <= 0.38;

      if (pGood && cGood && fGood) {
        macroBalanceScore = 25;
      } else if ((pGood && cGood) || (cGood && fGood) || (pGood && fGood)) {
        macroBalanceScore = 18;
      } else {
        macroBalanceScore = 10;
      }
    }

    // 4. Fiber & Dietary Diversity Score (0 - 20)
    const fiber = intake.totalFiberG || 0;
    let fiberScore = 5;
    if (fiber >= 20) fiberScore = 15;
    else if (fiber >= 12) fiberScore = 10;
    else if (fiber >= 6) fiberScore = 7;
    else fiberScore = 4;

    const diversityBonus = intake.mealCount >= 2 ? 5 : 2;
    const fiberDiversityScore = Math.min(20, fiberScore + diversityBonus);

    const totalScore = Math.min(
      100,
      Math.max(0, caloriesScore + proteinScore + macroBalanceScore + fiberDiversityScore)
    );

    let rating: NutritionScoreRating = 'needs_attention';
    if (totalScore >= 85) rating = 'excellent';
    else if (totalScore >= 70) rating = 'good';
    else if (totalScore >= 50) rating = 'fair';

    const breakdown: NutritionScoreBreakdown = {
      caloriesScore,
      proteinScore,
      macroBalanceScore,
      fiberDiversityScore,
    };

    let explanation = 'Nutrition score calculated across calories, protein, macronutrient ratios, and fiber.';
    if (rating === 'excellent') {
      explanation = 'Outstanding nutritional balance with strong protein fulfillment and optimal energy ratio.';
    } else if (rating === 'good') {
      explanation = 'Solid daily nutrition with minor opportunities to optimize protein or fiber intake.';
    } else if (rating === 'fair') {
      explanation = 'Moderate balance. Consider adding a protein- or fiber-rich source to reach daily targets.';
    } else {
      explanation = 'Nutrient intake is low or unevenly distributed. Focus on balanced meals with steady protein.';
    }

    return {
      score: totalScore,
      rating,
      breakdown,
      explanation,
    };
  }

  /**
   * Aggregates an array of MealAnalysis items for a single calendar date into a DailyNutritionSummary.
   */
  public aggregateMealsForDate(
    meals: MealAnalysis[],
    dateKeyInput: string,
    profile?: Partial<UserProfile> | null,
    dataSource: 'cloud' | 'local' | 'mixed' = 'cloud'
  ): DailyNutritionSummary {
    const dateKey = getLocalISODate(dateKeyInput) || dateKeyInput;
    const dayMeals = meals.filter(m => getLocalISODate(m.analyzedAt) === dateKey);

    let totalCalories = 0;
    let totalProteinG = 0;
    let totalCarbsG = 0;
    let totalFatG = 0;
    let totalFiberG = 0;

    for (const m of dayMeals) {
      const nut = m.totalNutrition;
      if (nut) {
        totalCalories += Math.max(0, Number(nut.calories) || 0);
        totalProteinG += Math.max(0, Number(nut.protein) || 0);
        totalCarbsG += Math.max(0, Number(nut.carbohydrates) || 0);
        totalFatG += Math.max(0, Number(nut.fat) || 0);
        totalFiberG += Math.max(0, Number(nut.fiber) || 0);
      }
    }

    totalCalories = Math.round(totalCalories);
    totalProteinG = Math.round(totalProteinG * 10) / 10;
    totalCarbsG = Math.round(totalCarbsG * 10) / 10;
    totalFatG = Math.round(totalFatG * 10) / 10;
    totalFiberG = Math.round(totalFiberG * 10) / 10;

    const targets = this.calculateDailyTargets(profile);

    const calorieProgressPercent =
      targets.targetCalories > 0 ? Math.round((totalCalories / targets.targetCalories) * 100) : 0;
    const proteinProgressPercent =
      targets.targetProteinG > 0 ? Math.round((totalProteinG / targets.targetProteinG) * 100) : 0;
    const carbsProgressPercent =
      targets.targetCarbsG > 0 ? Math.round((totalCarbsG / targets.targetCarbsG) * 100) : 0;
    const fatProgressPercent =
      targets.targetFatG > 0 ? Math.round((totalFatG / targets.targetFatG) * 100) : 0;
    const fiberProgressPercent =
      targets.targetFiberG > 0 ? Math.round((totalFiberG / targets.targetFiberG) * 100) : 0;

    const scoreResult = this.calculateNutritionScore(
      {
        totalCalories,
        totalProteinG,
        totalCarbsG,
        totalFatG,
        totalFiberG,
        mealCount: dayMeals.length,
      },
      targets
    );

    const micronutrients = this.aggregateMicronutrientsForMeals(dayMeals, dateKey);

    return {
      date: dateKey,
      totalCalories,
      totalProteinG,
      totalCarbsG,
      totalFatG,
      totalFiberG,
      mealCount: dayMeals.length,
      nutritionScore: scoreResult.score,
      nutritionRating: scoreResult.rating,
      targetCalories: targets.targetCalories,
      targetProteinG: targets.targetProteinG,
      targetCarbsG: targets.targetCarbsG,
      targetFatG: targets.targetFatG,
      targetFiberG: targets.targetFiberG,
      calorieProgressPercent,
      proteinProgressPercent,
      carbsProgressPercent,
      fatProgressPercent,
      fiberProgressPercent,
      meals: dayMeals,
      dataSource,
      micronutrients,
    };
  }

  /**
   * Generates deterministic, evidence-based nutrition insights from a daily summary.
   * Employs strictly factual, non-medical language without diagnostic claims.
   */
  public getNutritionInsights(
    daily: DailyNutritionSummary,
    profile?: Partial<UserProfile> | null
  ): NutritionInsight[] {
    const insights: NutritionInsight[] = [];
    const validProfile = validateUserProfile(profile).validatedProfile;
    const isHostelite = Boolean(validProfile?.isHostelite ?? true);

    // 0. Empty day state
    if (daily.mealCount === 0) {
      insights.push({
        id: `insight-empty-${daily.date}`,
        type: 'general',
        severity: 'info',
        title: 'No Meals Logged Today',
        description: 'Scan or record your meals to reveal daily progress and personalized nutrient insights.',
        evidence: `0 meals logged for ${daily.date}.`,
      });
      return insights;
    }

    // 1. Protein Intake Gap
    if (daily.totalProteinG < daily.targetProteinG * 0.70) {
      const recText = isHostelite
        ? 'Consider adding easily available campus staples like boiled eggs, fresh curd, sprouts, or roasted chana to your next meal.'
        : 'Consider adding a protein-dense food such as lentils, eggs, paneer, tofu, or Greek yogurt to your next meal.';

      insights.push({
        id: `insight-protein-low-${daily.date}`,
        type: 'low_protein',
        severity: 'attention',
        title: 'Protein Intake Below Target',
        description: 'Your recorded protein intake is below your personalized daily target.',
        affectedNutrient: 'Protein',
        recommendation: recText,
        evidence: `Recorded ${daily.totalProteinG}g vs daily target of ${daily.targetProteinG}g (${daily.proteinProgressPercent}% achieved).`,
      });
    } else if (daily.totalProteinG >= daily.targetProteinG * 0.90) {
      insights.push({
        id: `insight-protein-target-met-${daily.date}`,
        type: 'balanced',
        severity: 'positive',
        title: 'Protein Target on Track',
        description: 'You have successfully achieved your daily protein goal.',
        affectedNutrient: 'Protein',
        evidence: `Recorded ${daily.totalProteinG}g meeting ${daily.proteinProgressPercent}% of your ${daily.targetProteinG}g target.`,
      });
    }

    // 2. Caloric Range Insights
    if (daily.totalCalories > daily.targetCalories * 1.25) {
      insights.push({
        id: `insight-cal-high-${daily.date}`,
        type: 'high_calories',
        severity: 'attention',
        title: 'Caloric Intake Exceeding Target',
        description: 'Today’s recorded intake has surpassed your calculated daily caloric target.',
        affectedNutrient: 'Calories',
        recommendation: 'Choose lighter, fiber-rich, or hydrating options such as spiced buttermilk, cucumber salad, or clear soup.',
        evidence: `Recorded ${daily.totalCalories} kcal vs target of ${daily.targetCalories} kcal (${daily.calorieProgressPercent}%).`,
      });
    } else if (daily.mealCount >= 2 && daily.totalCalories < daily.targetCalories * 0.55) {
      insights.push({
        id: `insight-cal-low-${daily.date}`,
        type: 'low_calories',
        severity: 'info',
        title: 'Recorded Energy Below Target',
        description: 'Your logged intake is currently below your estimated daily energy requirements.',
        affectedNutrient: 'Calories',
        recommendation: 'Ensure you are fueling adequately with complex carbs and protein to sustain physical and cognitive energy.',
        evidence: `Recorded ${daily.totalCalories} kcal across ${daily.mealCount} meals (${daily.calorieProgressPercent}% of target).`,
      });
    }

    // 3. Dietary Fiber Insight
    if (daily.totalFiberG < 14 && daily.mealCount >= 1) {
      insights.push({
        id: `insight-fiber-low-${daily.date}`,
        type: 'low_fiber',
        severity: 'info',
        title: 'Fiber Intake Could Be Higher',
        description: 'Recorded dietary fiber is below standard nutritional intake recommendations.',
        affectedNutrient: 'Fiber',
        recommendation: 'Adding fruits with edible peel, whole-grain rotis, sprouts, or salad will help improve digestive wellness.',
        evidence: `Recorded ${daily.totalFiberG}g vs recommended 28g guideline (${daily.fiberProgressPercent}%).`,
      });
    }

    // 4. Balanced Intake Recognition
    if (daily.mealCount >= 2 && daily.nutritionScore >= 75) {
      insights.push({
        id: `insight-balanced-${daily.date}`,
        type: 'balanced',
        severity: 'positive',
        title: 'Balanced Nutrition Rhythm',
        description: 'Your logged meals demonstrate wholesome macronutrient distribution and strong consistency.',
        evidence: `Nutrition score reached ${daily.nutritionScore}/100 across ${daily.mealCount} meals.`,
      });
    }

    // 5. Health Context Reminder (Non-diagnostic safety notice)
    if (validProfile?.healthCondition && validProfile.healthCondition.toLowerCase() !== 'none') {
      insights.push({
        id: `insight-health-notice-${daily.date}`,
        type: 'general',
        severity: 'info',
        title: 'Health Profile Consideration',
        description: `Your nutritional tracking reflects context for: ${validProfile.healthCondition}.`,
        recommendation: 'These automated summaries provide general nutritional insights and do not constitute clinical guidance or medical advice.',
        evidence: `Registered health condition: ${validProfile.healthCondition}.`,
      });
    }

    // 6. Micronutrient Insights (Phase 8.7)
    if (daily.micronutrients?.nutrients) {
      const { ironMg, calciumMg, vitaminDMcg, potassiumMg } = daily.micronutrients.nutrients;

      // Iron
      if (ironMg && ironMg.dataAvailability !== 'none') {
        if (ironMg.status === 'below_reference') {
          insights.push({
            id: `insight-iron-gap-${daily.date}`,
            type: 'micronutrient_gap',
            severity: 'info',
            title: 'Iron Reference Intake Opportunity',
            description: `Your recorded meals provided ${ironMg.percentage}% of the general iron reference target today.`,
            affectedNutrient: 'Iron',
            recommendation: 'Consider hostel-friendly iron sources such as roasted chana, lentils/dal, sprouts, or leafy vegetables.',
            evidence: `Recorded ${ironMg.consumed}mg vs general reference target of ${ironMg.referenceTarget}mg (${ironMg.percentage}% achieved).`,
          });
        } else if (ironMg.status === 'on_track') {
          insights.push({
            id: `insight-iron-met-${daily.date}`,
            type: 'micronutrient_target_met',
            severity: 'positive',
            title: 'Iron Reference Intake Well-Supported',
            description: `Your logged meals provided ${ironMg.percentage}% of the general iron reference guideline.`,
            affectedNutrient: 'Iron',
            evidence: `Recorded ${ironMg.consumed}mg meeting ${ironMg.percentage}% of the ${ironMg.referenceTarget}mg reference target.`,
          });
        }
      }

      // Calcium
      if (calciumMg && calciumMg.dataAvailability !== 'none') {
        if (calciumMg.status === 'below_reference') {
          insights.push({
            id: `insight-calcium-gap-${daily.date}`,
            type: 'micronutrient_gap',
            severity: 'info',
            title: 'Calcium Intake Below Reference Guideline',
            description: 'Calcium intake is currently below the general reference target.',
            affectedNutrient: 'Calcium',
            recommendation: 'Curd, milk, fortified plant milk, or paneer are practical campus sources of calcium.',
            evidence: `Recorded ${calciumMg.consumed}mg vs reference target of ${calciumMg.referenceTarget}mg (${calciumMg.percentage}% achieved).`,
          });
        } else if (calciumMg.status === 'on_track') {
          insights.push({
            id: `insight-calcium-met-${daily.date}`,
            type: 'micronutrient_target_met',
            severity: 'positive',
            title: 'Calcium Target on Track',
            description: 'Your logged meals meet the general calcium reference guideline.',
            affectedNutrient: 'Calcium',
            evidence: `Recorded ${calciumMg.consumed}mg reaching ${calciumMg.percentage}% of reference.`,
          });
        }
      }

      // Vitamin D
      if (vitaminDMcg && vitaminDMcg.dataAvailability === 'limited') {
        insights.push({
          id: `insight-vitamind-limited-${daily.date}`,
          type: 'micronutrient_limited',
          severity: 'info',
          title: 'Vitamin D Estimation Notice',
          description: 'Vitamin D data is limited because some scanned foods do not provide micronutrient estimates.',
          affectedNutrient: 'Vitamin D',
          recommendation: 'Safe morning sunlight and fortified breakfast foods provide natural vitamin D.',
          evidence: `Recorded ${vitaminDMcg.consumed}mcg with partial nutritional data availability.`,
        });
      }

      // Potassium
      if (potassiumMg && potassiumMg.dataAvailability !== 'none' && potassiumMg.status === 'below_reference') {
        insights.push({
          id: `insight-potassium-gap-${daily.date}`,
          type: 'micronutrient_gap',
          severity: 'info',
          title: 'Potassium Intake Observation',
          description: 'Recorded potassium intake is below general daily reference targets.',
          affectedNutrient: 'Potassium',
          recommendation: 'Bananas, coconut water, potatoes, and lentils are student-accessible potassium sources.',
          evidence: `Recorded ${potassiumMg.consumed}mg vs reference target of ${potassiumMg.referenceTarget}mg (${potassiumMg.percentage}%).`,
        });
      }
    }

    // 7. Hydration Insights (Phase 8.7)
    if (daily.hydration && daily.hydration.loggedDrinksCount > 0) {
      if (daily.hydration.percentageOfTarget < 60) {
        insights.push({
          id: `insight-hydration-below-${daily.date}`,
          type: 'hydration_below_target',
          severity: 'info',
          title: 'Daily Hydration Below Target',
          description: 'Your recorded water intake is currently below your daily general hydration guideline.',
          recommendation: 'Keep a 1L refillable bottle handy during lectures or evening study sessions.',
          evidence: `Logged ${daily.hydration.dailyWaterIntakeMl} ml vs guideline of ${daily.hydration.hydrationTargetMl} ml (${daily.hydration.percentageOfTarget}%).`,
        });
      } else if (daily.hydration.percentageOfTarget >= 90) {
        insights.push({
          id: `insight-hydration-met-${daily.date}`,
          type: 'hydration_target_met',
          severity: 'positive',
          title: 'Hydration Target on Track',
          description: 'Great job maintaining steady fluid intake today.',
          evidence: `Logged ${daily.hydration.dailyWaterIntakeMl} ml reaching ${daily.hydration.percentageOfTarget}% of your ${daily.hydration.hydrationTargetMl} ml guideline.`,
        });
      }
    }

    return insights;
  }

  /**
   * Deterministic next-meal recommendation engine.
   * Integrates:
   * - Remaining daily macronutrient gaps (calories, protein, fiber)
   * - Dietary restrictions (veg, vegan, eggetarian, jain, non-veg)
   * - Allergies (peanut, dairy, egg, etc.)
   * - Hostel constraints (cooking access, mess, fridge)
   * - Affordability preference (budget, moderate, flexible)
   */
  public getNextMealRecommendations(
    daily: DailyNutritionSummary,
    profile?: Partial<UserProfile> | null,
    filterMode?: HostelFilterMode
  ): NextMealRecommendation[] {
    const validProfile = validateUserProfile(profile).validatedProfile;
    const isHostelite = Boolean(validProfile?.isHostelite ?? true);
    const hasCooking = validProfile?.hasCookingAccess ?? false;
    const hasFridge = validProfile?.hasFridge ?? false;
    const diet = validProfile?.dietaryRestrictions || 'vegetarian';
    const allergies = (validProfile?.allergies || []).map(a => a.toLowerCase());
    const budgetPref = validProfile?.budgetPreference || 'budget';

    // Catalog of verified, accessible student staples
    interface FoodCandidate {
      id: string;
      title: string;
      reason: string;
      nutritionBenefit: string;
      estimatedCost: string;
      preparationType: RecommendationPrepType;
      confidence: number;
      suggestedFoods: string[];
      nutrition: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
      affordabilityCategory: RecommendationAffordabilityCategory;
      hostelFriendly: boolean;
      noCookRequired: boolean;
      requiresFridge: boolean;
      messFriendly: boolean;
      dietCompatibility: ('vegetarian' | 'vegan' | 'eggetarian' | 'jain' | 'non_vegetarian')[];
      allergenTags: string[];
      emoji: string;
      actionTip: string;
      richNutrients?: ('iron' | 'calcium' | 'potassium')[];
    }

    const CATALOG: FoodCandidate[] = [
      {
        id: 'rec-sprouts-chaat',
        title: 'Fresh Sprouts Chaat',
        reason: 'Provides plant protein, live enzymes, and prebiotic fiber with zero cooking.',
        nutritionBenefit: 'Supplies ~9g plant protein and 5g prebiotic fiber with bioavailable iron.',
        estimatedCost: '₹20–30',
        preparationType: 'no-cook',
        confidence: 0.95,
        suggestedFoods: ['Sprouted Moong', 'Chopped Tomato', 'Chaat Masala', 'Lemon'],
        nutrition: { calories: 120, protein: 9, carbs: 18, fat: 1, fiber: 5 },
        affordabilityCategory: 'budget',
        hostelFriendly: true,
        noCookRequired: true,
        requiresFridge: false,
        messFriendly: false,
        dietCompatibility: ['vegetarian', 'vegan', 'eggetarian', 'non_vegetarian'],
        allergenTags: [],
        emoji: '🌱',
        actionTip: 'Available at local fruit/vegetable carts or easily sprouted in hostel rooms.',
        richNutrients: ['iron'],
      },
      {
        id: 'rec-boiled-eggs',
        title: 'Boiled Eggs (2 pcs)',
        reason: 'Delivers ~12g of complete biological value protein with minimal calories.',
        nutritionBenefit: 'Delivers ~12g complete biological protein with minimal carbohydrates.',
        estimatedCost: '₹14–20',
        preparationType: 'canteen',
        confidence: 0.96,
        suggestedFoods: ['2 Boiled Eggs', 'Black Pepper', 'Salt'],
        nutrition: { calories: 140, protein: 12, carbs: 1, fat: 10, fiber: 0 },
        affordabilityCategory: 'budget',
        hostelFriendly: true,
        noCookRequired: true,
        requiresFridge: false,
        messFriendly: true,
        dietCompatibility: ['eggetarian', 'non_vegetarian'],
        allergenTags: ['egg'],
        emoji: '🥚',
        actionTip: 'Readily available from campus tea stalls and canteens.',
      },
      {
        id: 'rec-curd-bowl',
        title: 'Fresh Curd / Dahi (1 Bowl)',
        reason: 'Supplies bioavailable calcium, gentle protein, and cooling probiotics.',
        nutritionBenefit: 'Provides ~6g gentle protein, 150mg calcium, and cooling gut probiotics.',
        estimatedCost: '₹15–25',
        preparationType: 'no-cook',
        confidence: 0.93,
        suggestedFoods: ['Fresh Dahi / Curd (150g)', 'Jeera powder'],
        nutrition: { calories: 95, protein: 6, carbs: 7, fat: 4, fiber: 0 },
        affordabilityCategory: 'budget',
        hostelFriendly: true,
        noCookRequired: true,
        requiresFridge: false,
        messFriendly: true,
        dietCompatibility: ['vegetarian', 'eggetarian', 'jain', 'non_vegetarian'],
        allergenTags: ['dairy', 'milk', 'lactose'],
        emoji: '🥛',
        actionTip: 'Sold in individual 100g/200g cups at any grocery or campus store.',
        richNutrients: ['calcium'],
      },
      {
        id: 'rec-roasted-chana',
        title: 'Roasted Chana (1 Bowl)',
        reason: 'Convenient room snack packing 11g protein, iron, and 8g fiber with long shelf-life.',
        nutritionBenefit: 'Packs ~11g plant protein, 8g dietary fiber, and plant iron.',
        estimatedCost: '₹20–35',
        preparationType: 'no-cook',
        confidence: 0.94,
        suggestedFoods: ['Roasted Bengal Gram (50g)'],
        nutrition: { calories: 180, protein: 11, carbs: 29, fat: 3, fiber: 8 },
        affordabilityCategory: 'budget',
        hostelFriendly: true,
        noCookRequired: true,
        requiresFridge: false,
        messFriendly: false,
        dietCompatibility: ['vegetarian', 'vegan', 'eggetarian', 'jain', 'non_vegetarian'],
        allergenTags: [],
        emoji: '🥜',
        actionTip: 'Keep a packet in your study bag for instant satiety between lectures.',
        richNutrients: ['iron'],
      },
      {
        id: 'rec-banana-peanuts',
        title: 'Banana with Roasted Peanuts',
        reason: 'Natural energy from slow carbs paired with plant protein and electrolytes.',
        nutritionBenefit: 'Delivers sustained natural carbohydrates, potassium, and plant protein.',
        estimatedCost: '₹15–25',
        preparationType: 'no-cook',
        confidence: 0.91,
        suggestedFoods: ['1 Medium Banana', 'Handful of Roasted Peanuts (25g)'],
        nutrition: { calories: 230, protein: 7, carbs: 32, fat: 9, fiber: 4 },
        affordabilityCategory: 'budget',
        hostelFriendly: true,
        noCookRequired: true,
        requiresFridge: false,
        messFriendly: false,
        dietCompatibility: ['vegetarian', 'vegan', 'eggetarian', 'jain', 'non_vegetarian'],
        allergenTags: ['peanut', 'peanuts', 'nuts'],
        emoji: '🍌',
        actionTip: 'Zero peel tools or storage required; ideal pre-workout or afternoon pick-me-up.',
        richNutrients: ['potassium'],
      },
      {
        id: 'rec-coconut-water',
        title: 'Fresh Tender Coconut Water',
        reason: 'Natural hydrating electrolytes with potassium and gentle clean energy.',
        nutritionBenefit: 'Replenishes cellular hydration and potassium without added sugars.',
        estimatedCost: '₹40–60',
        preparationType: 'no-cook',
        confidence: 0.89,
        suggestedFoods: ['1 Tender Coconut (250ml)'],
        nutrition: { calories: 48, protein: 1, carbs: 10, fat: 0.2, fiber: 1 },
        affordabilityCategory: 'budget',
        hostelFriendly: true,
        noCookRequired: true,
        requiresFridge: false,
        messFriendly: false,
        dietCompatibility: ['vegetarian', 'vegan', 'eggetarian', 'jain', 'non_vegetarian'],
        allergenTags: [],
        emoji: '🥥',
        actionTip: 'Available at roadside fruit vendors near campus gates.',
        richNutrients: ['potassium'],
      },
      {
        id: 'rec-buttermilk-chaas',
        title: 'Spiced Buttermilk / Chaas (250ml)',
        reason: 'Hydrating digestive probiotic drink that counterbalances oily or heavy meals.',
        nutritionBenefit: 'Light hydration, calcium, and digestion support after heavy meals.',
        estimatedCost: '₹10–15',
        preparationType: 'canteen',
        confidence: 0.93,
        suggestedFoods: ['Spiced Chaas / Buttermilk'],
        nutrition: { calories: 45, protein: 3, carbs: 5, fat: 1.5, fiber: 0 },
        affordabilityCategory: 'budget',
        hostelFriendly: true,
        noCookRequired: true,
        requiresFridge: false,
        messFriendly: true,
        dietCompatibility: ['vegetarian', 'eggetarian', 'jain', 'non_vegetarian'],
        allergenTags: ['dairy', 'milk', 'lactose'],
        emoji: '🥤',
        actionTip: 'Extremely affordable canteen staple.',
        richNutrients: ['calcium'],
      },
      {
        id: 'rec-paneer-tiffin',
        title: 'Paneer Roll or Bhurji (Canteen)',
        reason: 'Protein-dense meal addition with calcium and healthy fats.',
        nutritionBenefit: 'Dense source of ~14g dairy protein, calcium, and sustained satiety.',
        estimatedCost: '₹45–70',
        preparationType: 'canteen',
        confidence: 0.92,
        suggestedFoods: ['Paneer (80g)', 'Whole Wheat Roti', 'Capsicum'],
        nutrition: { calories: 280, protein: 14, carbs: 22, fat: 15, fiber: 3 },
        affordabilityCategory: 'moderate',
        hostelFriendly: true,
        noCookRequired: !hasCooking,
        requiresFridge: false,
        messFriendly: true,
        dietCompatibility: ['vegetarian', 'eggetarian', 'jain', 'non_vegetarian'],
        allergenTags: ['dairy', 'milk', 'lactose', 'paneer'],
        emoji: '🧀',
        actionTip: 'Order as a side or filling from your college canteen or mess.',
        richNutrients: ['calcium'],
      },
      {
        id: 'rec-dal-tadka-roti',
        title: 'Dal Tadka with 2 Phulkas (Mess/Tiffin)',
        reason: 'Warm comfort staple balancing complex carbohydrates and plant protein.',
        nutritionBenefit: 'Foundational meal offering ~13g pulse protein, B-vitamins, and fiber.',
        estimatedCost: '₹30–50',
        preparationType: 'canteen',
        confidence: 0.94,
        suggestedFoods: ['Yellow Toor Dal (1 Bowl)', '2 Phulkas', 'Green Salad'],
        nutrition: { calories: 310, protein: 13, carbs: 54, fat: 5, fiber: 7 },
        affordabilityCategory: 'budget',
        hostelFriendly: true,
        noCookRequired: true,
        requiresFridge: false,
        messFriendly: true,
        dietCompatibility: ['vegetarian', 'vegan', 'eggetarian', 'non_vegetarian'],
        allergenTags: ['gluten'],
        emoji: '🍲',
        actionTip: 'Ask the mess staff for an extra katori of thick dal.',
        richNutrients: ['iron', 'potassium'],
      },
    ];

    // Identify previously consumed food names today to promote variety
    const consumedFoodKeywords = (daily.meals || []).flatMap(m =>
      (m.items || []).map(i => i.name.toLowerCase())
    );

    // Filter candidates based on dietary restrictions, allergies, and hostel filters
    const filtered = CATALOG.filter(item => {
      // 1. Dietary restriction
      if (diet && !item.dietCompatibility.includes(diet as ('vegetarian' | 'vegan' | 'eggetarian' | 'jain' | 'non_vegetarian'))) {
        return false;
      }

      // 2. Allergies
      if (allergies.length > 0) {
        const hasAllergen = item.allergenTags.some(tag =>
          allergies.some(userAllergy => userAllergy.includes(tag) || tag.includes(userAllergy))
        );
        if (hasAllergen) return false;
      }

      // 3. Hostel constraints (no cooking access)
      if (!hasCooking && !item.noCookRequired) {
        return false;
      }

      // 4. Fridge constraint
      if (!hasFridge && item.requiresFridge) {
        return false;
      }

      // 5. Budget preference
      if (budgetPref === 'budget' && item.affordabilityCategory !== 'budget') {
        return false;
      }
      if (budgetPref === 'moderate' && item.affordabilityCategory === 'premium') {
        return false;
      }

      // 6. Interactive Hostel Mode filters
      if (filterMode && filterMode !== 'all') {
        if (filterMode === 'no_cook' && !item.noCookRequired) return false;
        if (filterMode === 'budget' && item.affordabilityCategory !== 'budget') return false;
        if (filterMode === 'high_protein' && item.nutrition.protein < 8) return false;
        if (filterMode === 'mess_friendly' && !item.messFriendly) return false;
        if (filterMode === 'no_fridge' && item.requiresFridge) return false;
      }

      return true;
    });

    // Score candidates based on current daily deficit
    const proteinDeficit = Math.max(0, daily.targetProteinG - daily.totalProteinG);
    const calorieHeadroom = daily.targetCalories - daily.totalCalories;

    const scored = filtered.map(item => {
      let score = 50;

      // Protein gap matching
      if (proteinDeficit > 15) {
        score += item.nutrition.protein * 3;
      }

      // Energy matching
      if (calorieHeadroom < 200 && item.nutrition.calories <= 150) {
        score += 25; // Light item when calories are tight
      } else if (calorieHeadroom >= 300 && item.nutrition.calories >= 180) {
        score += 20; // Heartier meal when room exists
      }

      // Hostel optimization
      if (isHostelite && item.hostelFriendly) {
        score += 30;
      }

      // Micronutrient gap matching
      if (daily.micronutrients?.nutrients) {
        const { ironMg, calciumMg, potassiumMg } = daily.micronutrients.nutrients;
        if (ironMg?.status === 'below_reference' && item.richNutrients?.includes('iron')) {
          score += 25;
        }
        if (calciumMg?.status === 'below_reference' && item.richNutrients?.includes('calcium')) {
          score += 25;
        }
        if (potassiumMg?.status === 'below_reference' && item.richNutrients?.includes('potassium')) {
          score += 25;
        }
      }

      // Affordability alignment
      if (budgetPref === 'budget' && item.affordabilityCategory === 'budget') {
        score += 20;
      }

      // Prioritize food variety: de-weight items already consumed today
      const alreadyEaten = consumedFoodKeywords.some(keyword =>
        item.title.toLowerCase().includes(keyword) ||
        item.suggestedFoods.some(sf => keyword.includes(sf.toLowerCase()))
      );
      if (alreadyEaten) {
        score -= 20;
      }

      return { item, score };
    });

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, 4).map(({ item }) => ({
      id: item.id,
      title: item.title,
      reason: item.reason,
      nutritionBenefit: item.nutritionBenefit,
      estimatedCost: item.estimatedCost,
      preparationType: item.preparationType,
      hostelFriendly: item.hostelFriendly,
      confidence: item.confidence,
      suggestedFoods: item.suggestedFoods,
      estimatedNutrition: item.nutrition,
      affordabilityCategory: item.affordabilityCategory,
      noCookRequired: item.noCookRequired,
      messFriendly: item.messFriendly,
      requiresFridge: item.requiresFridge,
      emoji: item.emoji,
      actionTip: item.actionTip,
    }));
  }

  /**
   * Generates deterministic, prioritized in-app smart nudges (Phase 9.4).
   * Prioritized as HIGH, MEDIUM, LOW. Only returns top 1 to 3 relevant nudges.
   */
  public generateSmartNudges(
    daily: DailyNutritionSummary,
    profile?: Partial<UserProfile> | null,
    streakMetrics?: DashboardStreakMetrics
  ): SmartNudge[] {
    const nudges: SmartNudge[] = [];

    // 1. Hydration Nudge
    if (daily.hydration) {
      const intake = daily.hydration.dailyWaterIntakeMl;
      const target = daily.hydration.hydrationTargetMl;
      const remaining = daily.hydration.remainingAmountMl;

      if (intake < target * 0.5) {
        nudges.push({
          id: 'nudge-hydration-low',
          category: 'hydration',
          priority: 'HIGH',
          title: 'Hydration Target Behind',
          message: `You've had ${intake} ml today. About ${(remaining / 1000).toFixed(1)} L remains.`,
          actionLabel: '+250 ml Water',
        });
      } else if (intake < target) {
        nudges.push({
          id: 'nudge-hydration-progress',
          category: 'hydration',
          priority: 'MEDIUM',
          title: 'Hydration on Track',
          message: `You're at ${daily.hydration.percentageOfTarget}% of your hydration target. ${(remaining / 1000).toFixed(1)} L to go.`,
          actionLabel: '+250 ml Water',
        });
      }
    }

    // 2. Protein Gap Nudge
    const targetProtein = daily.targetProteinG || 60;
    const currentProtein = daily.totalProteinG || 0;
    const proteinPct = Math.round((currentProtein / targetProtein) * 100);
    const proteinDeficit = Math.max(0, targetProtein - currentProtein);

    if (proteinPct < 50 && daily.mealCount >= 1) {
      nudges.push({
        id: 'nudge-protein-gap',
        category: 'protein',
        priority: 'HIGH',
        title: 'Protein Opportunity',
        message: `You're currently at ${proteinPct}% of today's protein target (${Math.round(proteinDeficit)}g remaining).`,
        actionLabel: 'See Suggestions',
      });
    } else if (proteinPct < 80 && daily.mealCount >= 2) {
      nudges.push({
        id: 'nudge-protein-progress',
        category: 'protein',
        priority: 'MEDIUM',
        title: 'Closing Protein Target',
        message: `You're at ${proteinPct}% of today's protein target. ${Math.round(proteinDeficit)}g to reach your goal.`,
      });
    }

    // 3. Meal Logging Nudge
    if (daily.mealCount === 0) {
      nudges.push({
        id: 'nudge-meal-empty',
        category: 'meal',
        priority: 'HIGH',
        title: 'First Meal Pending',
        message: 'No meals logged today yet. Scan your first meal to start tracking your daily journey.',
        actionLabel: 'Scan Meal',
        actionHref: '/scan',
      });
    } else if (daily.mealCount === 1) {
      nudges.push({
        id: 'nudge-meal-followup',
        category: 'meal',
        priority: 'LOW',
        title: 'Journey In Progress',
        message: "You've logged 1 meal today. Remember to log your next meal to maintain tracking accuracy.",
        actionLabel: 'Scan Meal',
        actionHref: '/scan',
      });
    }

    // 4. Micronutrient Nudge
    if (daily.micronutrients?.nutrients) {
      const { ironMg, calciumMg } = daily.micronutrients.nutrients;
      if (ironMg?.status === 'below_reference' && daily.mealCount >= 2) {
        nudges.push({
          id: 'nudge-micro-iron',
          category: 'micronutrient',
          priority: 'MEDIUM',
          title: 'Iron-Rich Opportunity',
          message: "Today's recorded meals are relatively low in iron. Consider adding sprouts or dal to your next meal.",
        });
      } else if (calciumMg?.status === 'below_reference' && daily.mealCount >= 2) {
        nudges.push({
          id: 'nudge-micro-calcium',
          category: 'micronutrient',
          priority: 'LOW',
          title: 'Calcium Balance',
          message: "Today's recorded meals are below reference calcium. Fresh curd or milk can help balance this.",
        });
      }
    }

    // 5. Consistency Nudge
    if (streakMetrics?.currentStreakDays && streakMetrics.currentStreakDays >= 3) {
      nudges.push({
        id: 'nudge-consistency-streak',
        category: 'consistency',
        priority: 'LOW',
        title: 'Consistent Tracker',
        message: `Great consistency! You're on a ${streakMetrics.currentStreakDays}-day tracking streak.`,
      });
    } else if (streakMetrics?.activeLoggingDaysCount && streakMetrics.activeLoggingDaysCount >= 5) {
      nudges.push({
        id: 'nudge-consistency-weekly',
        category: 'consistency',
        priority: 'LOW',
        title: 'Weekly Habit Built',
        message: `You've logged meals ${streakMetrics.activeLoggingDaysCount} days recently. Consistency builds lasting habits.`,
      });
    }

    // Sort by priority: HIGH -> MEDIUM -> LOW
    const priorityWeight: Record<NudgePriority, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    nudges.sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]);

    // Return at most top 3 to avoid spamming the user
    return nudges.slice(0, 3);
  }

  /**
   * Calculates deterministic goal progress metrics for supported health goals (Phase 9.5).
   * Prevents NaN, division by zero, and clamps progress percentages between 0 and 100%.
   */
  public calculateGoalProgress(
    goal: SupportedHealthGoal,
    daily: DailyNutritionSummary,
    profile?: Partial<UserProfile> | null,
    streakMetrics?: DashboardStreakMetrics
  ): GoalProgressSummary {
    switch (goal) {
      case 'muscle_gain':
      case 'protein_consistency': {
        const target = Math.max(1, daily.targetProteinG);
        const current = Math.max(0, daily.totalProteinG);
        const pct = Math.min(100, Math.round((current / target) * 100));
        const trend = pct >= 75 ? 'improving' : pct >= 50 ? 'stable' : 'needs_attention';
        return {
          goal,
          goalLabel: goal === 'muscle_gain' ? 'Muscle Gain Goal' : 'Protein Consistency',
          currentValue: Math.round(current),
          targetValue: Math.round(target),
          unit: 'g protein',
          progressPercent: pct,
          weeklyTrend: trend,
          weeklyTrendDescription: trend === 'improving'
            ? 'Protein intake strongly aligns with recovery targets.'
            : 'Focus on protein-rich options like eggs, paneer, sprouts, or dal.',
          consistencyPercent: streakMetrics?.sevenDayConsistencyPercent ?? pct,
          recommendedAction: 'Include a protein anchor (curd, chana, eggs, or paneer) in your next meal.',
        };
      }

      case 'weight_management':
      case 'fat_loss': {
        const target = Math.max(1, daily.targetCalories);
        const current = Math.max(0, daily.totalCalories);
        const pct = Math.min(100, Math.round((current / target) * 100));
        const variance = Math.abs(current - target);
        const trend = variance <= 250 ? 'improving' : current > target ? 'needs_attention' : 'stable';
        return {
          goal,
          goalLabel: goal === 'fat_loss' ? 'Fat Loss Calorie Deficit' : 'Weight Management',
          currentValue: Math.round(current),
          targetValue: Math.round(target),
          unit: 'kcal',
          progressPercent: pct,
          weeklyTrend: trend,
          weeklyTrendDescription: trend === 'improving'
            ? 'Caloric intake is tightly aligned with your energy budget.'
            : 'Keep portions balanced and prioritize fiber for satiety.',
          consistencyPercent: streakMetrics?.sevenDayConsistencyPercent ?? pct,
          recommendedAction: 'Choose high-volume, low-density vegetables and pulses for lasting fullness.',
        };
      }

      case 'hydration_consistency': {
        const target = Math.max(1, daily.hydration?.hydrationTargetMl ?? 2400);
        const current = Math.max(0, daily.hydration?.dailyWaterIntakeMl ?? 0);
        const pct = Math.min(100, Math.round((current / target) * 100));
        const trend = (daily.hydration?.percentageOfTarget ?? pct) >= 80 ? 'improving' : pct >= 50 ? 'stable' : 'needs_attention';
        return {
          goal,
          goalLabel: 'Hydration Consistency',
          currentValue: Math.round(current),
          targetValue: Math.round(target),
          unit: 'ml water',
          progressPercent: pct,
          weeklyTrend: trend,
          weeklyTrendDescription: trend === 'improving'
            ? 'Daily fluid intake is sufficient for mental clarity and digestion.'
            : 'Keep a water bottle handy and log drinks with quick-add buttons.',
          consistencyPercent: streakMetrics?.hydrationGoalMetDaysCount
            ? Math.round((streakMetrics.hydrationGoalMetDaysCount / 7) * 100)
            : pct,
          recommendedAction: 'Drink a glass of water before each lecture or study block.',
        };
      }

      case 'nutrition_consistency': {
        const target = 7;
        const current = Math.min(7, streakMetrics?.activeLoggingDaysCount ?? (daily.mealCount > 0 ? 1 : 0));
        const pct = Math.min(100, Math.round((current / target) * 100));
        const trend = current >= 5 ? 'improving' : current >= 3 ? 'stable' : 'needs_attention';
        return {
          goal,
          goalLabel: 'Nutrition Logging Consistency',
          currentValue: current,
          targetValue: target,
          unit: 'days/week',
          progressPercent: pct,
          weeklyTrend: trend,
          weeklyTrendDescription: trend === 'improving'
            ? 'Consistent meal logging enables accurate personal insights.'
            : 'Aim to log at least one meal every day to build a habit.',
          consistencyPercent: streakMetrics?.sevenDayConsistencyPercent ?? pct,
          recommendedAction: 'Log your meals right after eating while memories are fresh.',
        };
      }

      case 'general_health':
      default: {
        const target = 85;
        const current = Math.max(0, daily.nutritionScore);
        const pct = Math.min(100, Math.round((current / target) * 100));
        const trend = current >= 70 ? 'improving' : current >= 50 ? 'stable' : 'needs_attention';
        return {
          goal: 'general_health',
          goalLabel: 'General Health & Vitality',
          currentValue: current,
          targetValue: target,
          unit: 'health pts',
          progressPercent: pct,
          weeklyTrend: trend,
          weeklyTrendDescription: trend === 'improving'
            ? 'Nutrient balance, fiber, and hydration are well-maintained.'
            : 'Incorporate more colorful vegetables and whole foods today.',
          consistencyPercent: streakMetrics?.sevenDayConsistencyPercent ?? pct,
          recommendedAction: 'Aim for a balanced plate with colorful vegetables and quality protein.',
        };
      }
    }
  }

  /**
   * Generates human-readable, factual weekly insights from stored data (Phase 9.6).
   * Never fabricates statistics. Returns ["Not enough data yet."] if under 2 active logging days.
   */
  public generateWeeklyHumanInsights(weekly: WeeklyNutritionSummary): string[] {
    const activeDays = weekly.dailySummaries.filter(d => d.mealCount > 0);
    if (activeDays.length < 2) {
      return ['Not enough data yet. Log meals across multiple days to reveal weekly trends.'];
    }

    const insights: string[] = [];

    // 1. Logging consistency
    insights.push(`You logged meals on ${weekly.consistencyMetrics.daysWithLogs} of the last 7 days.`);

    // 2. Average protein intake
    if (weekly.averageProtein > 0) {
      insights.push(`Your average protein intake was ${Math.round(weekly.averageProtein)}g per day.`);
    }

    // 3. Hydration performance
    const daysWithHydration = activeDays.filter(d => d.hydration && d.hydration.dailyWaterIntakeMl > 0);
    if (daysWithHydration.length >= 2) {
      daysWithHydration.sort((a, b) => (b.hydration?.dailyWaterIntakeMl || 0) - (a.hydration?.dailyWaterIntakeMl || 0));
      const highestDay = new Date(daysWithHydration[0].date).toLocaleDateString('en-US', { weekday: 'long' });
      const lowestDay = new Date(daysWithHydration[daysWithHydration.length - 1].date).toLocaleDateString('en-US', { weekday: 'long' });
      insights.push(`Hydration was strongest on ${highestDay} and lowest on ${lowestDay}.`);
    }

    // 4. Macro trend
    const totalMacroCals = weekly.averageProtein * 4 + weekly.averageCarbs * 4 + weekly.averageFat * 9;
    if (totalMacroCals > 0) {
      const carbsPct = Math.round(((weekly.averageCarbs * 4) / totalMacroCals) * 100);
      const proteinPct = Math.round(((weekly.averageProtein * 4) / totalMacroCals) * 100);
      if (carbsPct >= 55) {
        insights.push('Most recorded meals were carbohydrate-heavy.');
      } else if (proteinPct >= 20) {
        insights.push('Protein intake was consistently well-represented in logged meals.');
      }
    }

    // 5. Consistency quality
    if (weekly.consistencyMetrics.targetConsistencyPercent >= 70) {
      insights.push('Your breakfast and meal consistency remained strong this week.');
    }

    return insights;
  }


  /**
   * Retrieves all meals for a user across a specified local calendar date range.
   * Internally executes cursor-based pagination through Firestore without artificial limits (e.g. 100 meals).
   * Gracefully falls back to local storage if unauthenticated, offline, or if cloud query fails.
   */
  public async getMealsForDateRange(
    userId: string | undefined,
    startDate?: string,
    endDate?: string
  ): Promise<{ meals: MealAnalysis[]; dataSource: 'cloud' | 'local' | 'mixed' }> {
    if (userId && userId.trim()) {
      try {
        const cloudResult = await firestoreMealHistoryService.getMealsForDateRange(
          userId,
          startDate,
          endDate
        );

        if (cloudResult.complete) {
          if (cloudResult.meals.length > 0) {
            return { meals: cloudResult.meals, dataSource: 'cloud' };
          }
          // If cloud has 0 meals, check local fallback
          const localMeals = await mealHistoryService.getRecentMeals();
          const filteredLocal = localMeals.filter(m => {
            const d = getLocalISODate(m.analyzedAt);
            if (startDate && d < startDate) return false;
            if (endDate && d > endDate) return false;
            return true;
          });

          if (filteredLocal.length > 0) {
            return { meals: filteredLocal, dataSource: 'local' };
          }
          return { meals: [], dataSource: 'cloud' };
        } else {
          // If cloud query was incomplete (failed midway), do NOT trust partial cloud data
          console.warn('[NutritionAnalyticsService] Incomplete cloud retrieval, using local storage fallback');
          const localMeals = await mealHistoryService.getRecentMeals();
          const filteredLocal = localMeals.filter(m => {
            const d = getLocalISODate(m.analyzedAt);
            if (startDate && d < startDate) return false;
            if (endDate && d > endDate) return false;
            return true;
          });
          return { meals: filteredLocal, dataSource: 'local' };
        }
      } catch (err) {
        console.warn('[NutritionAnalyticsService] Cloud retrieval failed, using local storage fallback:', err);
        const localMeals = await mealHistoryService.getRecentMeals();
        const filteredLocal = localMeals.filter(m => {
          const d = getLocalISODate(m.analyzedAt);
          if (startDate && d < startDate) return false;
          if (endDate && d > endDate) return false;
          return true;
        });
        return { meals: filteredLocal, dataSource: 'local' };
      }
    }

    // Unauthenticated -> local fallback
    const localMeals = await mealHistoryService.getRecentMeals();
    const filteredLocal = localMeals.filter(m => {
      const d = getLocalISODate(m.analyzedAt);
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;
      return true;
    });
    return { meals: filteredLocal, dataSource: 'local' };
  }

  /**
   * Primary entry point for daily summary.
   * Authoritative data retrieval:
   * 1. If userId provided: queries Firestore meal history for targetDate using cursor pagination
   * 2. On network/cloud failure or unauthenticated: falls back to local storage
   */
  /**
   * Resolves the authoritative UserProfile for a user.
   * Priority: explicit profile -> cloud Firestore (if userId) -> local cache.
   */
  public async resolveProfile(
    userId?: string,
    explicitProfile?: Partial<UserProfile> | null
  ): Promise<UserProfile | undefined> {
    if (explicitProfile) {
      const v = validateUserProfile(explicitProfile);
      if (v.validatedProfile) return v.validatedProfile;
    }

    if (userId && userId.trim()) {
      try {
        const { firestoreProfileService } = await import('./firestoreProfileService');
        const cloudP = await firestoreProfileService.getProfile(userId);
        if (cloudP) return cloudP;
      } catch {
        // Safe fallback
      }
    }

    if (typeof window !== 'undefined') {
      try {
        const { userProfileService } = await import('./userProfileService');
        return userProfileService.getProfile();
      } catch {
        // Safe fallback
      }
    }

    return undefined;
  }

  /**
   * Primary entry point for daily summary.
   * Authoritative data retrieval:
   * 1. If userId provided: queries Firestore meal history for targetDate using cursor pagination
   * 2. On network/cloud failure or unauthenticated: falls back to local storage
   */
  public async getDailySummary(
    userId: string | undefined,
    targetDate: string = getLocalISODate(),
    explicitProfile?: Partial<UserProfile> | null
  ): Promise<DailyNutritionSummary> {
    const { meals, dataSource } = await this.getMealsForDateRange(userId, targetDate, targetDate);
    const profile = await this.resolveProfile(userId, explicitProfile);
    const summary = this.aggregateMealsForDate(meals, targetDate, profile, dataSource);
    try {
      summary.hydration = await hydrationService.getDailySummary(userId, targetDate, profile);
    } catch {
      // Safe fallback
    }
    return summary;
  }

  /**
   * Convenience alias for today's summary.
   */
  public async getTodaySummary(
    userId?: string,
    explicitProfile?: Partial<UserProfile> | null
  ): Promise<DailyNutritionSummary> {
    return this.getDailySummary(userId, getLocalISODate(), explicitProfile);
  }

  /**
   * Computes 7-day rolling weekly nutrition summary.
   */
  public async getWeeklySummary(
    userId: string | undefined,
    startDate?: string,
    endDate?: string,
    explicitProfile?: Partial<UserProfile> | null
  ): Promise<WeeklyNutritionSummary> {
    // Determine 7-day range
    const dates = startDate && endDate
      ? [startDate, endDate]
      : getPastNDaysDates(7, new Date());

    const fullDatesList = startDate && endDate
      ? this.generateDateRange(startDate, endDate)
      : dates;

    const startKey = fullDatesList[0] || getLocalISODate();
    const endKey = fullDatesList[fullDatesList.length - 1] || getLocalISODate();

    const { meals, dataSource } = await this.getMealsForDateRange(userId, startKey, endKey);
    const profile = await this.resolveProfile(userId, explicitProfile);

    const dailySummaries: DailyNutritionSummary[] = fullDatesList.map(dateKey =>
      this.aggregateMealsForDate(meals, dateKey, profile, dataSource)
    );

    const loggedDays = dailySummaries.filter(d => d.mealCount > 0);
    const totalMeals = dailySummaries.reduce((acc, d) => acc + d.mealCount, 0);

    const avgCal = loggedDays.length > 0
      ? Math.round(loggedDays.reduce((acc, d) => acc + d.totalCalories, 0) / loggedDays.length)
      : 0;

    const avgProt = loggedDays.length > 0
      ? Math.round((loggedDays.reduce((acc, d) => acc + d.totalProteinG, 0) / loggedDays.length) * 10) / 10
      : 0;

    const avgCarbs = loggedDays.length > 0
      ? Math.round((loggedDays.reduce((acc, d) => acc + d.totalCarbsG, 0) / loggedDays.length) * 10) / 10
      : 0;

    const avgFat = loggedDays.length > 0
      ? Math.round((loggedDays.reduce((acc, d) => acc + d.totalFatG, 0) / loggedDays.length) * 10) / 10
      : 0;

    const avgFiber = loggedDays.length > 0
      ? Math.round((loggedDays.reduce((acc, d) => acc + d.totalFiberG, 0) / loggedDays.length) * 10) / 10
      : 0;

    const avgScore = loggedDays.length > 0
      ? Math.round(loggedDays.reduce((acc, d) => acc + d.nutritionScore, 0) / loggedDays.length)
      : 0;

    // Consistency calculations
    const targetMetDays = loggedDays.filter(d => d.calorieProgressPercent >= 70 && d.proteinProgressPercent >= 60).length;
    const targetConsistencyPercent = loggedDays.length > 0
      ? Math.round((targetMetDays / loggedDays.length) * 100)
      : 0;

    let scoreConsistency: 'high' | 'moderate' | 'variable' = 'variable';
    if (loggedDays.length >= 4 && targetConsistencyPercent >= 75) {
      scoreConsistency = 'high';
    } else if (loggedDays.length >= 2 && targetConsistencyPercent >= 50) {
      scoreConsistency = 'moderate';
    }

    const consistencyMetrics: ConsistencyMetrics = {
      daysWithLogs: loggedDays.length,
      loggedMealsCount: totalMeals,
      targetConsistencyPercent,
      scoreConsistency,
    };

    return {
      startDate: fullDatesList[0] || getLocalISODate(),
      endDate: fullDatesList[fullDatesList.length - 1] || getLocalISODate(),
      dailySummaries,
      averageCalories: avgCal,
      averageProtein: avgProt,
      averageCarbs: avgCarbs,
      averageFat: avgFat,
      averageFiber: avgFiber,
      averageNutritionScore: avgScore,
      totalMeals,
      consistencyMetrics,
      dataSource,
    };
  }

  /**
   * Deterministically calculates daily streaks and consistency metrics from actual logged data.
   * Adheres strictly to the rule:
   * - Never increments streaks simply because a page was opened.
   * - Computes from actual stored meal logs and hydration history.
   * - If insufficient historical data exists, sets hasSufficientData: false and
   *   "Your consistency streak will appear after a few days of tracking."
   */
  public calculateStreakMetrics(
    meals: MealAnalysis[] = [],
    hydrationEntries: import('../types/hydration').HydrationLogEntry[] = [],
    targetHydrationMl: number = 2200,
    referenceDate: Date | string = new Date()
  ): DashboardStreakMetrics {
    const todayStr = getLocalISODate(referenceDate) || getLocalISODate();
    const past30Days = getPastNDaysDates(30, referenceDate);
    const past7Days = getPastNDaysDates(7, referenceDate);

    // Group meals by date
    const mealsByDate = new Map<string, number>();
    for (const meal of meals) {
      const date = getLocalISODate(meal.analyzedAt || (meal as unknown as { createdAt?: string }).createdAt);
      if (date) {
        mealsByDate.set(date, (mealsByDate.get(date) || 0) + 1);
      }
    }

    // Group hydration by date
    const hydrationByDate = new Map<string, number>();
    for (const h of hydrationEntries) {
      const date = getLocalISODate(h.date || h.loggedAt);
      if (date) {
        hydrationByDate.set(date, (hydrationByDate.get(date) || 0) + (Number(h.amountMl) || 0));
      }
    }

    // Active day: date where meals > 0 or hydration >= 250ml
    const isDayActive = (date: string) => {
      const mealCount = mealsByDate.get(date) || 0;
      const hydMl = hydrationByDate.get(date) || 0;
      return mealCount > 0 || hydMl >= 250;
    };

    const mealsLoggedToday = mealsByDate.get(todayStr) || 0;
    const hydrationLoggedTodayMl = hydrationByDate.get(todayStr) || 0;

    // Calculate active days in 7-day and 30-day windows
    let active7Count = 0;
    for (const d of past7Days) {
      if (isDayActive(d)) active7Count++;
    }
    const sevenDayConsistencyPercent = Math.round((active7Count / 7) * 100);

    let active30Count = 0;
    let hydrationGoalMetDaysCount = 0;
    for (const d of past30Days) {
      if (isDayActive(d)) active30Count++;
      const hyd = hydrationByDate.get(d) || 0;
      if (targetHydrationMl > 0 && hyd >= targetHydrationMl) {
        hydrationGoalMetDaysCount++;
      }
    }
    const thirtyDayConsistencyPercent = Math.round((active30Count / 30) * 100);

    // Calculate current streak
    // If today is active, streak counts back from today.
    // If today is NOT active yet, check if yesterday was active.
    let currentStreakDays = 0;
    const todayIndex = past30Days.indexOf(todayStr);
    const startIndex = todayIndex >= 0 ? todayIndex : past30Days.length - 1;

    let checkIndex = startIndex;
    if (!isDayActive(todayStr)) {
      // Today has no log yet; check if yesterday had activity
      checkIndex = startIndex - 1;
    }

    while (checkIndex >= 0 && isDayActive(past30Days[checkIndex])) {
      currentStreakDays++;
      checkIndex--;
    }

    // Longest streak in past 30 days
    let longestStreakDays = 0;
    let tempStreak = 0;
    for (let i = 0; i < past30Days.length; i++) {
      if (isDayActive(past30Days[i])) {
        tempStreak++;
        if (tempStreak > longestStreakDays) longestStreakDays = tempStreak;
      } else {
        tempStreak = 0;
      }
    }

    const hasSufficientData = active30Count >= 2;
    const streakStatusMessage = hasSufficientData
      ? currentStreakDays > 0
        ? `${currentStreakDays} day streak active!`
        : 'Log a meal or drink today to restart your streak!'
      : 'Your consistency streak will appear after a few days of tracking.';

    return {
      currentStreakDays,
      longestStreakDays,
      hasSufficientData,
      sevenDayConsistencyPercent,
      thirtyDayConsistencyPercent,
      activeLoggingDaysCount: active30Count,
      hydrationGoalMetDaysCount,
      mealsLoggedToday,
      hydrationLoggedTodayMl,
      streakStatusMessage,
    };
  }

  /**
   * Resolves and normalizes date ranges with presets and strict boundary validation.
   * Clamps future dates to today to prevent fabricated future statistics.
   */
  public resolveDateRange(
    input: NutritionDateRange | NutritionDateRangePreset,
    refDate: Date | string = new Date()
  ): NutritionDateRange {
    const ref = typeof refDate === 'string' ? new Date(refDate) : new Date(refDate);
    const todayStr = getLocalISODate(ref) || '2026-10-02';

    if (typeof input === 'string') {
      switch (input) {
        case 'today':
          return { startDate: todayStr, endDate: todayStr, preset: 'today' };
        case 'last_7_days': {
          const start = new Date(ref);
          start.setDate(ref.getDate() - 6);
          return { startDate: getLocalISODate(start), endDate: todayStr, preset: 'last_7_days' };
        }
        case 'last_30_days': {
          const start = new Date(ref);
          start.setDate(ref.getDate() - 29);
          return { startDate: getLocalISODate(start), endDate: todayStr, preset: 'last_30_days' };
        }
        case 'this_month': {
          const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
          return { startDate: getLocalISODate(start), endDate: todayStr, preset: 'this_month' };
        }
        case 'last_month': {
          const start = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
          const end = new Date(ref.getFullYear(), ref.getMonth(), 0);
          return { startDate: getLocalISODate(start), endDate: getLocalISODate(end), preset: 'last_month' };
        }
        default:
          return { startDate: todayStr, endDate: todayStr, preset: 'today' };
      }
    }

    // Input is NutritionDateRange object
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    let s = typeof input.startDate === 'string' && dateRegex.test(input.startDate)
      ? input.startDate
      : todayStr;
    let e = typeof input.endDate === 'string' && dateRegex.test(input.endDate)
      ? input.endDate
      : todayStr;

    // Clamp future dates to today
    if (e > todayStr) {
      e = todayStr;
    }
    if (s > todayStr) {
      s = todayStr;
    }

    // Swap if reversed
    if (s > e) {
      const temp = s;
      s = e;
      e = temp;
    }

    return {
      startDate: s,
      endDate: e,
      preset: input.preset || 'custom',
    };
  }

  /**
   * Generates continuous daily trend points across a resolved date range.
   */
  public getLongitudinalTrends(
    meals: MealAnalysis[],
    dateRange: NutritionDateRange,
    profile?: Partial<UserProfile> | null
  ): NutritionTrendPoint[] {
    const dates = this.generateDateRange(dateRange.startDate, dateRange.endDate);
    return dates.map(dateKey => {
      const daily = this.aggregateMealsForDate(meals, dateKey, profile);
      return {
        date: dateKey,
        calories: daily.totalCalories,
        proteinG: daily.totalProteinG,
        carbsG: daily.totalCarbsG,
        fatG: daily.totalFatG,
        fiberG: daily.totalFiberG,
        nutritionScore: daily.nutritionScore,
        mealCount: daily.mealCount,
      };
    });
  }

  /**
   * Generates deterministic, evidence-based longitudinal observations across a period.
   */
  public generateLongitudinalInsights(
    trends: NutritionTrendPoint[],
    targetsOrMeals: NutritionTarget | number,
    activeDaysOrConsistency?: number,
    _scoreOrTargets?: number | NutritionTarget,
    explicitTargets?: NutritionTarget
  ): LongitudinalInsight[] {
    const activeTrends = trends.filter(t => t.mealCount > 0);
    const activeDaysCount = typeof activeDaysOrConsistency === 'number' && activeDaysOrConsistency <= trends.length
      ? activeDaysOrConsistency
      : activeTrends.length;

    let targets: NutritionTarget;
    if (typeof targetsOrMeals === 'object' && targetsOrMeals !== null) {
      targets = targetsOrMeals;
    } else if (explicitTargets) {
      targets = explicitTargets;
    } else if (typeof _scoreOrTargets === 'object' && _scoreOrTargets !== null) {
      targets = _scoreOrTargets;
    } else {
      targets = this.calculateDailyTargets();
    }

    const insights: LongitudinalInsight[] = [];

    if (activeDaysCount === 0 || activeTrends.length === 0) {
      insights.push({
        id: 'longitudinal-empty',
        category: 'consistency',
        type: 'info',
        title: 'No Recorded Data',
        observation: 'No meals were logged during this observation window.',
        trendDirection: 'insufficient_data',
        evidence: `0 active logging days across ${trends.length} days.`,
        recommendation: 'Log daily meals consistently to uncover longitudinal nutrient trajectories.',
      });
      return insights;
    }

    // 1. Protein Target Fulfillment Rate
    const proteinTargetDays = activeTrends.filter(t => t.proteinG >= targets.targetProteinG * 0.75).length;
    const proteinPct = Math.round((proteinTargetDays / activeDaysCount) * 100);
    let proteinTrend: 'improving' | 'declining' | 'stable' = 'stable';
    if (proteinPct >= 70) proteinTrend = 'improving';
    else if (proteinPct < 40) proteinTrend = 'declining';

    insights.push({
      id: 'longitudinal-protein-fulfillment',
      category: 'protein',
      type: proteinTrend === 'improving' ? 'success' : proteinTrend === 'declining' ? 'tip' : 'info',
      title: 'Protein Target Fulfillment',
      observation: `Protein target was reached on ${proteinTargetDays} of ${activeDaysCount} recorded days (${proteinPct}%).`,
      trendDirection: proteinTrend,
      evidence: `${proteinTargetDays}/${activeDaysCount} active days achieved >= 75% of your ${targets.targetProteinG}g goal.`,
      recommendation: proteinPct < 60
        ? 'Anchor daily meals with reliable high-yield staples such as sprouts, boiled eggs, curd, or roasted chana.'
        : 'Maintain this robust protein rhythm to support steady recovery and metabolic health.',
    });

    // 2. Caloric Intake Consistency
    const avgCal = Math.round(activeTrends.reduce((a, b) => a + b.calories, 0) / activeDaysCount);
    const calDiff = Math.abs(avgCal - targets.targetCalories);
    const calDiffPct = targets.targetCalories > 0 ? Math.round((calDiff / targets.targetCalories) * 100) : 0;

    insights.push({
      id: 'longitudinal-caloric-consistency',
      category: 'calories',
      type: calDiffPct <= 15 ? 'success' : 'info',
      title: 'Caloric Intake Alignment',
      observation: `Daily caloric intake averaged ${avgCal} kcal across active days against your ${targets.targetCalories} kcal target (${calDiffPct}% variance).`,
      trendDirection: calDiffPct <= 15 ? 'stable' : 'declining',
      evidence: `Mean intake: ${avgCal} kcal/day across ${activeDaysCount} active days.`,
    });

    // 3. Nutrition Score Trend
    if (activeTrends.length >= 4) {
      const mid = Math.floor(activeTrends.length / 2);
      const firstHalf = activeTrends.slice(0, mid);
      const secondHalf = activeTrends.slice(mid);

      const firstAvg = Math.round(firstHalf.reduce((a, b) => a + b.nutritionScore, 0) / firstHalf.length);
      const secondAvg = Math.round(secondHalf.reduce((a, b) => a + b.nutritionScore, 0) / secondHalf.length);
      const diff = secondAvg - firstAvg;

      let scoreTrend: 'improving' | 'declining' | 'stable' = 'stable';
      if (diff >= 5) scoreTrend = 'improving';
      else if (diff <= -5) scoreTrend = 'declining';

      insights.push({
        id: 'longitudinal-score-trajectory',
        category: 'score',
        type: scoreTrend === 'improving' ? 'success' : scoreTrend === 'declining' ? 'tip' : 'info',
        title: 'Nutritional Score Trajectory',
        observation: diff >= 0
          ? `Average nutrition score progressed from ${firstAvg} to ${secondAvg} across the selected window.`
          : `Average nutrition score shifted from ${firstAvg} to ${secondAvg} during this period.`,
        trendDirection: scoreTrend,
        evidence: `Score delta: ${diff >= 0 ? '+' : ''}${diff} points between initial and subsequent observation halves.`,
      });
    }

    // 4. Fiber Adequacy
    const highFiberDays = activeTrends.filter(t => t.fiberG >= 18).length;
    const fiberPct = Math.round((highFiberDays / activeDaysCount) * 100);
    insights.push({
      id: 'longitudinal-fiber-consistency',
      category: 'fiber',
      type: fiberPct >= 60 ? 'success' : 'tip',
      title: 'Dietary Fiber Frequency',
      observation: `Adequate dietary fiber was recorded on ${highFiberDays} of ${activeDaysCount} active days (${fiberPct}%).`,
      trendDirection: fiberPct >= 60 ? 'improving' : 'declining',
      evidence: `${highFiberDays}/${activeDaysCount} active days exceeded 18g fiber intake.`,
      recommendation: fiberPct < 50
        ? 'Incorporate fruits with edible peels, salads, or sprouted legumes into daily lunch or dinner.'
        : undefined,
    });

    return insights;
  }

  /**
   * Generates a comprehensive date-range nutrition report.
   */
  public async getDateRangeReport(
    userId: string | undefined,
    rangeOrPreset: NutritionDateRange | NutritionDateRangePreset,
    explicitProfile?: Partial<UserProfile> | null
  ): Promise<NutritionReport> {
    const dateRange = this.resolveDateRange(rangeOrPreset);
    const { meals: filteredMeals, dataSource } = await this.getMealsForDateRange(
      userId,
      dateRange.startDate,
      dateRange.endDate
    );

    const profile = await this.resolveProfile(userId, explicitProfile);

    const targets = this.calculateDailyTargets(profile);

    const trends = this.getLongitudinalTrends(filteredMeals, dateRange, profile);
    const activeTrends = trends.filter(t => t.mealCount > 0);
    const activeDaysCount = activeTrends.length;
    const totalMeals = filteredMeals.length;

    const avgMealsPerDay = activeDaysCount > 0
      ? Math.round((totalMeals / activeDaysCount) * 10) / 10
      : 0;

    const avgCal = activeDaysCount > 0
      ? Math.round(activeTrends.reduce((a, b) => a + b.calories, 0) / activeDaysCount)
      : 0;

    const avgProt = activeDaysCount > 0
      ? Math.round((activeTrends.reduce((a, b) => a + b.proteinG, 0) / activeDaysCount) * 10) / 10
      : 0;

    const avgCarbs = activeDaysCount > 0
      ? Math.round((activeTrends.reduce((a, b) => a + b.carbsG, 0) / activeDaysCount) * 10) / 10
      : 0;

    const avgFat = activeDaysCount > 0
      ? Math.round((activeTrends.reduce((a, b) => a + b.fatG, 0) / activeDaysCount) * 10) / 10
      : 0;

    const avgFiber = activeDaysCount > 0
      ? Math.round((activeTrends.reduce((a, b) => a + b.fiberG, 0) / activeDaysCount) * 10) / 10
      : 0;

    const avgScore = activeDaysCount > 0
      ? Math.round(activeTrends.reduce((a, b) => a + b.nutritionScore, 0) / activeDaysCount)
      : 0;

    const totalCalories = activeTrends.reduce((a, b) => a + b.calories, 0);
    const totalProteinG = Math.round(activeTrends.reduce((a, b) => a + b.proteinG, 0) * 10) / 10;
    const totalCarbsG = Math.round(activeTrends.reduce((a, b) => a + b.carbsG, 0) * 10) / 10;
    const totalFatG = Math.round(activeTrends.reduce((a, b) => a + b.fatG, 0) * 10) / 10;
    const totalFiberG = Math.round(activeTrends.reduce((a, b) => a + b.fiberG, 0) * 10) / 10;

    let nutritionRating: import('../types/analytics').NutritionScoreRating = 'needs_attention';
    if (avgScore >= 85) nutritionRating = 'excellent';
    else if (avgScore >= 70) nutritionRating = 'good';
    else if (avgScore >= 50) nutritionRating = 'fair';

    const calorieProgressPercent =
      targets.targetCalories > 0 ? Math.round((avgCal / targets.targetCalories) * 100) : 0;
    const proteinProgressPercent =
      targets.targetProteinG > 0 ? Math.round((avgProt / targets.targetProteinG) * 100) : 0;
    const carbsProgressPercent =
      targets.targetCarbsG > 0 ? Math.round((avgCarbs / targets.targetCarbsG) * 100) : 0;
    const fatProgressPercent =
      targets.targetFatG > 0 ? Math.round((avgFat / targets.targetFatG) * 100) : 0;
    const fiberProgressPercent =
      targets.targetFiberG > 0 ? Math.round((avgFiber / targets.targetFiberG) * 100) : 0;

    const scoreDistribution: ScoreDistribution = {
      excellent: activeTrends.filter(t => t.nutritionScore >= 85).length,
      good: activeTrends.filter(t => t.nutritionScore >= 70 && t.nutritionScore < 85).length,
      fair: activeTrends.filter(t => t.nutritionScore >= 50 && t.nutritionScore < 70).length,
      needs_attention: activeTrends.filter(t => t.nutritionScore < 50).length,
    };

    const totalDays = trends.length;
    const consistencyPercentage = totalDays > 0
      ? Math.round((activeDaysCount / totalDays) * 100)
      : 0;

    const insights = this.generateLongitudinalInsights(trends, targets, activeDaysCount);

    const micronutrients = this.aggregateMicronutrientsForMeals(filteredMeals, dateRange.endDate);
    let hydration: HydrationSummary | undefined;
    try {
      hydration = await hydrationService.getDailySummary(userId, dateRange.endDate, profile);
    } catch {
      // Safe fallback
    }

    return {
      dateRange,
      totalMeals,
      totalCalories,
      totalProteinG,
      totalCarbsG,
      totalFatG,
      totalFiberG,
      activeDaysCount,
      activeDays: activeDaysCount,
      averageMealsPerDay: avgMealsPerDay,
      averageCalories: avgCal,
      averageCaloriesPerDay: avgCal,
      averageProteinG: avgProt,
      averageCarbsG: avgCarbs,
      averageFatG: avgFat,
      averageFiberG: avgFiber,
      averageNutritionScore: avgScore,
      nutritionRating,
      scoreDistribution,
      consistencyPercentage,
      targets,
      calorieProgressPercent,
      proteinProgressPercent,
      carbsProgressPercent,
      fatProgressPercent,
      fiberProgressPercent,
      trends,
      trend: trends,
      insights,
      meals: filteredMeals,
      dataSource,
      micronutrients,
      hydration,
    };
  }

  /**
   * Generates a monthly aggregated report for a given year-month or the current month.
   */
  public async getMonthlySummary(
    userId: string | undefined,
    yearMonth?: string
  ): Promise<MonthlyNutritionReport> {
    const today = new Date();
    let y = today.getFullYear();
    let m = today.getMonth(); // 0-indexed

    if (yearMonth && /^\d{4}-\d{2}$/.test(yearMonth)) {
      const parts = yearMonth.split('-');
      y = parseInt(parts[0], 10);
      m = parseInt(parts[1], 10) - 1;
    }

    const firstDay = new Date(y, m, 1);
    const lastDayOfMonth = new Date(y, m + 1, 0);

    const startDate = getLocalISODate(firstDay);
    const endDate = getLocalISODate(lastDayOfMonth);

    const report = await this.getDateRangeReport(userId, { startDate, endDate, preset: 'custom' });

    const monthName = firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const activeTrends = report.trends.filter(t => t.mealCount > 0);

    // Sort to identify strongest and weakest days
    const sortedByScoreDesc = [...activeTrends].sort((a, b) => b.nutritionScore - a.nutritionScore || b.proteinG - a.proteinG);
    const sortedByScoreAsc = [...activeTrends].sort((a, b) => a.nutritionScore - b.nutritionScore);

    const strongestDays: DayScorePoint[] = sortedByScoreDesc.slice(0, 3).map(t => ({
      date: t.date,
      score: t.nutritionScore,
      calories: t.calories,
      proteinG: t.proteinG,
    }));

    const weakestDays: DayScorePoint[] = sortedByScoreAsc.slice(0, 3).map(t => ({
      date: t.date,
      score: t.nutritionScore,
      calories: t.calories,
      proteinG: t.proteinG,
    }));

    return {
      startDate,
      endDate,
      monthName,
      totalMeals: report.totalMeals,
      activeDaysCount: report.activeDaysCount,
      activeDays: report.activeDaysCount,
      averageMealsPerDay: report.averageMealsPerDay,
      averageCalories: report.averageCalories,
      averageProteinG: report.averageProteinG,
      averageCarbsG: report.averageCarbsG,
      averageFatG: report.averageFatG,
      averageFiberG: report.averageFiberG,
      averageNutritionScore: report.averageNutritionScore,
      scoreDistribution: report.scoreDistribution,
      consistencyPercentage: report.consistencyPercentage,
      strongestDays,
      weakestDays,
      trends: report.trends,
      trend: report.trends,
      insights: report.insights,
      dataSource: report.dataSource,
    };
  }

  /**
   * Sanitizes and exports nutrition report as JSON without leaking credentials,
   * passwords, session secrets, or GEMINI_API_KEY.
   */
  public exportReportAsJSON(
    report: NutritionReport,
    profileOrMeals?: UserProfile | MealAnalysis[],
    maybeProfile?: UserProfile
  ): string {
    let mealsToExport = report.meals;
    let profile: UserProfile | undefined;

    if (Array.isArray(profileOrMeals)) {
      mealsToExport = profileOrMeals;
      profile = maybeProfile;
    } else {
      profile = profileOrMeals;
    }

    const sanitizedMeals: SanitizedExportMealItem[] = mealsToExport.map(m => ({
      id: m.id,
      mealTitle: m.mealTitle,
      analyzedAt: m.analyzedAt,
      calories: Math.round(Number(m.totalNutrition?.calories) || 0),
      protein: Math.round((Number(m.totalNutrition?.protein) || 0) * 10) / 10,
      carbohydrates: Math.round((Number(m.totalNutrition?.carbohydrates) || 0) * 10) / 10,
      fat: Math.round((Number(m.totalNutrition?.fat) || 0) * 10) / 10,
      fiber: Math.round((Number(m.totalNutrition?.fiber) || 0) * 10) / 10,
      stars: m.nutrientRichness?.stars || 1,
      items: (m.items || []).map(i => i.name),
    }));

    const payload: SanitizedExportPayload = {
      exportVersion: '1.0',
      generatedAt: new Date().toISOString(),
      userProfile: profile
        ? {
            age: profile.age,
            gender: profile.gender,
            heightCm: profile.heightCm,
            weightKg: profile.weightKg,
            isHostelite: Boolean(profile.isHostelite),
            dietaryRestrictions: profile.dietaryRestrictions,
            budgetPreference: profile.budgetPreference,
          }
        : undefined,
      dateRange: report.dateRange,
      nutritionSummary: {
        totalMeals: report.totalMeals,
        totalCalories: report.totalCalories ?? report.averageCalories,
        totalProteinG: report.totalProteinG ?? report.averageProteinG,
        totalCarbsG: report.totalCarbsG ?? report.averageCarbsG,
        totalFatG: report.totalFatG ?? report.averageFatG,
        totalFiberG: report.totalFiberG ?? report.averageFiberG,
        activeDaysCount: report.activeDaysCount,
        averageCalories: report.averageCalories,
        averageProteinG: report.averageProteinG,
        averageCarbsG: report.averageCarbsG,
        averageFatG: report.averageFatG,
        averageFiberG: report.averageFiberG,
        averageNutritionScore: report.averageNutritionScore,
        consistencyPercentage: report.consistencyPercentage,
      },
      meals: sanitizedMeals,
    };

    return JSON.stringify(payload, null, 2);
  }

  /**
   * Generates a flat dietary journal CSV with proper quote escaping and Unicode support.
   */
  public exportReportAsCSV(report: NutritionReport, explicitMeals?: MealAnalysis[]): string {
    const mealsToExport = explicitMeals && explicitMeals.length > 0 ? explicitMeals : report.meals;

    const escapeCsv = (val: unknown): string => {
      if (val === undefined || val === null) return '""';
      const str = String(val);
      return `"${str.replace(/"/g, '""')}"`;
    };

    const headers = [
      'Date',
      'Meal Title',
      'Calories (kcal)',
      'Protein (g)',
      'Carbohydrates (g)',
      'Fat (g)',
      'Fiber (g)',
      'Nutrition Stars',
      'Food Items',
    ];

    const rows = mealsToExport.map(m => {
      const itemsList = (m.items || []).map(i => i.name).join(', ');
      return [
        escapeCsv(getLocalISODate(m.analyzedAt)),
        escapeCsv(m.mealTitle),
        escapeCsv(Math.round(Number(m.totalNutrition?.calories) || 0)),
        escapeCsv(Math.round((Number(m.totalNutrition?.protein) || 0) * 10) / 10),
        escapeCsv(Math.round((Number(m.totalNutrition?.carbohydrates) || 0) * 10) / 10),
        escapeCsv(Math.round((Number(m.totalNutrition?.fat) || 0) * 10) / 10),
        escapeCsv(Math.round((Number(m.totalNutrition?.fiber) || 0) * 10) / 10),
        escapeCsv(m.nutrientRichness?.stars?.toFixed(1) || '1.0'),
        escapeCsv(itemsList),
      ].join(',');
    });

    // UTF-8 BOM for Microsoft Excel compatibility
    return '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows].join('\r\n');
  }

  /**
   * Helper that packages report into a downloadable NutritionExportResult.
   */
  public exportReport(
    report: NutritionReport,
    format: 'json' | 'csv',
    profile?: UserProfile
  ): NutritionExportResult {
    const filenameDate = `${report.dateRange.startDate}_to_${report.dateRange.endDate}`;
    if (format === 'csv') {
      return {
        format: 'csv',
        filename: `track-a-bite-journal-${filenameDate}.csv`,
        mimeType: 'text/csv;charset=utf-8;',
        content: this.exportReportAsCSV(report),
      };
    }

    return {
      format: 'json',
      filename: `track-a-bite-report-${filenameDate}.json`,
      mimeType: 'application/json;charset=utf-8;',
      content: this.exportReportAsJSON(report, profile),
    };
  }

  private generateDateRange(start: string, end: string): string[] {
    const list: string[] = [];
    const curr = new Date(start);
    const last = new Date(end);
    while (curr <= last) {
      list.push(getLocalISODate(curr));
      curr.setDate(curr.getDate() + 1);
    }
    return list.length > 0 ? list : [start];
  }
}

export const nutritionAnalyticsService = new NutritionAnalyticsService();
