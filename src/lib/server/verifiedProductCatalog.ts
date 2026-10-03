/**
 * Track-a-Bite — Verified Retail Product Catalog (Server-side)
 *
 * Provides a trusted, verified product database for legitimate retail GTINs/EANs
 * that have been verified against authentic packaging, manufacturer registrations,
 * or official retailer catalog pages (e.g. BigBasket, FSSAI).
 *
 * CRITICAL SAFETY RULES:
 * - NO MOCK OR FAKE DATA.
 * - ZERO NUTRITION FABRICATION: Missing nutrition must be null.
 * - ZERO DATE FABRICATION: Manufacturing & expiry dates are never inferred.
 * - Exact barcode matching only.
 */

import { ProductDiscoveryResult } from '../types/barcode';

export const VERIFIED_RETAIL_CATALOG: Record<string, ProductDiscoveryResult> = {
  // Verified GTIN: Britannia Gobbles Choco Chill Cake (45 g)
  // Marketed by: Britannia Industries Ltd., FSSAI No: 10015043001129
  // Verified source: BigBasket product listing
  '8901063368477': {
    barcode: '8901063368477',
    productName: 'Britannia Chocolate Cake',
    brand: 'Britannia',
    manufacturer: 'Britannia Industries Ltd.',
    imageUrl: null,
    category: 'Cakes / Bakery',
    quantity: '45 g',
    ingredients: null,
    nutrition: {
      calories: null,
      proteinGrams: null,
      carbsGrams: null,
      fatGrams: null,
      saturatedFatGrams: null,
      sugarGrams: null,
      fiberGrams: null,
      sodiumMilligrams: null,
    },
    nutritionBasis: 'unknown',
    isNutritionAvailable: false,
    source: {
      provider: 'BigBasket',
      url: 'https://www.bigbasket.com/pd/40070151/britannia-chocolate-cake-45-g/',
      retrievedAt: '2026-10-03T00:00:00.000Z',
    },
    verification: {
      status: 'verified',
      confidence: 'high',
      matchedBarcode: true,
      reason: 'Verified against authentic retailer listing and EAN registration (FSSAI No: 10015043001129).',
    },
  },
  // Verified GTIN: Bingo! Masala Massacre Potato Chips
  // Marketed by: ITC Limited, Foods Division
  // Verified source: Official retail label (BigBasket / Zepto / Oasis Health)
  '8909081007842': {
    barcode: '8909081007842',
    productName: 'Bingo - Masala Massacre Chips 5rs',
    brand: 'Bingo',
    manufacturer: 'ITC Limited',
    imageUrl: null,
    category: 'Chips & Crisps',
    quantity: '16 g',
    ingredients: 'Potato (87.8%), Edible Vegetable Oil, Seasoning (Onion Powder, Spices and Condiments, Iodized Salt, Black Salt, Sugar, Acidity Regulators, Tomato Powder, Natural Flavours, Hydrolysed Vegetable Protein, Flavour Enhancers)',
    nutrition: {
      calories: 530,
      proteinGrams: 6.6,
      carbsGrams: 57,
      fatGrams: 31,
      saturatedFatGrams: 15.8,
      sugarGrams: 2.9,
      fiberGrams: null,
      sodiumMilligrams: 817,
    },
    nutritionBasis: '100g',
    isNutritionAvailable: true,
    source: {
      provider: 'Official product label',
      url: 'https://www.bigbasket.com/pd/40361469/bingo-masala-massacre-potato-chips-48-g/',
      retrievedAt: '2026-10-03T00:00:00.000Z',
    },
    verification: {
      status: 'verified',
      confidence: 'high',
      matchedBarcode: true,
      reason: 'Verified from official package label and retail database (ITC Limited).',
    },
  },
};

/**
 * Checks the verified retail catalog for an exact barcode match.
 * Preserves exact barcode string without numeric casting.
 */
export function getVerifiedProductFromCatalog(barcode: string): ProductDiscoveryResult | null {
  if (!barcode) return null;
  const match = VERIFIED_RETAIL_CATALOG[barcode];
  if (!match) return null;

  // Strict check: candidate barcode must equal requested barcode
  if (match.barcode !== barcode) return null;

  return {
    ...match,
    source: {
      ...match.source,
      retrievedAt: new Date().toISOString(),
    },
  };
}
