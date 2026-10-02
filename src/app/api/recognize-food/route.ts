import { NextRequest, NextResponse } from 'next/server';
import { GEMINI_CONFIG, getGeminiApiKey } from '../../../lib/server/geminiConfig';
import { callGeminiVision, GeminiClientError } from '../../../lib/server/geminiClient';
import { foodResearchService } from '../../../lib/server/foodResearchService';
import { portionEstimationService } from '../../../lib/services/portionEstimationService';
import { foodRecognitionService as mockRecognitionService } from '../../../lib/services/mockFoodRecognitionService';
import { groupDetectionsByFoodIdentity } from '../../../lib/services/foodGroupingService';
import { mealCompositionService } from '../../../lib/services/mealCompositionService';
import {
  FoodRecognitionResult,
  FoodDetection,
  AppImage,
} from '../../../lib/types/recognition';
import { UserProfile } from '../../../lib/types/profile';
import { MealContext } from '../../../lib/types/personalizedAnalysis';
import { diagnosticLogger } from '../../../lib/services/diagnosticLogger';

export const dynamic = 'force-dynamic';

// Rate Limiter: Max 30 requests per 60 seconds per client IP
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 30;
const requestCounts = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(clientIp: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const record = requestCounts.get(clientIp);

  if (!record || now > record.resetTime) {
    requestCounts.set(clientIp, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    // Periodically prune stale entries
    if (requestCounts.size > 500) {
      for (const [ip, entry] of requestCounts.entries()) {
        if (now > entry.resetTime) requestCounts.delete(ip);
      }
    }
    return { allowed: true };
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  record.count += 1;
  return { allowed: true };
}

const MAX_BASE64_LENGTH = 14 * 1024 * 1024; // ~10 MB binary image equivalent in base64 string

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  // Rate Limiting / Abuse Protection (Phase 9.1)
  const forwarded = req.headers.get('x-forwarded-for');
  const clientIp = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
  const rateLimit = checkRateLimit(clientIp);

  if (!rateLimit.allowed) {
    diagnosticLogger.warn('GEMINI_ERROR', `Rate limit exceeded for IP: ${clientIp}`);
    return NextResponse.json<FoodRecognitionResult>(
      {
        imageId: `rate-limit-${Date.now()}`,
        model: GEMINI_CONFIG.model,
        processingTimeMs: Date.now() - startTime,
        status: 'error',
        detections: [],
        errorMessage: `Scan limit reached. Please wait ${rateLimit.retryAfterSeconds} seconds before scanning again.`,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.retryAfterSeconds || 60),
        },
      }
    );
  }

  try {
    let base64Data = '';
    let mimeType = 'image/jpeg';
    let imageId = `img-${Date.now()}`;
    let scenarioHintId: string | undefined;
    let userProfile: Partial<UserProfile> | undefined = undefined;
    let mealContext: MealContext | undefined = undefined;

    const contentType = req.headers.get('content-type') || '';

    // Handle multipart/form-data upload
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      scenarioHintId = (formData.get('scenarioHintId') as string) || undefined;
      const idField = formData.get('id') as string | null;
      if (idField) imageId = idField;

      const profileField = formData.get('profile');
      if (profileField && typeof profileField === 'string') {
        try {
          userProfile = JSON.parse(profileField);
        } catch {}
      }
      const mealContextField = formData.get('mealContext');
      if (mealContextField && typeof mealContextField === 'string') {
        mealContext = mealContextField as MealContext;
      }

      if (!file) {
        return NextResponse.json<FoodRecognitionResult>({
          imageId,
          model: GEMINI_CONFIG.model,
          processingTimeMs: Date.now() - startTime,
          status: 'invalid-image',
          detections: [],
          errorMessage: 'No image file was provided in the upload.',
        });
      }

      if (file.size > GEMINI_CONFIG.maxImageSizeBytes) {
        return NextResponse.json<FoodRecognitionResult>({
          imageId,
          model: GEMINI_CONFIG.model,
          processingTimeMs: Date.now() - startTime,
          status: 'invalid-image',
          detections: [],
          errorMessage: 'Image size exceeds 10MB limit. Please upload a smaller photo.',
        });
      }

      mimeType = file.type || 'image/jpeg';
      const arrayBuffer = await file.arrayBuffer();
      base64Data = Buffer.from(arrayBuffer).toString('base64');
    }
    // Handle application/json payload (e.g. from camera canvas dataURL)
    else if (contentType.includes('application/json')) {
      const body = await req.json();
      scenarioHintId = body.scenarioHintId;
      if (body.id) imageId = body.id;
      if (body.profile) userProfile = body.profile;
      if (body.mealContext) mealContext = body.mealContext;

      if (!body.image) {
        return NextResponse.json<FoodRecognitionResult>({
          imageId,
          model: GEMINI_CONFIG.model,
          processingTimeMs: Date.now() - startTime,
          status: 'invalid-image',
          detections: [],
          errorMessage: 'No image data was provided.',
        });
      }

      const rawData = body.image as string;
      if (rawData.startsWith('data:')) {
        const matches = rawData.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
        if (matches) {
          mimeType = matches[1];
          base64Data = matches[2];
        } else {
          base64Data = rawData.replace(/^data:[^;]+;base64,/, '');
        }
      } else {
        base64Data = rawData;
        if (body.mimeType) mimeType = body.mimeType;
      }

      if (base64Data.length > MAX_BASE64_LENGTH) {
        return NextResponse.json<FoodRecognitionResult>({
          imageId,
          model: GEMINI_CONFIG.model,
          processingTimeMs: Date.now() - startTime,
          status: 'invalid-image',
          detections: [],
          errorMessage: 'Image size exceeds 10MB limit. Please upload a smaller photo.',
        });
      }
    } else {
      return NextResponse.json<FoodRecognitionResult>({
        imageId,
        model: GEMINI_CONFIG.model,
        processingTimeMs: Date.now() - startTime,
        status: 'invalid-image',
        detections: [],
        errorMessage: 'Unsupported Content-Type. Please use multipart/form-data or application/json.',
      });
    }

    // Validate MIME type
    if (!GEMINI_CONFIG.allowedMimeTypes.includes(mimeType.toLowerCase())) {
      return NextResponse.json<FoodRecognitionResult>({
        imageId,
        model: GEMINI_CONFIG.model,
        processingTimeMs: Date.now() - startTime,
        status: 'invalid-image',
        detections: [],
        errorMessage: 'Unsupported image format. Please capture or upload JPEG, PNG, or WebP.',
      });
    }

    // Check GEMINI_API_KEY
    const apiKey = getGeminiApiKey();

    // Check if this is an explicit scenario/test preview request
    const isExplicitScenarioOrPlaceholder =
      base64Data === 'placeholder' ||
      base64Data.length < 50 ||
      req.headers.get('x-trackabite-mock-mode') === 'true';

    if (!apiKey) {
      if (isExplicitScenarioOrPlaceholder || scenarioHintId) {
        const syntheticImage: AppImage = {
          id: imageId,
          sourceType: 'sample',
          scenarioHintId: scenarioHintId || 'multi-thali-4food',
          capturedAt: new Date().toISOString(),
        };
        const mockResult = await mockRecognitionService.recognizeFood(syntheticImage);
        return NextResponse.json<FoodRecognitionResult>({
          ...mockResult,
          model: `trackabite-mock-preview (Mock Test/Scenario Mode)`,
          meal: mealCompositionService.composeMeal(mockResult.detections, imageId, userProfile, mealContext),
        });
      }

      // Real user image capture/upload without an API key MUST fail clearly with a helpful server configuration error (Requirement 9 & 10)
      return NextResponse.json<FoodRecognitionResult>(
        {
          imageId,
          model: GEMINI_CONFIG.model,
          processingTimeMs: Date.now() - startTime,
          status: 'error',
          detections: [],
          errorMessage:
            'GEMINI_API_KEY is not configured on the server. Please set GEMINI_API_KEY in your .env.local file to enable live AI food recognition and Google Search grounding.',
        },
        { status: 503 }
      );
    }

    // If image data is a placeholder (e.g. from preset scenario clicks without an uploaded photo)
    if (base64Data === 'placeholder' || base64Data.length < 50) {
      if (scenarioHintId) {
        const syntheticImage: AppImage = {
          id: imageId,
          sourceType: 'sample',
          scenarioHintId,
          capturedAt: new Date().toISOString(),
        };
        const mockResult = await mockRecognitionService.recognizeFood(syntheticImage);
        return NextResponse.json<FoodRecognitionResult>({
          ...mockResult,
          model: `${GEMINI_CONFIG.model} (Scenario Preview)`,
          meal: mealCompositionService.composeMeal(mockResult.detections, imageId, userProfile, mealContext),
        });
      }
      return NextResponse.json<FoodRecognitionResult>({
        imageId,
        model: GEMINI_CONFIG.model,
        processingTimeMs: Date.now() - startTime,
        status: 'invalid-image',
        detections: [],
        errorMessage: 'No image data was received. Please capture or upload a photo of your meal.',
      });
    }

    // Call Gemini Vision model (server-side only)
    const geminiResponse = await callGeminiVision(base64Data, mimeType);

    // Handle no food present
    if (!geminiResponse.isFoodPresent || geminiResponse.detections.length === 0) {
      return NextResponse.json<FoodRecognitionResult>({
        imageId,
        model: GEMINI_CONFIG.model,
        processingTimeMs: Date.now() - startTime,
        status: 'no-food-detected',
        detections: [],
        errorMessage: 'Track-a-Bite couldn&apos;t detect any food on this plate. Please try another angle or select food manually.',
        imageMetadata: {
          sourceType: 'camera',
          quality: geminiResponse.overallImageQuality || 'good',
        },
      });
    }

    // Map Gemini detections through Stage 2 (Local Cache Fast Path) or Stage 3 (Research Grounding)
    const detections: FoodDetection[] = [];
    const surroundingNames = geminiResponse.detections.map(d => d.foodName);

    for (let idx = 0; idx < geminiResponse.detections.length; idx++) {
      const raw = geminiResponse.detections[idx];

      // Stage 2 (Local Check) & Stage 3/4 (Google Search Grounding & Candidate Ranking)
      // Maintains image and visual context throughout workflow (Requirement 1 & 3)
      const researchOutcome = await foodResearchService.researchFoodIdentity({
        visualFoodName: raw.foodName,
        visualObservation: raw.visualObservation,
        visualConfidence: raw.confidence,
        visualNotes: raw.visualNotes,
        candidateSuggestions: raw.candidateSuggestions,
        mealContextFoods: surroundingNames.filter((_, i) => i !== idx),
        imageData: {
          base64: base64Data,
          mimeType,
        },
      });

      // Portion estimation: Use Gemini's quantity & unit, and compute gram equivalence
      const rawGramsEquivalent = portionEstimationService.calculateGrams(researchOutcome.foodId, {
        quantity: raw.estimatedPortion.quantity,
        unit: raw.estimatedPortion.unit,
        confidence: raw.confidence,
        rawGramsEquivalent: 0,
      });

      const effectiveConfidence = researchOutcome.confidence;

      const detection: FoodDetection = {
        id: `gemini-${imageId}-${idx + 1}-${Math.random().toString(36).substring(2, 6)}`,
        foodId: researchOutcome.foodId,
        name: researchOutcome.canonicalName,
        localNameHindi: researchOutcome.localNameHindi,
        confidence: effectiveConfidence,
        confidenceTier: researchOutcome.confidenceTier,
        estimatedPortion: {
          quantity: raw.estimatedPortion.quantity,
          unit: raw.estimatedPortion.unit,
          confidence: raw.confidence,
          rawGramsEquivalent,
        },
        source: 'vision-model',
        candidateMatches: researchOutcome.candidates.map(c => ({
          foodId: c.candidateName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          name: c.candidateName,
          confidence: c.compositeScore,
        })),
        needsConfirmation: researchOutcome.needsConfirmation,
        identificationMode: researchOutcome.identificationMode,
        visualObservation: raw.visualObservation,
        evidence: researchOutcome.evidence,
        researchCandidates: researchOutcome.candidates,
        isEstimatedNutrition: researchOutcome.isEstimatedNutrition,
        fallbackDescription: researchOutcome.fallbackDescription,
      };

      detections.push(detection);
    }

    // General-purpose Food Region Grouping Mechanism (Phase 5.2.1):
    // Groups identical food identities (e.g. two physical curry compartments) and aggregates portions
    const consolidatedDetections = groupDetectionsByFoodIdentity(detections);

    // Determine overall recognition status based on detections
    const avgConfidence =
      consolidatedDetections.reduce((sum, d) => sum + d.confidence, 0) /
      Math.max(1, consolidatedDetections.length);
    const isLowConfidence = avgConfidence < 0.6;

    // Compose StructuredMeal domain model (Phase 6.2 Intelligent Meal Composition)
    const structuredMeal = mealCompositionService.composeMeal(
      consolidatedDetections,
      imageId,
      userProfile,
      mealContext
    );

    return NextResponse.json<FoodRecognitionResult>({
      imageId,
      model: GEMINI_CONFIG.model,
      processingTimeMs: Date.now() - startTime,
      status: isLowConfidence ? 'low-confidence' : 'success',
      detections: consolidatedDetections,
      confidenceWarning: isLowConfidence
        ? "Track-a-Bite couldn't confidently identify all dishes. Tap 'Not correct?' on any card to confirm your meal."
        : undefined,
      imageMetadata: {
        sourceType: 'camera',
        quality: geminiResponse.overallImageQuality || 'good',
      },
      meal: structuredMeal,
    });
  } catch (err: unknown) {
    const processingTimeMs = Date.now() - startTime;

    if (err instanceof GeminiClientError) {
      return NextResponse.json<FoodRecognitionResult>({
        imageId: `err-${Date.now()}`,
        model: GEMINI_CONFIG.model,
        processingTimeMs,
        status: 'error',
        detections: [],
        errorMessage: err.userMessage,
      });
    }

    return NextResponse.json<FoodRecognitionResult>({
      imageId: `err-${Date.now()}`,
      model: GEMINI_CONFIG.model,
      processingTimeMs,
      status: 'error',
      detections: [],
      errorMessage: 'Could not identify food at this moment. Please try taking a clearer photo or enter food manually.',
    });
  }
}
