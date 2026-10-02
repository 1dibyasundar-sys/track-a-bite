import { NutritionProfile, FoodServing, FoodNutrition } from './nutrition';

export type Region =
  | 'Pan-India'
  | 'North Indian'
  | 'South Indian'
  | 'East Indian'
  | 'West Indian'
  | 'Central Indian'
  | 'Tribal & Regional Heritage';

export type FoodCategory =
  | 'Grains & Millets'
  | 'Lentils & Pulses (Dal)'
  | 'Vegetables & Sabzi'
  | 'Breads & Rotis'
  | 'Dairy & Plant Proteins'
  | 'Fermented & Traditional'
  | 'Healthy Snacks & Sattu'
  | 'Snacks & Street Food'
  | 'Tribal & Regional Heritage';

export type AffordabilityLevel = 'Budget-Friendly' | 'Moderate' | 'Specialty / Festive';

export type DietaryTag =
  | 'Vegetarian'
  | 'Vegan'
  | 'Gluten-Free'
  | 'High-Protein'
  | 'High-Fiber'
  | 'Diabetic-Friendly'
  | 'Probiotic'
  | 'Low-GI';

export interface FoodItem {
  id: string;
  name: string;
  aliases: string[]; // Recognition variations & colloquial names
  category: FoodCategory;
  serving: FoodServing; // Clearly defined reference serving
  nutrition: FoodNutrition; // Direct typed nutrition for reference serving
  localNames: Record<string, string | undefined>;
  region: Region;
  description: string;
  culturalContext: string;
  commonIngredients: string[];
  standardServingSize: string; // e.g. "1 medium katori (150g)"
  servingUnit: string; // e.g. "katori", "piece", "cup", "plate"
  weightGramsPerUnit: number;
  nutritionPerServing: NutritionProfile;
  affordability: AffordabilityLevel;
  dietaryTags: DietaryTag[];
  seasonalAvailability?: string;
  pairingRecommendations: string[]; // food ids or dish names that balance this item
  preparationVariations?: string[];
  imageUrl?: string;
}

export interface FoodFilterOptions {
  query?: string;
  region?: Region | 'All';
  category?: FoodCategory | 'All';
  affordability?: AffordabilityLevel | 'All';
  dietaryTag?: DietaryTag | 'All';
  sortBy?: 'name' | 'protein' | 'fiber' | 'calories' | 'affordability';
}
