import {
  BalanceAssessment,
  MacroDistribution,
  NutritionProfile,
  NutrientRichnessScore,
  NutrientGapAssessment,
  MicronutrientMap,
  NutritionResult,
} from './nutrition';
import { AffordabilityLevel } from './food';
import { BoundingBox } from './recognition';

export type { BoundingBox };

export interface DetectedFoodItem {
  detectionId: string;
  foodId: string;
  name: string;
  localNameHindi?: string;
  confidence: number; // 0.0 - 1.0
  portionMultiplier: number; // e.g. 1.0, 1.5, 2.0
  portionUnit: string; // e.g. "katori", "piece", "cup", "bowl", "g", "ml"
  estimatedGrams: number;
  nutrition: NutritionProfile;
  boundingBox?: BoundingBox;
  isUserModified?: boolean;
  needsConfirmation?: boolean;
  nutritionAvailable?: boolean;
  micronutrients?: MicronutrientMap;
  nutritionResult?: NutritionResult;
  regions?: import('./recognition').DetectedFoodRegion[];
  identificationMode?: import('./recognition').IdentificationMode;
  evidence?: import('./recognition').FoodEvidence[];
  visualObservation?: import('./recognition').VisualObservation;
  isEstimatedNutrition?: boolean;
  fallbackDescription?: string;
}

export type ScanStage =
  | 'idle'
  | 'capturing'
  | 'preview'
  | 'analyzing'
  | 'detected'
  | 'reviewing'
  | 'completed';

export interface BalancingRecommendation {
  id: string;
  foodId?: string;
  title: string;
  description: string;
  impactReason: string;
  affordability: AffordabilityLevel;
  actionType: 'add' | 'substitute' | 'portion-tweak';
  localIngredientsSuggested: string[];
  approximatePriceRange?: string; // e.g. "₹15–25"
  isHostelFriendly?: boolean; // easy to find, zero/minimal cook
  prepEase?: 'Zero Cooking' | 'Ready-to-eat' | 'Boiled / Canteen';
  campusLocation?: string; // e.g. "College Canteen / Tea Stall / Fruit Cart"
}

export interface CampusChoiceItem {
  id: string;
  name: string;
  emoji: string;
  category: 'snack' | 'drink' | 'quick-meal' | 'upgrade';
  approximatePrice: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  tradeoffNote: string;
  betterCombinationTip: string;
}

export interface MealAnalysis {
  id: string;
  mealTitle: string;
  analyzedAt: string; // ISO string
  imagePreviewUrl?: string;
  items: DetectedFoodItem[];
  totalNutrition: NutritionProfile;
  macroDistribution: MacroDistribution;
  nutrientRichness: NutrientRichnessScore;
  nutrientGaps: NutrientGapAssessment;
  balanceAssessment: BalanceAssessment;
  positiveHighlights: string[];
  balancingRecommendations: BalancingRecommendation[];
  hostelFriendlyUpgrades: BalancingRecommendation[];
  hostelModeActive: boolean;
  practicalAdjustments: string[];
  disclaimer: string;
  analysis?: import('./personalizedAnalysis').MealPersonalizedAnalysis;
}
