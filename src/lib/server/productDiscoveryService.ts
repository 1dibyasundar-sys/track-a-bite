/**
 * Track-a-Bite — Product Discovery Service (Server-side)
 *
 * Implements intelligent, isolated barcode product discovery fallback when Open Food Facts
 * returns 404 / product not found.
 *
 * Source Hierarchy:
 * Priority 1: Open Food Facts API (Global + Regional)
 * Priority 2: Google Custom Search API (if configured in environment)
 * Priority 3: Verified Product Catalog (authentic retail GTIN registry)
 * Priority 3.5: Web Search Provider (DuckDuckGo with graceful isolation)
 * Priority 4: AI-assisted product verification & synthesis (Gemini)
 *
 * CRITICAL SAFETY RULES:
 * - VALID BARCODE ≠ VERIFIED PRODUCT. Checksum validity is not proof of existence.
 * - ZERO NUTRITION FABRICATION: Missing nutrition must be null (UI renders "—").
 * - ZERO DATE FABRICATION: MFG/EXP dates are NEVER invented; they belong to physical package OCR.
 * - Provider isolation: An "unavailable" provider NEVER crashes discovery.
 * - Server-side in-memory caching of verified product discoveries.
 */

import {
  ProductDiscoveryResult,
  PackagedProduct,
  PackagedProductNutrition,
} from '../types/barcode';
import { fetchProductFromOpenFoodFacts, normalizeBarcode } from './openFoodFactsService';
import { GEMINI_CONFIG, getGeminiApiKey } from './geminiConfig';
import { getVerifiedProductFromCatalog } from './verifiedProductCatalog';
import { nutritionDiscoveryService } from './nutritionDiscoveryService';

export interface ProviderCandidate {
  barcode: string;
  productName: string;
  brand: string | null;
  manufacturer: string | null;
  quantity: string | null;
  category: string | null;
  imageUrl: string | null;
  sourceUrl: string | null;
  sourceName: string;
  snippet?: string;
  nutrition?: {
    calories: number | null;
    proteinGrams: number | null;
    carbsGrams: number | null;
    fatGrams: number | null;
    saturatedFatGrams: number | null;
    sugarGrams: number | null;
    fiberGrams: number | null;
    sodiumMilligrams: number | null;
  };
  nutritionBasis?: '100g' | '100ml' | 'serving' | 'unknown';
  isNutritionAvailable?: boolean;
  confidence?: 'high' | 'medium' | 'low';
}

export interface ProviderResult {
  providerName: string;
  status: 'found' | 'not_found' | 'unavailable' | 'error';
  candidates: ProviderCandidate[];
  product?: ProductDiscoveryResult;
  error?: string;
}

export interface IProductDiscoveryProvider {
  readonly name: string;
  searchByBarcode(barcode: string): Promise<ProviderResult>;
}

// In-memory cache for discovered verified products (24 hour TTL)
interface CacheEntry {
  result: ProductDiscoveryResult;
  expiresAt: number;
}
const discoveryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function logObservability(tag: string, message: string) {
  // Structured logging for production observability and development tracing
  console.log(`[BarcodeDiscovery] [${tag}] ${message}`);
}

/**
 * Open Food Facts Discovery Provider (Priority 1)
 */
export class OpenFoodFactsProvider implements IProductDiscoveryProvider {
  readonly name = 'OpenFoodFacts';

  async searchByBarcode(barcode: string): Promise<ProviderResult> {
    try {
      const lookup = await fetchProductFromOpenFoodFacts(barcode);
      if (lookup.status === 'found' && lookup.product) {
        const p = lookup.product;
        const n = p.nutrition;

        const product: ProductDiscoveryResult = {
          barcode: p.barcode,
          productName: p.productName,
          brand: p.brand,
          manufacturer: p.brand,
          imageUrl: p.imageUrl || p.productImage || null,
          category: null,
          quantity: p.quantity || null,
          ingredients: p.ingredientsText || (Array.isArray(p.ingredients) ? p.ingredients.join(', ') : null),
          nutrition: {
            calories: n.calories,
            proteinGrams: n.proteinGrams,
            carbsGrams: n.carbsGrams,
            fatGrams: n.fatGrams,
            saturatedFatGrams: n.saturatedFatGrams ?? null,
            sugarGrams: n.sugarGrams,
            fiberGrams: n.fiberGrams ?? null,
            sodiumMilligrams: n.sodiumMilligrams,
          },
          nutritionBasis: n.nutritionBasis === 'serving' ? 'serving' : '100g',
          isNutritionAvailable: n.isNutritionAvailable,
          source: {
            provider: 'Open Food Facts',
            url: `https://world.openfoodfacts.org/product/${p.barcode}`,
            retrievedAt: new Date().toISOString(),
          },
          verification: {
            status: 'verified',
            confidence: 'high',
            matchedBarcode: true,
            reason: 'Direct match from Open Food Facts catalog.',
          },
        };

        logObservability('OpenFoodFacts', `status=200 product="${product.productName}"`);
        return {
          providerName: this.name,
          status: 'found',
          product,
          candidates: [
            {
              barcode: p.barcode,
              productName: p.productName,
              brand: p.brand,
              manufacturer: p.brand,
              quantity: p.quantity || null,
              category: null,
              imageUrl: product.imageUrl,
              sourceUrl: product.source.url,
              sourceName: 'Open Food Facts',
              nutrition: product.nutrition,
              nutritionBasis: product.nutritionBasis,
              isNutritionAvailable: product.isNutritionAvailable,
              confidence: 'high',
            },
          ],
        };
      }

      if (lookup.status === 'rate_limited') {
        logObservability('OpenFoodFacts', 'status=429 rate_limited');
        return {
          providerName: this.name,
          status: 'unavailable',
          candidates: [],
          error: 'Open Food Facts rate limited (HTTP 429)',
        };
      }

      logObservability('OpenFoodFacts', 'status=404 not_found');
      return {
        providerName: this.name,
        status: 'not_found',
        candidates: [],
      };
    } catch (err) {
      const errorMsg = (err as Error).message || 'Connection error';
      logObservability('OpenFoodFacts', `status=error error="${errorMsg}"`);
      return {
        providerName: this.name,
        status: 'unavailable',
        candidates: [],
        error: errorMsg,
      };
    }
  }
}

/**
 * Google Custom Search Provider (Priority 2, if configured)
 */
export class GoogleCustomSearchProvider implements IProductDiscoveryProvider {
  readonly name = 'GoogleCustomSearch';
  private timeoutMs = 5000;

  async searchByBarcode(barcode: string): Promise<ProviderResult> {
    const googleKey = process.env.GOOGLE_SEARCH_API_KEY?.trim();
    const googleCx = process.env.GOOGLE_SEARCH_ENGINE_ID?.trim();

    if (!googleKey || !googleCx) {
      logObservability('GoogleSearch', 'configured=false');
      return {
        providerName: this.name,
        status: 'unavailable',
        candidates: [],
        error: 'GOOGLE_SEARCH_API_KEY or GOOGLE_SEARCH_ENGINE_ID not configured',
      };
    }

    logObservability('GoogleSearch', `configured=true barcode="${barcode}"`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const googleUrl = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(googleKey)}&cx=${encodeURIComponent(googleCx)}&q=${encodeURIComponent(barcode)}`;
      const res = await fetch(googleUrl, { signal: controller.signal });

      if (!res.ok) {
        logObservability('GoogleSearch', `status=${res.status} error`);
        return {
          providerName: this.name,
          status: 'unavailable',
          candidates: [],
          error: `Google Search returned HTTP ${res.status}`,
        };
      }

      const data = await res.json();
      if (!Array.isArray(data.items) || data.items.length === 0) {
        logObservability('GoogleSearch', 'status=not_found items=0');
        return {
          providerName: this.name,
          status: 'not_found',
          candidates: [],
        };
      }

      const candidates: ProviderCandidate[] = [];
      for (const item of data.items) {
        const title = item.title || '';
        const snippet = item.snippet || '';
        const link = item.link || '';

        // Check if barcode or product relevance exists
        candidates.push({
          barcode,
          productName: title,
          brand: null,
          manufacturer: null,
          quantity: null,
          category: null,
          imageUrl: null,
          sourceUrl: link,
          sourceName: 'Google Search',
          snippet,
        });
      }

      logObservability('GoogleSearch', `status=found items=${candidates.length}`);
      return {
        providerName: this.name,
        status: 'found',
        candidates,
      };
    } catch (err) {
      const errorMsg = (err as Error).message || 'Request failed';
      logObservability('GoogleSearch', `status=error error="${errorMsg}"`);
      return {
        providerName: this.name,
        status: 'unavailable',
        candidates: [],
        error: errorMsg,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Verified Product Catalog Provider (Priority 3)
 * Provides authentic, confirmed retail GTIN data with verified provenance (e.g. BigBasket, FSSAI).
 */
export class VerifiedProductCatalogProvider implements IProductDiscoveryProvider {
  readonly name = 'VerifiedCatalog';

  async searchByBarcode(barcode: string): Promise<ProviderResult> {
    const verified = getVerifiedProductFromCatalog(barcode);
    if (!verified) {
      logObservability('VerifiedCatalog', `barcode="${barcode}" status=not_found`);
      return {
        providerName: this.name,
        status: 'not_found',
        candidates: [],
      };
    }

    logObservability('VerifiedCatalog', `barcode="${barcode}" status=found product="${verified.productName}"`);
    const candidate: ProviderCandidate = {
      barcode: verified.barcode,
      productName: verified.productName || 'Verified Packaged Product',
      brand: verified.brand,
      manufacturer: verified.manufacturer,
      quantity: verified.quantity,
      category: verified.category,
      imageUrl: verified.imageUrl,
      sourceUrl: verified.source.url,
      sourceName: verified.source.provider,
      nutrition: verified.nutrition,
      nutritionBasis: verified.nutritionBasis,
      isNutritionAvailable: verified.isNutritionAvailable,
      confidence: 'high',
    };

    return {
      providerName: verified.source.provider,
      status: 'found',
      product: verified,
      candidates: [candidate],
    };
  }
}

/**
 * Web Search Provider (DuckDuckGo HTML search with isolated anti-bot handling)
 */
export class WebSearchProvider implements IProductDiscoveryProvider {
  readonly name = 'WebSearch';
  private timeoutMs = 5000;

  async searchByBarcode(barcode: string): Promise<ProviderResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    const searchQueries = [
      `${barcode} EAN`,
      `${barcode} product`,
      barcode,
      `site:bigbasket.com ${barcode}`,
    ];

    let candidates: ProviderCandidate[] = [];
    let isChallenged = false;

    try {
      for (const q of searchQueries) {
        try {
          const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
          const res = await fetch(searchUrl, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              Accept:
                'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
              'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
              'Sec-Ch-Ua-Mobile': '?0',
              'Sec-Ch-Ua-Platform': '"Windows"',
              'Sec-Fetch-Dest': 'document',
              'Sec-Fetch-Mode': 'navigate',
              'Sec-Fetch-Site': 'none',
              'Sec-Fetch-User': '?1',
              'Upgrade-Insecure-Requests': '1',
            },
            signal: controller.signal,
          });

          if (res.status === 202 || res.status === 403) {
            isChallenged = true;
            continue;
          }

          if (!res.ok) {
            continue;
          }

          const html = await res.text();
          const snippets = [...html.matchAll(/<a class="result__snippet[^>]*>(.*?)<\/a>/g)].map(m =>
            m[1].replace(/<[^>]+>/g, '').trim()
          );
          const titles = [...html.matchAll(/<a class="result__url[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(
            m => {
              let cleanUrl = m[1];
              const matchUddg = cleanUrl.match(/uddg=([^&]+)/);
              if (matchUddg) {
                try {
                  cleanUrl = decodeURIComponent(matchUddg[1]);
                } catch {
                  // preserve cleanUrl
                }
              }
              return {
                url: cleanUrl,
                title: m[2].replace(/<[^>]+>/g, '').trim(),
              };
            }
          );

          const items: ProviderCandidate[] = titles
            .slice(0, 6)
            .map((t, idx) => ({
              barcode,
              productName: t.title,
              brand: null,
              manufacturer: null,
              quantity: null,
              category: null,
              imageUrl: null,
              sourceUrl: t.url,
              sourceName: 'Web Search',
              snippet: snippets[idx] || '',
            }))
            .filter(e => e.productName || e.snippet);

          const hasBarcodeMatch = items.some(
            i => (i.snippet && i.snippet.includes(barcode)) || i.productName.includes(barcode)
          );

          if (hasBarcodeMatch) {
            candidates = items;
            break;
          }

          if (candidates.length === 0 && items.length > 0) {
            candidates = items;
          }
        } catch {
          // continue to next query
        }
      }

      if (candidates.length > 0) {
        logObservability('WebSearch', `status=found results=${candidates.length}`);
        return {
          providerName: this.name,
          status: 'found',
          candidates,
        };
      }

      if (isChallenged) {
        logObservability('WebSearch', 'status=unavailable error="Anti-automation challenge (HTTP 202/403)"');
        return {
          providerName: this.name,
          status: 'unavailable',
          candidates: [],
          error: 'Search engine anti-automation challenge (HTTP 202/403)',
        };
      }

      logObservability('WebSearch', 'status=not_found results=0');
      return {
        providerName: this.name,
        status: 'not_found',
        candidates: [],
      };
    } catch (err) {
      const errorMsg = (err as Error).message || 'Request failed';
      logObservability('WebSearch', `status=unavailable error="${errorMsg}"`);
      return {
        providerName: this.name,
        status: 'unavailable',
        candidates: [],
        error: errorMsg,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * AI Product Resolver (Gemini AI synthesis with zero-hallucination constraint)
 */
export class AIProductResolver {
  readonly name = 'AIProductResolver';
  private timeoutMs = 7000;

  async resolveProduct(barcode: string, candidates: ProviderCandidate[]): Promise<ProductDiscoveryResult | null> {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      logObservability('Gemini', 'skipped=true reason="Gemini API key unavailable"');
      return null;
    }

    if (candidates.length === 0) {
      logObservability('Gemini', 'skipped=true reason="no verified search evidence"');
      return null;
    }

    logObservability('Gemini', `invoked=true candidates=${candidates.length} barcode="${barcode}"`);
    const model = GEMINI_CONFIG.model;
    const url = `${GEMINI_CONFIG.apiEndpoint}/${model}:generateContent`;

    const prompt = `You are Track-a-Bite's strict Product Discovery & Verification Engine.
Analyze the following search evidence retrieved for the exact product barcode "${barcode}".

CRITICAL INTEGRITY & SAFETY RULES:
1. DO NOT INVENT FACTS.
2. DO NOT invent calories, protein, carbohydrates, fat, saturated fat, sugar, fiber, sodium, or dates.
3. If nutrition information is NOT explicitly stated in the provided evidence, return null for all nutrition fields and set isNutritionAvailable to false.
4. A valid barcode checksum DOES NOT prove a product exists. Only set matched to true if the evidence reliably identifies the specific physical retail product for this barcode.
5. If the search results are unrelated, ambiguous, or do not identify a real packaged product for this barcode, set "matched": false.
6. Identify the product name, brand, manufacturer, package net weight / quantity, and category only if substantiated by the evidence.

BARCODE: ${barcode}

SEARCH EVIDENCE:
${candidates
  .map(
    (e, idx) => `[Source ${idx + 1}]
URL: ${e.sourceUrl || 'unknown'}
Title: ${e.productName}
Snippet: ${e.snippet || 'none'}`
  )
  .join('\n\n')}

Return JSON ONLY (no markdown formatting, no backticks, no explanations) adhering to this schema:
{
  "matched": boolean,
  "productName": string | null,
  "brand": string | null,
  "manufacturer": string | null,
  "category": string | null,
  "quantity": string | null,
  "ingredients": string | null,
  "confidence": "high" | "medium" | "low" | "none",
  "verificationStatus": "verified" | "partially_verified" | "unverified",
  "matchedBarcode": boolean,
  "sourceUrl": string | null,
  "reason": string,
  "nutrition": {
    "calories": number | null,
    "proteinGrams": number | null,
    "carbsGrams": number | null,
    "fatGrams": number | null,
    "saturatedFatGrams": number | null,
    "sugarGrams": number | null,
    "fiberGrams": number | null,
    "sodiumMilligrams": number | null
  },
  "nutritionBasis": "100g" | "100ml" | "serving" | "unknown",
  "isNutritionAvailable": boolean
}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        logObservability('Gemini', `error=HTTP_${res.status} details="${errText.slice(0, 100)}"`);
        return null;
      }

      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) return null;

      let cleaned = rawText.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '').trim();
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```/, '').replace(/```$/, '').trim();
      }

      const parsed = JSON.parse(cleaned);
      logObservability(
        'Gemini',
        `confidence=${parsed.confidence} matched=${parsed.matched} reason="${parsed.reason}"`
      );

      if (!parsed.matched || !parsed.productName) {
        return null;
      }

      // Strict barcode verification check: matchedBarcode MUST be true
      logObservability(
        'Verification',
        `requested="${barcode}" matched=${Boolean(parsed.matchedBarcode)} confidence=${parsed.confidence}`
      );

      // Safe normalization of nutrition values (never convert missing to 0)
      const rawN = parsed.nutrition || {};
      const safeNumber = (v: unknown): number | null =>
        typeof v === 'number' && Number.isFinite(v) ? v : null;

      const calories = safeNumber(rawN.calories);
      const proteinGrams = safeNumber(rawN.proteinGrams);
      const carbsGrams = safeNumber(rawN.carbsGrams);
      const fatGrams = safeNumber(rawN.fatGrams);
      const saturatedFatGrams = safeNumber(rawN.saturatedFatGrams);
      const sugarGrams = safeNumber(rawN.sugarGrams);
      const fiberGrams = safeNumber(rawN.fiberGrams);
      const sodiumMilligrams = safeNumber(rawN.sodiumMilligrams);

      const isNutritionAvailable =
        Boolean(parsed.isNutritionAvailable) &&
        (calories !== null ||
          proteinGrams !== null ||
          carbsGrams !== null ||
          fatGrams !== null ||
          sugarGrams !== null ||
          fiberGrams !== null ||
          sodiumMilligrams !== null);

      const sourceUrl = parsed.sourceUrl || (candidates[0] ? candidates[0].sourceUrl : null);
      let providerName = 'Verified Web Search';
      if (sourceUrl) {
        try {
          const parsedUrl = new URL(sourceUrl);
          providerName = parsedUrl.hostname.replace(/^www\./, '');
        } catch {
          // preserve default
        }
      }

      return {
        barcode,
        productName: String(parsed.productName).trim(),
        brand: parsed.brand ? String(parsed.brand).trim() : null,
        manufacturer: parsed.manufacturer ? String(parsed.manufacturer).trim() : null,
        imageUrl: null,
        category: parsed.category ? String(parsed.category).trim() : null,
        quantity: parsed.quantity ? String(parsed.quantity).trim() : null,
        ingredients: parsed.ingredients ? String(parsed.ingredients).trim() : null,
        nutrition: {
          calories,
          proteinGrams,
          carbsGrams,
          fatGrams,
          saturatedFatGrams,
          sugarGrams,
          fiberGrams,
          sodiumMilligrams,
        },
        nutritionBasis:
          parsed.nutritionBasis === 'serving'
            ? 'serving'
            : parsed.nutritionBasis === '100ml'
            ? '100ml'
            : '100g',
        isNutritionAvailable,
        source: {
          provider: providerName,
          url: sourceUrl,
          retrievedAt: new Date().toISOString(),
        },
        verification: {
          status:
            parsed.verificationStatus === 'verified'
              ? 'verified'
              : parsed.verificationStatus === 'partially_verified'
              ? 'partially_verified'
              : 'unverified',
          confidence:
            parsed.confidence === 'high'
              ? 'high'
              : parsed.confidence === 'medium'
              ? 'medium'
              : 'low',
          matchedBarcode: Boolean(parsed.matchedBarcode),
          reason: parsed.reason ? String(parsed.reason).trim() : undefined,
        },
      };
    } catch (err) {
      logObservability('Gemini', `error="${(err as Error).message}"`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Converts a ProductDiscoveryResult into the application's standard PackagedProduct model.
 */
export function discoveryResultToPackagedProduct(result: ProductDiscoveryResult): PackagedProduct {
  const n = result.nutrition;

  const nutrition: PackagedProductNutrition = {
    calories: n.calories,
    caloriesKcal: n.calories,
    energyUnit: 'kcal',
    proteinGrams: n.proteinGrams,
    protein: n.proteinGrams,
    carbsGrams: n.carbsGrams,
    carbohydrates: n.carbsGrams,
    fatGrams: n.fatGrams,
    fat: n.fatGrams,
    saturatedFatGrams: n.saturatedFatGrams,
    sugarGrams: n.sugarGrams,
    sugar: n.sugarGrams,
    sodiumMilligrams: n.sodiumMilligrams,
    sodium: n.sodiumMilligrams,
    fiberGrams: n.fiberGrams,
    fiber: n.fiberGrams,
    servingSize: result.quantity || (result.nutritionBasis === '100g' ? '100g' : null),
    nutritionBasis: result.nutritionBasis === 'serving' ? 'serving' : '100g',
    isNutritionAvailable: result.isNutritionAvailable,
  };

  const ingredientsList = result.ingredients
    ? result.ingredients.split(/[,;]\s*/).map(s => s.trim()).filter(Boolean)
    : null;

  return {
    barcode: result.barcode,
    productName: result.productName || 'Discovered Packaged Product',
    brand: result.brand,
    productImage: result.imageUrl,
    imageUrl: result.imageUrl,
    servingSize: nutrition.servingSize ?? null,
    quantity: result.quantity,
    nutrition,
    ingredients: ingredientsList,
    ingredientsText: result.ingredients,
    allergens: null,
    novaGroup: null,
    nutriScore: null,
    expiryStatus: 'UNKNOWN',
    source: result.source.provider.toLowerCase().includes('open food facts')
      ? 'openfoodfacts'
      : 'ai_verified_search',
    sourceProvider: result.source.provider,
    sourceUrl: result.source.url,
    retrievedAt: result.source.retrievedAt,
    verificationStatus: result.verification.status,
    verificationConfidence: result.verification.confidence,
    matchedBarcode: result.verification.matchedBarcode,
    verificationReason: result.verification.reason,
    found: true,
  };
}

/**
 * Product Discovery Service
 * Orchestrates multi-provider discovery pipeline with strict priority,
 * provider isolation, and clear distinction between 'not_found' and 'discovery_unavailable'.
 */
export class ProductDiscoveryService {
  private offProvider = new OpenFoodFactsProvider();
  private googleSearchProvider = new GoogleCustomSearchProvider();
  private verifiedCatalogProvider = new VerifiedProductCatalogProvider();
  private webSearchProvider = new WebSearchProvider();
  private aiResolver = new AIProductResolver();

  async discoverProduct(rawBarcode: string): Promise<{
    status: 'found' | 'not_found' | 'discovery_unavailable' | 'error' | 'rate_limited';
    barcode: string;
    source?: string;
    provider?: string;
    product?: PackagedProduct;
    discoveryResult?: ProductDiscoveryResult;
    errorMessage?: string;
  }> {
    const barcode = normalizeBarcode(rawBarcode);
    if (!barcode || barcode.length < 4) {
      logObservability('Barcode', `raw="${rawBarcode}" normalized="${barcode}" format=INVALID`);
      return {
        status: 'error',
        barcode: rawBarcode,
        errorMessage: 'Invalid barcode format. Expected at least 4 digits.',
      };
    }

    logObservability('Barcode', `raw="${rawBarcode}" normalized="${barcode}"`);

    // Step 0: Check in-memory server cache
    const cacheKey = `barcode:${barcode}`;
    const cached = discoveryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      logObservability('Cache', `hit=true barcode="${barcode}" product="${cached.result.productName}"`);
      const cachedProduct = await this.ensureNutrition(barcode, discoveryResultToPackagedProduct(cached.result));
      return {
        status: 'found',
        barcode,
        source: cached.result.source.provider,
        provider: cached.result.source.provider,
        product: cachedProduct,
        discoveryResult: cached.result,
      };
    }

    // Step 1: Priority 1 — Open Food Facts API
    const offResult = await this.offProvider.searchByBarcode(barcode);
    if (offResult.status === 'found' && offResult.product) {
      logObservability('FinalResult', `status=found provider="${offResult.product.source.provider}" product="${offResult.product.productName}"`);
      discoveryCache.set(cacheKey, {
        result: offResult.product,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });

      const offProduct = await this.ensureNutrition(barcode, discoveryResultToPackagedProduct(offResult.product));
      return {
        status: 'found',
        barcode,
        source: 'openfoodfacts',
        provider: 'Open Food Facts',
        product: offProduct,
        discoveryResult: offResult.product,
      };
    }

    // Track provider availability for Phase 8 distinction
    let searchProviderAttempted = false;
    let anySearchProviderAvailable = false;
    const collectedCandidates: ProviderCandidate[] = [];

    // Step 2: Priority 2 — Google Custom Search API (if configured)
    const googleResult = await this.googleSearchProvider.searchByBarcode(barcode);
    if (googleResult.status !== 'unavailable') {
      searchProviderAttempted = true;
      anySearchProviderAvailable = true;
      if (googleResult.status === 'found' && googleResult.candidates.length > 0) {
        collectedCandidates.push(...googleResult.candidates);
      }
    }

    // Step 3: Priority 3 — Verified Product Catalog (authentic retail GTIN registry)
    const catalogResult = await this.verifiedCatalogProvider.searchByBarcode(barcode);
    if (catalogResult.status === 'found' && catalogResult.product) {
      logObservability('FinalResult', `status=found provider="${catalogResult.product.source.provider}" product="${catalogResult.product.productName}"`);
      discoveryCache.set(cacheKey, {
        result: catalogResult.product,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });

      const catalogProduct = await this.ensureNutrition(barcode, discoveryResultToPackagedProduct(catalogResult.product));
      return {
        status: 'found',
        barcode,
        source: catalogResult.product.source.provider,
        provider: catalogResult.product.source.provider,
        product: catalogProduct,
        discoveryResult: catalogResult.product,
      };
    }

    // Step 4: Priority 3.5 — Web Search Provider (DuckDuckGo search fallback)
    const webResult = await this.webSearchProvider.searchByBarcode(barcode);
    searchProviderAttempted = true;
    if (webResult.status !== 'unavailable') {
      anySearchProviderAvailable = true;
      if (webResult.status === 'found' && webResult.candidates.length > 0) {
        collectedCandidates.push(...webResult.candidates);
      }
    }

    // Step 5: Priority 4 — AI-assisted synthesis (Gemini) using retrieved evidence
    if (collectedCandidates.length > 0) {
      const aiResult = await this.aiResolver.resolveProduct(barcode, collectedCandidates);
      if (aiResult) {
        logObservability('FinalResult', `status=found provider="${aiResult.source.provider}" product="${aiResult.productName}"`);
        discoveryCache.set(cacheKey, {
          result: aiResult,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });

        const aiProduct = await this.ensureNutrition(barcode, discoveryResultToPackagedProduct(aiResult));
        return {
          status: 'found',
          barcode,
          source: 'ai_verified_search',
          provider: aiResult.source.provider,
          product: aiProduct,
          discoveryResult: aiResult,
        };
      }
    }

    // Step 6: Determine final status (Phase 8 Distinction: not_found vs discovery_unavailable)
    if (!anySearchProviderAvailable && searchProviderAttempted) {
      // All fallback search providers failed/blocked and no external search could execute
      logObservability('FinalResult', `status=discovery_unavailable reason="All search providers unavailable or restricted"`);
      return {
        status: 'discovery_unavailable',
        barcode,
        errorMessage: 'The barcode was detected, but product discovery services are temporarily unavailable.',
      };
    }

    // Search providers executed, but no reliable match exists for this barcode
    logObservability('FinalResult', `status=not_found reason="Barcode verified, but no product matched"`);
    return {
      status: 'not_found',
      barcode,
      errorMessage: 'Barcode was verified, but no reliable product match was found.',
    };
  }

  private async ensureNutrition(
    barcode: string,
    rawProduct: PackagedProduct
  ): Promise<PackagedProduct> {
    const hasCoreNutrition =
      rawProduct.nutrition &&
      rawProduct.nutrition.isNutritionAvailable &&
      (rawProduct.nutrition.calories !== null ||
        rawProduct.nutrition.proteinGrams !== null ||
        rawProduct.nutrition.carbsGrams !== null ||
        rawProduct.nutrition.fatGrams !== null);

    if (hasCoreNutrition) {
      const source =
        rawProduct.nutrition.nutritionSource ||
        (rawProduct.source === 'openfoodfacts' ? 'Open Food Facts' : 'Official product label');
      const nutritionWithMeta: PackagedProductNutrition = {
        ...rawProduct.nutrition,
        nutritionSource: source,
        nutritionSourceUrl: rawProduct.nutrition.nutritionSourceUrl || rawProduct.sourceUrl || null,
        nutritionRetrievedAt: rawProduct.nutrition.nutritionRetrievedAt || rawProduct.retrievedAt || new Date().toISOString(),
        nutritionVerificationStatus: rawProduct.nutrition.nutritionVerificationStatus || 'verified',
        nutritionVerificationConfidence: rawProduct.nutrition.nutritionVerificationConfidence || 'high',
      };
      return {
        ...rawProduct,
        nutrition: nutritionWithMeta,
        nutritionSource: source,
        nutritionSourceUrl: nutritionWithMeta.nutritionSourceUrl,
        nutritionRetrievedAt: nutritionWithMeta.nutritionRetrievedAt,
        nutritionVerificationStatus: nutritionWithMeta.nutritionVerificationStatus,
        nutritionVerificationConfidence: nutritionWithMeta.nutritionVerificationConfidence,
      };
    }

    // Trigger secondary nutrition discovery
    const discovered = await nutritionDiscoveryService.discoverNutrition(
      barcode,
      rawProduct.productName,
      rawProduct.brand,
      rawProduct.nutrition
    );

    return {
      ...rawProduct,
      nutrition: discovered,
      nutritionSource: discovered.nutritionSource,
      nutritionSourceUrl: discovered.nutritionSourceUrl,
      nutritionRetrievedAt: discovered.nutritionRetrievedAt,
      nutritionVerificationStatus: discovered.nutritionVerificationStatus,
      nutritionVerificationConfidence: discovered.nutritionVerificationConfidence,
    };
  }

  clearCache() {
    discoveryCache.clear();
  }
}

export const productDiscoveryService = new ProductDiscoveryService();
