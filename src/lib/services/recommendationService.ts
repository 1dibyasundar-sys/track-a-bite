import {
  IRecommendationService,
  FoodItem,
  UserProfile,
  MealAnalysisResult,
  FoodRecommendation,
  RecommendationAffordability,
  BalancingRecommendation,
  NutritionProfile,
  MacroDistribution,
  DetectedFoodItem,
} from '../types';
import { INDIAN_FOOD_DATABASE } from '../../data/foods';

interface FoodPresetRule {
  foodId: string;
  name: string;
  reasons: Record<string, string>;
  defaultReason: string;
  targetGaps: string[];
  affordability: RecommendationAffordability;
  hostelFriendly: boolean;
  priorityWeights: {
    protein: number;
    fiber: number;
    calcium: number;
    potassium: number;
    vitaminC: number;
    iron: number;
    processedOffset: number;
  };
}

const RECOMMENDATION_CATALOG: FoodPresetRule[] = [
  {
    foodId: 'boiled-eggs',
    name: 'Boiled Egg',
    reasons: {
      protein: 'Adds ~6.3g complete protein per egg with minimal prep—ideal for hostel stamina.',
      processedOffset: 'Replaces refined snack calories with clean, satiating protein.',
    },
    defaultReason: 'Adds protein with minimal preparation.',
    targetGaps: ['protein', 'vitaminA'],
    affordability: 'budget',
    hostelFriendly: true,
    priorityWeights: { protein: 10, fiber: 0, calcium: 2, potassium: 1, vitaminC: 0, iron: 3, processedOffset: 8 },
  },
  {
    foodId: 'roasted-chana',
    name: 'Roasted Chana',
    reasons: {
      protein: 'Adds protein and fiber and is easy to keep in a hostel room.',
      fiber: 'Crunchy hostel-friendly snack packed with 3.5g fiber and iron per serving.',
    },
    defaultReason: 'Adds protein and fiber and is easy to keep in a hostel.',
    targetGaps: ['protein', 'fiber', 'iron'],
    affordability: 'budget',
    hostelFriendly: true,
    priorityWeights: { protein: 8, fiber: 9, calcium: 1, potassium: 3, vitaminC: 0, iron: 8, processedOffset: 7 },
  },
  {
    foodId: 'banana',
    name: 'Fresh Banana',
    reasons: {
      fiber: 'Adds fiber and potassium without any cooking or prep.',
      potassium: 'Natural source of cellular potassium to balance out high-sodium mess or canteen food.',
    },
    defaultReason: 'Adds fiber and potassium.',
    targetGaps: ['fiber', 'potassium', 'vitaminC'],
    affordability: 'budget',
    hostelFriendly: true,
    priorityWeights: { protein: 1, fiber: 8, calcium: 1, potassium: 10, vitaminC: 4, iron: 1, processedOffset: 6 },
  },
  {
    foodId: 'fresh-curd',
    name: 'Fresh Curd (Dahi)',
    reasons: {
      calcium: 'Adds bone-supporting calcium and gut probiotics readily available at campus booths.',
      protein: 'Adds protein and calcium to balance carb-heavy rice or roti meals.',
    },
    defaultReason: 'Adds protein and calcium.',
    targetGaps: ['protein', 'calcium', 'potassium'],
    affordability: 'budget',
    hostelFriendly: true,
    priorityWeights: { protein: 7, fiber: 0, calcium: 10, potassium: 5, vitaminC: 0, iron: 0, processedOffset: 5 },
  },
  {
    foodId: 'sprouts-chaat',
    name: 'Sprouts Chaat',
    reasons: {
      fiber: 'High-fiber, high-protein snack loaded with fresh vitamin C and plant iron.',
      protein: 'Plant-based protein and living enzymes to aid digestion.',
    },
    defaultReason: 'High-fiber and high-protein snack loaded with fresh nutrients.',
    targetGaps: ['protein', 'fiber', 'iron', 'vitaminC'],
    affordability: 'budget',
    hostelFriendly: true,
    priorityWeights: { protein: 9, fiber: 10, calcium: 3, potassium: 6, vitaminC: 9, iron: 7, processedOffset: 9 },
  },
  {
    foodId: 'roasted-peanuts',
    name: 'Roasted Peanuts',
    reasons: {
      protein: 'Dense source of protein and heart-healthy fats for lasting study sessions.',
      fiber: 'Keeps you full longer without refrigeration or cooking.',
    },
    defaultReason: 'Adds protein and healthy fats for sustained hostel energy.',
    targetGaps: ['protein', 'fiber'],
    affordability: 'budget',
    hostelFriendly: true,
    priorityWeights: { protein: 7, fiber: 5, calcium: 1, potassium: 3, vitaminC: 0, iron: 3, processedOffset: 4 },
  },
  {
    foodId: 'fresh-guava',
    name: 'Fresh Guava',
    reasons: {
      fiber: 'Exceptional dietary fiber (~5.4g per fruit) and over 200mg natural vitamin C.',
      vitaminC: 'Potent vitamin C source for immunity and iron absorption at minimal cost.',
    },
    defaultReason: 'Rich in dietary fiber and vitamin C.',
    targetGaps: ['fiber', 'vitaminC'],
    affordability: 'budget',
    hostelFriendly: true,
    priorityWeights: { protein: 1, fiber: 10, calcium: 1, potassium: 4, vitaminC: 10, iron: 1, processedOffset: 6 },
  },
  {
    foodId: 'fresh-milk',
    name: 'Fresh Milk',
    reasons: {
      calcium: 'Quick calcium and protein drink easily picked up at any campus stall.',
      protein: 'Easily digestible protein to supplement a light breakfast or late study night.',
    },
    defaultReason: 'Convenient source of calcium and protein.',
    targetGaps: ['protein', 'calcium', 'potassium'],
    affordability: 'budget',
    hostelFriendly: true,
    priorityWeights: { protein: 6, fiber: 0, calcium: 9, potassium: 4, vitaminC: 0, iron: 0, processedOffset: 3 },
  },
  {
    foodId: 'palak-paneer',
    name: 'Palak Paneer',
    reasons: {
      calcium: 'Combines spinach iron with dense dairy calcium and protein.',
      iron: 'Cooked greens provide bioavailable plant iron and vitamin A.',
    },
    defaultReason: 'Wholesome source of iron, calcium, and dairy protein.',
    targetGaps: ['protein', 'iron', 'calcium', 'vitaminA'],
    affordability: 'moderate',
    hostelFriendly: false,
    priorityWeights: { protein: 8, fiber: 4, calcium: 8, potassium: 5, vitaminC: 3, iron: 8, processedOffset: 5 },
  },
  {
    foodId: 'vegetable-curry',
    name: 'Mixed Vegetable Curry',
    reasons: {
      fiber: 'Adds colorful vegetables, dietary fiber, and antioxidants to plain carbs.',
      vitaminA: 'Supplies beta-carotene and essential minerals from mixed vegetables.',
    },
    defaultReason: 'Adds vegetable variety, dietary fiber, and micronutrients.',
    targetGaps: ['fiber', 'vitaminA', 'potassium'],
    affordability: 'moderate',
    hostelFriendly: false,
    priorityWeights: { protein: 3, fiber: 7, calcium: 3, potassium: 6, vitaminC: 6, iron: 4, processedOffset: 5 },
  },
  {
    foodId: 'dal-tadka',
    name: 'Dal Tadka',
    reasons: {
      protein: 'Foundational lentils that balance out plain white rice or roti.',
      iron: 'Source of plant iron and soluble fiber for healthy cholesterol and digestion.',
    },
    defaultReason: 'Adds pulse protein and soluble dietary fiber.',
    targetGaps: ['protein', 'fiber', 'iron'],
    affordability: 'budget',
    hostelFriendly: false,
    priorityWeights: { protein: 7, fiber: 7, calcium: 2, potassium: 4, vitaminC: 1, iron: 6, processedOffset: 4 },
  },
];

export class RecommendationService implements IRecommendationService {
  /**
   * Phase 5 Primary Contract:
   * Recommends practical, affordable food additions tailored to the meal's nutrient gaps and user profile.
   */
  getRecommendations(
    analysis: MealAnalysisResult,
    userProfile?: UserProfile,
    foods: FoodItem[] = INDIAN_FOOD_DATABASE
  ): FoodRecommendation[] {
    const isHostelite =
      userProfile?.isHostelite ?? (userProfile as unknown as { hostelite?: boolean })?.hostelite ?? true;

    // 1. Identify foods already in the meal
    const existingFoodIds = new Set<string>();
    // If the caller attached recommendations or items, inspect them
    if (analysis && (analysis as unknown as { items?: Array<{ foodId: string }> }).items) {
      for (const item of (analysis as unknown as { items: Array<{ foodId: string }> }).items) {
        if (item.foodId) existingFoodIds.add(item.foodId.toLowerCase().trim());
      }
    }

    // 2. Map active gaps and their severity weights
    const gapWeights: Record<string, number> = {};
    for (const gap of analysis.gaps || []) {
      const mult = gap.severity === 'high' ? 2.0 : gap.severity === 'moderate' ? 1.3 : 0.8;
      gapWeights[gap.nutrient] = mult;
    }

    const isProcessed = analysis.composition?.dominantNutrients?.includes('highly-processed') ?? false;

    // 3. Score candidate recommendations
    interface ScoredRecommendation {
      rule: FoodPresetRule;
      score: number;
      chosenReason: string;
      priority: 'high' | 'medium' | 'low';
    }

    const scoredCandidates: ScoredRecommendation[] = [];

    for (const rule of RECOMMENDATION_CATALOG) {
      // Don't recommend foods already eaten in this meal
      if (existingFoodIds.has(rule.foodId.toLowerCase())) continue;

      let score = 0;
      let primaryReason = rule.defaultReason;
      let highestGapWeight = 0;

      // Check each target gap
      for (const gapKey of rule.targetGaps) {
        if (gapWeights[gapKey]) {
          const weight = gapWeights[gapKey];
          const nutrientFactor = rule.priorityWeights[gapKey as keyof typeof rule.priorityWeights] || 5;
          const contribution = weight * nutrientFactor;
          score += contribution;

          if (contribution > highestGapWeight) {
            highestGapWeight = contribution;
            if (rule.reasons[gapKey]) {
              primaryReason = rule.reasons[gapKey];
            }
          }
        }
      }

      if (isProcessed && rule.priorityWeights.processedOffset > 0) {
        score += rule.priorityWeights.processedOffset * 1.5;
        if (rule.reasons.processedOffset && highestGapWeight === 0) {
          primaryReason = rule.reasons.processedOffset;
        }
      }

      // Hostel mode prioritization
      if (isHostelite) {
        if (rule.hostelFriendly) {
          score += 15; // heavy boost for room-friendly/no-cook foods
        } else {
          score -= 10; // lower priority for cooking-heavy dishes in hostel mode
        }

        if (rule.affordability === 'budget') {
          score += 10;
        } else if (rule.affordability === 'moderate') {
          score += 2;
        } else {
          score -= 10;
        }
      } else {
        // Non-hostelite: diversity and balanced nutrition are boosted
        if (rule.affordability === 'budget') score += 4;
        if (rule.affordability === 'moderate') score += 4;
      }

      // Assign priority
      let priority: 'high' | 'medium' | 'low' = 'low';
      if (score >= 22) {
        priority = 'high';
      } else if (score >= 12) {
        priority = 'medium';
      }

      // Only keep relevant candidates
      if (score > 3) {
        scoredCandidates.push({
          rule,
          score,
          chosenReason: primaryReason,
          priority,
        });
      }
    }

    // 4. Sort descending by computed relevance score
    scoredCandidates.sort((a, b) => {
      // In hostel mode, guarantee hostelFriendly always stays at top if equal
      if (isHostelite && a.rule.hostelFriendly !== b.rule.hostelFriendly) {
        return a.rule.hostelFriendly ? -1 : 1;
      }
      return b.score - a.score;
    });

    // 5. Build final list of top 3-4 recommendations
    const results: FoodRecommendation[] = scoredCandidates.slice(0, 4).map(c => {
      // Verify food existence in database if provided
      const dbFood = foods.find(f => f.id === c.rule.foodId);
      const name = dbFood ? dbFood.name.split('(')[0].trim() : c.rule.name;

      return {
        foodId: c.rule.foodId,
        foodName: name,
        reason: c.chosenReason,
        priority: c.priority,
        affordability: c.rule.affordability,
        hostelFriendly: c.rule.hostelFriendly,
      };
    });

    return results;
  }

  /**
   * Backwards-compatible legacy method for existing components and tests
   */
  async generateRecommendations(analysis: {
    nutrition: NutritionProfile;
    macroDistribution: MacroDistribution;
    items: DetectedFoodItem[];
    userProfile?: UserProfile;
  }): Promise<BalancingRecommendation[]> {
    const isHostelite = analysis.userProfile?.isHostelite ?? true;

    const legacyResults: BalancingRecommendation[] = [
      {
        id: 'rec-boiled-egg',
        foodId: 'boiled-eggs',
        title: 'Add 1-2 Boiled Eggs',
        description: 'Instant protein boost without requiring kitchen access in your hostel.',
        impactReason: 'Boosts total protein by ~6-12g to slow carbohydrate digestion.',
        affordability: 'Budget-Friendly',
        actionType: 'add',
        localIngredientsSuggested: ['Boiled egg', 'Pinch of black pepper'],
        approximatePriceRange: '₹7–14',
        isHostelFriendly: true,
        prepEase: 'Boiled / Canteen',
        campusLocation: 'Campus Canteen / Tea Stall',
      },
      {
        id: 'rec-banana',
        foodId: 'banana',
        title: 'Pair with 1 Fresh Banana',
        description: 'Adds clean fiber, potassium, and steady energy for college classes.',
        impactReason: 'Replenishes cellular fluid balance and provides natural digestive fiber.',
        affordability: 'Budget-Friendly',
        actionType: 'add',
        localIngredientsSuggested: ['Fresh banana'],
        approximatePriceRange: '₹5–8',
        isHostelFriendly: true,
        prepEase: 'Zero Cooking',
        campusLocation: 'Campus Fruit Cart',
      },
    ];

    if (isHostelite) {
      legacyResults.push({
        id: 'rec-chana',
        foodId: 'roasted-chana',
        title: 'Keep Roasted Chana Handy',
        description: 'Zero-cooking high-protein desk snack for long study nights.',
        impactReason: 'Adds ~5g protein and 3.5g dietary fiber.',
        affordability: 'Budget-Friendly',
        actionType: 'add',
        localIngredientsSuggested: ['Bhuna chana'],
        approximatePriceRange: '₹15–20',
        isHostelFriendly: true,
        prepEase: 'Zero Cooking',
      });
    }

    return Promise.resolve(legacyResults);
  }
}

export const recommendationService = new RecommendationService();
