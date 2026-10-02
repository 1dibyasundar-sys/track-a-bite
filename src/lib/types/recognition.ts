/**
 * Domain types for Computer Vision & Food Perception Architecture (Phase 2)
 *
 * This layer abstracts perception from specific AI providers (Gemini, Vision API, local models, etc.)
 * UI components interact only with these contracts.
 */

export type PortionUnit = 'g' | 'ml' | 'piece' | 'serving' | 'bowl' | 'cup';

export interface EstimatedPortion {
  quantity: number;
  unit: PortionUnit;
  confidence: number; // 0.0 - 1.0 (portion estimation confidence)
  rawGramsEquivalent: number; // Normalized weight in grams for nutrition lookup
}

export type ConfidenceTier = 'high' | 'medium' | 'low';

export type DetectionSource =
  | 'vision-model'
  | 'user-corrected'
  | 'manual-entry'
  | 'mock-preset';

export interface BoundingBox {
  x: number; // percentage from left (0-100)
  y: number; // percentage from top (0-100)
  width: number; // percentage width (0-100)
  height: number; // percentage height (0-100)
}

export type IdentificationMode = 'local' | 'vision' | 'research';

export interface FoodEvidence {
  type: 'web' | 'visual' | 'local_match';
  source?: string;
  title?: string;
  relevance?: string;
  snippet?: string;
  uri?: string;
  query?: string;
}

export interface VisualObservation {
  appearance?: string;
  color?: string;
  texture?: string;
  shape?: string;
  visibleIngredients?: string[];
  cookingStyle?: string;
  approximateRegion?: string;
  visualConfidence?: number;
}

export interface ResearchCandidate {
  candidateName: string;
  visualCompatibility: number; // 0.0 - 1.0
  ingredientCompatibility: number; // 0.0 - 1.0
  preparationCompatibility: number; // 0.0 - 1.0
  regionalCompatibility: number; // 0.0 - 1.0
  sourceAgreement: number; // 0.0 - 1.0
  compositeScore: number; // 0.0 - 1.0
  rationale: string;
}

export interface CandidateMatch {
  foodId: string;
  name: string;
  localNameHindi?: string;
  confidence: number;
}

export interface DetectedFoodRegion {
  regionId: string;
  foodId: string;
  foodName: string;
  confidence: number;
  portion: EstimatedPortion;
  boundingBox?: BoundingBox;
  visualNotes?: string;
}

export interface FoodDetection {
  id: string; // Unique ID for this detection session
  foodId: string; // Foreign key to FoodItem in database
  name: string; // Canonical food name
  localNameHindi?: string;
  confidence: number; // 0.0 - 1.0 (perception confidence)
  confidenceTier: ConfidenceTier;
  estimatedPortion: EstimatedPortion;
  boundingBox?: BoundingBox;
  source: DetectionSource;
  candidateMatches?: CandidateMatch[]; // Alternative candidates for fast user correction
  needsConfirmation?: boolean; // Set true when food is not mapped to internal database
  regions?: DetectedFoodRegion[]; // Supporting multiple physical compartments/regions of the same food identity
  identificationMode?: IdentificationMode; // 'local' | 'vision' | 'research'
  visualObservation?: VisualObservation;
  evidence?: FoodEvidence[];
  researchCandidates?: ResearchCandidate[];
  isEstimatedNutrition?: boolean;
  fallbackDescription?: string;
}

export type ImageSourceType = 'camera' | 'upload' | 'sample' | 'webcam';

/**
 * Clean image abstraction representing visual input.
 * Decouples DOM/Camera/File APIs from the perception services.
 */
export interface AppImage {
  id: string;
  sourceType: ImageSourceType;
  uri?: string; // Data URL or object URL for preview
  blob?: Blob;
  file?: File;
  mimeType?: string;
  width?: number;
  height?: number;
  byteSize?: number;
  capturedAt: string; // ISO string
  scenarioHintId?: string; // Used for deterministic test/development scenarios
}

export type RecognitionStatus =
  | 'success'
  | 'low-confidence'
  | 'no-food-detected'
  | 'invalid-image'
  | 'error';

export interface FoodRecognitionResult {
  imageId: string;
  model: string; // Identifier of perception model/version used
  processingTimeMs: number;
  status: RecognitionStatus;
  detections: FoodDetection[];
  confidenceWarning?: string;
  errorMessage?: string;
  imageMetadata?: {
    sourceType: ImageSourceType;
    dimensions?: { width: number; height: number };
    quality?: 'good' | 'low-light' | 'blurry' | 'glare';
  };
  meal?: import('./mealComposition').StructuredMeal;
}

/**
 * Helper to determine confidence tier from numerical confidence
 */
export function getConfidenceTier(confidence: number): ConfidenceTier {
  if (confidence >= 0.85) return 'high';
  if (confidence >= 0.6) return 'medium';
  return 'low';
}

/**
 * Helper to format confidence for user-facing UI
 */
export function formatConfidencePercent(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

/**
 * Helper to format estimated portion cleanly (e.g. "180 g", "2 pieces", "1 bowl")
 */
export function formatEstimatedPortion(portion: EstimatedPortion): string {
  const roundedQty = Math.round(portion.quantity * 10) / 10;
  const unitLabel = roundedQty > 1 && portion.unit === 'piece' ? 'pieces' : portion.unit;
  return `${roundedQty} ${unitLabel}`;
}
