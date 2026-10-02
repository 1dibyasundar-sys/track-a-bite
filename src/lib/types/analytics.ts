/**
 * Nutrition Analytics Domain Types (Phase 8.4)
 *
 * Defines strongly typed structures for daily and weekly aggregation,
 * personalized nutritional scoring, gap-driven insights, and next-meal recommendations.
 */

import { MealAnalysis } from './meal';
import { HydrationSummary } from './hydration';

export interface MicronutrientIntake {
  ironMg?: number;
  calciumMg?: number;
  vitaminDMcg?: number;
  potassiumMg?: number;
  sodiumMg?: number;
  vitaminB12Mcg?: number;
  folateMcg?: number;
}

export type MicronutrientDataAvailability = 'sufficient' | 'limited' | 'none';
export type MicronutrientStatus =
  | 'on_track'
  | 'below_reference'
  | 'above_reference'
  | 'insufficient_data';

export interface MicronutrientProgressItem {
  key: keyof MicronutrientIntake;
  name: string;
  unit: 'mg' | 'mcg';
  consumed: number;
  referenceTarget: number;
  percentage: number;
  dataAvailability: MicronutrientDataAvailability;
  status: MicronutrientStatus;
  label: string; // e.g. "Reference intake"
}

export interface DailyMicronutrientSummary {
  date: string; // YYYY-MM-DD
  intake: MicronutrientIntake;
  nutrients: Record<keyof MicronutrientIntake, MicronutrientProgressItem>;
  dataAvailability: MicronutrientDataAvailability;
  recordedItemsCount: number;
  disclaimer: string;
}

export type NutritionScoreRating = 'excellent' | 'good' | 'fair' | 'needs_attention';

export interface NutritionScoreBreakdown {
  caloriesScore: number;      // 0 - 25
  proteinScore: number;       // 0 - 30
  macroBalanceScore: number;  // 0 - 25
  fiberDiversityScore: number;// 0 - 20
}

export interface NutritionScoreResult {
  score: number; // 0 - 100
  rating: NutritionScoreRating;
  breakdown: NutritionScoreBreakdown;
  explanation: string;
}

export interface NutritionTarget {
  targetCalories: number;
  targetProteinG: number;
  targetCarbsG: number;
  targetFatG: number;
  targetFiberG: number;
  isPersonalized: boolean;
  calculationMethod: 'user_defined' | 'mifflin_st_jeor' | 'standard_heuristic';
  targetTypeLabel?: 'Custom target' | 'Recommended target';
}

export interface DailyNutritionSummary {
  date: string; // YYYY-MM-DD (local calendar date)
  totalCalories: number;
  totalProteinG: number;
  totalCarbsG: number;
  totalFatG: number;
  totalFiberG: number;
  mealCount: number;
  nutritionScore: number; // 0 - 100
  nutritionRating: NutritionScoreRating;
  targetCalories: number;
  targetProteinG: number;
  targetCarbsG: number;
  targetFatG: number;
  targetFiberG: number;
  calorieProgressPercent: number; // e.g. 75 (%)
  proteinProgressPercent: number;
  carbsProgressPercent: number;
  fatProgressPercent: number;
  fiberProgressPercent: number;
  meals: MealAnalysis[];
  dataSource: 'cloud' | 'local' | 'mixed';
  micronutrients?: DailyMicronutrientSummary;
  hydration?: HydrationSummary;
}

export interface ConsistencyMetrics {
  daysWithLogs: number;             // Number of days in range with >= 1 meal
  loggedMealsCount: number;         // Total meals logged in period
  targetConsistencyPercent: number; // % of logged days meeting >= 70% of protein/calorie targets
  scoreConsistency: 'high' | 'moderate' | 'variable';
}

export interface DashboardStreakMetrics {
  currentStreakDays: number;
  longestStreakDays: number;
  hasSufficientData: boolean;
  sevenDayConsistencyPercent: number;
  thirtyDayConsistencyPercent: number;
  activeLoggingDaysCount: number;
  hydrationGoalMetDaysCount: number;
  mealsLoggedToday: number;
  hydrationLoggedTodayMl: number;
  streakStatusMessage: string;
}

export interface WeeklyNutritionSummary {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  dailySummaries: DailyNutritionSummary[];
  averageCalories: number;
  averageProtein: number;
  averageCarbs: number;
  averageFat: number;
  averageFiber: number;
  averageNutritionScore: number;
  totalMeals: number;
  consistencyMetrics: ConsistencyMetrics;
  dataSource: 'cloud' | 'local' | 'mixed';
}

export type InsightType =
  | 'low_protein'
  | 'high_calories'
  | 'low_calories'
  | 'low_fiber'
  | 'carb_heavy'
  | 'fat_heavy'
  | 'balanced'
  | 'low_diversity'
  | 'micronutrient_gap'
  | 'micronutrient_target_met'
  | 'micronutrient_limited'
  | 'hydration_below_target'
  | 'hydration_target_met'
  | 'general';

export type InsightSeverity = 'info' | 'positive' | 'attention' | 'warning';

export interface NutritionInsight {
  id: string;
  type: InsightType;
  severity: InsightSeverity;
  title: string;
  description: string;
  affectedNutrient?: string;
  recommendation?: string;
  evidence: string; // Empirical data justifying insight (e.g. "Recorded 24g vs target 65g")
}

export interface NextMealEstimatedNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export type RecommendationAffordabilityCategory = 'budget' | 'moderate' | 'premium';
export type RecommendationPrepType = 'no-cook' | 'canteen' | 'minimal-prep' | 'cooking';
export type HostelFilterMode = 'all' | 'no_cook' | 'budget' | 'high_protein' | 'mess_friendly' | 'no_fridge';

export interface NextMealRecommendation {
  id: string;
  title: string;
  reason: string;
  nutritionBenefit: string;
  estimatedCost: string;
  preparationType: RecommendationPrepType;
  hostelFriendly: boolean;
  confidence: number; // 0.0 - 1.0 deterministic confidence
  suggestedFoods: string[];
  estimatedNutrition: NextMealEstimatedNutrition;
  affordabilityCategory: RecommendationAffordabilityCategory;
  noCookRequired: boolean;
  emoji: string;
  actionTip?: string;
  messFriendly?: boolean;
  requiresFridge?: boolean;
}

export type NudgeCategory = 'hydration' | 'protein' | 'meal' | 'micronutrient' | 'consistency';
export type NudgePriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface SmartNudge {
  id: string;
  category: NudgeCategory;
  priority: NudgePriority;
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
  timestamp?: string;
}

export type SupportedHealthGoal =
  | 'general_health'
  | 'weight_management'
  | 'fat_loss'
  | 'muscle_gain'
  | 'nutrition_consistency'
  | 'hydration_consistency'
  | 'protein_consistency';

export interface GoalProgressSummary {
  goal: SupportedHealthGoal;
  goalLabel: string;
  currentValue: number;
  targetValue: number;
  unit: string;
  progressPercent: number; // 0-100% clamped
  weeklyTrend: 'improving' | 'stable' | 'needs_attention';
  weeklyTrendDescription: string;
  consistencyPercent: number;
  recommendedAction: string;
}
