export interface Micronutrient {
  name: string;
  amount: string;
  dailyValuePercentage?: number;
  healthContext?: string;
}

export interface MicronutrientMap {
  iron?: number; // mg
  calcium?: number; // mg
  vitaminC?: number; // mg
  vitaminA?: number; // mcg
  potassium?: number; // mg
  [key: string]: number | undefined;
}

export interface FoodServing {
  size: number; // reference numeric quantity (e.g. 100, 1)
  unit: string; // reference unit ('g', 'ml', 'piece', 'bowl', 'cup', 'serving')
  weightGrams: number; // weight in grams of 1 reference serving
  description: string; // user-friendly label (e.g. "1 medium katori (150g cooked)")
}

export interface FoodNutrition {
  calories: number; // kcal
  carbohydrates: number; // grams
  protein: number; // grams
  fat: number; // grams
  fiber: number; // grams
  iron?: number; // mg
  calcium?: number; // mg
  vitaminC?: number; // mg
  vitaminA?: number; // mcg
  potassium?: number; // mg
  sodium?: number; // mg
  sugar?: number; // grams
  isApproximate?: boolean;
}

export interface PortionInput {
  quantity?: number;
  size?: number; // alias for quantity
  unit: string;
  weightGrams?: number;
}

export interface NutritionResult {
  calories: number; // kcal
  carbohydrates: number; // grams
  protein: number; // grams
  fat: number; // grams
  fiber: number; // grams
  micronutrients: MicronutrientMap;
  serving: {
    quantity: number;
    unit: string;
    weightGrams: number;
    description: string;
  };
  nutritionAvailable: boolean;
  needsConfirmation?: boolean;
  isApproximate?: boolean;
  disclaimer?: string;
}

export interface MealNutritionItem {
  foodId: string;
  foodName: string;
  portion: PortionInput;
  nutrition: NutritionResult;
}

export interface MealNutritionResult {
  totalCalories: number;
  totalCarbohydrates: number;
  totalProtein: number;
  totalFat: number;
  totalFiber: number;
  totalMicronutrients: MicronutrientMap;
  micronutrients?: MicronutrientMap;
  items: MealNutritionItem[];
  disclaimer: string;
}

export interface NutritionProfile {
  calories: number; // kcal
  protein: number; // grams
  carbohydrates: number; // grams
  fat: number; // grams
  fiber: number; // grams
  sodium?: number; // mg
  sugar?: number; // grams
  micronutrients?: Micronutrient[];
}

export interface MacroDistribution {
  carbsPercent: number;
  proteinPercent: number;
  fatPercent: number;
}

export type MealBalanceRating =
  | 'balanced'
  | 'carb-heavy'
  | 'protein-light'
  | 'fat-heavy'
  | 'fiber-rich'
  | 'low-vegetable';

export interface BalanceAssessment {
  rating: MealBalanceRating;
  label: string;
  summary: string;
  detail: string;
  glycemicImpactEstimate: 'Low' | 'Moderate' | 'High';
}

export interface NutrientRichnessScore {
  stars: number; // 1.0 to 5.0 (step 0.5)
  label: string; // e.g. "Nutrient Rich", "Energy Dense", "Balanced Fuel"
  explanation: string; // e.g. "Good source of protein and fiber, but relatively low in calcium."
  highlights: string[];
}

export interface ProvidedNutrient {
  name: string;
  amountDescription: string;
  status: 'good' | 'moderate';
}

export interface MissingNutrient {
  name: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  practicalSource: string; // e.g. "Curd or Boiled Eggs"
}

export interface NutrientGapAssessment {
  providedNutrients: ProvidedNutrient[];
  missingNutrients: MissingNutrient[];
  whyItMattersSummary: string;
}

// ============================================================================
// PHASE 5: NUTRIENT INTELLIGENCE & 5-STAR RICHNESS TYPES
// ============================================================================

export type MealCharacteristic =
  | 'protein-rich'
  | 'carbohydrate-heavy'
  | 'fat-heavy'
  | 'fiber-rich'
  | 'micronutrient-rich'
  | 'balanced'
  | 'low-protein'
  | 'low-fiber'
  | 'highly-processed';

export type StarScore = 1 | 2 | 3 | 4 | 5;

export type StarScoreLabel =
  | 'Very Limited'
  | 'Needs Improvement'
  | 'Moderate'
  | 'Good'
  | 'Nutrient Rich';

export interface NutrientRichnessResult {
  score: StarScore;
  label: StarScoreLabel;
  explanation: string;
}

export interface MealCompositionResult {
  dominantNutrients: MealCharacteristic[];
  strengths: string[];
}

export type GapNutrientName =
  | 'protein'
  | 'fiber'
  | 'iron'
  | 'calcium'
  | 'vitaminC'
  | 'vitaminA'
  | 'potassium';

export type GapSeverity = 'low' | 'moderate' | 'high';

export interface NutrientGapItem {
  nutrient: GapNutrientName;
  severity: GapSeverity;
  explanation: string;
}

export type RecommendationAffordability = 'budget' | 'moderate' | 'premium';

export interface FoodRecommendation {
  foodId: string;
  foodName: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  affordability: RecommendationAffordability;
  hostelFriendly: boolean;
}

export interface MealAnalysisResult {
  nutrientRichness: NutrientRichnessResult;
  composition: MealCompositionResult;
  gaps: NutrientGapItem[];
  recommendations: FoodRecommendation[];
  professionalGuidanceNote?: string;
  disclaimer: string;
}
