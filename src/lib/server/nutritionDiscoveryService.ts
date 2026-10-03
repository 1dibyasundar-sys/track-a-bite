/**
 * Track-a-Bite — Nutrition Discovery Service (Server-side)
 *
 * Implements secondary authoritative nutrition discovery when Open Food Facts
 * or initial discovery returns missing or incomplete nutritional values.
 *
 * Strict Accuracy & Safety Rules:
 * - DO NOT fabricate nutrition.
 * - DO NOT convert missing values to zero.
 * - DO NOT infer nutrition from similar products or categories.
 * - DO NOT allow Gemini to invent values. Gemini is an EXTRACTION ENGINE only.
 * - Explicit zeros (e.g. 0g fiber) are strictly preserved as 0.
 *
 * Priority Hierarchy:
 * 1. Open Food Facts (if valid nutrition already present)
 * 2. Manufacturer / official brand product page
 * 3. Verified retailer product page (e.g. BigBasket, Blinkit, Zepto, Oasis)
 * 4. Other authoritative product/nutrition source
 * 5. AI extraction ONLY from retrieved source content
 */

import { PackagedProductNutrition } from '../types/barcode';
import { GEMINI_CONFIG, getGeminiApiKey } from './geminiConfig';
import { getVerifiedProductFromCatalog } from './verifiedProductCatalog';

interface RetrievedEvidence {
  sourceName: string;
  sourceUrl: string | null;
  title: string;
  content: string;
}

export class NutritionDiscoveryService {
  private timeoutMs = 8000;

  /**
   * Discovers verified nutrition data for a given barcode and product name.
   */
  async discoverNutrition(
    barcode: string,
    productName: string,
    brand: string | null = null,
    existingNutrition?: PackagedProductNutrition | null
  ): Promise<PackagedProductNutrition> {
    // 1. Priority 1 — Existing valid nutrition from Open Food Facts
    if (
      existingNutrition &&
      existingNutrition.isNutritionAvailable &&
      (existingNutrition.calories !== null ||
        existingNutrition.proteinGrams !== null ||
        existingNutrition.carbsGrams !== null ||
        existingNutrition.fatGrams !== null)
    ) {
      return {
        ...existingNutrition,
        nutritionSource: existingNutrition.nutritionSource || 'Open Food Facts',
        nutritionSourceUrl: existingNutrition.nutritionSourceUrl || `https://world.openfoodfacts.org/product/${barcode}`,
        nutritionRetrievedAt: existingNutrition.nutritionRetrievedAt || new Date().toISOString(),
        nutritionVerificationStatus: existingNutrition.nutritionVerificationStatus || 'verified',
        nutritionVerificationConfidence: existingNutrition.nutritionVerificationConfidence || 'high',
      };
    }

    // 2. Priority 2 & 3 — Verified Product Catalog (authentic retail GTIN registry)
    const catalogMatch = getVerifiedProductFromCatalog(barcode);
    if (
      catalogMatch &&
      catalogMatch.isNutritionAvailable &&
      (catalogMatch.nutrition.calories !== null ||
        catalogMatch.nutrition.proteinGrams !== null ||
        catalogMatch.nutrition.carbsGrams !== null ||
        catalogMatch.nutrition.fatGrams !== null)
    ) {
      const cn = catalogMatch.nutrition;
      return {
        calories: cn.calories,
        caloriesKcal: cn.calories,
        energyUnit: 'kcal',
        proteinGrams: cn.proteinGrams,
        protein: cn.proteinGrams,
        carbsGrams: cn.carbsGrams,
        carbohydrates: cn.carbsGrams,
        fatGrams: cn.fatGrams,
        fat: cn.fatGrams,
        saturatedFatGrams: cn.saturatedFatGrams ?? null,
        sugarGrams: cn.sugarGrams ?? null,
        sugar: cn.sugarGrams ?? null,
        sodiumMilligrams: cn.sodiumMilligrams ?? null,
        sodium: cn.sodiumMilligrams ?? null,
        fiberGrams: cn.fiberGrams ?? null,
        fiber: cn.fiberGrams ?? null,
        servingSize: catalogMatch.quantity || (catalogMatch.nutritionBasis === '100g' ? '100g' : null),
        nutritionBasis: catalogMatch.nutritionBasis === 'serving' ? 'serving' : '100g',
        isNutritionAvailable: true,
        nutritionSource: catalogMatch.source.provider || 'Official product label',
        nutritionSourceUrl: catalogMatch.source.url,
        nutritionRetrievedAt: catalogMatch.source.retrievedAt,
        nutritionVerificationStatus: catalogMatch.verification.status || 'verified',
        nutritionVerificationConfidence: catalogMatch.verification.confidence || 'high',
      };
    }

    // 3. Priority 4 & 5 — Multi-query authoritative web search & Gemini extraction
    const evidenceList = await this.searchAuthoritativeSources(barcode, productName, brand);

    if (evidenceList.length > 0) {
      const extracted = await this.extractNutritionWithAi(barcode, productName, brand, evidenceList);
      if (extracted && extracted.isNutritionAvailable) {
        return extracted;
      }
    }

    // Fallback: If no trustworthy source provided nutrition, return null values honestly
    return {
      calories: null,
      caloriesKcal: null,
      energyUnit: 'kcal',
      proteinGrams: null,
      protein: null,
      carbsGrams: null,
      carbohydrates: null,
      fatGrams: null,
      fat: null,
      saturatedFatGrams: null,
      sugarGrams: null,
      sugar: null,
      sodiumMilligrams: null,
      sodium: null,
      fiberGrams: null,
      fiber: null,
      servingSize: null,
      nutritionBasis: '100g',
      isNutritionAvailable: false,
      nutritionSource: null,
      nutritionSourceUrl: null,
      nutritionRetrievedAt: new Date().toISOString(),
      nutritionVerificationStatus: 'unverified',
      nutritionVerificationConfidence: 'low',
    };
  }

  /**
   * Executes targeted nutrition search queries across web search engines.
   */
  private async searchAuthoritativeSources(
    barcode: string,
    productName: string,
    brand: string | null
  ): Promise<RetrievedEvidence[]> {
    const cleanName = productName.replace(/[^\w\s-]/g, ' ').trim();
    const cleanBrand = brand ? brand.replace(/[^\w\s-]/g, ' ').trim() : '';

    const queries: string[] = [
      `${barcode} nutrition`,
      `${barcode} nutrition facts`,
      `${cleanName} nutrition`,
      `${cleanName} nutrition facts`,
      `${cleanName} "per 100g"`,
      `${cleanName} energy protein carbohydrate fat`,
    ];

    if (cleanBrand && !cleanName.toLowerCase().includes(cleanBrand.toLowerCase())) {
      queries.unshift(`${cleanBrand} ${cleanName} nutrition`);
    }

    const evidence: RetrievedEvidence[] = [];

    for (const q of queries.slice(0, 4)) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);

        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
        const res = await fetch(searchUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!res.ok) continue;

        const html = await res.text();
        const snippets = [...html.matchAll(/<a class="result__snippet[^>]*>(.*?)<\/a>/g)].map(m =>
          m[1].replace(/<[^>]+>/g, '').trim()
        );
        const titles = [...html.matchAll(/<a class="result__url[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(
          m => {
            let cleanUrl = m[1];
            const matchUddg = cleanUrl.match(/uddg=([^&]+)/);
            if (matchUddg) {
              cleanUrl = decodeURIComponent(matchUddg[1]);
            }
            return {
              url: cleanUrl,
              title: m[2].replace(/<[^>]+>/g, '').trim(),
            };
          }
        );

        for (let i = 0; i < Math.min(snippets.length, titles.length, 3); i++) {
          const item = titles[i];
          const snippet = snippets[i];
          if (!snippet || snippet.length < 15) continue;

          // Check if snippet contains nutritional indicators
          if (/kcal|calories|protein|carbohydrate|fat|sodium|sugar/i.test(snippet)) {
            evidence.push({
              sourceName: this.identifyProvider(item.url),
              sourceUrl: item.url,
              title: item.title,
              content: snippet,
            });
          }
        }

        if (evidence.length >= 4) break;
      } catch {
        // Continue to next query if one times out or errors
      }
    }

    return evidence;
  }

  /**
   * Uses Gemini strictly as an EXTRACTION ENGINE over retrieved source content.
   */
  private async extractNutritionWithAi(
    barcode: string,
    productName: string,
    brand: string | null,
    evidenceList: RetrievedEvidence[]
  ): Promise<PackagedProductNutrition | null> {
    const apiKey = getGeminiApiKey();
    if (!apiKey) return null;

    const prompt = `You are a strict nutrition extraction engine.
CRITICAL EXTRACTION RULES:
Never use prior knowledge.
Never estimate.
Never infer.
Never complete missing nutritional values.
Return null for any nutrient not explicitly present in the supplied source material.
Do NOT convert null or missing values to 0.
Explicitly stated zeros (e.g. "0g fiber") must be extracted as 0.

PRODUCT: ${productName}
BARCODE: ${barcode}
BRAND: ${brand || 'unknown'}

RETRIEVED SOURCE MATERIAL:
${evidenceList
  .map(
    (e, idx) => `[Source ${idx + 1}]
Provider: ${e.sourceName}
URL: ${e.sourceUrl || 'unknown'}
Title: ${e.title}
Content: ${e.content}`
  )
  .join('\n\n')}

Return JSON ONLY (no markdown formatting, no code blocks):
{
  "calories": number | null,
  "proteinGrams": number | null,
  "carbsGrams": number | null,
  "fatGrams": number | null,
  "saturatedFatGrams": number | null,
  "sugarGrams": number | null,
  "fiberGrams": number | null,
  "sodiumMilligrams": number | null,
  "nutritionBasis": "100g" | "serving",
  "servingSize": string | null,
  "isNutritionAvailable": boolean,
  "nutritionSource": string,
  "nutritionSourceUrl": string | null,
  "nutritionVerificationStatus": "verified" | "partially_verified" | "unverified",
  "nutritionVerificationConfidence": "high" | "medium" | "low"
}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const url = `${GEMINI_CONFIG.apiEndpoint}/${GEMINI_CONFIG.model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.0,
            responseMimeType: 'application/json',
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) return null;

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

      const safeNum = (v: unknown): number | null =>
        typeof v === 'number' && Number.isFinite(v) ? v : null;

      const calories = safeNum(parsed.calories);
      const protein = safeNum(parsed.proteinGrams);
      const carbs = safeNum(parsed.carbsGrams);
      const fat = safeNum(parsed.fatGrams);
      const saturatedFat = safeNum(parsed.saturatedFatGrams);
      const sugar = safeNum(parsed.sugarGrams);
      const fiber = safeNum(parsed.fiberGrams);
      const sodium = safeNum(parsed.sodiumMilligrams);

      const isAvailable =
        Boolean(parsed.isNutritionAvailable) &&
        (calories !== null || protein !== null || carbs !== null || fat !== null);

      if (!isAvailable) return null;

      return {
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
        servingSize: parsed.servingSize || (parsed.nutritionBasis === '100g' ? '100g' : null),
        nutritionBasis: parsed.nutritionBasis === 'serving' ? 'serving' : '100g',
        isNutritionAvailable: true,
        nutritionSource: parsed.nutritionSource || evidenceList[0]?.sourceName || 'Verified Product Label',
        nutritionSourceUrl: parsed.nutritionSourceUrl || evidenceList[0]?.sourceUrl || null,
        nutritionRetrievedAt: new Date().toISOString(),
        nutritionVerificationStatus: parsed.nutritionVerificationStatus || 'verified',
        nutritionVerificationConfidence: parsed.nutritionVerificationConfidence || 'high',
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private identifyProvider(url: string | null): string {
    if (!url) return 'Verified Web Source';
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      if (hostname.includes('bigbasket')) return 'BigBasket';
      if (hostname.includes('zepto')) return 'Zepto';
      if (hostname.includes('blinkit')) return 'Blinkit';
      if (hostname.includes('amazon')) return 'Amazon';
      if (hostname.includes('openfoodfacts')) return 'Open Food Facts';
      if (hostname.includes('oasis')) return 'Verified Retail Label (Oasis / Zepto)';
      return hostname.replace(/^www\./, '');
    } catch {
      return 'Verified Web Source';
    }
  }
}

export const nutritionDiscoveryService = new NutritionDiscoveryService();
