import { foodDatabaseService, FoodDatabaseService } from './foodDatabaseService';
import { nutritionService, NutritionService } from './nutritionService';
import { foodRecognitionService, mockFoodRecognitionService, geminiFoodRecognitionService } from './foodRecognitionService';
import { NutrientAnalysisService, nutrientAnalysisService } from './nutrientAnalysisService';
import { RecommendationService, recommendationService } from './recommendationService';
import { MockRecommendationService } from './mockRecommendationService';
import { MockMealAnalysisService } from './mockMealAnalysisService';
import { MockMealHistoryService } from './mockMealHistoryService';
import { MockPortionEstimationService } from './portionEstimationService';
import { userProfileService, UserProfileService } from './userProfileService';

// Singleton service instances for the application
export { foodDatabaseService, FoodDatabaseService };
export { nutritionService, NutritionService };
export { nutrientAnalysisService, NutrientAnalysisService };
export { recommendationService, RecommendationService, MockRecommendationService };
export const portionEstimationService = new MockPortionEstimationService();
export const mealAnalysisService = new MockMealAnalysisService(nutritionService, recommendationService);
export const mealHistoryService = new MockMealHistoryService();
export {
  foodRecognitionService,
  mockFoodRecognitionService,
  geminiFoodRecognitionService,
  userProfileService,
  UserProfileService,
};

export * from './foodDatabaseService';
export * from './nutritionService';
export * from './nutrientAnalysisService';
export * from './recommendationService';
export * from './portionEstimationService';
export * from './mockFoodRecognitionService';
export * from './geminiFoodRecognitionService';
export * from './foodRecognitionService';
export * from './mockRecommendationService';
export * from './mockMealAnalysisService';
export * from './mockMealHistoryService';
export * from './userProfileService';
export * from './recognitionAdapter';
export * from './foodNormalizationService';
export * from './mealCompositionService';
export * from './intelligentPortionService';
export * from './nutritionRecommendationService';
export * from './nutritionAnalysisService';
export * from './profileStorageService';
export * from './authService';
export * from './firebaseAuthService';
export * from './firestoreProfileService';
export * from './firestoreMealHistoryService';
export * from './nutritionAnalyticsService';
export * from './nutritionExportService';
export * from './firestoreHydrationService';
export * from './hydrationStorageService';
export * from './hydrationService';
export * from './diagnosticLogger';
export * from './expiryCalculationService';
export * from './barcodeProductService';
export * from './packageOcrService';
