import {
  FoodDetection,
  DetectedFoodItem,
  FoodItem,
  IFoodDatabaseService,
  INutritionService,
  IPortionEstimationService,
  DetectionSource,
} from '../types';

/**
 * Converts a pure perception FoodDetection into a DetectedFoodItem with computed nutritional metrics.
 * Preserves clean service boundaries between Computer Vision perception and Nutrition calculation.
 */
import { getRegionalFoodReference } from '../data/regionalReferences';

export async function detectionToMealItem(
  detection: FoodDetection,
  foodDatabaseService: IFoodDatabaseService,
  nutritionService: INutritionService
): Promise<DetectedFoodItem> {
  let food = await foodDatabaseService.getFoodById(detection.foodId);
  if (!food && detection.name) {
    food = await foodDatabaseService.findFoodByAlias(detection.name);
  }
  // Fallback to regional culinary reference data if identified through research
  if (!food && detection.foodId) {
    food = getRegionalFoodReference(detection.foodId) || (detection.name ? getRegionalFoodReference(detection.name) : null);
  }

  const baseWeight = food?.serving?.weightGrams || food?.weightGramsPerUnit || 150;
  const estimatedGrams = detection.estimatedPortion.rawGramsEquivalent || baseWeight;

  const portionInput = {
    quantity: detection.estimatedPortion.quantity || 1,
    unit: detection.estimatedPortion.unit || 'serving',
    weightGrams: estimatedGrams,
  };

  const nutritionResult = nutritionService.calculateNutrition(food, portionInput);

  // Multiplier relative to standard serving size
  const portionMultiplier =
    Math.round((estimatedGrams / Math.max(1, baseWeight)) * 100) / 100;

  const nutritionProfile: import('../types').NutritionProfile = {
    calories: nutritionResult.calories,
    carbohydrates: nutritionResult.carbohydrates,
    protein: nutritionResult.protein,
    fat: nutritionResult.fat,
    fiber: nutritionResult.fiber,
    sodium: food?.nutrition.sodium
      ? Math.round(food.nutrition.sodium * (nutritionResult.serving.weightGrams / Math.max(1, baseWeight)))
      : undefined,
    sugar: food?.nutrition.sugar
      ? Math.round(food.nutrition.sugar * (nutritionResult.serving.weightGrams / Math.max(1, baseWeight)) * 10) / 10
      : undefined,
  };

  const isEstimated =
    detection.isEstimatedNutrition ||
    Boolean(food?.nutrition.isApproximate) ||
    detection.identificationMode === 'research';

  return {
    detectionId: detection.id,
    foodId: food ? food.id : detection.foodId,
    name: food ? food.name : detection.name,
    localNameHindi: food?.localNames.hindi || detection.localNameHindi,
    confidence: detection.confidence,
    portionMultiplier,
    portionUnit: detection.estimatedPortion.unit,
    estimatedGrams: nutritionResult.serving.weightGrams || estimatedGrams,
    nutrition: nutritionProfile,
    boundingBox: detection.boundingBox,
    isUserModified: detection.source === 'user-corrected' || detection.source === 'manual-entry',
    needsConfirmation:
      !nutritionResult.nutritionAvailable ||
      Boolean(detection.needsConfirmation) ||
      detection.confidence < 0.60,
    nutritionAvailable: nutritionResult.nutritionAvailable,
    micronutrients: nutritionResult.micronutrients,
    nutritionResult,
    regions: detection.regions,
    identificationMode: detection.identificationMode || (food ? 'local' : 'vision'),
    evidence: detection.evidence,
    visualObservation: detection.visualObservation,
    isEstimatedNutrition: isEstimated,
    fallbackDescription: detection.fallbackDescription,
  };
}

/**
 * Creates a new FoodDetection when user manually adds an extra food item
 */
export async function createManualDetection(
  food: FoodItem,
  portionEstimationService: IPortionEstimationService,
  source: DetectionSource = 'manual-entry'
): Promise<FoodDetection> {
  const portion = await portionEstimationService.estimatePortion(food.id);

  return {
    id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    foodId: food.id,
    name: food.name,
    localNameHindi: food.localNames.hindi,
    confidence: 1.0,
    confidenceTier: 'high',
    estimatedPortion: portion,
    source,
  };
}

/**
 * Replaces an existing detection when user taps "Not correct?"
 */
export async function replaceDetection(
  existing: FoodDetection,
  newFood: FoodItem,
  portionEstimationService: IPortionEstimationService
): Promise<FoodDetection> {
  const newPortion = await portionEstimationService.estimatePortion(newFood.id, {
    boundingBox: existing.boundingBox,
  });

  return {
    ...existing,
    foodId: newFood.id,
    name: newFood.name,
    localNameHindi: newFood.localNames.hindi,
    confidence: 1.0,
    confidenceTier: 'high',
    estimatedPortion: newPortion,
    source: 'user-corrected',
  };
}
