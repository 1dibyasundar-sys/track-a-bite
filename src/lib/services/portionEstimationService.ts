import {
  IPortionEstimationService,
  EstimatedPortion,
  PortionUnit,
  BoundingBox,
} from '../types';
import { INDIAN_FOOD_DATABASE } from '../../data/foods';

/**
 * Standard baseline portions for common campus and regional foods.
 * Used by MockPortionEstimationService to provide reproducible estimates.
 */
interface FoodPortionPreset {
  quantity: number;
  unit: PortionUnit;
  confidence: number;
  gramsPerUnit: number;
}

const FOOD_PORTION_PRESETS: Record<string, FoodPortionPreset> = {
  'steamed-rice': { quantity: 180, unit: 'g', confidence: 0.88, gramsPerUnit: 1 },
  'dal-tadka': { quantity: 120, unit: 'ml', confidence: 0.85, gramsPerUnit: 1.25 }, // ~150g
  'kachori': { quantity: 2, unit: 'piece', confidence: 0.92, gramsPerUnit: 45 }, // 90g total
  'samosa': { quantity: 1, unit: 'piece', confidence: 0.94, gramsPerUnit: 85 },
  'sprouts-chaat': { quantity: 1, unit: 'bowl', confidence: 0.91, gramsPerUnit: 180 },
  'potato-chips': { quantity: 1, unit: 'serving', confidence: 0.95, gramsPerUnit: 35 },
  'banana': { quantity: 1, unit: 'piece', confidence: 0.96, gramsPerUnit: 118 },
  'boiled-eggs': { quantity: 2, unit: 'piece', confidence: 0.95, gramsPerUnit: 50 }, // 100g total
  'hostel-maggi': { quantity: 1, unit: 'bowl', confidence: 0.9, gramsPerUnit: 240 },
  'bread-omelette': { quantity: 1, unit: 'serving', confidence: 0.93, gramsPerUnit: 160 },
  'chana-chaat': { quantity: 1, unit: 'bowl', confidence: 0.89, gramsPerUnit: 150 },
  'aloo-curry': { quantity: 1, unit: 'bowl', confidence: 0.87, gramsPerUnit: 150 },
  'vegetable-curry': { quantity: 1, unit: 'bowl', confidence: 0.88, gramsPerUnit: 150 },
  'kachumber-salad': { quantity: 1, unit: 'serving', confidence: 0.89, gramsPerUnit: 100 },
  'mango-pickle': { quantity: 1, unit: 'serving', confidence: 0.90, gramsPerUnit: 15 },
  'mint-chutney': { quantity: 1, unit: 'serving', confidence: 0.90, gramsPerUnit: 25 },
  'whole-wheat-roti': { quantity: 2, unit: 'piece', confidence: 0.96, gramsPerUnit: 40 }, // 80g total
  'fresh-curd': { quantity: 1, unit: 'bowl', confidence: 0.92, gramsPerUnit: 150 },
  'palak-paneer': { quantity: 1, unit: 'bowl', confidence: 0.86, gramsPerUnit: 180 },
  'idli-sambar': { quantity: 2, unit: 'piece', confidence: 0.94, gramsPerUnit: 60 },
  'masala-dosa': { quantity: 1, unit: 'serving', confidence: 0.92, gramsPerUnit: 180 },
  'poha': { quantity: 1, unit: 'bowl', confidence: 0.9, gramsPerUnit: 160 },
  'vegetable-upma': { quantity: 1, unit: 'bowl', confidence: 0.9, gramsPerUnit: 160 },
  'roasted-papad': { quantity: 1, unit: 'piece', confidence: 0.95, gramsPerUnit: 15 },
  'pakhala-bhata': { quantity: 1, unit: 'bowl', confidence: 0.90, gramsPerUnit: 250 },
  'dalma': { quantity: 1, unit: 'bowl', confidence: 0.88, gramsPerUnit: 160 },
  'chakuli-pitha': { quantity: 2, unit: 'piece', confidence: 0.92, gramsPerUnit: 50 },
  'dahi-bara': { quantity: 2, unit: 'piece', confidence: 0.92, gramsPerUnit: 70 },
};

/**
 * Mock implementation of PortionEstimationService.
 * Can be cleanly swapped with volumetric computer-vision depth models later.
 */
export class MockPortionEstimationService implements IPortionEstimationService {
  async estimatePortion(
    foodId: string,
    visualCue?: { boundingBox?: BoundingBox; preferredUnit?: PortionUnit }
  ): Promise<EstimatedPortion> {
    const preset = FOOD_PORTION_PRESETS[foodId];

    if (preset) {
      // If bounding box is unusually small or large, simulate modest visual volume adjustment
      let visualFactor = 1.0;
      if (visualCue?.boundingBox) {
        const area = (visualCue.boundingBox.width * visualCue.boundingBox.height) / 10000;
        if (area > 0.35) visualFactor = 1.25;
        else if (area < 0.15) visualFactor = 0.75;
      }

      const adjustedQty = Math.round(preset.quantity * visualFactor * 10) / 10;
      const rawGrams = Math.round(adjustedQty * preset.gramsPerUnit);

      return {
        quantity: visualCue?.preferredUnit ? adjustedQty : preset.quantity,
        unit: visualCue?.preferredUnit || preset.unit,
        confidence: preset.confidence,
        rawGramsEquivalent: rawGrams,
      };
    }

    // Fallback using catalog weight if not in hardcoded presets
    const catalogItem = INDIAN_FOOD_DATABASE.find(f => f.id === foodId);
    const weightGrams = catalogItem ? catalogItem.weightGramsPerUnit : 150;
    const unit: PortionUnit = catalogItem?.servingUnit === 'piece' ? 'piece' : 'bowl';

    return {
      quantity: 1,
      unit,
      confidence: 0.75, // Moderate confidence for uncalibrated items
      rawGramsEquivalent: weightGrams,
    };
  }

  adjustPortion(current: EstimatedPortion, delta: number): EstimatedPortion {
    const isPiece = current.unit === 'piece';
    const step = isPiece ? 1 : 0.25;
    const minQty = isPiece ? 1 : 0.25;
    const maxQty = isPiece ? 10 : 5.0;

    const newQty = Math.max(
      minQty,
      Math.min(maxQty, Math.round((current.quantity + delta * step) * 100) / 100)
    );

    const ratio = newQty / Math.max(0.01, current.quantity);
    const newGrams = Math.round(current.rawGramsEquivalent * ratio);

    return {
      ...current,
      quantity: newQty,
      rawGramsEquivalent: Math.max(10, newGrams),
    };
  }

  calculateGrams(foodId: string, portion: EstimatedPortion): number {
    if (portion.rawGramsEquivalent > 0) {
      return portion.rawGramsEquivalent;
    }

    const catalogItem = INDIAN_FOOD_DATABASE.find(f => f.id === foodId);
    const standardServingGrams = catalogItem?.weightGramsPerUnit || 150;

    // If unit is explicitly grams
    if (portion.unit === 'g') {
      return Math.round(portion.quantity);
    }

    // If unit is milliliters
    if (portion.unit === 'ml') {
      const density = foodId.includes('dal') || foodId.includes('curry') ? 1.2 : 1.0;
      return Math.round(portion.quantity * density);
    }

    // If unit matches a specific preset (e.g. piece with custom piece weight)
    const preset = FOOD_PORTION_PRESETS[foodId];
    if (preset && preset.unit === portion.unit) {
      return Math.round(portion.quantity * preset.gramsPerUnit);
    }

    // Otherwise, scale by standard reference serving weight
    return Math.round(portion.quantity * standardServingGrams);
  }
}

export const portionEstimationService = new MockPortionEstimationService();
