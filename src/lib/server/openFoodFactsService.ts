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

    // Parse Nutriments
    const n = p.nutriments || {};

    // Energy / Calories (kcal preference, fallback from kJ)
    let calories: number | null = null;
    if (typeof n['energy-kcal_serving'] === 'number') {
      calories = Math.round(n['energy-kcal_serving']);
    } else if (typeof n['energy-kcal_100g'] === 'number') {
      calories = Math.round(n['energy-kcal_100g']);
    } else if (typeof n['energy-kcal'] === 'number') {
      calories = Math.round(n['energy-kcal']);
    } else if (typeof n['energy_100g'] === 'number') {
      // kJ to kcal conversion
      calories = Math.round(n['energy_100g'] / 4.184);
    }

    // Protein
    const proteinGrams =
      typeof n.proteins_serving === 'number'
        ? Math.round(n.proteins_serving * 10) / 10
        : typeof n.proteins_100g === 'number'
        ? Math.round(n.proteins_100g * 10) / 10
        : null;

    // Carbs
    const carbsGrams =
      typeof n.carbohydrates_serving === 'number'
        ? Math.round(n.carbohydrates_serving * 10) / 10
        : typeof n.carbohydrates_100g === 'number'
        ? Math.round(n.carbohydrates_100g * 10) / 10
        : null;

    // Fat
    const fatGrams =
      typeof n.fat_serving === 'number'
        ? Math.round(n.fat_serving * 10) / 10
        : typeof n.fat_100g === 'number'
        ? Math.round(n.fat_100g * 10) / 10
        : null;

    // Saturated Fat
    const saturatedFatGrams =
      typeof n['saturated-fat_serving'] === 'number'
        ? Math.round(n['saturated-fat_serving'] * 10) / 10
        : typeof n['saturated-fat_100g'] === 'number'
        ? Math.round(n['saturated-fat_100g'] * 10) / 10
        : null;

    // Sugar
    const sugarGrams =
      typeof n.sugars_serving === 'number'
        ? Math.round(n.sugars_serving * 10) / 10
        : typeof n.sugars_100g === 'number'
        ? Math.round(n.sugars_100g * 10) / 10
        : null;

    // Sodium (in mg)
    let sodiumMilligrams: number | null = null;
    if (typeof n.sodium_serving === 'number') {
      sodiumMilligrams = Math.round(n.sodium_serving * 1000);
    } else if (typeof n.sodium_100g === 'number') {
      sodiumMilligrams = Math.round(n.sodium_100g * 1000);
    } else if (typeof n.salt_100g === 'number') {
      // 1g salt ~ 400mg sodium
      sodiumMilligrams = Math.round(n.salt_100g * 400);
    }

    // Fiber
    const fiberGrams =
      typeof n.fiber_serving === 'number'
        ? Math.round(n.fiber_serving * 10) / 10
        : typeof n.fiber_100g === 'number'
        ? Math.round(n.fiber_100g * 10) / 10
        : null;

    const nutrition: PackagedProductNutrition = {
      calories,
      proteinGrams,
      carbsGrams,
      fatGrams,
      saturatedFatGrams,
      sugarGrams,
      sodiumMilligrams,
      fiberGrams,
      servingSize,
      servingQuantityGrams,
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
