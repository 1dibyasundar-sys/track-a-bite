/**
 * Personalized Nutrition Analysis & 5-Star Scoring Domain Types (Phase 6.4)
 *
 * Transforms image-derived meal nutrition into actionable, understandable,
 * and transparent nutritional intelligence tailored to the student's profile.
 */

export type MealContext = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'meal';

export type DimensionStatus =
  | 'good'
  | 'balanced'
  | 'could_improve'
  | 'relatively_high'
  | 'relatively_low'
  | 'low';

export interface ScoreDimension {
  score: number; // 1 to 5
  status: DimensionStatus;
  label: string; // e.g. "Good", "Balanced", "Could improve", "Relatively high"
  percentBar: number; // 0 to 100
  textBar: string; // e.g. "████████░░"
  commentary: string; // human-readable rationale
}

export interface ScoreDimensionMap {
  protein: ScoreDimension;
  fiber: ScoreDimension;
  carbohydrates: ScoreDimension;
  fat: ScoreDimension;
  mealBalance: ScoreDimension;
}

export type AffordabilityCategory = 'very_low_cost' | 'low_cost' | 'moderate_cost';

export interface NutrientRecommendation {
  id: string;
  food: string;
  foodId?: string;
  emoji: string;
  bestFor: string; // e.g. "Protein + Fiber", "Protein", "Protein + Calcium"
  reason: string;
  priority: 'high' | 'medium';
  affordability: AffordabilityCategory;
  affordabilityLabel: string; // e.g. "Very affordable", "Affordable"
  hostelFriendly: boolean;
  availabilityNote: string; // e.g. "Hostel friendly", "Easy to find", "Minimal preparation"
  nutrientContribution: {
    protein?: 'high' | 'moderate' | 'low';
    fiber?: 'high' | 'moderate' | 'low';
    calcium?: 'high' | 'moderate';
    potassium?: 'high' | 'moderate';
  };
  tags: string[];
}

export interface DailyEnergyEstimate {
  estimatedDailyCalories: number | null;
  calculationMethod: 'mifflin_st_jeor' | 'icmr_standard' | 'insufficient_profile';
  confidence: number;
  disclaimer: string;
  status: 'calculated' | 'insufficient_profile';
}

export interface TargetRange {
  target: number;
  min: number;
  max: number;
  unit: string;
}

export interface MealNutrientTargets {
  mealContext: MealContext;
  allocationFraction: number; // e.g. 0.35 for lunch
  calories: TargetRange;
  protein: TargetRange;
  carbohydrates: TargetRange;
  fat: TargetRange;
  fiber: TargetRange;
  status: 'personalized' | 'standard_heuristic' | 'insufficient_profile';
}

export interface NutrientAssessmentItem {
  status: string;
  score: number;
  label?: string;
}

export interface MealPersonalizedAnalysis {
  overallScore: number; // 1.0 to 5.0 (step 0.5)
  stars: number; // Numeric stars (e.g. 4.0)
  starDisplay: string; // e.g. "⭐⭐⭐⭐☆"
  scoreLabel: string; // e.g. "Good overall balance"
  summary: string; // e.g. "Good overall balance. Your meal could use a little more protein."
  dailyEnergy?: DailyEnergyEstimate;
  targets?: MealNutrientTargets;
  dimensions: ScoreDimensionMap;
  nutrientAssessment: {
    protein: NutrientAssessmentItem;
    fiber: NutrientAssessmentItem;
    carbohydrates: NutrientAssessmentItem;
    fat: NutrientAssessmentItem;
    mealBalance: NutrientAssessmentItem;
  };
  gaps: string[]; // e.g. ["protein", "fiber"]
  imbalances: string[]; // e.g. ["relatively_high_carbs"]
  recommendations: NutrientRecommendation[];
  primaryRecommendation?: NutrientRecommendation;
  alternativeRecommendations: NutrientRecommendation[];
  hostelModeActive: boolean;
  hostelBadgeText?: string;
  healthNotice?: string;
  profileStatus: 'personalized' | 'insufficient_profile' | 'standard';
  disclaimer: string;
}
