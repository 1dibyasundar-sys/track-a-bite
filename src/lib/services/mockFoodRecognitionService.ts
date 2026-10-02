import {
  IFoodRecognitionService,
  FoodRecognitionResult,
  FoodDetection,
  AppImage,
  RecognitionOptions,
  MockScenarioInfo,
  getConfidenceTier,
} from '../types';
import { portionEstimationService } from './portionEstimationService';
import { groupDetectionsByFoodIdentity } from './foodGroupingService';
import { mealCompositionService } from './mealCompositionService';
import { INDIAN_FOOD_DATABASE } from '../../data/foods';
import { getRegionalFoodReference } from '../data/regionalReferences';

interface ScenarioDefinition {
  id: string;
  label: string;
  description: string;
  status: FoodRecognitionResult['status'];
  items: Array<{
    foodId: string;
    confidence: number;
    bbox?: { x: number; y: number; width: number; height: number };
    alternatives?: Array<{ foodId: string; name: string; confidence: number }>;
    portion?: { quantity: number; unit: import('../types').PortionUnit };
    fallbackDescription?: string;
  }>;
  confidenceWarning?: string;
  errorMessage?: string;
}

const DETERMINISTIC_SCENARIOS: ScenarioDefinition[] = [
  {
    id: 'multi-thali-4food',
    label: 'Hostel Thali (Rice, Dal, Sabzi, Pickle)',
    description: 'Plate containing Steamed Rice, Dal Tadka, Mixed Vegetable Curry, and Mango Pickle.',
    status: 'success',
    items: [
      {
        foodId: 'steamed-rice',
        confidence: 0.94,
        bbox: { x: 12, y: 15, width: 38, height: 35 },
      },
      {
        foodId: 'dal-tadka',
        confidence: 0.91,
        bbox: { x: 55, y: 12, width: 35, height: 32 },
        alternatives: [
          { foodId: 'sambar', name: 'Sambar', confidence: 0.65 },
          { foodId: 'chole-masala', name: 'Chole Masala', confidence: 0.58 },
        ],
      },
      {
        foodId: 'vegetable-curry',
        confidence: 0.88,
        bbox: { x: 52, y: 50, width: 38, height: 38 },
        alternatives: [
          { foodId: 'aloo-curry', name: 'Potato Curry', confidence: 0.68 },
          { foodId: 'palak-paneer', name: 'Palak Paneer', confidence: 0.42 },
        ],
      },
      {
        foodId: 'mango-pickle',
        confidence: 0.90,
        bbox: { x: 15, y: 55, width: 20, height: 20 },
        alternatives: [
          { foodId: 'mint-chutney', name: 'Mint Chutney', confidence: 0.62 },
        ],
      },
    ],
  },
  {
    id: 'thali-multi-compartment',
    label: 'Hostel Thali (2 Curry Compartments + Papad)',
    description: 'Mess thali with Steamed Rice, Dal, 2 physical compartments of Mixed Vegetable Curry (80g + 70g), Papad, and Pickle.',
    status: 'success',
    items: [
      {
        foodId: 'steamed-rice',
        confidence: 0.94,
        bbox: { x: 10, y: 35, width: 45, height: 40 },
      },
      {
        foodId: 'dal-tadka',
        confidence: 0.91,
        bbox: { x: 55, y: 15, width: 35, height: 30 },
      },
      {
        foodId: 'vegetable-curry',
        confidence: 0.86,
        bbox: { x: 12, y: 10, width: 20, height: 20 },
        portion: { quantity: 80, unit: 'g' },
      },
      {
        foodId: 'vegetable-curry',
        confidence: 0.88,
        bbox: { x: 34, y: 10, width: 18, height: 20 },
        portion: { quantity: 70, unit: 'g' },
      },
      {
        foodId: 'roasted-papad',
        confidence: 0.95,
        bbox: { x: 60, y: 50, width: 28, height: 28 },
      },
      {
        foodId: 'mango-pickle',
        confidence: 0.90,
        bbox: { x: 12, y: 78, width: 15, height: 15 },
        portion: { quantity: 15, unit: 'g' },
      },
    ],
  },
  {
    id: 'thali-with-salad',
    label: 'Full Thali with Fresh Salad',
    description: 'Hostel thali with Steamed Rice, Dal Tadka, Mixed Vegetable Curry, and Fresh Kachumber Salad.',
    status: 'success',
    items: [
      {
        foodId: 'steamed-rice',
        confidence: 0.94,
        bbox: { x: 12, y: 15, width: 38, height: 35 },
      },
      {
        foodId: 'dal-tadka',
        confidence: 0.91,
        bbox: { x: 55, y: 12, width: 35, height: 32 },
      },
      {
        foodId: 'vegetable-curry',
        confidence: 0.88,
        bbox: { x: 52, y: 50, width: 38, height: 38 },
      },
      {
        foodId: 'kachumber-salad',
        confidence: 0.92,
        bbox: { x: 15, y: 55, width: 30, height: 32 },
      },
    ],
  },
  {
    id: 'kachori-chutney',
    label: 'Kachori with Green Chutney',
    description: 'Crisp khasta kachori served with fresh spicy mint & coriander chutney.',
    status: 'success',
    items: [
      {
        foodId: 'kachori',
        confidence: 0.93,
        bbox: { x: 20, y: 20, width: 45, height: 45 },
      },
      {
        foodId: 'mint-chutney',
        confidence: 0.91,
        bbox: { x: 65, y: 50, width: 25, height: 25 },
      },
    ],
  },
  {
    id: 'chips-juice',
    label: 'Chips & Packaged Juice',
    description: 'Packaged potato chips paired with tetra pack fruit juice.',
    status: 'success',
    items: [
      {
        foodId: 'potato-chips',
        confidence: 0.95,
        bbox: { x: 18, y: 20, width: 40, height: 45 },
      },
      {
        foodId: 'packaged-juice',
        confidence: 0.93,
        bbox: { x: 60, y: 15, width: 30, height: 60 },
      },
    ],
  },
  {
    id: 'sprouts-chaat',
    label: 'Campus Sprouts Chaat',
    description: 'Roadside boiled sprouted green gram and kala chana with lemon juice and amchur.',
    status: 'success',
    items: [
      {
        foodId: 'sprouts-chaat',
        confidence: 0.93,
        bbox: { x: 20, y: 18, width: 60, height: 62 },
        alternatives: [
          { foodId: 'chana-chaat', name: 'Kala Chana Chaat', confidence: 0.72 },
        ],
      },
    ],
  },
  {
    id: 'kachori-snack',
    label: 'Canteen Kachori (2 Pieces)',
    description: 'Flaky khasta moong dal kachori served at college tea stalls.',
    status: 'success',
    items: [
      {
        foodId: 'kachori',
        confidence: 0.91,
        bbox: { x: 22, y: 20, width: 56, height: 58 },
        alternatives: [
          { foodId: 'samosa', name: 'Samosa', confidence: 0.64 },
          { foodId: 'bread-pakora', name: 'Bread Pakora', confidence: 0.45 },
        ],
      },
    ],
  },
  {
    id: 'chips-lays',
    label: 'Lays / Packaged Potato Chips',
    description: 'Crispy fried packaged salted and spiced potato wafers.',
    status: 'success',
    items: [
      {
        foodId: 'potato-chips',
        confidence: 0.96,
        bbox: { x: 20, y: 20, width: 60, height: 55 },
      },
    ],
  },
  {
    id: 'fresh-banana',
    label: 'Fresh Desi Banana',
    description: 'Whole ripe yellow fruit purchased from gate vendor.',
    status: 'success',
    items: [
      {
        foodId: 'banana',
        confidence: 0.97,
        bbox: { x: 25, y: 28, width: 50, height: 45 },
      },
    ],
  },
  {
    id: 'boiled-egg',
    label: '2 Boiled Eggs',
    description: 'Peeled hard-boiled country eggs from campus tea stall.',
    status: 'success',
    items: [
      {
        foodId: 'boiled-eggs',
        confidence: 0.95,
        bbox: { x: 28, y: 24, width: 44, height: 52 },
      },
    ],
  },
  {
    id: 'canteen-samosa-juice',
    label: 'Samosa & Packaged Juice',
    description: 'Golden fried potato samosa paired with packaged mixed fruit juice.',
    status: 'success',
    items: [
      {
        foodId: 'samosa',
        confidence: 0.94,
        bbox: { x: 18, y: 22, width: 42, height: 48 },
        alternatives: [{ foodId: 'kachori', name: 'Kachori', confidence: 0.62 }],
      },
      {
        foodId: 'packaged-juice',
        confidence: 0.92,
        bbox: { x: 62, y: 18, width: 28, height: 60 },
      },
    ],
  },
  {
    id: 'hostel-maggi-egg',
    label: 'Hostel Maggi & Boiled Egg',
    description: 'Late-night instant noodles paired with a hard-boiled egg.',
    status: 'success',
    items: [
      {
        foodId: 'hostel-maggi',
        confidence: 0.92,
        bbox: { x: 15, y: 15, width: 50, height: 55 },
      },
      {
        foodId: 'boiled-eggs',
        confidence: 0.95,
        bbox: { x: 68, y: 30, width: 22, height: 35 },
      },
    ],
  },
  {
    id: 'pakhala-bhata-thali',
    label: 'Odia Pakhala Thali (Pakhala, Dalma, Papad, Pickle)',
    description: 'Traditional summer meal with fermented water rice, lentil & vegetable stew, roasted papad, and pickle.',
    status: 'success',
    items: [
      {
        foodId: 'pakhala-bhata',
        confidence: 0.93,
        bbox: { x: 10, y: 35, width: 45, height: 45 },
        portion: { quantity: 1, unit: 'bowl' },
      },
      {
        foodId: 'dalma',
        confidence: 0.91,
        bbox: { x: 55, y: 15, width: 35, height: 35 },
        portion: { quantity: 1, unit: 'bowl' },
      },
      {
        foodId: 'roasted-papad',
        confidence: 0.95,
        bbox: { x: 60, y: 55, width: 28, height: 28 },
        portion: { quantity: 1, unit: 'piece' },
      },
      {
        foodId: 'mango-pickle',
        confidence: 0.90,
        bbox: { x: 15, y: 80, width: 15, height: 15 },
        portion: { quantity: 15, unit: 'g' },
      },
    ],
  },
  {
    id: 'regional-chakuli-dalma',
    label: 'Chakuli Pitha with Dalma',
    description: 'Soft Odia fermented rice & urad dal crepes paired with vegetable-lentil dalma.',
    status: 'success',
    items: [
      {
        foodId: 'chakuli-pitha',
        confidence: 0.91,
        bbox: { x: 15, y: 20, width: 45, height: 50 },
        portion: { quantity: 2, unit: 'piece' },
      },
      {
        foodId: 'dalma',
        confidence: 0.90,
        bbox: { x: 60, y: 25, width: 35, height: 40 },
        portion: { quantity: 1, unit: 'bowl' },
      },
    ],
  },
  {
    id: 'street-dahi-bara',
    label: 'Cuttack Dahi Bara',
    description: 'Soaked urad dal dumplings in spiced thin yogurt water with roasted cumin.',
    status: 'success',
    items: [
      {
        foodId: 'dahi-bara',
        confidence: 0.94,
        bbox: { x: 20, y: 20, width: 60, height: 60 },
        portion: { quantity: 2, unit: 'piece' },
      },
    ],
  },
  {
    id: 'poha-breakfast',
    label: 'Kanda Poha with Peanuts',
    description: 'Turmeric flattened rice with crunchy peanuts, curry leaves, and mustard seeds.',
    status: 'success',
    items: [
      {
        foodId: 'poha',
        confidence: 0.92,
        bbox: { x: 20, y: 20, width: 60, height: 60 },
        portion: { quantity: 1, unit: 'bowl' },
      },
    ],
  },
  {
    id: 'vegetable-upma-breakfast',
    label: 'Vegetable Upma',
    description: 'Savory roasted semolina porridge with diced carrots, peas, and tempered spices.',
    status: 'success',
    items: [
      {
        foodId: 'vegetable-upma',
        confidence: 0.90,
        bbox: { x: 20, y: 20, width: 60, height: 60 },
        portion: { quantity: 1, unit: 'bowl' },
      },
    ],
  },
  {
    id: 'unfamiliar-vegetable-curry',
    label: 'Uncertain Homestyle Sabzi (Fallback)',
    description: 'Ambiguous spiced cooked vegetable preparation triggering honest fallback.',
    status: 'low-confidence',
    items: [
      {
        foodId: 'vegetable-curry',
        confidence: 0.54,
        bbox: { x: 25, y: 25, width: 50, height: 50 },
        fallbackDescription: 'Food appears to be an Indian vegetable curry, but exact dish identification is uncertain.',
      },
    ],
  },
  {
    id: 'low-confidence-curry',
    label: 'Unclear Mixed Gravy (Low Confidence)',
    description: 'A dim/blurry canteen curry where computer vision has uncertainty.',
    status: 'low-confidence',
    confidenceWarning:
      "We couldn't confidently identify this food (48% match). Tap 'Not correct?' to pick your exact dish.",
    items: [
      {
        foodId: 'aloo-curry',
        confidence: 0.48,
        bbox: { x: 25, y: 25, width: 50, height: 50 },
        alternatives: [
          { foodId: 'dal-tadka', name: 'Dal Tadka', confidence: 0.46 },
          { foodId: 'sambar', name: 'Sambar', confidence: 0.41 },
          { foodId: 'palak-paneer', name: 'Palak Paneer', confidence: 0.35 },
        ],
      },
    ],
  },
  {
    id: 'empty-plate-no-food',
    label: 'Empty Plate / Non-Food Surface',
    description: 'Test case simulating an empty plate, napkin, or non-food photograph.',
    status: 'no-food-detected',
    errorMessage:
      'No recognizable food items found on this plate or surface. Try centering food under overhead light or choose manually.',
    items: [],
  },
  {
    id: 'invalid-image',
    label: 'Corrupted / Invalid Image',
    description: 'Test case simulating an unreadable image or corrupted camera capture.',
    status: 'invalid-image',
    errorMessage:
      'Unable to process the visual frame. The image file appears empty or unsupported.',
    items: [],
  },
];

export class MockFoodRecognitionService implements IFoodRecognitionService {
  private scenarios = DETERMINISTIC_SCENARIOS;

  getAvailableMockScenarios(): MockScenarioInfo[] {
    return this.scenarios.map(s => ({
      id: s.id,
      label: s.label,
      description: s.description,
      expectedDetections: s.items.map(i => {
        const food = INDIAN_FOOD_DATABASE.find(f => f.id === i.foodId);
        return food ? food.name : i.foodId;
      }),
      isMultiFood: s.items.length > 1,
      isLowConfidence: s.status === 'low-confidence',
      isNoFood: s.status === 'no-food-detected' || s.status === 'invalid-image',
    }));
  }

  async recognizeFood(
    image: AppImage,
    options?: RecognitionOptions
  ): Promise<FoodRecognitionResult> {
    const startTime = Date.now();

    // Validate image presence
    if (!image || (!image.uri && !image.file && !image.blob && !image.scenarioHintId)) {
      return {
        imageId: image?.id || `img-${Date.now()}`,
        model: 'trackabite-vision-mock-v2.0',
        processingTimeMs: 120,
        status: 'invalid-image',
        detections: [],
        errorMessage: 'No valid image data was received by the recognition pipeline.',
      };
    }

    // Determine deterministic scenario
    let targetScenarioId = options?.scenarioHintId || image.scenarioHintId;

    if (!targetScenarioId && image.file?.name) {
      const normalizedName = image.file.name.toLowerCase();
      const match = this.scenarios.find(s => normalizedName.includes(s.id));
      if (match) targetScenarioId = match.id;
    }

    // Default to multi-food thali for realistic demo if unhinted
    const scenario =
      this.scenarios.find(s => s.id === targetScenarioId) || this.scenarios[0];

    // Simulate realistic asynchronous perception latency (600ms - 850ms)
    await new Promise(res => setTimeout(res, 680));

    // Handle error / empty states
    if (scenario.status === 'no-food-detected' || scenario.status === 'invalid-image') {
      return {
        imageId: image.id,
        model: 'trackabite-vision-mock-v2.0',
        processingTimeMs: Date.now() - startTime,
        status: scenario.status,
        detections: [],
        errorMessage: scenario.errorMessage,
        imageMetadata: {
          sourceType: image.sourceType,
          quality: 'good',
        },
      };
    }

    // Build typed FoodDetection list
    const detections: FoodDetection[] = [];

    for (let idx = 0; idx < scenario.items.length; idx++) {
      const item = scenario.items[idx];
      const regionalRef = getRegionalFoodReference(item.foodId);
      const isResearched = Boolean(regionalRef);
      const foodItem = INDIAN_FOOD_DATABASE.find(f => f.id === item.foodId) || regionalRef;
      const name = foodItem ? foodItem.name : item.foodId;
      const hindiName = foodItem?.localNames?.hindi;

      // Portion estimation via separated service
      let estimatedPortion = await portionEstimationService.estimatePortion(
        item.foodId,
        { boundingBox: item.bbox }
      );
      if (item.portion) {
        const rawGramsEquivalent = portionEstimationService.calculateGrams(item.foodId, {
          quantity: item.portion.quantity,
          unit: item.portion.unit,
          confidence: item.confidence,
          rawGramsEquivalent: 0,
        });
        estimatedPortion = {
          quantity: item.portion.quantity,
          unit: item.portion.unit,
          confidence: item.confidence,
          rawGramsEquivalent,
        };
      }

      const detection: FoodDetection = {
        id: `det-${image.id}-${idx + 1}-${Math.random().toString(36).substring(2, 6)}`,
        foodId: item.foodId,
        name,
        localNameHindi: hindiName,
        confidence: item.confidence,
        confidenceTier: getConfidenceTier(item.confidence),
        estimatedPortion,
        boundingBox: item.bbox,
        source: 'vision-model',
        candidateMatches: item.alternatives,
        identificationMode: isResearched ? 'research' : 'local',
        isEstimatedNutrition: isResearched || Boolean(foodItem?.nutrition?.isApproximate),
        fallbackDescription: item.fallbackDescription,
        evidence: isResearched
          ? [
              {
                type: 'web',
                title: 'Google Grounded Culinary Reference',
                relevance: `Researched dish "${name}" corroborated via regional culinary reference.`,
              },
            ]
          : [
              {
                type: 'local_match',
                title: name,
                relevance: 'Verified match in local nutritional catalog.',
              },
            ],
      };

      detections.push(detection);
    }

    // Apply General-purpose Food Region Grouping Mechanism (Phase 5.2.1):
    // Consolidates identical food identities (e.g. 2 curry compartments) into single food detection with combined portion
    const consolidatedDetections = groupDetectionsByFoodIdentity(detections);

    const processingTimeMs = Date.now() - startTime;

    return {
      imageId: image.id,
      model: 'trackabite-vision-mock-v2.0',
      processingTimeMs,
      status: scenario.status,
      detections: consolidatedDetections,
      confidenceWarning: scenario.confidenceWarning,
      errorMessage: scenario.errorMessage,
      imageMetadata: {
        sourceType: image.sourceType,
        quality: scenario.status === 'low-confidence' ? 'low-light' : 'good',
      },
      meal: mealCompositionService.composeMeal(consolidatedDetections, image.id),
    };
  }

  /**
   * Backwards-compatible sample scenario runner during phase transition
   */
  async recognizeSampleScenario(scenarioId: string): Promise<FoodRecognitionResult> {
    const syntheticImage: AppImage = {
      id: `sample-${scenarioId}`,
      sourceType: 'sample',
      scenarioHintId: scenarioId,
      capturedAt: new Date().toISOString(),
    };
    return this.recognizeFood(syntheticImage);
  }
}

export const mockFoodRecognitionService = new MockFoodRecognitionService();
export const foodRecognitionService = mockFoodRecognitionService;
