import { FoodItem, FoodFilterOptions, Region } from './food';
import {
  NutritionProfile,
  MacroDistribution,
  NutrientRichnessScore,
  NutrientGapAssessment,
  PortionInput,
  NutritionResult,
  MealNutritionResult,
  MealAnalysisResult,
  FoodRecommendation,
} from './nutrition';
import { DetectedFoodItem, MealAnalysis, BalancingRecommendation } from './meal';
import { UserProfile } from './profile';
import {
  AppImage,
  FoodRecognitionResult,
  EstimatedPortion,
  PortionUnit,
  BoundingBox,
} from './recognition';

export interface RecognitionOptions {
  scenarioHintId?: string;
  confidenceThreshold?: number;
}

export interface MockScenarioInfo {
  id: string;
  label: string;
  description: string;
  expectedDetections: string[];
  isMultiFood: boolean;
  isLowConfidence?: boolean;
  isNoFood?: boolean;
}

export interface IFoodRecognitionService {
  /**
   * Primary recognition contract receiving an abstracted AppImage
   * and returning a typed FoodRecognitionResult.
   */
  recognizeFood(
    image: AppImage,
    options?: RecognitionOptions
  ): Promise<FoodRecognitionResult>;

  /**
   * Returns list of deterministic test scenarios for UI demos and automated verification
   */
  getAvailableMockScenarios(): MockScenarioInfo[];

  /**
   * Legacy simulation helper kept for backwards compatibility
   */
  recognizeSampleScenario?(scenarioId: string): Promise<FoodRecognitionResult>;
}

export interface IPortionEstimationService {
  /**
   * Estimates quantity and unit for a recognized food item based on visual cues or standard servings
   */
  estimatePortion(
    foodId: string,
    visualCue?: { boundingBox?: BoundingBox; preferredUnit?: PortionUnit }
  ): Promise<EstimatedPortion>;

  /**
   * Adjusts portion quantity while maintaining consistent unit scaling
   */
  adjustPortion(current: EstimatedPortion, delta: number): EstimatedPortion;

  /**
   * Converts estimated portion into normalized grams for nutrition calculation
   */
  calculateGrams(foodId: string, portion: EstimatedPortion): number;
}

export interface IFoodDatabaseService {
  getAllFoods(): Promise<FoodItem[]>;
  getFoodById(id: string): Promise<FoodItem | null>;
  findFoodByName(name: string): Promise<FoodItem | null>;
  findFoodByAlias(alias: string): Promise<FoodItem | null>;
  searchFoods(options: string | FoodFilterOptions): Promise<FoodItem[]>;
  getAffordableProteins(): Promise<FoodItem[]>;
  getByRegion(region: Region): Promise<FoodItem[]>;
}

export interface INutritionService {
  /**
   * Primary Phase 4 nutrition calculation for a food item and portion.
   * Scales reference nutrition values proportionally.
   * If food is null/unknown, returns nutritionAvailable: false without inventing values.
   */
  calculateNutrition(food: FoodItem | null, portion: PortionInput): NutritionResult;

  /**
   * Aggregates nutrition across all foods in a meal, including total calories, macros, and micronutrients.
   */
  calculateMealNutrition(
    items: Array<{ food: FoodItem | null; portion: PortionInput }>
  ): MealNutritionResult;

  calculateItemNutrition(food: FoodItem, multiplier: number): NutritionProfile;
  aggregateNutrition(items: DetectedFoodItem[]): NutritionProfile;
  calculateMacroDistribution(nutrition: NutritionProfile): MacroDistribution;
  calculateNutrientRichness(nutrition: NutritionProfile, items?: DetectedFoodItem[]): NutrientRichnessScore;
  calculateNutrientGaps(nutrition: NutritionProfile, items?: DetectedFoodItem[]): NutrientGapAssessment;
}

export interface IMealAnalysisService {
  analyzeMeal(
    items: DetectedFoodItem[],
    mealTitle?: string,
    imageUrl?: string,
    userProfile?: UserProfile
  ): Promise<MealAnalysis>;
}

export interface INutrientAnalysisService {
  /**
   * Primary Phase 5 contract:
   * Evaluates calculated meal nutrition against profile to determine
   * composition, 5-star nutrient richness score, nutrient gaps, and food recommendations.
   */
  analyzeMeal(
    mealNutrition: MealNutritionResult,
    userProfile?: UserProfile
  ): MealAnalysisResult;
}

export interface IRecommendationService {
  /**
   * Phase 5 primary recommendation contract:
   * Suggests practical, affordable, hostel-prioritized foods to address nutrient gaps.
   */
  getRecommendations(
    analysis: MealAnalysisResult,
    userProfile?: UserProfile,
    foods?: FoodItem[]
  ): FoodRecommendation[];

  generateRecommendations(analysis: {
    nutrition: NutritionProfile;
    macroDistribution: MacroDistribution;
    items: DetectedFoodItem[];
    userProfile?: UserProfile;
  }): Promise<BalancingRecommendation[]>;
}

export interface IMealHistoryService {
  getRecentMeals(): Promise<MealAnalysis[]>;
  getMealById(id: string): Promise<MealAnalysis | null>;
  saveMeal(meal: MealAnalysis): Promise<void>;
  deleteMeal(id: string): Promise<void>;
  clearHistory?(): Promise<void>;
}
