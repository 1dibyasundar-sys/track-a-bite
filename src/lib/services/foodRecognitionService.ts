/**
 * Unified Food Recognition Service with Mode Switching
 *
 * Allows switching between 'gemini' and 'mock' modes dynamically
 * without changing UI components or violating service boundaries.
 */

import {
  IFoodRecognitionService,
  FoodRecognitionResult,
  AppImage,
  RecognitionOptions,
  MockScenarioInfo,
} from '../types';
import { mockFoodRecognitionService } from './mockFoodRecognitionService';
import { geminiFoodRecognitionService } from './geminiFoodRecognitionService';

export type RecognitionProviderMode = 'gemini' | 'mock';

const MODE_STORAGE_KEY = 'trackabite_recognition_mode';

class DelegatingFoodRecognitionService implements IFoodRecognitionService {
  private currentMode: RecognitionProviderMode = 'gemini';

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(MODE_STORAGE_KEY) as RecognitionProviderMode | null;
        if (stored === 'mock' || stored === 'gemini') {
          this.currentMode = stored;
        }
      } catch {
        // Fallback to default
      }
    }
  }

  getMode(): RecognitionProviderMode {
    return this.currentMode;
  }

  setMode(mode: RecognitionProviderMode): void {
    this.currentMode = mode;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(MODE_STORAGE_KEY, mode);
        window.dispatchEvent(
          new CustomEvent('trackabite_recognition_mode_changed', { detail: mode })
        );
      } catch {
        // LocalStorage error
      }
    }
  }

  async recognizeFood(
    image: AppImage,
    options?: RecognitionOptions
  ): Promise<FoodRecognitionResult> {
    if (this.currentMode === 'mock') {
      return mockFoodRecognitionService.recognizeFood(image, options);
    }
    return geminiFoodRecognitionService.recognizeFood(image, options);
  }

  getAvailableMockScenarios(): MockScenarioInfo[] {
    return mockFoodRecognitionService.getAvailableMockScenarios();
  }

  async recognizeSampleScenario(scenarioId: string): Promise<FoodRecognitionResult> {
    if (this.currentMode === 'mock') {
      return mockFoodRecognitionService.recognizeSampleScenario(scenarioId);
    }
    return geminiFoodRecognitionService.recognizeSampleScenario(scenarioId);
  }
}

export const foodRecognitionService = new DelegatingFoodRecognitionService();
export { mockFoodRecognitionService } from './mockFoodRecognitionService';
export { geminiFoodRecognitionService } from './geminiFoodRecognitionService';
