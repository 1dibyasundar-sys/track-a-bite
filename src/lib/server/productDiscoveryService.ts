/**
 * Track-a-Bite — Product Discovery Service (Server-side)
 *
 * Implements intelligent barcode product discovery fallback when Open Food Facts
 * returns 404 / product not found.
 *
 * Source Hierarchy:
 * Priority 1: Open Food Facts
 * Priority 2: Legitimate Product Databases / APIs (e.g. Google Custom Search if configured)
 * Priority 3: Web Search Provider (DuckDuckGo Search)
 * Priority 4: AI-assisted product identification & synthesis (Gemini)
 *
 * CRITICAL SAFETY RULES:
 * - VALID BARCODE ≠ VERIFIED PRODUCT. Checksum validity is not proof of existence.
 * - ZERO NUTRITION FABRICATION: Missing nutrition must be null (UI renders "—").
 * - ZERO DATE FABRICATION: MFG/EXP dates are NEVER invented; they belong to physical package OCR.
 * - Timeouts & AbortController on all external network requests.
 * - Server-side in-memory caching of verified product discoveries.
 */

import {
  ProductDiscoveryResult,
  PackagedProduct,
  PackagedProductNutrition,
} from '../types/barcode';
import { fetchProductFromOpenFoodFacts, normalizeBarcode } from './openFoodFactsService';
import { GEMINI_CONFIG, getGeminiApiKey } from './geminiConfig';

export interface SearchEvidence {
  title: string;
  url: string;
  snippet: string;
}

export interface IProductDiscoveryProvider {
  readonly name: string;
  searchByBarcode(barcode: string): Promise<ProductDiscoveryResult | null>;
}

// In-memory cache for discovered verified products (24 hour TTL)
interface CacheEntry {
  result: ProductDiscoveryResult;
  expiresAt: number;
}
const discoveryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function logDev(...args: unknown[]) {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[BarcodeDiscovery]', ...args);
  }
}

/**
 * Open Food Facts Discovery Provider (Priority 1)
 */
export class OpenFoodFactsProvider implements IProductDiscoveryProvider {
  readonly name = 'openfoodfacts';

  async searchByBarcode(barcode: string): Promise<ProductDiscoveryResult | null> {
    const lookup = await fetchProductFromOpenFoodFacts(barcode);
    if (lookup.status !== 'found' || !lookup.product) {
      return null;
    }

    const p = lookup.product;
    const n = p.nutrition;

    return {
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
  }
}

/**
 * Web Search Provider (DuckDuckGo HTML search fallback)
 */
export class WebSearchProvider {
  readonly name = 'web_search';
  private timeoutMs = 5000;

  async fetchSearchEvidence(barcode: string): Promise<SearchEvidence[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      // 1. Check Google Custom Search API if environment variables are provided
      const googleKey = process.env.GOOGLE_SEARCH_API_KEY?.trim();
      const googleCx = process.env.GOOGLE_SEARCH_ENGINE_ID?.trim();

      if (googleKey && googleCx) {
        logDev(`Querying Google Custom Search API for barcode: ${barcode}`);
        try {
          const googleUrl = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(googleKey)}&cx=${encodeURIComponent(googleCx)}&q=${encodeURIComponent(barcode)}`;
          const gRes = await fetch(googleUrl, { signal: controller.signal });
          if (gRes.ok) {
            const gData = await gRes.json();
            if (Array.isArray(gData.items) && gData.items.length > 0) {
              const items: SearchEvidence[] = gData.items.map((item: { title?: string; link?: string; snippet?: string }) => ({
                title: item.title || '',
                url: item.link || '',
                snippet: item.snippet || '',
              }));
              logDev(`Google Custom Search returned ${items.length} results`);
              return items;
            }
          }
        } catch (gErr) {
          logDev('Google Custom Search query notice:', (gErr as Error).message);
        }
      }

      // 2. DuckDuckGo HTML Search
      const searchQueries = [
        `${barcode} EAN`,
        `${barcode} product`,
        barcode,
        `site:bigbasket.com ${barcode}`,
      ];
      let evidence: SearchEvidence[] = [];

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
                  // keep cleanUrl
                }
              }
              return {
                url: cleanUrl,
                title: m[2].replace(/<[^>]+>/g, '').trim(),
              };
            }
          );

          const items: SearchEvidence[] = titles
            .slice(0, 6)
            .map((t, idx) => ({
              title: t.title,
              url: t.url,
              snippet: snippets[idx] || '',
            }))
            .filter(e => e.title || e.snippet);

          logDev(`WebSearch query "${q}" returned ${items.length} items`);

          const hasBarcodeMatch = items.some(
            i => i.snippet.includes(barcode) || i.title.includes(barcode)
          );

          if (hasBarcodeMatch) {
            evidence = items;
            break;
          }

          if (evidence.length === 0 && items.length > 0) {
            evidence = items;
          }
        } catch (searchErr) {
          logDev(`WebSearch query "${q}" failed:`, (searchErr as Error).message);
        }
      }

      logDev(`Provider=WebSearch → results=${evidence.length}`);
      return evidence;
    } catch (err) {
      logDev('WebSearch error:', (err as Error).message);
      return [];
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * AI Product Resolver (Gemini AI synthesis with zero-hallucination constraint)
 */
export class AIProductResolver {
  readonly name = 'ai_verified_search';
  private timeoutMs = 7000;

  async resolveProduct(barcode: string, evidence: SearchEvidence[]): Promise<ProductDiscoveryResult | null> {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      logDev('Gemini API key unavailable for AI product resolution');
      return null;
    }

    if (evidence.length === 0) {
      logDev('No search evidence available for AI resolution');
      return null;
    }

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
${evidence
  .map(
    (e, idx) => `[Source ${idx + 1}]
URL: ${e.url}
Title: ${e.title}
Snippet: ${e.snippet}`
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
        logDev(`Gemini API error (${res.status}):`, errText.slice(0, 200));
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
      logDev('Provider=AIResolver → confidence=' + parsed.confidence + ' matched=' + parsed.matched + ' reason=' + parsed.reason);

      if (!parsed.matched || !parsed.productName) {
        return null;
      }

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

      const sourceUrl = parsed.sourceUrl || (evidence[0] ? evidence[0].url : null);
      let providerName = 'Verified Web Search';
      if (sourceUrl) {
        try {
          const parsedUrl = new URL(sourceUrl);
          providerName = parsedUrl.hostname.replace(/^www\./, '');
        } catch {
          // keep default
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
      logDev('AIProductResolver error:', (err as Error).message);
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
 * Orchestrates multi-provider discovery pipeline.
 */
export class ProductDiscoveryService {
  private offProvider = new OpenFoodFactsProvider();
  private searchProvider = new WebSearchProvider();
  private aiResolver = new AIProductResolver();

  async discoverProduct(rawBarcode: string): Promise<{
    status: 'found' | 'not_found' | 'error' | 'rate_limited';
    barcode: string;
    source?: string;
    provider?: string;
    product?: PackagedProduct;
    discoveryResult?: ProductDiscoveryResult;
    errorMessage?: string;
  }> {
    const barcode = normalizeBarcode(rawBarcode);
    if (!barcode || barcode.length < 4) {
      return {
        status: 'error',
        barcode: rawBarcode,
        errorMessage: 'Invalid barcode format. Expected at least 4 digits.',
      };
    }

    logDev(`Starting discovery for barcode=${barcode}`);

    // Step 0: Check in-memory server cache
    const cacheKey = `barcode:${barcode}`;
    const cached = discoveryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      logDev(`Cache hit for barcode=${barcode}`);
      return {
        status: 'found',
        barcode,
        source: cached.result.source.provider,
        provider: cached.result.source.provider,
        product: discoveryResultToPackagedProduct(cached.result),
        discoveryResult: cached.result,
      };
    }

    // Step 1: Open Food Facts (Priority 1)
    try {
      const offResult = await this.offProvider.searchByBarcode(barcode);
      if (offResult) {
        logDev(`OpenFoodFacts → FOUND product=${offResult.productName}`);
        discoveryCache.set(cacheKey, {
          result: offResult,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });

        return {
          status: 'found',
          barcode,
          source: 'openfoodfacts',
          provider: 'Open Food Facts',
          product: discoveryResultToPackagedProduct(offResult),
          discoveryResult: offResult,
        };
      }
      logDev(`OpenFoodFacts → 404`);
    } catch (offErr) {
      logDev(`OpenFoodFacts provider error:`, (offErr as Error).message);
    }

    // Step 2: Fallback Search (Priority 2 & 3)
    let searchEvidence: SearchEvidence[] = [];
    try {
      searchEvidence = await this.searchProvider.fetchSearchEvidence(barcode);
    } catch (searchErr) {
      logDev(`SearchProvider error:`, (searchErr as Error).message);
    }

    // Step 3: AI-assisted product verification and synthesis (Priority 4)
    if (searchEvidence.length > 0) {
      try {
        const aiResult = await this.aiResolver.resolveProduct(barcode, searchEvidence);
        if (aiResult) {
          logDev(`Final source=${aiResult.source.provider} confidence=${aiResult.verification.confidence}`);
          discoveryCache.set(cacheKey, {
            result: aiResult,
            expiresAt: Date.now() + CACHE_TTL_MS,
          });

          return {
            status: 'found',
            barcode,
            source: 'ai_verified_search',
            provider: aiResult.source.provider,
            product: discoveryResultToPackagedProduct(aiResult),
            discoveryResult: aiResult,
          };
        }
      } catch (aiErr) {
        logDev(`AIProductResolver error:`, (aiErr as Error).message);
      }
    }

    // Step 4: Exhausted all providers without a reliable match
    logDev(`All discovery providers exhausted → NOT_FOUND for barcode=${barcode}`);
    return {
      status: 'not_found',
      barcode,
      errorMessage: `Product with barcode "${barcode}" was not found in connected food databases or catalog searches.`,
    };
  }

  clearCache() {
    discoveryCache.clear();
  }
}

export const productDiscoveryService = new ProductDiscoveryService();
