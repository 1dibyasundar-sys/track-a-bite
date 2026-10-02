/**
 * Client-Side Food Recognition Service communicating with Server Route
 *
 * Implements IFoodRecognitionService without exposing API keys to the browser.
 * Sends AppImage payloads to the secure POST /api/recognize-food route.
 */

import {
  IFoodRecognitionService,
  FoodRecognitionResult,
  AppImage,
  RecognitionOptions,
  MockScenarioInfo,
} from '../types';
import { foodRecognitionService as mockRecognitionService } from './mockFoodRecognitionService';

export class GeminiFoodRecognitionService implements IFoodRecognitionService {
  async recognizeFood(
    image: AppImage,
    options?: RecognitionOptions
  ): Promise<FoodRecognitionResult> {
    try {
      let response: Response;

      // 1. If image contains a real File object, use multipart/form-data
      if (image.file) {
        const formData = new FormData();
        formData.append('file', image.file);
        formData.append('id', image.id);
        if (options?.scenarioHintId) {
          formData.append('scenarioHintId', options.scenarioHintId);
        }

        response = await fetch('/api/recognize-food', {
          method: 'POST',
          body: formData,
        });
      }
      // 2. Otherwise send JSON payload if real data URI is available
      else if (image.uri && image.uri.startsWith('data:image/') && !image.uri.includes('placeholder')) {
        const payload = {
          id: image.id,
          image: image.uri,
          mimeType: image.mimeType || 'image/jpeg',
          scenarioHintId: options?.scenarioHintId,
        };

        response = await fetch('/api/recognize-food', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
      }
      // 3. No real image available: require a new capture rather than sending placeholder
      else {
        return {
          imageId: image.id,
          model: 'gemini-server-route',
          processingTimeMs: 50,
          status: 'invalid-image',
          detections: [],
          errorMessage: 'Capture a new meal to analyze. Please enable camera or upload a photo.',
        };
      }

      if (!response.ok) {
        const errorJson = await response.json().catch(() => null);
        return {
          imageId: image.id,
          model: 'gemini-server-route',
          processingTimeMs: 150,
          status: 'error',
          detections: [],
          errorMessage:
            errorJson?.errorMessage ||
            'Could not identify food at this moment. Please try taking a clearer photo or enter manually.',
        };
      }

      const result: FoodRecognitionResult = await response.json();
      return result;
    } catch {
      // Network failure or offline: return user-friendly error
      return {
        imageId: image.id,
        model: 'gemini-server-route',
        processingTimeMs: 100,
        status: 'error',
        detections: [],
        errorMessage:
          'Network connection to recognition server failed. Please check your connection or choose food manually.',
      };
    }
  }

  getAvailableMockScenarios(): MockScenarioInfo[] {
    return mockRecognitionService.getAvailableMockScenarios();
  }

  async recognizeSampleScenario(scenarioId: string): Promise<FoodRecognitionResult> {
    return mockRecognitionService.recognizeSampleScenario(scenarioId);
  }
}

export const geminiFoodRecognitionService = new GeminiFoodRecognitionService();
