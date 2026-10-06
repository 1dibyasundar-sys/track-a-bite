/**
 * Track-a-Bite — TAB (AI Live Food Companion) Types
 *
 * Explicit state machine, provider interfaces, context contracts,
 * and safe tool action definitions.
 */

// Types for TAB (AI Live Food Companion)

export type TABVoiceState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'interrupted'
  | 'error'
  | 'disconnected';

export type TABMicrophonePermission =
  | 'prompt'
  | 'granted'
  | 'denied'
  | 'unsupported';

export interface TABMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: number;
  isStreaming?: boolean;
  actionExecuted?: TABAction;
}

export type TABActionType =
  | 'OPEN_SCANNER'
  | 'OPEN_BARCODE_SCANNER'
  | 'OPEN_MEAL_SCANNER'
  | 'SCAN_ANOTHER_PRODUCT'
  | 'OPEN_HISTORY'
  | 'OPEN_PROFILE'
  | 'GET_CURRENT_PRODUCT'
  | 'GET_CURRENT_MEAL'
  | 'GET_NUTRITION_SUMMARY'
  | 'START_REANALYSIS';

export interface TABAction {
  type: TABActionType;
  label: string;
  parameters?: Record<string, unknown>;
}

export interface TABUserContext {
  age?: number;
  gender?: string;
  dietaryRestrictions?: string;
  healthConditions?: string[];
  healthGoal?: string;
  isHostelite: boolean;
  budgetPreference?: string;
  targetCalories?: number;
  targetProteinG?: number;
  targetCarbsG?: number;
  targetFatG?: number;
}

export interface TABProductContext {
  barcode: string;
  productName: string;
  brand: string | null;
  servingSize?: string | null;
  ingredientsText?: string | null;
  sourceProvider?: string;
  verificationStatus?: string;
  isNutritionAvailable: boolean;
  nutritionSource?: string | null;
  calories?: number | null;
  proteinGrams?: number | null;
  carbsGrams?: number | null;
  fatGrams?: number | null;
  sugarGrams?: number | null;
  fiberGrams?: number | null;
  sodiumMilligrams?: number | null;
  isPackageOcrVerified?: boolean;
  mfgDate?: string | null;
  expDate?: string | null;
  batchLot?: string | null;
}

export interface TABMealContext {
  mealTitle: string;
  analyzedAt: string;
  itemsCount: number;
  foodNames: string[];
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  overallScore?: number;
  keyGaps?: string[];
  recommendations?: string[];
}

export interface TABContext {
  userProfile?: TABUserContext | null;
  currentProduct?: TABProductContext | null;
  currentMeal?: TABMealContext | null;
  recentScans?: string[];
  recentMealTitles?: string[];
}

export interface TABVoiceProviderEvents {
  onStateChange: (state: TABVoiceState) => void;
  onTranscript: (transcript: string, isFinal: boolean) => void;
  onResponseChunk: (chunk: string) => void;
  onResponseComplete: (fullText: string, action?: TABAction) => void;
  onAudioLevel?: (level: number) => void; // 0.0 to 1.0 for visualizer
  onError: (errorMessage: string, canRetry?: boolean) => void;
  onMicrophonePermissionChange?: (permission: TABMicrophonePermission) => void;
}

export interface TABVoiceProvider {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  startListening(): Promise<void>;
  stopListening(): Promise<void>;
  sendText(text: string, context?: TABContext): Promise<void>;
  interrupt(): Promise<void>;
  getState(): TABVoiceState;
  isSupported(): boolean;
}
