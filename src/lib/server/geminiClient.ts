/**
 * Server-only Gemini Vision API Client
 *
 * Implements structured multimodal food recognition with strict schema validation.
 * NEVER prints or logs API keys.
 */

import {
  GEMINI_CONFIG,
  GEMINI_FOOD_PROMPT,
  GEMINI_RESPONSE_SCHEMA,
  getGeminiApiKey,
} from './geminiConfig';
import { PortionUnit, VisualObservation } from '../types/recognition';

export interface RawGeminiDetection {
  foodName: string;
  confidence: number;
  estimatedPortion: {
    quantity: number;
    unit: PortionUnit;
  };
  visualNotes?: string;
  visualObservation?: VisualObservation;
  candidateSuggestions?: string[];
  needsConfirmation?: boolean;
}

export interface RawGeminiRecognitionResponse {
  isFoodPresent: boolean;
  detections: RawGeminiDetection[];
  overallImageQuality?: 'good' | 'low-light' | 'blurry' | 'glare';
}

export class GeminiClientError extends Error {
  public code: 'MISSING_KEY' | 'RATE_LIMIT' | 'TIMEOUT' | 'API_ERROR' | 'MALFORMED_RESPONSE';
  public userMessage: string;

  constructor(
    code: 'MISSING_KEY' | 'RATE_LIMIT' | 'TIMEOUT' | 'API_ERROR' | 'MALFORMED_RESPONSE',
    userMessage: string,
    internalDetail?: string
  ) {
    super(internalDetail || userMessage);
    this.name = 'GeminiClientError';
    this.code = code;
    this.userMessage = userMessage;
  }
}

/**
 * Validates the raw JSON output returned by Gemini.
 * Never trust raw model output.
 */
function validateGeminiResponse(raw: unknown): RawGeminiRecognitionResponse {
  if (!raw || typeof raw !== 'object') {
    throw new GeminiClientError(
      'MALFORMED_RESPONSE',
      'The recognition engine returned an unexpected format. Please try again.'
    );
  }

  const obj = raw as Record<string, unknown>;

  const isFoodPresent =
    typeof obj.isFoodPresent === 'boolean' ? obj.isFoodPresent : true;

  if (!Array.isArray(obj.detections)) {
    return {
      isFoodPresent: false,
      detections: [],
      overallImageQuality: 'good',
    };
  }

  const validUnits: PortionUnit[] = ['g', 'ml', 'piece', 'serving', 'bowl', 'cup'];
  const validatedDetections: RawGeminiDetection[] = [];

  for (const item of obj.detections) {
    if (!item || typeof item !== 'object') continue;
    const det = item as Record<string, unknown>;

    const foodName = typeof det.foodName === 'string' ? det.foodName.trim() : '';
    if (!foodName) continue;

    let confidence = typeof det.confidence === 'number' ? det.confidence : 0.8;
    // Bound confidence strictly between 0.0 and 1.0
    confidence = Math.max(0.0, Math.min(1.0, confidence));

    let quantity = 1;
    let unit: PortionUnit = 'serving';

    if (det.estimatedPortion && typeof det.estimatedPortion === 'object') {
      const p = det.estimatedPortion as Record<string, unknown>;
      if (typeof p.quantity === 'number' && p.quantity > 0) {
        quantity = p.quantity;
      }
      if (typeof p.unit === 'string' && validUnits.includes(p.unit as PortionUnit)) {
        unit = p.unit as PortionUnit;
      }
    }

    const needsConfirmation =
      typeof det.needsConfirmation === 'boolean'
        ? det.needsConfirmation
        : confidence < 0.60;

    let visualObservation: VisualObservation | undefined;
    if (det.visualObservation && typeof det.visualObservation === 'object') {
      const vo = det.visualObservation as Record<string, unknown>;
      visualObservation = {
        appearance: typeof vo.appearance === 'string' ? vo.appearance : undefined,
        color: typeof vo.color === 'string' ? vo.color : undefined,
        texture: typeof vo.texture === 'string' ? vo.texture : undefined,
        shape: typeof vo.shape === 'string' ? vo.shape : undefined,
        visibleIngredients: Array.isArray(vo.visibleIngredients)
          ? vo.visibleIngredients.filter((i): i is string => typeof i === 'string')
          : undefined,
        cookingStyle: typeof vo.cookingStyle === 'string' ? vo.cookingStyle : undefined,
        visualConfidence: confidence,
      };
    }

    const candidateSuggestions = Array.isArray(det.candidateSuggestions)
      ? det.candidateSuggestions.filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
      : undefined;

    validatedDetections.push({
      foodName,
      confidence,
      estimatedPortion: { quantity, unit },
      visualNotes: typeof det.visualNotes === 'string' ? det.visualNotes : undefined,
      visualObservation,
      candidateSuggestions,
      needsConfirmation,
    });
  }

  const validQualities = ['good', 'low-light', 'blurry', 'glare'];
  const quality =
    typeof obj.overallImageQuality === 'string' &&
    validQualities.includes(obj.overallImageQuality)
      ? (obj.overallImageQuality as 'good' | 'low-light' | 'blurry' | 'glare')
      : 'good';

  return {
    isFoodPresent: isFoodPresent && validatedDetections.length > 0,
    detections: validatedDetections,
    overallImageQuality: quality,
  };
}

/**
 * Sends image data to Gemini for structured food recognition.
 */
export async function callGeminiVision(
  base64Data: string,
  mimeType: string
): Promise<RawGeminiRecognitionResponse> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new GeminiClientError(
      'MISSING_KEY',
      'Gemini API key is not configured on the server. Falling back to mock perception.'
    );
  }

  const url = `${GEMINI_CONFIG.apiEndpoint}/${GEMINI_CONFIG.model}:generateContent`;

  const requestBody = {
    system_instruction: {
      parts: [{ text: GEMINI_FOOD_PROMPT }],
    },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: 'Identify all food items on this plate/meal, estimate their visual portions, and provide recognition confidence.',
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
      temperature: 0.2, // Low temperature for factual, deterministic vision output
      topP: 0.8,
      responseMimeType: 'application/json',
      responseSchema: GEMINI_RESPONSE_SCHEMA,
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_CONFIG.requestTimeoutMs);

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
      if (response.status === 429) {
        throw new GeminiClientError(
          'RATE_LIMIT',
          'AI recognition rate limit reached. Please wait a moment or choose food manually.'
        );
      }

      const errorText = await response.text().catch(() => '');
      throw new GeminiClientError(
        'API_ERROR',
        'Could not identify food at this moment. Please try taking a clearer photo or enter manually.',
        `Gemini returned HTTP ${response.status}: ${errorText.slice(0, 150)}`
      );
    }

    const json = await response.json();
    const candidateText =
      json.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      throw new GeminiClientError(
        'MALFORMED_RESPONSE',
        'No recognition output received from the vision model.'
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(candidateText);
    } catch {
      throw new GeminiClientError(
        'MALFORMED_RESPONSE',
        'Failed to parse structured recognition response.'
      );
    }

    return validateGeminiResponse(parsed);
  } catch (err: unknown) {
    clearTimeout(timeoutId);

    if (err instanceof GeminiClientError) {
      throw err;
    }

    if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') {
      throw new GeminiClientError(
        'TIMEOUT',
        'Food recognition timed out. Try taking a photo with better lighting or enter manually.'
      );
    }

    const message = err instanceof Error ? err.message : 'Unknown network failure';
    throw new GeminiClientError(
      'API_ERROR',
      'Network connection to food recognition service failed. Please check your internet connection.',
      message
    );
  }
}
