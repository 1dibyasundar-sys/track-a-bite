/**
 * Track-a-Bite — Open Food Facts Integration (Server-side)
 *
 * Fetches product metadata, brand, images, serving sizes, and
 * verified nutritional parameters from the Open Food Facts API.
 * Adheres to Open Food Facts API guidelines with custom User-Agent.
 */

import { PackagedProduct, BarcodeLookupResult, PackagedProductNutrition } from '../types/barcode';

const OFF_BASE_URL = 'https://world.openfoodfacts.org/api/v2/product';
const USER_AGENT = 'Track-a-Bite - Web - Version 1.0 (https://track-a-bite.vercel.app)';
const REQUEST_TIMEOUT_MS = 6000;

/**
 * Normalizes barcode strings by stripping non-numeric characters and whitespace.
 */
export function normalizeBarcode(rawBarcode: string): string {
  if (!rawBarcode) return '';
  return rawBarcode.replace(/[^0-9A-Za-z]/g, '').trim();
}

/**
 * Normalizes nutrition field value from Open Food Facts API:
 * - Returns finite number if valid numeric or non-empty numeric string.
 * - Preserves 0 as a valid number.
 * - Returns null for null, undefined, empty string, or non-finite values.
 * Never converts missing values to zero.
 */
export function normalizeNutritionValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

/**
 * Cleans float precision inaccuracies (e.g. 6.300000000000001 -> 6.3) while preserving 0 and null.
 */
export function cleanRound(value: number | null, decimals: number = 1): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Queries Open Food Facts for a product barcode.
 */
export async function fetchProductFromOpenFoodFacts(rawBarcode: string): Promise<BarcodeLookupResult> {
  const barcode = normalizeBarcode(rawBarcode);

  if (!barcode) {
    return {
      status: 'error',
      barcode: rawBarcode,
      errorMessage: 'Invalid or empty barcode provided.',
    };
  }

  const url = `${OFF_BASE_URL}/${encodeURIComponent(barcode)}.json`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 429) {
      return {
        status: 'rate_limited',
        barcode,
        errorMessage: 'Product lookup is temporarily busy. Please wait a moment and try again.',
      };
    }

    if (!response.ok && response.status !== 404) {
      return {
        status: 'error',
        barcode,
        errorMessage: `Product database returned HTTP ${response.status}`,
      };
    }

    const data = await response.json();

    if (data.status === 0 || !data.product) {
      return {
        status: 'not_found',
        barcode,
        errorMessage: 'Product not found in database.',
      };
    }

    const p = data.product;

    // Extract product name with fallbacks
    const productName =
      p.product_name_en ||
      p.product_name ||
      p.generic_name_en ||
      p.generic_name ||
      'Packaged Food Product';

    // Extract brand
    const brand = p.brands || (Array.isArray(p.brands_tags) ? p.brands_tags[0] : null) || null;

    // Extract image
    const productImage = p.image_front_url || p.image_url || p.image_small_url || null;

    // Extract serving info
    const servingSize = p.serving_size || null;
    const servingQuantityGrams = typeof p.serving_quantity === 'number' ? p.serving_quantity : null;

    // Parse Nutriments according to Open Food Facts normalized schema
    const n = (p.nutriments && typeof p.nutriments === 'object') ? p.nutriments : {};
    const hasNoNutritionFlag =
      p.no_nutrition_data === 'on' ||
      p.no_nutrition_data === '1' ||
      p.no_nutrition_data === true ||
      p.no_nutrition_data === 'true';

    // Open Food Facts field priority: Prefer normalized per-100g/per-100ml values whenever available.
    // Do not mix serving values and 100g values.
    const has100gData = !hasNoNutritionFlag && (
      p.nutrition_data_per === '100g' ||
      normalizeNutritionValue(n['energy-kcal_100g']) !== null ||
      normalizeNutritionValue(n['energy-kj_100g']) !== null ||
      normalizeNutritionValue(n['energy_100g']) !== null ||
      normalizeNutritionValue(n['proteins_100g']) !== null ||
      normalizeNutritionValue(n['carbohydrates_100g']) !== null ||
      normalizeNutritionValue(n['fat_100g']) !== null ||
      normalizeNutritionValue(n['fiber_100g']) !== null ||
      normalizeNutritionValue(n['sugars_100g']) !== null ||
      normalizeNutritionValue(n['sodium_100g']) !== null
    );

    const hasServingData = !hasNoNutritionFlag && !has100gData && (
      p.nutrition_data_per === 'serving' ||
      normalizeNutritionValue(n['energy-kcal_serving']) !== null ||
      normalizeNutritionValue(n['energy-kj_serving']) !== null ||
      normalizeNutritionValue(n['energy_serving']) !== null ||
      normalizeNutritionValue(n['proteins_serving']) !== null ||
      normalizeNutritionValue(n['carbohydrates_serving']) !== null ||
      normalizeNutritionValue(n['fat_serving']) !== null ||
      normalizeNutritionValue(n['fiber_serving']) !== null ||
      normalizeNutritionValue(n['sugars_serving']) !== null ||
      normalizeNutritionValue(n['sodium_serving']) !== null
    );

    const nutritionBasis: '100g' | 'serving' = hasServingData ? 'serving' : '100g';

    let calories: number | null = null;
    let proteinGrams: number | null = null;
    let carbsGrams: number | null = null;
    let fatGrams: number | null = null;
    let saturatedFatGrams: number | null = null;
    let sugarGrams: number | null = null;
    let fiberGrams: number | null = null;
    let sodiumMilligrams: number | null = null;

    if (!hasNoNutritionFlag) {
      if (nutritionBasis === '100g') {
        // --- 100g / 100ml BASIS ---

        // Energy: Prefer energy-kcal_100g. Do not blindly use energy (which is in kJ in Open Food Facts).
        const kcal100 = normalizeNutritionValue(n['energy-kcal_100g']);
        if (kcal100 !== null) {
          calories = Math.round(kcal100);
        } else {
          const kcalVal = normalizeNutritionValue(n['energy-kcal_value']);
          const kcalUnit = typeof n['energy-kcal_unit'] === 'string' ? n['energy-kcal_unit'].toLowerCase() : '';
          if (kcalVal !== null && (kcalUnit === 'kcal' || kcalUnit === '') && p.nutrition_data_per === '100g') {
            calories = Math.round(kcalVal);
          } else {
            // Fallback: If kcal is unavailable, check kJ and convert correctly (kJ / 4.184)
            const kjVal = normalizeNutritionValue(n['energy-kj_100g']) ?? normalizeNutritionValue(n['energy_100g']);
            if (kjVal !== null) {
              calories = Math.round(kjVal / 4.184);
            }
          }
        }

        // Protein: Prefer proteins_100g
        proteinGrams = cleanRound(normalizeNutritionValue(n['proteins_100g']), 1);

        // Carbohydrates: Prefer carbohydrates_100g
        carbsGrams = cleanRound(normalizeNutritionValue(n['carbohydrates_100g']), 1);

        // Fat: Prefer fat_100g
        fatGrams = cleanRound(normalizeNutritionValue(n['fat_100g']), 1);

        // Saturated Fat: Prefer saturated-fat_100g
        saturatedFatGrams = cleanRound(normalizeNutritionValue(n['saturated-fat_100g']), 1);

        // Sugar: Prefer sugars_100g
        sugarGrams = cleanRound(normalizeNutritionValue(n['sugars_100g']), 1);

        // Fiber: Prefer fiber_100g (preserves legitimate 0, e.g. Nutella fiber = 0)
        fiberGrams = cleanRound(normalizeNutritionValue(n['fiber_100g']), 1);

        // Sodium: Prefer sodium_100g (default unit in Open Food Facts is grams)
        const sodiumVal = normalizeNutritionValue(n['sodium_100g']);
        if (sodiumVal !== null) {
          const unit = typeof n['sodium_unit'] === 'string' ? n['sodium_unit'].toLowerCase() : 'g';
          sodiumMilligrams = unit === 'mg' ? cleanRound(sodiumVal, 0) : cleanRound(sodiumVal * 1000, 0);
        } else {
          // Fallback: salt_100g (1g salt ~ 400mg sodium)
          const saltVal = normalizeNutritionValue(n['salt_100g']);
          if (saltVal !== null) {
            sodiumMilligrams = cleanRound(saltVal * 400, 0);
          }
        }
      } else if (nutritionBasis === 'serving') {
        // --- SERVING BASIS ---

        const kcalServing = normalizeNutritionValue(n['energy-kcal_serving']);
        if (kcalServing !== null) {
          calories = Math.round(kcalServing);
        } else {
          const kjServing = normalizeNutritionValue(n['energy-kj_serving']) ?? normalizeNutritionValue(n['energy_serving']);
          if (kjServing !== null) {
            calories = Math.round(kjServing / 4.184);
          }
        }

        proteinGrams = cleanRound(normalizeNutritionValue(n['proteins_serving']), 1);
        carbsGrams = cleanRound(normalizeNutritionValue(n['carbohydrates_serving']), 1);
        fatGrams = cleanRound(normalizeNutritionValue(n['fat_serving']), 1);
        saturatedFatGrams = cleanRound(normalizeNutritionValue(n['saturated-fat_serving']), 1);
        sugarGrams = cleanRound(normalizeNutritionValue(n['sugars_serving']), 1);
        fiberGrams = cleanRound(normalizeNutritionValue(n['fiber_serving']), 1);

        const sodiumVal = normalizeNutritionValue(n['sodium_serving']);
        if (sodiumVal !== null) {
          const unit = typeof n['sodium_unit'] === 'string' ? n['sodium_unit'].toLowerCase() : 'g';
          sodiumMilligrams = unit === 'mg' ? cleanRound(sodiumVal, 0) : cleanRound(sodiumVal * 1000, 0);
        } else {
          const saltVal = normalizeNutritionValue(n['salt_serving']);
          if (saltVal !== null) {
            sodiumMilligrams = cleanRound(saltVal * 400, 0);
          }
        }
      }
    }

    const isNutritionAvailable =
      !hasNoNutritionFlag &&
      (calories !== null ||
        proteinGrams !== null ||
        carbsGrams !== null ||
        fatGrams !== null ||
        fiberGrams !== null ||
        sugarGrams !== null ||
        sodiumMilligrams !== null);

    const nutrition: PackagedProductNutrition = {
      calories,
      caloriesKcal: calories,
      energyUnit: 'kcal',
      proteinGrams,
      protein: proteinGrams,
      carbsGrams,
      carbohydrates: carbsGrams,
      fatGrams,
      fat: fatGrams,
      saturatedFatGrams,
      sugarGrams,
      sugar: sugarGrams,
      sodiumMilligrams,
      sodium: sodiumMilligrams,
      fiberGrams,
      fiber: fiberGrams,
      servingSize,
      servingQuantityGrams,
      nutritionBasis,
      isNutritionAvailable,
    };

    // Ingredients
    const ingredientsText = p.ingredients_text_en || p.ingredients_text || null;
    let ingredients: string[] | null = null;
    if (Array.isArray(p.ingredients)) {
      ingredients = p.ingredients
        .map((ing: { text?: string }) => ing.text)
        .filter((t: unknown): t is string => typeof t === 'string' && t.trim().length > 0);
    } else if (ingredientsText) {
      ingredients = ingredientsText.split(/[,;]\s*/).map((s: string) => s.trim());
    }

    // Allergens
    let allergens: string[] | null = null;
    if (Array.isArray(p.allergens_tags) && p.allergens_tags.length > 0) {
      allergens = p.allergens_tags.map((a: string) => a.replace(/^[a-z]+:/i, '').replace(/-/g, ' '));
    } else if (typeof p.allergens === 'string' && p.allergens.trim().length > 0) {
      allergens = p.allergens.split(/[,;]\s*/).map((s: string) => s.trim());
    }

    // Scores
    const novaGroup = typeof p.nova_group === 'number' ? p.nova_group : null;
    const nutriScore = typeof p.nutriscore_grade === 'string' ? p.nutriscore_grade.toUpperCase() : null;

    const product: PackagedProduct = {
      barcode,
      productName,
      brand,
      productImage,
      servingSize,
      nutrition,
      ingredients,
      ingredientsText,
      allergens,
      novaGroup,
      nutriScore,
      expiryStatus: 'UNKNOWN',
      source: 'openfoodfacts',
      found: true,
    };

    return {
      status: 'found',
      barcode,
      product,
    };
  } catch (error: unknown) {
    const err = error as Error;
    if (err.name === 'AbortError') {
      return {
        status: 'error',
        barcode,
        errorMessage: 'Product lookup timed out. Please try again.',
      };
    }
    return {
      status: 'error',
      barcode,
      errorMessage: err.message || 'Unable to connect to product database.',
    };
  }
}
