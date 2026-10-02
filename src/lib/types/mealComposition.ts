/**
 * Structured Meal Composition Domain Model (Phase 6.2 & Phase 6.3)
 *
 * Converts individual visual food detections into a coherent,
 * nutrition-ready structured meal with preserved source regions,
 * food-type-aware portion estimation, and honest nutrition calculations.
 */

import {
  BoundingBox,
  ConfidenceTier,
  FoodEvidence,
  IdentificationMode,
  VisualObservation,
} from './recognition';
import { NutritionProfile } from './nutrition';

export type EstimationMethod =
  | 'visual_area_estimate'
  | 'visual_volume_estimate'
  | 'piece_count_estimate'
  | 'container_reference'
  | 'user_confirmed'
  | 'catalogue_default'
  | 'unavailable';

export interface PortionUncertaintyRange {
  minGrams: number;
  maxGrams: number;
}

export interface MealComponentPortion {
  value: number | null; // e.g. 150 (grams) or 2 (pieces)
  quantity: number; // Numeric count or quantity (backward compatible)
  unit: string; // 'g' | 'ml' | 'piece' | 'bowl' | 'serving'
  estimatedGrams: number | null; // Approximate mass in grams
  estimatedVolumeMl?: number | null; // Approximate volume in ml
  status: 'pending' | 'estimated' | 'confirmed';
  estimationMethod: EstimationMethod;
  confidence: number; // 0.0 - 1.0 confidence in portion estimate
  userConfirmed: boolean;
  formattedDisplay: string; // e.g. "≈ 150g" or "2 pieces (≈ 80g)" or "Portion pending"
  isPieceBased: boolean;
  uncertaintyRange?: PortionUncertaintyRange;
}

export interface MealComponentRegion {
  regionId: string;
  foodId: string;
  foodName: string;
  confidence: number;
  portion: MealComponentPortion;
  boundingBox?: BoundingBox;
  visualObservation?: VisualObservation;
  visualNotes?: string;
}

export interface MealComponentNutritionRef {
  isAvailable: boolean;
  isEstimated: boolean;
  nutrition?: NutritionProfile;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  source: 'local_database' | 'regional_reference' | 'estimated' | 'none';
  recipeReferenceName?: string;
}

export interface ComponentNutrition {
  calories: number | null;
  carbohydrates: number | null;
  protein: number | null;
  fat: number | null;
  fiber: number | null;
  status: 'linked' | 'estimated_fallback' | 'unmapped';
  confidence: number; // Composite confidence (food conf * portion conf * ref reliability)
  isApproximate: boolean;
  referenceServingGrams?: number;
  referenceServingDescription?: string;
  formattedCalories: string; // e.g. "≈ 234 kcal" or "Unmapped"
  formattedProtein?: string; // e.g. "≈ 4.9g"
  formattedCarbs?: string; // e.g. "≈ 50.4g"
  formattedFat?: string; // e.g. "≈ 0.5g"
  formattedFiber?: string; // e.g. "≈ 0.7g"
  disclaimer?: string;
}

export interface MealComponent {
  id: string; // e.g. "comp-vegetable-curry-1"
  foodId: string; // Identifier in database or regional catalog
  name: string; // Canonical food name (e.g. "Mixed Vegetable Curry")
  normalizedName: string; // Standardized food identity (e.g. "Mixed Vegetable Curry")
  category: string; // 'grains' | 'lentils' | 'curry' | 'bread' | 'snack' | 'condiment' | 'beverage' | 'other'
  confidence: number; // Combined perception confidence (0.0 - 1.0)
  confidenceTier: ConfidenceTier;
  identificationMode: IdentificationMode; // 'local' | 'research' | 'vision'
  totalRegions: number; // Count of physical visual regions occupied by this food
  regionIds: string[]; // List of region IDs
  regions: MealComponentRegion[]; // Detailed visual region records
  portion: MealComponentPortion; // Combined portion across all regions
  boundingBox?: BoundingBox; // Combined bounding box enclosing all constituent regions
  evidence?: FoodEvidence[]; // Corroborating web and visual evidence
  nutritionReference: MealComponentNutritionRef;
  nutrition?: ComponentNutrition; // Phase 6.3 component-level nutrition
  needsConfirmation: boolean;
  fallbackDescription?: string;
}

export interface MealNutritionSummary {
  calories: number;
  carbohydrates: number;
  protein: number;
  fat: number;
  fiber: number;
  confidence: number; // Overall meal nutrition confidence
  status: 'complete' | 'partial' | 'unmapped';
  nutritionCompleteness: 'complete' | 'partial' | 'unmapped';
  missingNutritionFoods?: string[];
  disclaimer: string;
  formattedCalories: string; // e.g. "≈ 520 kcal"
}

export interface MealMetadata {
  mealId: string;
  totalComponents: number;
  totalRegions: number;
  hasResearchComponents: boolean;
  hasUncertainComponents: boolean;
  composedAt: string; // ISO string
}

export interface StructuredMeal {
  id: string;
  components: MealComponent[];
  totalComponents: number;
  totalRegions: number;
  nutrition?: MealNutritionSummary; // Phase 6.3 meal-level nutrition summary
  analysis?: import('./personalizedAnalysis').MealPersonalizedAnalysis; // Phase 6.4 personalized analysis
  metadata: MealMetadata;
}
