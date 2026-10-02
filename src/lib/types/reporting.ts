/**
 * Nutrition Reporting & Longitudinal Analytics Domain Types (Phase 8.5)
 *
 * Defines strongly typed structures for date-range queries, monthly reports,
 * multi-day trend vectors, longitudinal insights, and sanitized export payloads.
 */

import { MealAnalysis } from './meal';
import { NutritionTarget, NutritionScoreRating } from './analytics';

export type NutritionDateRangePreset =
  | 'today'
  | 'last_7_days'
  | 'last_30_days'
  | 'this_month'
  | 'last_month'
  | 'custom';

export interface NutritionDateRange {
  startDate: string; // YYYY-MM-DD (local calendar date)
  endDate: string;   // YYYY-MM-DD (local calendar date)
  preset?: NutritionDateRangePreset;
}

export interface NutritionTrendPoint {
  date: string; // YYYY-MM-DD
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  nutritionScore: number;
  mealCount: number;
}

export type TrendDirection = 'improving' | 'declining' | 'stable' | 'insufficient_data';

export type InsightCategory =
  | 'protein'
  | 'calories'
  | 'consistency'
  | 'score'
  | 'balance'
  | 'fiber';

export interface LongitudinalInsight {
  id: string;
  category: InsightCategory;
  type?: 'info' | 'tip' | 'success' | 'warning';
  title: string;
  observation: string;
  trendDirection: TrendDirection;
  evidence: string; // Verifiable empirical metrics (e.g. "Met protein targets on 21 of 28 days (75%)")
  recommendation?: string;
}

export interface DayScorePoint {
  date: string;
  score: number;
  calories: number;
  proteinG: number;
}

export interface ScoreDistribution {
  excellent: number;       // score >= 85
  good: number;            // 70 <= score < 85
  fair: number;            // 50 <= score < 70
  needs_attention: number; // score < 50
}

export interface MonthlyNutritionReport {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  monthName: string; // e.g. "October 2026"
  totalMeals: number;
  activeDaysCount: number;
  activeDays?: number;
  averageMealsPerDay: number;
  averageCalories: number;
  averageProteinG: number;
  averageCarbsG: number;
  averageFatG: number;
  averageFiberG: number;
  averageNutritionScore: number;
  scoreDistribution: ScoreDistribution;
  consistencyPercentage: number;
  strongestDays: DayScorePoint[];
  weakestDays: DayScorePoint[];
  trends: NutritionTrendPoint[];
  trend: NutritionTrendPoint[];
  insights: LongitudinalInsight[];
  dataSource: 'cloud' | 'local' | 'mixed';
}

export interface NutritionReport {
  dateRange: NutritionDateRange;
  totalMeals: number;
  totalCalories?: number;
  totalProteinG?: number;
  totalCarbsG?: number;
  totalFatG?: number;
  totalFiberG?: number;
  activeDaysCount: number;
  activeDays?: number;
  averageMealsPerDay: number;
  averageCalories: number;
  averageCaloriesPerDay?: number;
  averageProteinG: number;
  averageCarbsG: number;
  averageFatG: number;
  averageFiberG: number;
  averageNutritionScore: number;
  nutritionRating?: NutritionScoreRating;
  scoreDistribution: ScoreDistribution;
  consistencyPercentage: number;
  targets?: NutritionTarget;
  calorieProgressPercent?: number;
  proteinProgressPercent?: number;
  carbsProgressPercent?: number;
  fatProgressPercent?: number;
  fiberProgressPercent?: number;
  trends: NutritionTrendPoint[];
  trend: NutritionTrendPoint[];
  insights: LongitudinalInsight[];
  meals: MealAnalysis[];
  dataSource: 'cloud' | 'local' | 'mixed';
  micronutrients?: import('./analytics').DailyMicronutrientSummary;
  hydration?: import('./hydration').HydrationSummary;
}

export type NutritionExportFormat = 'json' | 'csv' | 'print';

export interface NutritionExportResult {
  format: NutritionExportFormat;
  filename: string;
  mimeType: string;
  content: string;
}

export interface SanitizedExportMealItem {
  id: string;
  mealTitle: string;
  analyzedAt: string;
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber: number;
  stars: number;
  items: string[];
}

export interface SanitizedExportProfile {
  age?: number;
  gender?: string;
  heightCm?: number;
  weightKg?: number;
  healthGoal?: string;
  isHostelite: boolean;
  dietaryRestrictions?: string;
  budgetPreference?: string;
  targetCalories?: number;
  targetProteinG?: number;
  targetCarbsG?: number;
  targetFatG?: number;
  targetHydrationMl?: number;
  customTargetsActive?: boolean;
}

export interface SanitizedExportPayload {
  exportVersion: '1.0';
  generatedAt: string; // ISO 8601 timestamp
  userProfile?: SanitizedExportProfile;
  dateRange: NutritionDateRange;
  nutritionSummary: {
    totalMeals: number;
    totalCalories?: number;
    totalProteinG?: number;
    totalCarbsG?: number;
    totalFatG?: number;
    totalFiberG?: number;
    activeDaysCount: number;
    averageCalories: number;
    averageProteinG: number;
    averageCarbsG: number;
    averageFatG: number;
    averageFiberG: number;
    averageNutritionScore: number;
    consistencyPercentage: number;
  };
  meals: SanitizedExportMealItem[];
}

export interface NutritionExportUser {
  displayName?: string;
  age?: number;
  gender?: string;
  heightCm?: number;
  weightKg?: number;
  healthGoal?: string;
  dietaryRestrictions?: string;
  isHostelite?: boolean;
  targetCalories?: number;
  targetProteinG?: number;
  targetCarbsG?: number;
  targetFatG?: number;
  targetHydrationMl?: number;
  customTargetsActive?: boolean;
}

export interface NutritionExportPeriod {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  preset?: string;
}

export interface NutritionExportSummary {
  totalMeals: number;
  totalCalories?: number;
  totalProteinG?: number;
  totalCarbsG?: number;
  totalFatG?: number;
  totalFiberG?: number;
  activeDaysCount?: number;
  averageCalories: number;
  averageProteinG: number;
  averageCarbsG: number;
  averageFatG: number;
  averageFiberG?: number;
  averageNutritionScore?: number;
  consistencyPercentage?: number;
}

export interface NutritionExportPayload {
  application: 'Track-a-Bite';
  exportVersion: '1.0';
  generatedAt: string; // ISO 8601 timestamp
  user?: NutritionExportUser;
  userProfile?: SanitizedExportProfile;
  period: NutritionExportPeriod;
  dateRange?: NutritionDateRange;
  summary: NutritionExportSummary;
  nutritionSummary?: NutritionExportSummary;
  targets?: import('./analytics').NutritionTarget;
  meals: SanitizedExportMealItem[];
  micronutrients?: import('./analytics').DailyMicronutrientSummary;
  hydration?: import('./hydration').HydrationSummary;
}

export interface PrintableNutritionReportData {
  title: string;
  generatedAt: string;
  period: NutritionExportPeriod;
  user?: NutritionExportUser;
  summary: NutritionExportSummary;
  score: {
    value: number;
    rating?: string;
    consistencyPercentage: number;
  };
  targets?: import('./analytics').NutritionTarget;
  progress?: {
    caloriesPercent: number;
    proteinPercent: number;
    carbsPercent: number;
    fatPercent: number;
  };
  insights: LongitudinalInsight[];
  recommendations: import('./analytics').NextMealRecommendation[];
  meals: SanitizedExportMealItem[];
  dataSource: 'cloud' | 'local' | 'mixed';
  micronutrients?: import('./analytics').DailyMicronutrientSummary;
  hydration?: import('./hydration').HydrationSummary;
}
