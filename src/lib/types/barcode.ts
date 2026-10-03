/**
 * Track-a-Bite — Packaged Food & Barcode Types
 *
 * Types for retail barcode scanning, Open Food Facts product mapping,
 * package date OCR (MFG / EXP / Batch), and expiry verification.
 */

export type BarcodeType =
  | 'EAN-13'
  | 'EAN-8'
  | 'UPC-A'
  | 'UPC-E'
  | 'CODE-128'
  | 'CODE-39'
  | 'QR-CODE'
  | 'OTHER';

export type ExpiryStatus =
  | 'VALID'
  | 'EXPIRING_SOON'
  | 'EXPIRED'
  | 'UNKNOWN';

export interface PackageOcrResult {
  manufacturingDate: string | null;       // ISO date (YYYY-MM-DD) or null
  rawManufacturingDateText?: string | null; // Exact detected text e.g. "MFD: 12/08/2026"
  expiryDate: string | null;              // ISO date (YYYY-MM-DD) or null
  rawExpiryDateText?: string | null;        // Exact detected text e.g. "EXP: 11-02-2027"
  bestBeforePeriodText?: string | null;    // e.g. "Best Before 6 Months from MFD"
  bestBeforePeriod?: string | null;       // alias for bestBeforePeriodText
  isEstimatedExpiry?: boolean;             // true if calculated from best before + MFD
  isBestBeforeDerived?: boolean;          // alias
  estimatedBestBeforeDate?: string | null;// Calculated date when derived from best before
  derivedBestBeforeDate?: string | null;  // alias
  batchNumber: string | null;             // e.g. "B24X91"
  rawBatchText?: string | null;
  confidence: 'high' | 'medium' | 'low' | 'unverified';
  needsUserConfirmation?: boolean;
  unverifiedReason?: string;
  rawOcrText?: string;
  expiryStatus?: ExpiryStatus;
  expiryExplanation?: string;
}

export interface PackagedProductNutrition {
  calories: number | null;
  caloriesKcal?: number | null;
  energyUnit?: 'kcal' | 'kJ' | null;
  proteinGrams: number | null;
  protein?: number | null;
  carbsGrams: number | null;
  carbohydrates?: number | null;
  fatGrams: number | null;
  fat?: number | null;
  saturatedFatGrams?: number | null;
  sugarGrams: number | null;
  sugar?: number | null;
  sodiumMilligrams: number | null;
  sodium?: number | null;
  fiberGrams?: number | null;
  fiber?: number | null;
  servingSize?: string | null;
  servingQuantityGrams?: number | null;
  nutritionBasis: '100g' | 'serving';
  isNutritionAvailable: boolean;
}

export interface ProductDiscoveryResult {
  barcode: string;
  productName: string | null;
  brand: string | null;
  manufacturer: string | null;
  imageUrl: string | null;
  category: string | null;
  quantity: string | null;
  ingredients: string | null;
  nutrition: {
    calories: number | null;
    proteinGrams: number | null;
    carbsGrams: number | null;
    fatGrams: number | null;
    saturatedFatGrams: number | null;
    sugarGrams: number | null;
    fiberGrams: number | null;
    sodiumMilligrams: number | null;
  };
  nutritionBasis: '100g' | '100ml' | 'serving' | 'unknown';
  isNutritionAvailable: boolean;
  source: {
    provider: string;
    url: string | null;
    retrievedAt: string;
  };
  verification: {
    status: 'verified' | 'partially_verified' | 'unverified';
    confidence: 'high' | 'medium' | 'low';
    matchedBarcode: boolean;
    reason?: string;
  };
}

export interface PackagedProduct {
  barcode: string;
  barcodeType?: BarcodeType;
  productName: string;
  brand: string | null;
  productImage: string | null;
  imageUrl?: string | null;
  servingSize: string | null;
  servingSizeGrams?: number | null;
  quantity?: string | null;
  nutrition: PackagedProductNutrition;
  ingredients: string[] | null;
  ingredientsText?: string | null;
  allergens: string[] | string | null;
  novaGroup?: number | null;
  nutriScore?: string | null;
  packageDetails?: PackageOcrResult;
  manufacturingDate?: string | null;
  expiryDate?: string | null;
  batchNumber?: string | null;
  expiryStatus: ExpiryStatus;
  source: 'openfoodfacts' | 'manual' | 'local' | 'web_search' | 'ai_verified_search' | 'product_database' | string;
  sourceProvider?: string;
  sourceUrl?: string | null;
  retrievedAt?: string;
  verificationStatus?: 'verified' | 'partially_verified' | 'unverified';
  verificationConfidence?: 'high' | 'medium' | 'low';
  matchedBarcode?: boolean;
  verificationReason?: string;
  found: boolean;
}

export interface BarcodeLookupResult {
  status: 'found' | 'not_found' | 'discovery_unavailable' | 'error' | 'rate_limited';
  barcode: string;
  source?: string;
  provider?: string;
  product?: PackagedProduct;
  errorMessage?: string;
}

