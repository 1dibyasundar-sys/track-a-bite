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
        if (options?.scenarioHintId || image.scenarioHintId) {
          formData.append(
            'scenarioHintId',
            options?.scenarioHintId || image.scenarioHintId || ''
          );
        }

        response = await fetch('/api/recognize-food', {
          method: 'POST',
          body: formData,
        });
      }
      // 2. Otherwise send JSON payload with data URI or metadata
      else {
        const payload = {
          id: image.id,
          image: image.uri || 'data:image/jpeg;base64,placeholder',
          mimeType: image.mimeType || 'image/jpeg',
          scenarioHintId: options?.scenarioHintId || image.scenarioHintId,
        };

        response = await fetch('/api/recognize-food', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
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
