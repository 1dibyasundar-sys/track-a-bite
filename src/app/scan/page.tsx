'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Container } from '../../components/layout/container';
import { AuthGuard } from '../../components/auth/AuthGuard';
import { useAuth } from '../../components/auth/AuthProvider';
import { ScanViewport } from '../../components/scan/scan-viewport';
import { FoodDetectionCard } from '../../components/scan/food-detection-card';
import { FoodSelectorModal } from '../../components/scan/food-selector-modal';
import { MacroDistributionBar } from '../../components/nutrition/macro-distribution-bar';
import { MealIntelligenceCard } from '../../components/nutrition/meal-intelligence-card';
import { DisclaimerBanner } from '../../components/layout/disclaimer-banner';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import {
  foodRecognitionService,
  portionEstimationService,
  foodDatabaseService,
  nutritionService,
  nutrientAnalysisService,
  mealAnalysisService,
  mealHistoryService,
  firestoreMealHistoryService,
  userProfileService,
  useUserProfile,
  detectionToMealItem,
  createManualDetection,
  replaceDetection,
} from '../../lib/services';
import { RecognitionProviderMode } from '../../lib/services/foodRecognitionService';
import {
  ScanStage,
  DetectedFoodItem,
  FoodItem,
  MealAnalysis,
  AppImage,
  FoodDetection,
  FoodRecognitionResult,
} from '../../lib/types';
import {
  ArrowRightIcon,
  CameraIcon,
  SparklesIcon,
  PlusIcon,
  AlertCircleIcon,
  InfoIcon,
  RefreshCwIcon,
} from '../../components/ui/icons';
import { BarcodeScannerViewport, normalizeBarcodeFormat } from '../../components/scan/BarcodeScannerViewport';
import { PackageOcrScanner } from '../../components/scan/PackageOcrScanner';
import { PackagedFoodResultCard } from '../../components/scan/PackagedFoodResultCard';
import { barcodeProductService } from '../../lib/services/barcodeProductService';
import { PackagedProduct, PackageOcrResult } from '../../lib/types/barcode';

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/heif',
  'image/gif',
];

export function validateImageFile(file: unknown): { isValid: boolean; error?: string } {
  if (!file || !(file instanceof File)) {
    return { isValid: false, error: 'Please select an image file to proceed.' };
  }
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type.toLowerCase())) {
    return {
      isValid: false,
      error: 'Unsupported image format. Please upload a JPEG, PNG, WebP, or HEIC photo.',
    };
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return {
      isValid: false,
      error: 'Image file size exceeds 10MB limit. Please upload a smaller photo.',
    };
  }
  if (file.size === 0) {
    return {
      isValid: false,
      error: 'Selected file is empty or corrupted. Please capture or select another photo.',
    };
  }
  return { isValid: true };
}

function ScanContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isReanalyze = searchParams.get('reanalyze') === 'true';
  const { user } = useAuth();

  // State machine for scan & perception pipeline
  const [stage, setStage] = useState<ScanStage>('idle');
  const [items, setItems] = useState<DetectedFoodItem[]>([]);
  const [detections, setDetections] = useState<FoodDetection[]>([]);
  const [recognitionResult, setRecognitionResult] = useState<FoodRecognitionResult | null>(null);
  const [recognitionMode, setRecognitionMode] = useState<RecognitionProviderMode>('gemini');

  // Active scenario preset: None by default (never preload mock scenario for real scans)
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [targetChangeItemId, setTargetChangeItemId] = useState<string | null>(null);
  const [isProcessingFinal, setIsProcessingFinal] = useState(false);
  const [activeImage, setActiveImage] = useState<AppImage | null>(null);

  // Phase 10: Scan UX states
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Ensure perception service is set to gemini mode
  useEffect(() => {
    foodRecognitionService.setMode('gemini');
  }, []);

  // Phase 1 / Phase 6: Top-level mode switcher: 'cooked' (meal plate) vs 'packaged' (barcode + OCR)
  const [scanCategory, setScanCategory] = useState<'cooked' | 'packaged'>('cooked');

  // Packaged food scanner states
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [scannedFormat, setScannedFormat] = useState<string | null>(null);
  const [isLookingUpBarcode, setIsLookingUpBarcode] = useState(false);
  const [barcodeLookupError, setBarcodeLookupError] = useState<string | null>(null);
  const [scannedProduct, setScannedProduct] = useState<PackagedProduct | null>(null);
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
  const [isSavingPackagedMeal, setIsSavingPackagedMeal] = useState(false);

  const handleBarcodeDetected = async (barcode: string, format?: string) => {
    const cleanBarcode = barcode.replace(/[^0-9A-Za-z]/g, '').trim();
    const inferredFormat = normalizeBarcodeFormat(cleanBarcode, format);

    if (process.env.NODE_ENV !== 'production') {
      console.log('[ScanPage] onBarcodeDetected arguments received:', {
        rawBarcode: barcode,
        cleanBarcode,
        format: inferredFormat,
        lookupUrl: `/api/barcode-lookup?barcode=${encodeURIComponent(cleanBarcode)}`,
      });
    }

    setScannedBarcode(cleanBarcode);
    setScannedFormat(inferredFormat);
    setIsLookingUpBarcode(true);
    setBarcodeLookupError(null);

    try {
      const result = await barcodeProductService.lookupProduct(cleanBarcode);

      if (process.env.NODE_ENV !== 'production') {
        console.log('[ScanPage] lookup result:', {
          barcode: cleanBarcode,
          status: result.status,
          hasProduct: Boolean(result.product),
          productName: result.product?.productName,
          errorMessage: result.errorMessage,
        });
      }

      if (result.status === 'found' && result.product) {
        setScannedProduct(result.product);
      } else if (result.status === 'not_found') {
        setScannedProduct(null);
        setBarcodeLookupError(
          result.errorMessage || 'Barcode was verified, but no reliable product match was found.'
        );
      } else if (result.status === 'discovery_unavailable') {
        setScannedProduct(null);
        setBarcodeLookupError(
          result.errorMessage || 'The barcode was detected, but product discovery services are temporarily unavailable.'
        );
      } else if (result.status === 'rate_limited') {
        setScannedProduct(null);
        setBarcodeLookupError('Database lookup is temporarily rate limited. Please try again in a few moments.');
      } else {
        setScannedProduct(null);
        setBarcodeLookupError(result.errorMessage || 'Failed to retrieve product details.');
      }
    } catch (err: unknown) {
      const error = err as Error;
      if (process.env.NODE_ENV !== 'production') {
        console.error('[ScanPage] lookup error:', error);
      }
      setScannedProduct(null);
      setBarcodeLookupError(error.message || 'An unexpected error occurred during lookup.');
    } finally {
      setIsLookingUpBarcode(false);
    }
  };

  const handleApplyPackageDetails = (details: PackageOcrResult) => {
    if (!scannedProduct) return;
    setScannedProduct({
      ...scannedProduct,
      packageDetails: details,
      manufacturingDate: details.manufacturingDate || scannedProduct.manufacturingDate || null,
      expiryDate: details.expiryDate || scannedProduct.expiryDate || null,
      batchNumber: details.batchNumber || scannedProduct.batchNumber || null,
      expiryStatus: details.expiryStatus || scannedProduct.expiryStatus,
    });
  };

  const handleSavePackagedMeal = async () => {
    if (!scannedProduct) return;
    setIsSavingPackagedMeal(true);
    try {
      const meal = barcodeProductService.convertProductToMealAnalysis(scannedProduct);

      if (user?.uid) {
        await firestoreMealHistoryService.saveMeal(user.uid, meal);
      } else {
        await mealHistoryService.saveMeal(meal);
      }

      router.push('/history');
    } catch (err: unknown) {
      console.error('Failed to save packaged food item to meal history:', err);
      alert('Could not save meal item. Please try again.');
    } finally {
      setIsSavingPackagedMeal(false);
    }
  };

  const handleResetPackaged = () => {
    setScannedProduct(null);
    setScannedBarcode(null);
    setScannedFormat(null);
    setBarcodeLookupError(null);
    setIsLookingUpBarcode(false);
  };

  // Clean up object URLs when unmounting or changing preview
  React.useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // 1. Trigger capture action from live camera
  const handleCapture = (capturedItem?: unknown) => {
    setValidationError(null);
    if (capturedItem && capturedItem instanceof File) {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
      const url = URL.createObjectURL(capturedItem);
      setPreviewUrl(url);

      const imagePayload: AppImage = {
        id: `capture-${Date.now()}`,
        sourceType: 'camera',
        file: capturedItem,
        uri: url,
        capturedAt: new Date().toISOString(),
      };
      setActiveImage(imagePayload);
      setStage('preview');
    } else {
      setValidationError('No image frame was captured. Please enable your camera and tap "Capture Plate", or upload a photo.');
      setStage('idle');
    }
  };

  // 2. File upload action with validation
  const handleUploadFile = (file: File) => {
    const validation = validateImageFile(file);
    if (!validation.isValid) {
      setValidationError(validation.error || 'Invalid image file.');
      return;
    }

    setValidationError(null);
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    const imagePayload: AppImage = {
      id: `upload-${Date.now()}`,
      sourceType: 'upload',
      file,
      uri: url,
      capturedAt: new Date().toISOString(),
    };
    setActiveImage(imagePayload);
    setStage('preview');
  };

  // 3. User initiates analysis from preview (with duplicate protection)
  const handleStartAnalysis = () => {
    if (isAnalyzing || stage === 'analyzing') {
      return;
    }
    if (!activeImage?.file && !activeImage?.uri) {
      setValidationError('Capture a new meal to analyze.');
      setStage('idle');
      return;
    }
    setIsAnalyzing(true);
    setStage('analyzing');
  };

  // 4. Complete analysis callback from viewport radar
  const handleAnalysisComplete = async () => {
    try {
      if (!activeImage?.file && !activeImage?.uri) {
        setValidationError('Capture a new meal to analyze.');
        setStage('idle');
        return;
      }

      const img = activeImage;

      // Real camera and uploaded images do NOT send scenarioHintId
      const result = await foodRecognitionService.recognizeFood(img, {
        scenarioHintId: selectedScenarioId || undefined,
      });
      setRecognitionResult(result);
      setDetections(result.detections);

      // Convert pure perception detections into meal items with computed nutrition
      if (result.status === 'success' || result.status === 'low-confidence') {
        const mealItems: DetectedFoodItem[] = [];
        for (const d of result.detections) {
          const mealItem = await detectionToMealItem(
            d,
            foodDatabaseService,
            nutritionService
          );
          mealItems.push(mealItem);
        }
        setItems(mealItems);
        setStage('detected');
      } else {
        // Empty or error state
        setItems([]);
        setStage('detected');
      }
    } catch (err: unknown) {
      console.error('[ScanPage] Analysis failed:', err);
      setRecognitionResult({
        imageId: activeImage?.id || `img-${Date.now()}`,
        model: 'gemini-server-route',
        processingTimeMs: 150,
        status: 'error',
        detections: [],
        errorMessage: "Couldn't confidently identify the food in this image. Please try again or capture a clearer photo.",
      });
      setItems([]);
      setStage('detected');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 5. Quick sample scenario selection
  const handleSelectSample = (scenarioId: string) => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setValidationError(null);
    setIsAnalyzing(false);
    setSelectedScenarioId(scenarioId);
    setStage('idle');
    setItems([]);
    setDetections([]);
    setRecognitionResult(null);
    setActiveImage(null);
  };

  // 5. Portion adjustment
  const handleUpdatePortion = async (detectionId: string, delta: number) => {
    // 1. Update detections state via PortionEstimationService
    const targetDetection = detections.find(d => d.id === detectionId);
    let updatedDetection = targetDetection;
    if (targetDetection) {
      const adjustedPortion = portionEstimationService.adjustPortion(
        targetDetection.estimatedPortion,
        delta
      );
      updatedDetection = {
        ...targetDetection,
        estimatedPortion: adjustedPortion,
        source: 'user-corrected',
      };
      setDetections(prev =>
        prev.map(d => (d.id === detectionId ? updatedDetection! : d))
      );
    }

    const currentItem = items.find(i => i.detectionId === detectionId);
    if (!currentItem) return;

    const food = await foodDatabaseService.getFoodById(currentItem.foodId);
    const newMultiplier = Math.max(
      0.25,
      Math.min(5.0, Math.round((currentItem.portionMultiplier + delta) * 100) / 100)
    );
    const baseGrams =
      food?.serving?.weightGrams ||
      food?.weightGramsPerUnit ||
      Math.round(currentItem.estimatedGrams / currentItem.portionMultiplier);
    const estimatedGrams = Math.round(baseGrams * newMultiplier);

    const nutritionResult = nutritionService.calculateNutrition(food, {
      quantity: newMultiplier,
      unit: currentItem.portionUnit,
      weightGrams: estimatedGrams,
    });

    const newNutrition: import('../../lib/types').NutritionProfile = {
      calories: nutritionResult.calories,
      carbohydrates: nutritionResult.carbohydrates,
      protein: nutritionResult.protein,
      fat: nutritionResult.fat,
      fiber: nutritionResult.fiber,
      sodium: food?.nutrition.sodium
        ? Math.round(food.nutrition.sodium * (nutritionResult.serving.weightGrams / Math.max(1, baseGrams)))
        : undefined,
      sugar: food?.nutrition.sugar
        ? Math.round(food.nutrition.sugar * (nutritionResult.serving.weightGrams / Math.max(1, baseGrams)) * 10) / 10
        : undefined,
    };

    setItems(prev =>
      prev.map(item => {
        if (item.detectionId !== detectionId) return item;
        return {
          ...item,
          portionMultiplier: newMultiplier,
          estimatedGrams: nutritionResult.serving.weightGrams || estimatedGrams,
          nutrition: newNutrition,
          nutritionAvailable: nutritionResult.nutritionAvailable,
          micronutrients: nutritionResult.micronutrients,
          nutritionResult,
          isUserModified: true,
        };
      })
    );
  };

  // 6. Remove item
  const handleRemoveItem = (detectionId: string) => {
    setItems(prev => prev.filter(i => i.detectionId !== detectionId));
    setDetections(prev => prev.filter(d => d.id !== detectionId));
  };

  // 7. Change food match trigger ("Not correct?")
  const handleRequestChangeFood = (detectionId: string) => {
    setTargetChangeItemId(detectionId);
    setIsSelectorOpen(true);
  };

  // 8. Add extra food manually trigger
  const handleRequestAddFood = () => {
    setTargetChangeItemId(null);
    setIsSelectorOpen(true);
  };

  // 9. Quick swap from alternative visual candidate
  const handleSelectAlternative = async (detectionId: string, foodId: string) => {
    const food = await foodDatabaseService.getFoodById(foodId);
    if (!food) return;

    const existingDetection = detections.find(d => d.id === detectionId);
    if (existingDetection) {
      const updatedDetection = await replaceDetection(
        existingDetection,
        food,
        portionEstimationService
      );
      setDetections(prev =>
        prev.map(d => (d.id === detectionId ? updatedDetection : d))
      );

      const updatedMealItem = await detectionToMealItem(
        updatedDetection,
        foodDatabaseService,
        nutritionService
      );

      setItems(prev =>
        prev.map(item => (item.detectionId === detectionId ? updatedMealItem : item))
      );
    }
  };

  // 10. Process selection from FoodSelectorModal
  const handleFoodSelected = async (food: FoodItem) => {
    if (targetChangeItemId) {
      // Replace existing item
      const existingDetection = detections.find(d => d.id === targetChangeItemId);
      if (existingDetection) {
        const updatedDetection = await replaceDetection(
          existingDetection,
          food,
          portionEstimationService
        );
        setDetections(prev =>
          prev.map(d => (d.id === targetChangeItemId ? updatedDetection : d))
        );

        const updatedMealItem = await detectionToMealItem(
          updatedDetection,
          foodDatabaseService,
          nutritionService
        );

        setItems(prev =>
          prev.map(item => (item.detectionId === targetChangeItemId ? updatedMealItem : item))
        );
      }
    } else {
      // Add new item manually
      const manualDetection = await createManualDetection(
        food,
        portionEstimationService
      );
      setDetections(prev => [...prev, manualDetection]);

      const newMealItem = await detectionToMealItem(
        manualDetection,
        foodDatabaseService,
        nutritionService
      );
      setItems(prev => [...prev, newMealItem]);
    }
  };

  // 11. Reset scan
  const handleReset = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setValidationError(null);
    setIsAnalyzing(false);
    setStage('idle');
    setItems([]);
    setDetections([]);
    setRecognitionResult(null);
    setActiveImage(null);
    setSelectedScenarioId(null);
  };

  // Live aggregated nutrition totals
  const totalNutrition = nutritionService.aggregateNutrition(items);
  const macroDistribution = nutritionService.calculateMacroDistribution(totalNutrition);

  // User profile for personalized hostel and nutrient intelligence
  const profile = useUserProfile();

  // Phase 4: Live calculated meal nutrition across all foods
  const mealNutritionResult = useMemo(() => {
    if (items.length === 0) return null;
    const foodDbItems = items.map(item => {
      const food = foodDatabaseService.getFoodByIdSync(item.foodId);
      return {
        food,
        portion: {
          quantity: item.portionMultiplier,
          unit: item.portionUnit,
          weightGrams: item.estimatedGrams,
        },
      };
    });
    return nutritionService.calculateMealNutrition(foodDbItems);
  }, [items]);

  // Phase 5: Live calculated nutrient intelligence (5-star score, strengths, gaps, recommendations)
  const mealAnalysisResult = useMemo(() => {
    if (!mealNutritionResult) return null;
    return nutrientAnalysisService.analyzeMeal(mealNutritionResult, profile);
  }, [mealNutritionResult, profile]);

  // Handle one-click adding of recommended foods to the meal
  const handleAddRecommendation = async (foodId: string) => {
    const food = await foodDatabaseService.getFoodById(foodId);
    if (!food) return;
    await handleFoodSelected(food);
  };

  // 12. Finalize and proceed to full results page
  const handleProceedToResults = async () => {
    if (items.length === 0 || isProcessingFinal) return;
    setIsProcessingFinal(true);
    try {
      const profile = userProfileService.getProfile();
      const mealTitle =
        items.length === 1
          ? items[0].name
          : `${items[0].name} & Sides (${items.length} items)`;

      const analysis: MealAnalysis = await mealAnalysisService.analyzeMeal(
        items,
        mealTitle,
        activeImage?.uri,
        profile
      );

      // 1. Optimistic local persistence (instant and resilient offline guarantee)
      await mealHistoryService.saveMeal(analysis);

      // 2. Cloud persistence for authenticated users (await with fallback to eliminate race condition)
      if (user?.uid) {
        try {
          await firestoreMealHistoryService.saveMeal(user.uid, analysis);
        } catch (err) {
          console.warn('[ScanPage] Cloud meal persistence notice:', err);
        }
      }

      router.push(`/results?id=${analysis.id}`);
    } catch {
      router.push('/results');
    } finally {
      setIsProcessingFinal(false);
    }
  };

  const hasDetections = items.length > 0 && stage === 'detected';
  const isErrorState =
    stage === 'detected' && recognitionResult?.status === 'error';
  const isInvalidImageState =
    stage === 'detected' && recognitionResult?.status === 'invalid-image';
  const isNoFoodState =
    stage === 'detected' &&
    !isErrorState &&
    !isInvalidImageState &&
    (recognitionResult?.status === 'no-food-detected' || items.length === 0);

  return (
    <AuthGuard>
      <div className="py-6 sm:py-10">
        <Container size="lg">
        {/* Unified 3D SCAN FOOD Switcher */}
        <div className="flex flex-col items-center justify-center mb-6 space-y-2">
          <span className="text-3xs font-extrabold uppercase tracking-widest text-[#E86A33] dark:text-[#F4A340]">
            SCAN FOOD
          </span>
          <div className="card-3d inline-flex items-center p-1.5 bg-white dark:bg-[#1D1A17] border border-[#E8DED2] dark:border-[#38312A] rounded-2xl shadow-sm">
            <button
              type="button"
              onClick={() => setScanCategory('cooked')}
              className={`px-5 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                scanCategory === 'cooked'
                  ? 'bg-[#E86A33] text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-[#FAF7F2] dark:hover:bg-[#25211D]'
              }`}
            >
              <span>🍽️</span> <span>Meal</span>
            </button>
            <button
              type="button"
              onClick={() => setScanCategory('packaged')}
              className={`px-5 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                scanCategory === 'packaged'
                  ? 'bg-[#E86A33] text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-[#FAF7F2] dark:hover:bg-[#25211D]'
              }`}
            >
              <span>📦</span> <span>Barcode</span>
            </button>
          </div>
        </div>

        {scanCategory === 'cooked' ? (
          <>
            {/* Re-analyze Active Notice */}
            {isReanalyze && (
              <div className="max-w-xl mx-auto mb-4 p-3 rounded-2xl bg-[#FEF7EE] dark:bg-[#2A1C14] border border-[#F4A340]/40 text-[#C85320] dark:text-[#F4A340] flex items-center justify-center gap-2 shadow-xs">
                <RefreshCwIcon size={14} className="text-[#E86A33] dark:text-[#F4A340] shrink-0 animate-spin" />
                <span className="font-semibold">Re-analyzing: Previous meal cleared. Capture your new plate to analyze.</span>
              </div>
            )}

            {/* Header */}
            <div className="text-center max-w-xl mx-auto mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-2xs font-bold tracking-widest text-[#E86A33] dark:text-[#F4A340] uppercase px-3 py-1 rounded-full bg-[#F3EDE4] dark:bg-[#25211D] border border-[#E8DED2] dark:border-[#38312A] inline-block">
              Perception Pipeline • Phase 3
            </span>
          </div>

          {/* Mode Switcher: Gemini AI Vision vs Mock Simulation */}
          <div className="inline-flex items-center gap-1 p-1 bg-[#F3EDE4] dark:bg-[#1D1A17] border border-[#E8DED2] dark:border-[#38312A] rounded-full mb-3 shadow-2xs">
            <button
              type="button"
              onClick={() => {
                foodRecognitionService.setMode('gemini');
                setRecognitionMode('gemini');
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                recognitionMode === 'gemini'
                  ? 'bg-[#7C6CE7] text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              ✨ Gemini AI Vision
            </button>
            <button
              type="button"
              onClick={() => {
                foodRecognitionService.setMode('mock');
                setRecognitionMode('mock');
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                recognitionMode === 'mock'
                  ? 'bg-stone-800 text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              🧪 Mock Simulation
            </button>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-stone-100 tracking-tight">
            Scan Your Meal
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-1.5">
            Identify single snacks, multi-dish canteen plates, and packaged foods with computer vision.
          </p>
        </div>

        {/* Profile Completion Callout if Incomplete */}
        {!profile.onboardingCompleted && (
          <div className="max-w-2xl mx-auto mb-6 p-3 sm:p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-950 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">💡</span>
              <div className="space-y-0.5">
                <span className="font-bold block">General Nutrition Mode</span>
                <span className="text-2xs text-amber-900 dark:text-amber-300 leading-snug">
                  Complete your profile for personalized energy targets and campus-tailored recommendations.
                </span>
              </div>
            </div>
            <Link
              href="/onboarding"
              className="px-3 py-1.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-bold text-2xs transition-colors shrink-0 text-center"
            >
              Complete Profile →
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
          {/* Left Column: Camera Viewport (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            <ScanViewport
              stage={stage}
              items={items}
              previewUrl={previewUrl}
              selectedScenarioId={selectedScenarioId || undefined}
              validationError={validationError}
              isAnalyzing={isAnalyzing}
              onCapture={handleCapture}
              onStartAnalysis={handleStartAnalysis}
              onUploadFile={handleUploadFile}
              onAnalysisComplete={handleAnalysisComplete}
              onReset={handleReset}
              onSelectSample={handleSelectSample}
              onClearValidationError={() => setValidationError(null)}
            />

            {/* Architecture Separation & Confidence Notice */}
            <div className="p-3.5 rounded-2xl bg-stone-100 dark:bg-[#1D1A17] border border-stone-200 dark:border-[#38312A] text-xs text-stone-600 dark:text-stone-400 flex items-start gap-2.5">
              <InfoIcon size={16} className="text-stone-500 shrink-0 mt-0.5" />
              <div className="space-y-0.5 leading-relaxed">
                <span className="font-semibold text-stone-800 dark:text-stone-200">
                  Confidence Notice:
                </span>{' '}
                Confidence percentages indicate visual pattern match against our regional dish models, not nutritional certainty. All portions are estimates.
              </div>
            </div>
          </div>

          {/* Right Column: Identification Feedback & Review (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Stage: Idle - Require New Image */}
            {stage === 'idle' && (
              <Card className="border-stone-200/90 dark:border-[#38312A] bg-white dark:bg-[#1D1A17] shadow-sm">
                <CardContent className="p-6 sm:p-8 text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#FEF7EE] dark:bg-[#2A1C14] text-[#E86A33] flex items-center justify-center mx-auto shadow-inner">
                    <CameraIcon size={26} />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100">
                      Capture a new meal to analyze
                    </h2>
                    <p className="text-xs text-stone-600 dark:text-stone-400 mt-1 leading-relaxed max-w-sm mx-auto">
                      Point your camera at your food plate and tap &quot;Capture Plate&quot;, or upload a meal photo to identify actual dishes.
                    </p>
                  </div>
                  <div className="pt-2">
                    <Button
                      onClick={() => {
                        const enableBtn = document.getElementById('enable-camera-btn');
                        if (enableBtn) enableBtn.click();
                      }}
                      fullWidth
                      size="lg"
                      leftIcon={<CameraIcon size={16} />}
                    >
                      Start Camera Scanner
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Stage: Preview */}
            {stage === 'preview' && (
              <Card className="border-emerald-200/90 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/20 shadow-sm">
                <CardContent className="p-6 sm:p-8 text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center mx-auto shadow-inner">
                    <SparklesIcon size={26} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                      Photo Ready for Analysis
                    </h2>
                    <p className="text-xs text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
                      Review your food photo preview. Ensure the meal is well-lit and all items are visible before running recognition.
                    </p>
                  </div>
                  <div className="space-y-2 pt-1">
                    <Button
                      onClick={handleStartAnalysis}
                      fullWidth
                      size="lg"
                      disabled={isAnalyzing}
                      isLoading={isAnalyzing}
                      leftIcon={<SparklesIcon size={16} />}
                    >
                      Analyze Meal
                    </Button>
                    <Button
                      onClick={handleReset}
                      fullWidth
                      variant="outline"
                      size="md"
                      disabled={isAnalyzing}
                    >
                      Retake Photo
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Stage: Analyzing Feedback ("Identifying your food...") */}
            {stage === 'analyzing' && (
              <Card className="border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm">
                <CardContent className="p-8 text-center space-y-3">
                  <div className="inline-block w-9 h-9 border-3 border-emerald-700 dark:border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                    Identifying your food...
                  </h2>
                  <p className="text-xs text-stone-600 dark:text-stone-400 max-w-xs mx-auto leading-relaxed">
                    Executing vision segmentation, matching against regional recipes, and estimating volumetric portion weights.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* ERROR STATE: General Error / API / Timeout */}
            {isErrorState && (
              <Card className="border-rose-200 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20 shadow-sm">
                <CardContent className="p-6 sm:p-7 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 flex items-center justify-center mx-auto">
                    <AlertCircleIcon size={24} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-rose-950 dark:text-rose-200">
                      Couldn&apos;t confidently identify the food in this image
                    </h3>
                    <p className="text-xs text-rose-900 dark:text-rose-300 mt-1 leading-relaxed">
                      {recognitionResult?.errorMessage ||
                        "Track-a-Bite couldn't identify the food at this moment. Try taking a clearer photo or enter manually."}
                    </p>
                  </div>
                  <div className="pt-2 space-y-2">
                    <Button
                      fullWidth
                      variant="primary"
                      onClick={handleStartAnalysis}
                      disabled={isAnalyzing}
                      leftIcon={<RefreshCwIcon size={15} />}
                    >
                      Try Again
                    </Button>
                    <Button fullWidth variant="outline" onClick={handleReset}>
                      Retake Photo
                    </Button>
                    <Button
                      fullWidth
                      variant="subtle"
                      onClick={handleRequestAddFood}
                      leftIcon={<PlusIcon size={15} />}
                    >
                      Choose Food Manually
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ERROR STATE: No Food Detected */}
            {isNoFoodState && (
              <Card className="border-amber-200 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20 shadow-sm">
                <CardContent className="p-6 sm:p-7 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center justify-center mx-auto">
                    <AlertCircleIcon size={24} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-amber-950 dark:text-amber-200">
                      No Food Detected
                    </h3>
                    <p className="text-xs text-amber-900 dark:text-amber-300 mt-1 leading-relaxed">
                      {recognitionResult?.errorMessage ||
                        "We couldn't detect recognizable foods in this image. Please ensure your plate is clearly framed."}
                    </p>
                  </div>
                  <div className="pt-2 space-y-2">
                    <Button
                      fullWidth
                      variant="primary"
                      onClick={handleStartAnalysis}
                      disabled={isAnalyzing}
                      leftIcon={<RefreshCwIcon size={15} />}
                    >
                      Try Again
                    </Button>
                    <Button fullWidth variant="outline" onClick={handleReset}>
                      Retake Photo
                    </Button>
                    <Button
                      fullWidth
                      variant="subtle"
                      onClick={handleRequestAddFood}
                      leftIcon={<PlusIcon size={15} />}
                    >
                      Choose Food Manually
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ERROR STATE: Invalid Image */}
            {isInvalidImageState && (
              <Card className="border-rose-200 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20 shadow-sm">
                <CardContent className="p-6 sm:p-7 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 flex items-center justify-center mx-auto">
                    <AlertCircleIcon size={24} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-rose-950 dark:text-rose-200">
                      Invalid or Corrupted Image
                    </h3>
                    <p className="text-xs text-rose-900 dark:text-rose-300 mt-1 leading-relaxed">
                      {recognitionResult?.errorMessage ||
                        'Unable to decode the visual frame. Please capture another image.'}
                    </p>
                  </div>
                  <div className="pt-2 space-y-2">
                    <Button fullWidth variant="outline" onClick={handleReset}>
                      Retake Photo
                    </Button>
                    <Button
                      fullWidth
                      variant="subtle"
                      onClick={handleRequestAddFood}
                      leftIcon={<PlusIcon size={15} />}
                    >
                      Enter Food Manually
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Stage: Detected / Reviewing */}
            {hasDetections && (
              <div className="space-y-4 animate-in fade-in duration-300">
                {/* Low-confidence warning banner if flagged */}
                {recognitionResult?.status === 'low-confidence' && (
                  <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                    <AlertCircleIcon size={16} className="text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">Low-Confidence Detection</span>
                      <p className="text-2xs text-amber-800 dark:text-amber-300 mt-0.5">
                        {recognitionResult.confidenceWarning ||
                          "We couldn't confidently identify this food. Tap 'Not correct?' to select your exact dish."}
                      </p>
                    </div>
                  </div>
                )}

                {/* Detected Food Card List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                        Detected ({items.length})
                      </span>
                      {items.length > 1 && (
                        <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                          Multi-Food Plate
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleRequestAddFood}
                      className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <PlusIcon size={13} />
                      <span>Add Extra Item</span>
                    </button>
                  </div>

                  {items.map(item => {
                    const matchingDetection = detections.find(d => d.id === item.detectionId);
                    return (
                      <FoodDetectionCard
                        key={item.detectionId}
                        item={item}
                        alternativeCandidates={matchingDetection?.candidateMatches}
                        onUpdatePortion={handleUpdatePortion}
                        onRemoveItem={handleRemoveItem}
                        onRequestChangeFood={handleRequestChangeFood}
                        onSelectAlternative={handleSelectAlternative}
                        canRemove={items.length > 1}
                      />
                    );
                  })}
                </div>

                {/* Aggregated Macro Preview & Proceed */}
                <Card className="border-stone-200 dark:border-[#38312A] bg-white dark:bg-[#1D1A17] shadow-sm">
                  <CardContent className="p-4 sm:p-5 space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-stone-100 dark:border-[#38312A]">
                      <div>
                        <span className="text-xs font-bold text-stone-800 dark:text-stone-200 block">
                          Total Meal Estimation
                        </span>
                        <span className="text-3xs text-stone-500 dark:text-stone-400">
                          {items.length} item{items.length > 1 ? 's' : ''} combined
                        </span>
                      </div>
                      <span className="text-sm font-extrabold text-[#E86A33] dark:text-[#F4A340]">
                        {totalNutrition.calories} kcal
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
                      <div className="p-2 rounded-xl bg-[#FEF7EE] dark:bg-[#251A14] border border-[#FBD5BD] dark:border-[#4D2918]">
                        <span className="block text-3xs text-[#E86A33] font-semibold uppercase">Protein</span>
                        <span className="text-sm font-bold text-[#E86A33] dark:text-[#F4A340]">{totalNutrition.protein}g</span>
                      </div>
                      <div className="p-2 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40">
                        <span className="block text-3xs text-amber-700 dark:text-amber-400 font-semibold uppercase">Carbs</span>
                        <span className="text-sm font-bold text-amber-900 dark:text-amber-200">{totalNutrition.carbohydrates}g</span>
                      </div>
                      <div className="p-2 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40">
                        <span className="block text-3xs text-rose-700 dark:text-rose-400 font-semibold uppercase">Fat</span>
                        <span className="text-sm font-bold text-rose-900 dark:text-rose-200">{totalNutrition.fat}g</span>
                      </div>
                      <div className="p-2 rounded-xl bg-[#F0FDF4] dark:bg-[#15251C] border border-[#3F8F68]/30 dark:border-[#3F8F68]/40">
                        <span className="block text-3xs text-[#3F8F68] dark:text-[#5FA77F] font-semibold uppercase">Fiber</span>
                        <span className="text-sm font-bold text-[#2E6B4E] dark:text-[#5FA77F]">{totalNutrition.fiber}g</span>
                      </div>
                    </div>

                    <MacroDistributionBar distribution={macroDistribution} />

                    {/* Saving Status Feedback Banner */}
                    {isProcessingFinal && (
                      <div className="p-3 rounded-xl bg-[#FEF7EE] dark:bg-[#2A1C14] border border-[#FBD5BD] dark:border-[#4D2918] text-[#E86A33] text-xs flex items-center gap-2 animate-pulse" role="status">
                        <span className="w-2 h-2 rounded-full bg-[#E86A33] animate-ping shrink-0" />
                        <span className="font-semibold">
                          {user?.uid ? 'Syncing meal to your cloud nutrition journal...' : 'Saving meal to local nutrition journal...'}
                        </span>
                      </div>
                    )}

                    {/* Proceed Button */}
                    <Button
                      fullWidth
                      size="lg"
                      onClick={handleProceedToResults}
                      isLoading={isProcessingFinal}
                      rightIcon={<ArrowRightIcon size={18} />}
                      className="mt-2"
                    >
                      {isProcessingFinal ? 'Saving to Nutrition Journal...' : 'View Richness & Upgrades'}
                    </Button>

                    {/* Subtle Accuracy Disclaimer */}
                    <p className="text-3xs text-center text-stone-500 dark:text-stone-400 pt-1 leading-relaxed">
                      * Nutrition values are estimates based on standard regional reference food data and confirmed portion size, not laboratory measurements.
                    </p>
                  </CardContent>
                </Card>

                {/* Phase 5: 5-Star Nutrient Intelligence & Recommended Additions */}
                {mealAnalysisResult && (
                  <MealIntelligenceCard
                    analysis={mealAnalysisResult}
                    onAddRecommendation={handleAddRecommendation}
                    isHostelite={profile.isHostelite}
                  />
                )}

                {/* Contextual Educational Disclaimer */}
                <DisclaimerBanner variant="subtle" className="mt-4" />
              </div>
            )}
          </div>
        </div>
        </>
        ) : (
          <div className="space-y-6">
            <div className="text-center max-w-xl mx-auto mb-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-2xs font-bold tracking-widest text-[#E86A33] uppercase px-3 py-1 rounded-full bg-[#FEF7EE] dark:bg-[#2A1C14] border border-[#FBD5BD] dark:border-[#4D2918] inline-block">
                  Barcode &amp; Package Intelligence
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-stone-100 tracking-tight">
                Scan Packaged Food
              </h1>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-1.5">
                Scan product barcodes to inspect nutrition, ingredients, and verify package expiry dates.
              </p>
            </div>

            <div className="max-w-2xl mx-auto space-y-6">
              {!scannedProduct ? (
                barcodeLookupError ? (
                  /* Dedicated Product Not Found Card (replaces scanner so user doesn't silently remain on frozen camera) */
                  <div className="bg-white dark:bg-[#1D1A17] rounded-3xl border border-stone-200 dark:border-[#38312A] text-stone-900 dark:text-stone-100 shadow-md overflow-hidden transition-all">
                    {/* Header */}
                    <div className="bg-stone-900 dark:bg-[#151311] px-5 py-3 text-white flex items-center justify-between border-b border-stone-800 dark:border-[#38312A]">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🔳</span>
                        <span className="text-xs font-extrabold tracking-wider uppercase text-[#E86A33] dark:text-[#F4A340]">
                          Barcode Detected
                        </span>
                      </div>
                      <span className="text-2xs font-mono text-stone-400 bg-stone-800 dark:bg-[#25211D] px-2.5 py-1 rounded-md">
                        {scannedFormat || 'EAN-13'}: {scannedBarcode}
                      </span>
                    </div>

                    <div className="p-6 sm:p-8 text-center space-y-5">
                      <div className={`w-16 h-16 rounded-full border flex items-center justify-center mx-auto shadow-xs ${
                        barcodeLookupError?.toLowerCase().includes('unavailable')
                          ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800/60 text-amber-600 dark:text-amber-400'
                          : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400'
                      }`}>
                        <AlertCircleIcon size={32} />
                      </div>

                      <div className="space-y-2 max-w-md mx-auto">
                        <h2 className="text-xl sm:text-2xl font-extrabold text-stone-900 dark:text-stone-100 leading-tight">
                          {barcodeLookupError?.toLowerCase().includes('unavailable')
                            ? 'Discovery Services Unavailable'
                            : 'Product Not Found'}
                        </h2>
                        <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
                          {barcodeLookupError || 'Barcode was verified, but no reliable product match was found.'}
                        </p>
                      </div>

                      <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#25211D] border border-stone-200 dark:border-[#38312A] text-left text-xs text-stone-600 dark:text-stone-400 space-y-2 max-w-md mx-auto">
                        <span className="font-bold text-stone-800 dark:text-stone-200 block">
                          Detection Verified:
                        </span>
                        <ul className="list-disc list-inside space-y-1 text-2xs text-stone-500 dark:text-stone-400 leading-relaxed">
                          <li>
                            Barcode <span className="font-mono font-bold text-stone-700 dark:text-stone-300">{scannedBarcode}</span> was accurately captured by the scanner.
                          </li>
                          {barcodeLookupError?.toLowerCase().includes('unavailable') ? (
                            <li>
                              External product discovery catalogs are temporarily unreachable from the server.
                            </li>
                          ) : (
                            <li>
                              The barcode was successfully read, but no sufficiently reliable product match was found.
                            </li>
                          )}
                          <li>
                            You can scan another barcode or enter the digits manually.
                          </li>
                        </ul>
                      </div>

                      <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={handleResetPackaged}
                          className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-[#E86A33] hover:bg-[#d65f2c] text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
                        >
                          <RefreshCwIcon size={14} /> Scan Another Barcode
                        </button>
                        <button
                          type="button"
                          onClick={handleResetPackaged}
                          className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer border border-stone-300 dark:border-stone-700"
                        >
                          ⌨️ Enter Barcode Manually
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <BarcodeScannerViewport
                      onBarcodeDetected={handleBarcodeDetected}
                      isProcessing={isLookingUpBarcode}
                    />

                    <div className="p-4 rounded-2xl bg-stone-100 dark:bg-[#1D1A17] border border-stone-200 dark:border-[#38312A] text-xs text-stone-600 dark:text-stone-400 flex items-start gap-2.5">
                      <InfoIcon size={16} className="text-stone-500 shrink-0 mt-0.5" />
                      <div className="space-y-0.5 leading-relaxed">
                        <span className="font-semibold text-stone-800 dark:text-stone-200">
                          Zero Hallucination Guarantee:
                        </span>{' '}
                        Barcodes identify products and official nutrition facts. Manufacturing and expiry dates are never fabricated; they are verified using optical text recognition directly from printed package stamps.
                      </div>
                    </div>
                  </div>
                )
              ) : (
                <PackagedFoodResultCard
                  product={scannedProduct}
                  onOpenOcr={() => setIsOcrModalOpen(true)}
                  onAddToMeal={handleSavePackagedMeal}
                  onReset={handleResetPackaged}
                  isSaving={isSavingPackagedMeal}
                />
              )}
            </div>
          </div>
        )}

        {/* Food Selector Modal for Customizing / Swapping Items */}
        <FoodSelectorModal
          isOpen={isSelectorOpen}
          onClose={() => setIsSelectorOpen(false)}
          onSelectFood={handleFoodSelected}
          title={targetChangeItemId ? 'Change Food Identification' : 'Add Item to Plate'}
          description={
            targetChangeItemId
              ? 'Select the dish or snack that was actually on your plate instead of the auto-detected item.'
              : 'Add any side dish, banana, boiled egg, curd, or drink to your meal.'
          }
        />

        {/* Package OCR Scanner Modal for Printed Dates */}
        <PackageOcrScanner
          isOpen={isOcrModalOpen}
          onClose={() => setIsOcrModalOpen(false)}
          onApplyDetails={handleApplyPackageDetails}
          currentDetails={scannedProduct?.packageDetails}
        />
      </Container>
    </div>
    </AuthGuard>
  );
}

export default function ScanPage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 text-center">
          <div className="inline-block w-8 h-8 border-3 border-emerald-700 dark:border-emerald-400 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm text-stone-600 dark:text-stone-400 font-medium">Opening Food Scanner...</p>
        </div>
      }
    >
      <ScanContent />
    </Suspense>
  );
}
