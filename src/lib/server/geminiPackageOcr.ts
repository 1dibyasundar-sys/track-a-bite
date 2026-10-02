/**
 * Track-a-Bite — Gemini Package OCR Client (Phase 3)
 *
 * Dedicated server-side multimodal OCR engine specialized for extracting
 * printed, stamped, inkjet, or embossed package dates and batch codes:
 * - Manufacturing Date (MFD / MFG / PKD)
 * - Expiry Date (EXP / Use By)
 * - Best Before duration
 * - Batch / Lot number
 *
 * Strict Security & Accuracy Rules:
 * - NEVER invents dates. If not visible, marks as unverified.
 * - Server-only: GEMINI_API_KEY is never exposed to the client.
 */

import { GEMINI_CONFIG, getGeminiApiKey } from './geminiConfig';
import { PackageOcrResult } from '../types/barcode';
import { evaluatePackageOcr } from '../services/expiryCalculationService';

export interface RawPackageOcrResponse {
  rawManufacturingDateText?: string | null;
  manufacturingDate?: string | null;
  rawExpiryDateText?: string | null;
  expiryDate?: string | null;
  bestBeforePeriodText?: string | null;
  rawBatchText?: string | null;
  batchNumber?: string | null;
  confidence: 'high' | 'medium' | 'low' | 'unverified';
  isAmbiguous?: boolean;
  unverifiedReason?: string | null;
}

const PACKAGE_OCR_SYSTEM_PROMPT = `You are a precision package date and batch OCR engine for packaged food items in India and globally.
Your task is to examine the photo of a food product packaging label, crimp, lid, cap, or carton and read the printed or stamped packaging details:

1. Manufacturing Date (MFD, MFG, PKD, PACKED, DATE OF MFR).
2. Expiry Date (EXP, EXPIRY, USE BY, BEST BEFORE DATE).
3. Best Before Duration (e.g. "Best before 6 months from manufacture", "Use within 180 days of packing").
4. Batch / Lot Number (e.g. "BATCH NO", "LOT", "B-204").

CRITICAL ACCURACY GUIDELINES:
- NEVER invent, guess, or hallucinate dates. If a date is not clearly visible in the image, set it to null.
- Extract the exact raw text as seen on the package (e.g. "MFD 12/08/2026").
- Normalize clearly visible dates into ISO format (YYYY-MM-DD). If day or month is ambiguous, set isAmbiguous to true.
- If the image shows no packaging dates (e.g. photo of a front logo or barcode only), set confidence to "unverified" and set unverifiedReason to "Manufacturing/expiry date could not be verified from the package."`;

const PACKAGE_OCR_SCHEMA = {
  type: 'OBJECT',
  properties: {
    rawManufacturingDateText: { type: 'STRING', nullable: true },
    manufacturingDate: { type: 'STRING', nullable: true },
    rawExpiryDateText: { type: 'STRING', nullable: true },
    expiryDate: { type: 'STRING', nullable: true },
    bestBeforePeriodText: { type: 'STRING', nullable: true },
    rawBatchText: { type: 'STRING', nullable: true },
    batchNumber: { type: 'STRING', nullable: true },
    confidence: {
      type: 'STRING',
      enum: ['high', 'medium', 'low', 'unverified'],
    },
    isAmbiguous: { type: 'BOOLEAN' },
    unverifiedReason: { type: 'STRING', nullable: true },
  },
  required: ['confidence', 'isAmbiguous'],
};

export async function extractPackageDetailsWithGemini(
  base64Data: string,
  mimeType: string = 'image/jpeg'
): Promise<PackageOcrResult> {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    return {
      manufacturingDate: null,
      rawManufacturingDateText: null,
      expiryDate: null,
      rawExpiryDateText: null,
      bestBeforePeriodText: null,
      isEstimatedExpiry: false,
      batchNumber: null,
      rawBatchText: null,
      confidence: 'unverified',
      unverifiedReason: 'Manufacturing/expiry date could not be verified from the package.',
    };
  }

  const url = `${GEMINI_CONFIG.apiEndpoint}/${GEMINI_CONFIG.model}:generateContent`;

  const requestBody = {
    system_instruction: {
      parts: [{ text: PACKAGE_OCR_SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: 'Extract the printed manufacturing date (MFG), expiry date (EXP), best before duration, and batch/lot number from this package photo.',
          },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1, // Deterministic extraction
      topP: 0.8,
      responseMimeType: 'application/json',
      responseSchema: PACKAGE_OCR_SCHEMA,
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[PackageOCR] Gemini API returned HTTP ${response.status}`);
      return {
        manufacturingDate: null,
        rawManufacturingDateText: null,
        expiryDate: null,
        rawExpiryDateText: null,
        bestBeforePeriodText: null,
        isEstimatedExpiry: false,
        batchNumber: null,
        rawBatchText: null,
        confidence: 'unverified',
        unverifiedReason: 'Manufacturing/expiry date could not be verified from the package.',
      };
    }

    const json = await response.json();
    const candidateText = json.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      return {
        manufacturingDate: null,
        rawManufacturingDateText: null,
        expiryDate: null,
        rawExpiryDateText: null,
        bestBeforePeriodText: null,
        isEstimatedExpiry: false,
        batchNumber: null,
        rawBatchText: null,
        confidence: 'unverified',
        unverifiedReason: 'Manufacturing/expiry date could not be verified from the package.',
      };
    }

    const parsed: RawPackageOcrResponse = JSON.parse(candidateText);

    // Run through evaluatePackageOcr to calculate best before & normalize dates
    const evaluation = evaluatePackageOcr({
      manufacturingDate: parsed.manufacturingDate,
      rawManufacturingDateText: parsed.rawManufacturingDateText,
      expiryDate: parsed.expiryDate,
      rawExpiryDateText: parsed.rawExpiryDateText,
      bestBeforePeriodText: parsed.bestBeforePeriodText,
      batchNumber: parsed.batchNumber,
      rawBatchText: parsed.rawBatchText,
      confidence: parsed.confidence,
      unverifiedReason: parsed.unverifiedReason || undefined,
    });

    return evaluation.evaluatedOcr;
  } catch (err: unknown) {
    const error = err as Error;
    console.warn(`[PackageOCR] Error during OCR: ${error.message}`);
    return {
      manufacturingDate: null,
      rawManufacturingDateText: null,
      expiryDate: null,
      rawExpiryDateText: null,
      bestBeforePeriodText: null,
      isEstimatedExpiry: false,
      batchNumber: null,
      rawBatchText: null,
      confidence: 'unverified',
      unverifiedReason: 'Manufacturing/expiry date could not be verified from the package.',
    };
  }
}
