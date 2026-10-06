/**
 * Track-a-Bite — TAB Context Builder
 *
 * Constructs a minimal, structured, privacy-conscious context payload
 * for the AI food companion. Adheres to zero-hallucination rules:
 * - Missing nutrition fields remain null and are explicitly flagged as unavailable.
 * - Product provenance, nutrition provenance, and package OCR are strictly distinguished.
 */

import { UserProfile } from '../types/profile';
import { MealAnalysis } from '../types/meal';
import { PackagedProduct } from '../types/barcode';
import { TABContext, TABMealContext, TABProductContext, TABUserContext } from './types';

export function buildTABUserContext(profile?: Partial<UserProfile> | null): TABUserContext | null {
  if (!profile) return null;

  return {
    age: profile.age,
    gender: profile.gender,
    dietaryRestrictions: profile.dietaryRestrictions,
    healthConditions: profile.healthConditions && profile.healthConditions.length > 0
      ? profile.healthConditions.filter(c => c.toLowerCase() !== 'none')
      : undefined,
    healthGoal: profile.healthGoal,
    isHostelite: Boolean(profile.isHostelite),
    budgetPreference: profile.budgetPreference,
    targetCalories: profile.targetCalories,
    targetProteinG: profile.targetProteinG,
    targetCarbsG: profile.targetCarbsG,
    targetFatG: profile.targetFatG,
  };
}

export function buildTABProductContext(product?: PackagedProduct | null): TABProductContext | null {
  if (!product) return null;

  const nutrition = product.nutrition;
  const packageDetails = product.packageDetails;
  const isOcrVerified = Boolean(
    packageDetails?.isVerified ||
    packageDetails?.source === 'package_ocr' ||
    packageDetails?.manufacturingDate ||
    packageDetails?.expiryDate
  );

  return {
    barcode: product.barcode,
    productName: product.productName,
    brand: product.brand || null,
    servingSize: product.servingSize || null,
    ingredientsText: product.ingredientsText || null,
    sourceProvider: product.sourceProvider || (product.source === 'openfoodfacts' ? 'Open Food Facts' : 'Product Database'),
    verificationStatus: product.verificationStatus || 'verified',
    isNutritionAvailable: Boolean(nutrition?.isNutritionAvailable),
    nutritionSource: nutrition?.nutritionSource || (nutrition?.isNutritionAvailable ? 'Verified source' : null),
    calories: nutrition?.calories ?? null,
    proteinGrams: nutrition?.proteinGrams ?? nutrition?.protein ?? null,
    carbsGrams: nutrition?.carbsGrams ?? nutrition?.carbohydrates ?? null,
    fatGrams: nutrition?.fatGrams ?? nutrition?.fat ?? null,
    sugarGrams: nutrition?.sugarGrams ?? nutrition?.sugar ?? null,
    fiberGrams: nutrition?.fiberGrams ?? nutrition?.fiber ?? null,
    sodiumMilligrams: nutrition?.sodiumMilligrams ?? nutrition?.sodium ?? null,
    isPackageOcrVerified: isOcrVerified,
    mfgDate: packageDetails?.manufacturingDate || null,
    expDate: packageDetails?.expiryDate || null,
    batchLot: packageDetails?.batchLot || packageDetails?.batchNumber || null,
  };
}

export function buildTABMealContext(meal?: MealAnalysis | null): TABMealContext | null {
  if (!meal) return null;

  const foodNames = meal.items?.map(item => item.name) || [];
  const keyGaps = meal.nutrientGaps?.missingNutrients?.map(g => g.name) || [];
  const recommendations = meal.balancingRecommendations?.map(r => r.title) || [];

  return {
    mealTitle: meal.mealTitle || 'Scanned Meal',
    analyzedAt: meal.analyzedAt,
    itemsCount: foodNames.length,
    foodNames,
    calories: Math.round(meal.totalNutrition?.calories || 0),
    proteinG: Math.round((meal.totalNutrition?.protein || 0) * 10) / 10,
    carbsG: Math.round((meal.totalNutrition?.carbohydrates || 0) * 10) / 10,
    fatG: Math.round((meal.totalNutrition?.fat || 0) * 10) / 10,
    overallScore: meal.nutrientRichness?.stars,
    keyGaps: keyGaps.slice(0, 3),
    recommendations: recommendations.slice(0, 3),
  };
}

export function buildTABContext(params: {
  userProfile?: Partial<UserProfile> | null;
  currentProduct?: PackagedProduct | null;
  currentMeal?: MealAnalysis | null;
  recentScans?: string[];
  recentMealTitles?: string[];
}): TABContext {
  return {
    userProfile: buildTABUserContext(params.userProfile),
    currentProduct: buildTABProductContext(params.currentProduct),
    currentMeal: buildTABMealContext(params.currentMeal),
    recentScans: params.recentScans?.slice(0, 5),
    recentMealTitles: params.recentMealTitles?.slice(0, 5),
  };
}

export function formatTABContextForPrompt(ctx?: TABContext | null): string {
  if (!ctx) return '';

  const lines: string[] = [];

  if (ctx.userProfile) {
    const up = ctx.userProfile;
    const profileParts: string[] = [];
    if (up.dietaryRestrictions) profileParts.push(`Diet: ${up.dietaryRestrictions}`);
    if (up.isHostelite) profileParts.push('Living: Hostel/College');
    if (up.budgetPreference) profileParts.push(`Budget: ${up.budgetPreference}`);
    if (up.healthGoal) profileParts.push(`Goal: ${up.healthGoal.replace(/_/g, ' ')}`);
    if (up.healthConditions && up.healthConditions.length > 0) {
      profileParts.push(`Health Conditions: ${up.healthConditions.join(', ')}`);
    }
    if (up.targetCalories) profileParts.push(`Target: ${up.targetCalories} kcal`);
    if (profileParts.length > 0) {
      lines.push(`USER PROFILE: ${profileParts.join(' | ')}`);
    }
  }

  if (ctx.currentProduct) {
    const cp = ctx.currentProduct;
    lines.push(`ACTIVE SCANNED PACKAGED PRODUCT:
- Product: "${cp.productName}" (Brand: ${cp.brand || 'Unspecified'}, Barcode: ${cp.barcode})
- Source: ${cp.sourceProvider}
- Nutrition Available: ${cp.isNutritionAvailable ? 'YES' : 'NO'} (Source: ${cp.nutritionSource || 'None'})`);

    if (cp.isNutritionAvailable) {
      lines.push(`- Verified Values: Calories: ${cp.calories ?? '—'}, Protein: ${cp.proteinGrams !== null ? `${cp.proteinGrams}g` : '—'}, Carbs: ${cp.carbsGrams !== null ? `${cp.carbsGrams}g` : '—'}, Fat: ${cp.fatGrams !== null ? `${cp.fatGrams}g` : '—'}, Sugar: ${cp.sugarGrams !== null ? `${cp.sugarGrams}g` : '—'}, Fiber: ${cp.fiberGrams !== null ? `${cp.fiberGrams}g` : '—'}, Sodium: ${cp.sodiumMilligrams !== null ? `${cp.sodiumMilligrams}mg` : '—'}`);
    } else {
      lines.push('- NOTE: No verified nutritional values exist for this barcode. DO NOT invent or assume values.');
    }

    if (cp.isPackageOcrVerified) {
      lines.push(`- Package OCR: MFG: ${cp.mfgDate || 'Unverified'}, EXP: ${cp.expDate || 'Unverified'}, Batch: ${cp.batchLot || 'Unverified'} (Verified from physical package print)`);
    } else {
      lines.push('- Package OCR: Not yet scanned on physical package.');
    }
  }

  if (ctx.currentMeal) {
    const cm = ctx.currentMeal;
    lines.push(`ACTIVE SCANNED MEAL:
- Title: "${cm.mealTitle}" (${cm.itemsCount} items: ${cm.foodNames.join(', ')})
- Nutrition: ${cm.calories} kcal | Protein: ${cm.proteinG}g | Carbs: ${cm.carbsG}g | Fat: ${cm.fatG}g
${cm.overallScore ? `- Health Score: ${cm.overallScore}/5` : ''}
${cm.keyGaps && cm.keyGaps.length > 0 ? `- Gaps: ${cm.keyGaps.join(', ')}` : ''}`);
  }

  if (ctx.recentMealTitles && ctx.recentMealTitles.length > 0) {
    lines.push(`RECENT MEALS: ${ctx.recentMealTitles.join(', ')}`);
  }

  return lines.join('\n\n');
}
