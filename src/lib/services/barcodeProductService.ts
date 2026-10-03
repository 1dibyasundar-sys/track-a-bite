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

import {
  BarcodeLookupResult,
  PackagedProduct,
  PackagedProductNutrition,
  PackageOcrResult,
  ExpiryStatus,
} from '../types/barcode';
import { MealAnalysis, DetectedFoodItem } from '../types/meal';
import { NutritionProfile } from '../types/nutrition';
import { nutritionService } from './nutritionService';

/**
 * Normalizes a barcode lookup API response into a UI-safe PackagedProduct object.
 * Guarantees zero runtime crashes while strictly preserving null nutrition values.
 */
export function normalizeBarcodeLookupResult(rawResult: unknown): PackagedProduct | null {
  if (!rawResult || typeof rawResult !== 'object') return null;

  const res = rawResult as Record<string, unknown>;
  const rawProduct = (res.product && typeof res.product === 'object'
    ? res.product
    : res.discoveryResult && typeof res.discoveryResult === 'object'
    ? res.discoveryResult
    : res) as Record<string, unknown>;

  if (!rawProduct || typeof rawProduct !== 'object') return null;

  // Barcode string preservation (strictly string, preserves leading zeroes)
  const rawBarcode = rawProduct.barcode || res.barcode;
  if (!rawBarcode) return null;
  const barcode = String(rawBarcode).trim();

  // Name & Identity
  const productName =
    (typeof rawProduct.productName === 'string' && rawProduct.productName.trim()) ||
    (typeof rawProduct.name === 'string' && rawProduct.name.trim()) ||
    'Packaged Food Product';

  const brand = (typeof rawProduct.brand === 'string' && rawProduct.brand.trim()) || null;
  const quantity =
    (typeof rawProduct.quantity === 'string' && rawProduct.quantity.trim()) ||
    (typeof rawProduct.servingSize === 'string' && rawProduct.servingSize.trim()) ||
    null;
  const servingSize =
    (typeof rawProduct.servingSize === 'string' && rawProduct.servingSize.trim()) ||
    (typeof rawProduct.quantity === 'string' && rawProduct.quantity.trim()) ||
    null;

  const displayImage =
    (typeof rawProduct.imageUrl === 'string' && rawProduct.imageUrl.trim()) ||
    (typeof rawProduct.productImage === 'string' && rawProduct.productImage.trim()) ||
    null;

  // Source Provenance
  const sourceObj = (rawProduct.source && typeof rawProduct.source === 'object' ? rawProduct.source : null) as Record<string, unknown> | null;
  const sourceProvider =
    (typeof rawProduct.sourceProvider === 'string' && rawProduct.sourceProvider.trim()) ||
    (typeof res.sourceProvider === 'string' && res.sourceProvider.trim()) ||
    (typeof res.provider === 'string' && res.provider.trim()) ||
    (typeof rawProduct.provider === 'string' && rawProduct.provider.trim()) ||
    (sourceObj && typeof sourceObj.provider === 'string' && sourceObj.provider.trim()) ||
    (typeof rawProduct.source === 'string' && rawProduct.source.toLowerCase().includes('open food facts') ? 'Open Food Facts' : 'BigBasket');

  const sourceUrl =
    (typeof rawProduct.sourceUrl === 'string' && rawProduct.sourceUrl.trim()) ||
    (typeof res.sourceUrl === 'string' && res.sourceUrl.trim()) ||
    (sourceObj && typeof sourceObj.url === 'string' && sourceObj.url.trim()) ||
    (typeof rawProduct.url === 'string' && rawProduct.url.trim()) ||
    null;

  // Verification Data
  const verObj = (rawProduct.verification && typeof rawProduct.verification === 'object' ? rawProduct.verification : null) as Record<string, unknown> | null;
  const verificationStatus: 'verified' | 'partially_verified' | 'unverified' =
    rawProduct.verificationStatus === 'verified' || verObj?.status === 'verified' || res.verificationStatus === 'verified'
      ? 'verified'
      : rawProduct.verificationStatus === 'partially_verified' || verObj?.status === 'partially_verified' || res.verificationStatus === 'partially_verified'
      ? 'partially_verified'
      : 'unverified';

  const verificationConfidence: 'high' | 'medium' | 'low' =
    rawProduct.verificationConfidence === 'high' || verObj?.confidence === 'high' || res.verificationConfidence === 'high'
      ? 'high'
      : rawProduct.verificationConfidence === 'medium' || verObj?.confidence === 'medium' || res.verificationConfidence === 'medium'
      ? 'medium'
      : 'low';

  const matchedBarcode =
    rawProduct.matchedBarcode !== undefined
      ? Boolean(rawProduct.matchedBarcode)
      : verObj?.matchedBarcode !== undefined
      ? Boolean(verObj.matchedBarcode)
      : res.matchedBarcode !== undefined
      ? Boolean(res.matchedBarcode)
      : true;

  const verificationReason =
    (typeof rawProduct.verificationReason === 'string' && rawProduct.verificationReason.trim()) ||
    (verObj && typeof verObj.reason === 'string' && verObj.reason.trim()) ||
    (typeof res.verificationReason === 'string' && res.verificationReason.trim()) ||
    undefined;

  // Nutrition Extraction (Ensuring null is preserved, NEVER null -> 0)
  const rawNutrition = (rawProduct.nutrition && typeof rawProduct.nutrition === 'object' ? rawProduct.nutrition : {}) as Record<string, unknown>;

  const parseNutrientNumber = (keys: string[]): number | null => {
    for (const key of keys) {
      const val = rawNutrition[key];
      if (val !== null && val !== undefined && val !== '') {
        const num = Number(val);
        if (Number.isFinite(num)) {
          return num;
        }
      }
    }
    return null;
  };

  const calories = parseNutrientNumber(['calories', 'caloriesKcal']);
  const protein = parseNutrientNumber(['protein', 'proteinGrams']);
  const carbs = parseNutrientNumber(['carbohydrates', 'carbsGrams']);
  const fat = parseNutrientNumber(['fat', 'fatGrams']);
  const saturatedFat = parseNutrientNumber(['saturatedFat', 'saturatedFatGrams']);
  const sugar = parseNutrientNumber(['sugar', 'sugarGrams']);
  const sodium = parseNutrientNumber(['sodium', 'sodiumMilligrams']);
  const fiber = parseNutrientNumber(['fiber', 'fiberGrams']);

  const isNutritionAvailable =
    rawNutrition.isNutritionAvailable === true ||
    calories !== null ||
    protein !== null ||
    carbs !== null ||
    fat !== null;

  const nutritionBasis: '100g' | 'serving' =
    rawNutrition.nutritionBasis === 'serving' ? 'serving' : '100g';

  const nutritionSource =
    (typeof rawNutrition.nutritionSource === 'string' && rawNutrition.nutritionSource.trim()) ||
    (typeof rawProduct.nutritionSource === 'string' && rawProduct.nutritionSource.trim()) ||
    (typeof res.nutritionSource === 'string' && res.nutritionSource.trim()) ||
    (isNutritionAvailable ? (sourceProvider || 'Official product label') : null);

  const nutritionSourceUrl =
    (typeof rawNutrition.nutritionSourceUrl === 'string' && rawNutrition.nutritionSourceUrl.trim()) ||
    (typeof rawProduct.nutritionSourceUrl === 'string' && rawProduct.nutritionSourceUrl.trim()) ||
    (typeof res.nutritionSourceUrl === 'string' && res.nutritionSourceUrl.trim()) ||
    sourceUrl;

  const nutritionRetrievedAt =
    (typeof rawNutrition.nutritionRetrievedAt === 'string' && rawNutrition.nutritionRetrievedAt.trim()) ||
    (typeof rawProduct.nutritionRetrievedAt === 'string' && rawProduct.nutritionRetrievedAt.trim()) ||
    new Date().toISOString();

  const nutritionVerificationStatus: 'verified' | 'partially_verified' | 'unverified' =
    rawNutrition.nutritionVerificationStatus === 'verified' || rawProduct.nutritionVerificationStatus === 'verified'
      ? 'verified'
      : rawNutrition.nutritionVerificationStatus === 'partially_verified' || rawProduct.nutritionVerificationStatus === 'partially_verified'
      ? 'partially_verified'
      : 'unverified';

  const nutritionVerificationConfidence: 'high' | 'medium' | 'low' =
    rawNutrition.nutritionVerificationConfidence === 'high' || rawProduct.nutritionVerificationConfidence === 'high'
      ? 'high'
      : rawNutrition.nutritionVerificationConfidence === 'medium' || rawProduct.nutritionVerificationConfidence === 'medium'
      ? 'medium'
      : 'low';

  const nutrition: PackagedProductNutrition = {
    calories,
    caloriesKcal: calories,
    energyUnit: 'kcal',
    proteinGrams: protein,
    protein,
    carbsGrams: carbs,
    carbohydrates: carbs,
    fatGrams: fat,
    fat,
    saturatedFatGrams: saturatedFat,
    sugarGrams: sugar,
    sugar,
    sodiumMilligrams: sodium,
    sodium,
    fiberGrams: fiber,
    fiber,
    servingSize,
    nutritionBasis,
    isNutritionAvailable,
    nutritionSource,
    nutritionSourceUrl,
    nutritionRetrievedAt,
    nutritionVerificationStatus,
    nutritionVerificationConfidence,
  };

  // Ingredients text & list
  let ingredientsList: string[] | null = null;
  let ingredientsText: string | null = null;
  if (Array.isArray(rawProduct.ingredients)) {
    ingredientsList = rawProduct.ingredients.map(i => String(i).trim()).filter(Boolean);
    ingredientsText = ingredientsList.join(', ');
  } else if (typeof rawProduct.ingredients === 'string') {
    ingredientsText = rawProduct.ingredients.trim();
    ingredientsList = ingredientsText.split(/[,;]\s*/).filter(Boolean);
  } else if (typeof rawProduct.ingredientsText === 'string') {
    ingredientsText = rawProduct.ingredientsText.trim();
    ingredientsList = ingredientsText.split(/[,;]\s*/).filter(Boolean);
  }

  const pkgProduct: PackagedProduct = {
    barcode,
    productName,
    brand,
    productImage: displayImage,
    imageUrl: displayImage,
    servingSize,
    quantity,
    nutrition,
    ingredients: ingredientsList,
    ingredientsText,
    allergens: rawProduct.allergens as string[] | string | null ?? null,
    novaGroup: typeof rawProduct.novaGroup === 'number' ? rawProduct.novaGroup : null,
    nutriScore: typeof rawProduct.nutriScore === 'string' ? rawProduct.nutriScore : null,
    packageDetails: rawProduct.packageDetails as PackageOcrResult | undefined,
    manufacturingDate: (typeof rawProduct.manufacturingDate === 'string' && rawProduct.manufacturingDate) || null,
    expiryDate: (typeof rawProduct.expiryDate === 'string' && rawProduct.expiryDate) || null,
    batchNumber: (typeof rawProduct.batchNumber === 'string' && rawProduct.batchNumber) || null,
    expiryStatus: (rawProduct.expiryStatus as ExpiryStatus) || 'UNKNOWN',
    source: typeof rawProduct.source === 'string' ? rawProduct.source : 'ai_verified_search',
    sourceProvider,
    sourceUrl,
    retrievedAt: typeof rawProduct.retrievedAt === 'string' ? rawProduct.retrievedAt : new Date().toISOString(),
    nutritionSource,
    nutritionSourceUrl,
    nutritionRetrievedAt,
    nutritionVerificationStatus,
    nutritionVerificationConfidence,
    verificationStatus,
    verificationConfidence,
    matchedBarcode,
    verificationReason,
    found: true,
  };

  return pkgProduct;
}

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
          errorMessage: body.errorMessage || 'Barcode was verified, but no reliable product match was found.',
        };
      }

      if (res.status === 503) {
        const body = await res.json().catch(() => ({}));
        return {
          status: 'discovery_unavailable',
          barcode,
          errorMessage: body.errorMessage || 'The barcode was detected, but product discovery services are temporarily unavailable.',
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
      if (data.status === 'found') {
        const normalized = normalizeBarcodeLookupResult(data);
        if (normalized) {
          return {
            status: 'found',
            barcode,
            source: normalized.sourceProvider || data.source,
            provider: normalized.sourceProvider || data.provider,
            product: normalized,
          };
        }
      }

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
   * Primes the product cache directly with a validated PackagedProduct
   */
  primeCache(barcode: string, product: PackagedProduct) {
    this.cache.set(this.normalizeBarcode(barcode), product);
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

