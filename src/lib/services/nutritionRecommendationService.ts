/**
 * Nutrition Recommendation Engine (Phase 6.4)
 *
 * Provides gap-driven, affordable, hostel-friendly, and culturally relevant
 * food recommendations without food-shaming.
 */

import {
  NutrientRecommendation,
  AffordabilityCategory,
} from '../types/personalizedAnalysis';
import { UserProfile } from '../types/profile';

interface RecommendationPreset {
  id: string;
  food: string;
  foodId: string;
  emoji: string;
  bestFor: string;
  reasons: Record<string, string>;
  defaultReason: string;
  affordability: AffordabilityCategory;
  affordabilityLabel: string;
  hostelFriendly: boolean;
  availabilityNote: string;
  nutrientContribution: {
    protein?: 'high' | 'moderate' | 'low';
    fiber?: 'high' | 'moderate' | 'low';
    calcium?: 'high' | 'moderate';
    potassium?: 'high' | 'moderate';
  };
  targetGaps: string[];
  priorityRank: number; // base priority (lower is higher priority)
}

const RECOMMENDATION_CATALOGUE: RecommendationPreset[] = [
  {
    id: 'rec-sprouts',
    food: 'Sprouts',
    foodId: 'sprouts-chaat',
    emoji: '🌱',
    bestFor: 'Protein + Fiber',
    reasons: {
      protein: 'Adds plant protein and rich prebiotic fiber with zero cooking.',
      fiber: 'Rich in dietary fiber and live enzymes to balance digestion.',
      carb_heavy: 'Balances a carb-heavy meal with satiating fiber and clean protein.',
    },
    defaultReason: 'Adds plant protein and fiber with minimal prep.',
    affordability: 'very_low_cost',
    affordabilityLabel: 'Very affordable',
    hostelFriendly: true,
    availabilityNote: 'Very affordable • Hostel friendly',
    nutrientContribution: { protein: 'high', fiber: 'high' },
    targetGaps: ['protein', 'fiber', 'carb_heavy'],
    priorityRank: 1,
  },
  {
    id: 'rec-boiled-egg',
    food: 'Boiled Egg',
    foodId: 'boiled-eggs',
    emoji: '🥚',
    bestFor: 'Protein',
    reasons: {
      protein: 'Supplies complete biological value protein (~6g per egg) for stamina.',
      carb_heavy: 'Replaces or balances high glycemic carbs with pure protein and choline.',
    },
    defaultReason: 'Adds protein with minimal preparation.',
    affordability: 'low_cost',
    affordabilityLabel: 'Affordable',
    hostelFriendly: true,
    availabilityNote: 'Affordable • Easy to find',
    nutrientContribution: { protein: 'high' },
    targetGaps: ['protein', 'carb_heavy'],
    priorityRank: 2,
  },
  {
    id: 'rec-curd',
    food: 'Curd / Dahi',
    foodId: 'fresh-curd',
    emoji: '🥛',
    bestFor: 'Protein + Calcium',
    reasons: {
      protein: 'Adds light protein and probiotics for gut health.',
      calcium: 'Natural bioavailable calcium supporting bone density.',
      fat_heavy: 'Cooling, digestive probiotic that cuts through heavy fats.',
    },
    defaultReason: 'Adds protein and digestive probiotics.',
    affordability: 'low_cost',
    affordabilityLabel: 'Affordable',
    hostelFriendly: true,
    availabilityNote: 'Affordable • Hostel friendly',
    nutrientContribution: { protein: 'moderate', calcium: 'high' },
    targetGaps: ['protein', 'calcium', 'fat_heavy'],
    priorityRank: 3,
  },
  {
    id: 'rec-roasted-chana',
    food: 'Roasted Chana',
    foodId: 'roasted-chana',
    emoji: '🥜',
    bestFor: 'Protein + Crunch',
    reasons: {
      protein: 'Hostel room staple with ~7g protein per handful, long shelf-life.',
      fiber: 'High soluble and insoluble fiber for prolonged fullness.',
    },
    defaultReason: 'Crunchy hostel staple providing protein and fiber.',
    affordability: 'very_low_cost',
    affordabilityLabel: 'Very affordable',
    hostelFriendly: true,
    availabilityNote: 'Very affordable • Long shelf life',
    nutrientContribution: { protein: 'high', fiber: 'high' },
    targetGaps: ['protein', 'fiber'],
    priorityRank: 4,
  },
  {
    id: 'rec-banana',
    food: 'Fresh Banana',
    foodId: 'banana',
    emoji: '🍌',
    bestFor: 'Fiber + Potassium',
    reasons: {
      fiber: 'Natural quick fiber with zero peeling tools or refrigeration needed.',
      potassium: 'Cellular potassium to balance canteen sodium.',
    },
    defaultReason: 'Natural whole-fruit fiber and electrolytes.',
    affordability: 'very_low_cost',
    affordabilityLabel: 'Very affordable',
    hostelFriendly: true,
    availabilityNote: 'Readily available • No prep needed',
    nutrientContribution: { fiber: 'high', potassium: 'high' },
    targetGaps: ['fiber', 'potassium'],
    priorityRank: 5,
  },
  {
    id: 'rec-buttermilk',
    food: 'Spiced Buttermilk / Chaas',
    foodId: 'buttermilk',
    emoji: '🥤',
    bestFor: 'Hydration + Probiotics',
    reasons: {
      fat_heavy: 'Light, digestive probiotic drink that counterbalances oily or heavy meals.',
      calcium: 'Hydrating fluid electrolytes with calcium.',
    },
    defaultReason: 'Cooling traditional probiotic drink.',
    affordability: 'very_low_cost',
    affordabilityLabel: 'Very affordable',
    hostelFriendly: true,
    availabilityNote: 'Canteen staple • Digestion friendly',
    nutrientContribution: { calcium: 'moderate' },
    targetGaps: ['fat_heavy', 'calcium'],
    priorityRank: 6,
  },
];

export class NutritionRecommendationService {
  /**
   * Generates tailored, gap-focused recommendations based on nutrient gaps and hostel status.
   * Limits to 1 primary recommendation + 2–4 alternatives.
   */
  getRecommendations(params: {
    gaps: string[];
    imbalances: string[];
    existingFoodNames: string[];
    profile?: UserProfile;
  }): {
    all: NutrientRecommendation[];
    primary?: NutrientRecommendation;
    alternatives: NutrientRecommendation[];
  } {
    const { gaps, imbalances, existingFoodNames, profile } = params;
    const isHostelite = Boolean(profile?.isHostelite ?? true);
    const existingLower = existingFoodNames.map(f => f.toLowerCase());

    const activeGapKeys = new Set<string>();
    if (gaps.includes('protein')) activeGapKeys.add('protein');
    if (gaps.includes('fiber')) activeGapKeys.add('fiber');
    if (imbalances.includes('relatively_high_carbs')) activeGapKeys.add('carb_heavy');
    if (imbalances.includes('relatively_high_fat')) activeGapKeys.add('fat_heavy');

    // Default to protein and fiber if no specific gap
    if (activeGapKeys.size === 0) {
      activeGapKeys.add('protein');
      activeGapKeys.add('fiber');
    }

    // Filter catalogue to relevant items not already on the plate
    const candidates = RECOMMENDATION_CATALOGUE.filter(preset => {
      // Exclude if already present
      const alreadyPresent = existingLower.some(
        name => name.includes(preset.food.toLowerCase()) || name.includes(preset.foodId.toLowerCase())
      );
      if (alreadyPresent) return false;

      // Check if it matches an active gap
      return preset.targetGaps.some(g => activeGapKeys.has(g));
    });

    // Score and rank candidates
    const scored = candidates.map(preset => {
      let score = 50;

      // Matches primary gap
      if (activeGapKeys.has('protein') && preset.targetGaps.includes('protein')) score += 30;
      if (activeGapKeys.has('fiber') && preset.targetGaps.includes('fiber')) score += 25;
      if (activeGapKeys.has('carb_heavy') && preset.targetGaps.includes('carb_heavy')) score += 20;
      if (activeGapKeys.has('fat_heavy') && preset.targetGaps.includes('fat_heavy')) score += 20;

      // Hostel optimization
      if (isHostelite) {
        if (preset.hostelFriendly) score += 35;
        if (preset.affordability === 'very_low_cost') score += 20;
        else if (preset.affordability === 'low_cost') score += 10;
      } else {
        // General non-hostel scoring
        if (preset.affordability === 'very_low_cost') score += 10;
        else if (preset.affordability === 'low_cost') score += 5;
      }

      // Tie-breaker by priority rank
      score -= preset.priorityRank;

      // Pick the best reason text
      let reason = preset.defaultReason;
      if (activeGapKeys.has('protein') && preset.reasons.protein) reason = preset.reasons.protein;
      else if (activeGapKeys.has('fiber') && preset.reasons.fiber) reason = preset.reasons.fiber;
      else if (activeGapKeys.has('carb_heavy') && preset.reasons.carb_heavy) reason = preset.reasons.carb_heavy;
      else if (activeGapKeys.has('fat_heavy') && preset.reasons.fat_heavy) reason = preset.reasons.fat_heavy;

      const rec: NutrientRecommendation = {
        id: preset.id,
        food: preset.food,
        foodId: preset.foodId,
        emoji: preset.emoji,
        bestFor: preset.bestFor,
        reason,
        priority: score >= 90 ? 'high' : 'medium',
        affordability: preset.affordability,
        affordabilityLabel: preset.affordabilityLabel,
        hostelFriendly: preset.hostelFriendly,
        availabilityNote: preset.availabilityNote,
        nutrientContribution: preset.nutrientContribution,
        tags: [
          preset.affordabilityLabel,
          preset.hostelFriendly ? 'Hostel friendly' : 'Campus available',
        ],
      };

      return { rec, score };
    });

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);

    const all = scored.map(s => s.rec).slice(0, 5);
    const primary = all.length > 0 ? all[0] : undefined;
    const alternatives = all.length > 1 ? all.slice(1, 4) : [];

    return {
      all,
      primary,
      alternatives,
    };
  }
}

export const nutritionRecommendationService = new NutritionRecommendationService();
