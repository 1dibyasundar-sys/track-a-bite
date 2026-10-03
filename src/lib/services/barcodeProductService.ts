/**
 * Track-a-Bite — Barcode Product Service (Phase 2)
 *
 * Abstract client-side service for barcode normalization and product lookup.
 * Decouples the UI from the underlying provider (Open Food Facts / USDA / Internal).
 *
 * Handles:
 * - Product found
 * - Product not found (404)
 * - Network errors
 * - Malformed responses
 * - Rate limiting
 * - Incomplete nutrition data
 */

import { BarcodeLookupResult, PackagedProduct } from '../types/barcode';
import { MealAnalysis, DetectedFoodItem } from '../types/meal';
import { NutritionProfile } from '../types/nutrition';
import { nutritionService } from './nutritionService';

export interface IBarcodeProductProvider {
  lookupBarcode(barcode: string): Promise<BarcodeLookupResult>;
}

class ApiBarcodeProductProvider implements IBarcodeProductProvider {
  async lookupBarcode(barcode: string): Promise<BarcodeLookupResult> {
    try {
      const res = await fetch(`/api/barcode-lookup?barcode=${encodeURIComponent(barcode)}`, {
        headers: { Accept: 'application/json' },
      });

      if (res.status === 404) {
        const body = await res.json().catch(() => ({}));
        return {
          status: 'not_found',
          barcode,
          errorMessage: body.errorMessage || 'Product not found in database.',
        };
      }

      if (res.status === 429) {
        return {
          status: 'rate_limited',
          barcode,
          errorMessage: 'Product lookup is temporarily rate-limited. Please wait a moment.',
        };
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return {
          status: 'error',
          barcode,
          errorMessage: body.errorMessage || `Product lookup failed (HTTP ${res.status}).`,
        };
      }

      const data = await res.json();
      return data;
    } catch (err: unknown) {
      const error = err as Error;
      return {
        status: 'error',
        barcode,
        errorMessage: error.message || 'Network error while looking up product.',
      };
    }
  }
}

export class BarcodeProductService {
  private provider: IBarcodeProductProvider;
  private cache: Map<string, PackagedProduct> = new Map();

  constructor(provider?: IBarcodeProductProvider) {
    this.provider = provider || new ApiBarcodeProductProvider();
  }

  /**
   * Set a custom product provider (e.g. for testing or switching to another catalog)
   */
  setProvider(provider: IBarcodeProductProvider) {
    this.provider = provider;
  }

  /**
   * Normalizes barcode string (trims, removes spaces/dashes, ensures alphanumeric).
   */
  normalizeBarcode(rawBarcode: string): string {
    if (!rawBarcode) return '';
    return rawBarcode.replace(/[^0-9A-Za-z]/g, '').trim();
  }

  /**
   * Looks up a product by barcode with optimistic cache checking.
   */
  async lookupProduct(rawBarcode: string): Promise<BarcodeLookupResult> {
    const barcode = this.normalizeBarcode(rawBarcode);

    if (!barcode || barcode.length < 4) {
      return {
        status: 'error',
        barcode: rawBarcode,
        errorMessage: 'Barcode must contain at least 4 digits.',
      };
    }

    // Check cache
    if (this.cache.has(barcode)) {
      return {
        status: 'found',
        barcode,
        product: this.cache.get(barcode)!,
      };
    }

    const result = await this.provider.lookupBarcode(barcode);

    if (result.status === 'found' && result.product) {
      this.cache.set(barcode, result.product);
    }

    return result;
  }

  /**
   * Clears lookup cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Converts a PackagedProduct into a standard Track-a-Bite MealAnalysis
   * for saving in Firestore / history without fabricating data.
   */
  convertProductToMealAnalysis(product: PackagedProduct): MealAnalysis {
    const n = product.nutrition;
    const proteinVal = n.protein ?? n.proteinGrams ?? 0;
    const carbsVal = n.carbohydrates ?? n.carbsGrams ?? 0;
    const fatVal = n.fat ?? n.fatGrams ?? 0;
    const fiberVal = n.fiber ?? n.fiberGrams ?? 0;
    const sodiumVal = n.sodium ?? n.sodiumMilligrams ?? undefined;
    const sugarVal = n.sugar ?? n.sugarGrams ?? undefined;

    const nutrition: NutritionProfile = {
      calories: Math.round(n.calories || 0),
      protein: Math.round(proteinVal * 10) / 10,
      carbohydrates: Math.round(carbsVal * 10) / 10,
      fat: Math.round(fatVal * 10) / 10,
      fiber: Math.round(fiberVal * 10) / 10,
      sodium: sodiumVal ? Math.round(sodiumVal) : undefined,
      sugar: sugarVal ? Math.round(sugarVal * 10) / 10 : undefined,
    };

    const item: DetectedFoodItem = {
      detectionId: `packaged_${product.barcode}_${Date.now()}`,
      foodId: `barcode_${product.barcode}`,
      name: product.productName,
      confidence: 1.0,
      portionMultiplier: 1.0,
      portionUnit: product.servingSize || 'package',
      estimatedGrams: product.servingSizeGrams || n.servingQuantityGrams || 100,
      nutrition,
      nutritionAvailable: product.nutrition.isNutritionAvailable,
      isEstimatedNutrition: false,
      fallbackDescription: product.brand ? `Brand: ${product.brand}` : undefined,
    };

    const macroDistribution = nutritionService.calculateMacroDistribution(nutrition);
    const nutrientRichness = nutritionService.calculateNutrientRichness(nutrition, [item]);
    const nutrientGaps = nutritionService.calculateNutrientGaps(nutrition, [item]);

    const title = product.brand
      ? `${product.productName} (${product.brand})`
      : product.productName;

    return {
      id: `meal_barcode_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      mealTitle: title,
      analyzedAt: new Date().toISOString(),
      imagePreviewUrl: product.imageUrl || product.productImage || undefined,
      items: [item],
      totalNutrition: nutrition,
      macroDistribution,
      nutrientRichness,
      nutrientGaps,
      balanceAssessment: {
        rating:
          macroDistribution.carbsPercent > 65
            ? 'carb-heavy'
            : macroDistribution.proteinPercent > 20
            ? 'balanced'
            : 'balanced',
        label: `${product.brand || 'Packaged Product'} — ${product.productName}`,
        summary: product.nutrition.isNutritionAvailable
          ? `Packaged item scanned via barcode (${product.barcode}).`
          : `Packaged item scanned via barcode (${product.barcode}). Official nutrition data unavailable on packaging database.`,
        detail: product.ingredientsText
          ? `Ingredients: ${product.ingredientsText.slice(0, 150)}${product.ingredientsText.length > 150 ? '...' : ''}`
          : 'Official product packaging details.',
        glycemicImpactEstimate:
          (nutrition.sugar && nutrition.sugar > 15) || macroDistribution.carbsPercent > 70
            ? 'High'
            : 'Moderate',
      },
      positiveHighlights: product.nutrition.isNutritionAvailable ? nutrientRichness.highlights : [],
      balancingRecommendations: [],
      hostelFriendlyUpgrades: [],
      hostelModeActive: true,
      practicalAdjustments: [],
      disclaimer: product.nutrition.isNutritionAvailable
        ? `Nutrition facts retrieved from product packaging source (${product.sourceProvider || 'Open Food Facts'}).`
        : `Nutrition data was unavailable from product packaging source (${product.sourceProvider || 'Open Food Facts'}).`,
      source: 'barcode',
      barcode: product.barcode,
      brand: product.brand || undefined,
      manufacturingDate: product.manufacturingDate || undefined,
      expiryDate: product.expiryDate || undefined,
      batchNumber: product.batchNumber || undefined,
      expiryStatus: product.expiryStatus,
      packageDetails: product.packageDetails,
    };
  }

}

export const barcodeProductService = new BarcodeProductService();

