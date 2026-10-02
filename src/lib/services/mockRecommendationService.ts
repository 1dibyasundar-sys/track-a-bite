import {
  IRecommendationService,
  BalancingRecommendation,
  NutritionProfile,
  MacroDistribution,
  DetectedFoodItem,
  UserProfile,
  MealAnalysisResult,
  FoodRecommendation,
  FoodItem,
} from '../types';
import { recommendationService } from './recommendationService';

export class MockRecommendationService implements IRecommendationService {
  getRecommendations(
    analysis: MealAnalysisResult,
    userProfile?: UserProfile,
    foods?: FoodItem[]
  ): FoodRecommendation[] {
    return recommendationService.getRecommendations(analysis, userProfile, foods);
  }

  async generateRecommendations(analysis: {
    nutrition: NutritionProfile;
    macroDistribution: MacroDistribution;
    items: DetectedFoodItem[];
    userProfile?: UserProfile;
  }): Promise<BalancingRecommendation[]> {
    const { nutrition, macroDistribution, items, userProfile } = analysis;
    const isHostelMode = userProfile ? userProfile.isHostelite : true;
    const recommendations: BalancingRecommendation[] = [];

    const hasCurd = items.some(
      i => i.foodId === 'fresh-curd' || i.name.toLowerCase().includes('curd') || i.name.toLowerCase().includes('dahi')
    );
    const hasSprouts = items.some(
      i => i.foodId === 'sprouted-moong-salad' || i.name.toLowerCase().includes('sprout') || i.foodId === 'sprouts-chaat'
    );
    const hasEggs = items.some(
      i => i.name.toLowerCase().includes('egg') || i.foodId === 'boiled-eggs' || i.foodId === 'bread-omelette'
    );
    const hasChanaOrSattu = items.some(
      i => i.name.toLowerCase().includes('chana') || i.name.toLowerCase().includes('sattu')
    );

    // 1. Protein Deficit / High Carb Condition
    if (nutrition.protein < 14 || macroDistribution.carbsPercent > 58) {
      if (isHostelMode && !hasEggs) {
        recommendations.push({
          id: 'rec-boiled-eggs',
          foodId: 'boiled-eggs',
          title: 'Grab 2 Boiled Eggs from nearest tea stall',
          description: 'Adds ~12.6g complete protein and choline for study concentration with zero room cooking.',
          impactReason: 'Lowers post-meal glycemic surge and protects lean muscle during long study sessions.',
          affordability: 'Budget-Friendly',
          actionType: 'add',
          approximatePriceRange: '₹15–25',
          isHostelFriendly: true,
          prepEase: 'Ready-to-eat',
          campusLocation: 'Campus Tea Stall / Night Canteen',
          localIngredientsSuggested: ['Farm eggs', 'Black pepper', 'Kala namak'],
        });
      }

      if (!hasSprouts) {
        recommendations.push({
          id: 'rec-sprouts-chaat',
          foodId: 'sprouts-chaat',
          title: 'Add 1 cup fresh Sprouts Chaat',
          description: 'Sprouted moong & chana give ~13.5g plant protein, active enzymes, and 8g fiber for under ₹30.',
          impactReason: 'Raw sprouts slow down carbohydrate absorption, preventing afternoon classroom sleepiness.',
          affordability: 'Budget-Friendly',
          actionType: 'add',
          approximatePriceRange: '₹20–30',
          isHostelFriendly: true,
          prepEase: 'Ready-to-eat',
          campusLocation: 'Campus Gate Street Cart / Mess Salad counter',
          localIngredientsSuggested: ['Sprouted Moong', 'Kala Chana', 'Fresh Lemon'],
        });
      }

      if (!hasCurd) {
        recommendations.push({
          id: 'rec-curd-dahi',
          foodId: 'fresh-curd',
          title: 'Pair with 1 small packet / katori of Dahi',
          description: 'Supplies 5g protein, 180mg bone-building calcium, and soothing lactobacillus probiotics.',
          impactReason: 'Cools down spicy canteen food and buffers acidic reflux from irregular hostel meal timings.',
          affordability: 'Budget-Friendly',
          actionType: 'add',
          approximatePriceRange: '₹15–25',
          isHostelFriendly: true,
          prepEase: 'Zero Cooking',
          campusLocation: 'Campus Mother Dairy / Amul Parlour / Mess',
          localIngredientsSuggested: ['Fresh Dahi', 'Cold Chaas'],
        });
      }
    }

    // 2. Fiber & Micronutrient Gaps (< 5g fiber)
    if (nutrition.fiber < 5 && !hasSprouts) {
      recommendations.push({
        id: 'rec-banana-potassium',
        foodId: 'banana',
        title: 'Eat 1 fresh Desi Banana',
        description: 'Delivers 3.1g natural prebiotic fiber and 420mg potassium to balance canteen sodium.',
        impactReason: 'Combats dehydration, muscle fatigue, and midnight junk-food cravings.',
        affordability: 'Budget-Friendly',
        actionType: 'add',
        approximatePriceRange: '₹5–10',
        isHostelFriendly: true,
        prepEase: 'Zero Cooking',
        campusLocation: 'Fruit vendor outside college',
        localIngredientsSuggested: ['Robusta / Yelakki Banana'],
      });
    }

    // 3. Late Night / Midnight Snack balancer (e.g. chips, kachori, samosa, maggi)
    const isSnackFood = items.some(
      i =>
        i.name.toLowerCase().includes('chips') ||
        i.name.toLowerCase().includes('samosa') ||
        i.name.toLowerCase().includes('kachori') ||
        i.name.toLowerCase().includes('maggi')
    );

    if (isSnackFood && !hasChanaOrSattu) {
      recommendations.push({
        id: 'rec-roasted-chana-peanuts',
        foodId: 'roasted-peanuts',
        title: 'Keep a ₹10 packet of Roasted Chana or Peanuts',
        description: 'Pocket-friendly dry roasted legumes supply 10g protein and slow-digesting fats.',
        impactReason: 'Balances the high glycemic index of refined flour snacks without requiring any kitchen equipment.',
        affordability: 'Budget-Friendly',
        actionType: 'add',
        approximatePriceRange: '₹10–20',
        isHostelFriendly: true,
        prepEase: 'Zero Cooking',
        campusLocation: 'Local Kirana / Stationary Shop',
        localIngredientsSuggested: ['Roasted Chana with skin', 'Roasted Peanuts'],
      });
    }

    // Default Fallback: If already well-rounded
    if (recommendations.length === 0) {
      recommendations.push({
        id: 'rec-maintain-hostel-balance',
        title: 'Great balance for campus life!',
        description: 'This meal provides a solid synergy of protein, carbs, and fiber for active college days.',
        impactReason: 'Supplies sustained study stamina and steady energy.',
        affordability: 'Budget-Friendly',
        actionType: 'add',
        approximatePriceRange: '₹0–10',
        isHostelFriendly: true,
        prepEase: 'Zero Cooking',
        campusLocation: 'Anywhere',
        localIngredientsSuggested: ['Fresh lemon squeeze', 'Black pepper'],
      });
    }

    return Promise.resolve(recommendations);
  }
}
