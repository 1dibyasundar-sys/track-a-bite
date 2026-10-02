/**
 * Intelligent Portion Estimation & Nutrition Service (Phase 6.3)
 *
 * Implements food-type-aware portion estimation and honest nutrition calculations.
 * Supports:
 * - Piece/count estimation for flat foods (Roti, Papad) and discrete snacks
 * - Volumetric & visual area estimation for grain mounds (Rice, Poha, Upma)
 * - Container/katori volume references for curries, dals, and liquids
 * - Honest uncertainty states and catalogue fallbacks
 * - Linear portion-scaled nutrition per component
 * - Completeness-aware meal-level nutrition summaries
 *
 * IMPORTANT: Never claims exact weights from 2D photographs.
 * Image-derived portions are formatted as estimates ("≈ 180g").
 */

import {
  MealComponent,
  MealComponentPortion,
  MealComponentRegion,
  ComponentNutrition,
  MealNutritionSummary,
  EstimationMethod,
  BoundingBox,
  VisualObservation,
  EstimatedPortion,
  PortionUnit,
} from '../types';
import { INDIAN_FOOD_DATABASE } from '../../data/foods';

export type FoodPhysicalType =
  | 'flat_bread'
  | 'grain_mound'
  | 'liquid_or_gravy'
  | 'discrete_snack'
  | 'condiment'
  | 'unknown';

interface PresetPortionData {
  physicalType: FoodPhysicalType;
  defaultQuantity: number;
  unit: PortionUnit;
  pieceWeightGrams?: number;
  standardGrams: number;
  densityGramsPerMl?: number;
  defaultMethod: EstimationMethod;
  defaultConfidence: number;
}

const FOOD_PORTION_REGISTRY: Record<string, PresetPortionData> = {
  // Flat Breads / Solid flat foods
  'whole-wheat-roti': {
    physicalType: 'flat_bread',
    defaultQuantity: 2,
    unit: 'piece',
    pieceWeightGrams: 40,
    standardGrams: 80,
    defaultMethod: 'piece_count_estimate',
    defaultConfidence: 0.88,
  },
  'chapati': {
    physicalType: 'flat_bread',
    defaultQuantity: 2,
    unit: 'piece',
    pieceWeightGrams: 40,
    standardGrams: 80,
    defaultMethod: 'piece_count_estimate',
    defaultConfidence: 0.88,
  },
  'phulka': {
    physicalType: 'flat_bread',
    defaultQuantity: 2,
    unit: 'piece',
    pieceWeightGrams: 35,
    standardGrams: 70,
    defaultMethod: 'piece_count_estimate',
    defaultConfidence: 0.88,
  },
  'roasted-papad': {
    physicalType: 'flat_bread',
    defaultQuantity: 1,
    unit: 'piece',
    pieceWeightGrams: 15,
    standardGrams: 15,
    defaultMethod: 'piece_count_estimate',
    defaultConfidence: 0.92,
  },
  'papad': {
    physicalType: 'flat_bread',
    defaultQuantity: 1,
    unit: 'piece',
    pieceWeightGrams: 15,
    standardGrams: 15,
    defaultMethod: 'piece_count_estimate',
    defaultConfidence: 0.92,
  },

  // Rice & Grains
  'steamed-rice': {
    physicalType: 'grain_mound',
    defaultQuantity: 180,
    unit: 'g',
    standardGrams: 180,
    defaultMethod: 'visual_area_estimate',
    defaultConfidence: 0.82,
  },
  'rice': {
    physicalType: 'grain_mound',
    defaultQuantity: 180,
    unit: 'g',
    standardGrams: 180,
    defaultMethod: 'visual_area_estimate',
    defaultConfidence: 0.82,
  },
  'poha': {
    physicalType: 'grain_mound',
    defaultQuantity: 160,
    unit: 'bowl',
    standardGrams: 160,
    defaultMethod: 'visual_area_estimate',
    defaultConfidence: 0.85,
  },
  'vegetable-upma': {
    physicalType: 'grain_mound',
    defaultQuantity: 160,
    unit: 'bowl',
    standardGrams: 160,
    defaultMethod: 'visual_area_estimate',
    defaultConfidence: 0.85,
  },
  'hostel-maggi': {
    physicalType: 'grain_mound',
    defaultQuantity: 1,
    unit: 'bowl',
    standardGrams: 240,
    defaultMethod: 'container_reference',
    defaultConfidence: 0.85,
  },
  'pakhala-bhata': {
    physicalType: 'grain_mound',
    defaultQuantity: 1,
    unit: 'bowl',
    standardGrams: 250,
    defaultMethod: 'container_reference',
    defaultConfidence: 0.85,
  },

  // Liquids / Semi-liquids / Curries
  'dal-tadka': {
    physicalType: 'liquid_or_gravy',
    defaultQuantity: 120,
    unit: 'ml',
    standardGrams: 150,
    densityGramsPerMl: 1.25,
    defaultMethod: 'container_reference',
    defaultConfidence: 0.82,
  },
  'dal': {
    physicalType: 'liquid_or_gravy',
    defaultQuantity: 120,
    unit: 'ml',
    standardGrams: 150,
    densityGramsPerMl: 1.25,
    defaultMethod: 'container_reference',
    defaultConfidence: 0.82,
  },
  'vegetable-curry': {
    physicalType: 'liquid_or_gravy',
    defaultQuantity: 1,
    unit: 'bowl',
    standardGrams: 150,
    densityGramsPerMl: 1.15,
    defaultMethod: 'container_reference',
    defaultConfidence: 0.80,
  },
  'mixed-vegetable-curry': {
    physicalType: 'liquid_or_gravy',
    defaultQuantity: 1,
    unit: 'bowl',
    standardGrams: 150,
    densityGramsPerMl: 1.15,
    defaultMethod: 'container_reference',
    defaultConfidence: 0.80,
  },
  'palak-paneer': {
    physicalType: 'liquid_or_gravy',
    defaultQuantity: 1,
    unit: 'bowl',
    standardGrams: 180,
    densityGramsPerMl: 1.2,
    defaultMethod: 'container_reference',
    defaultConfidence: 0.82,
  },
  'aloo-curry': {
    physicalType: 'liquid_or_gravy',
    defaultQuantity: 1,
    unit: 'bowl',
    standardGrams: 150,
    densityGramsPerMl: 1.15,
    defaultMethod: 'container_reference',
    defaultConfidence: 0.80,
  },
  'dalma': {
    physicalType: 'liquid_or_gravy',
    defaultQuantity: 1,
    unit: 'bowl',
    standardGrams: 160,
    densityGramsPerMl: 1.2,
    defaultMethod: 'container_reference',
    defaultConfidence: 0.80,
  },
  'fresh-curd': {
    physicalType: 'liquid_or_gravy',
    defaultQuantity: 1,
    unit: 'bowl',
    standardGrams: 150,
    densityGramsPerMl: 1.0,
    defaultMethod: 'container_reference',
    defaultConfidence: 0.86,
  },
  'buttermilk': {
    physicalType: 'liquid_or_gravy',
    defaultQuantity: 200,
    unit: 'ml',
    standardGrams: 200,
    densityGramsPerMl: 1.0,
    defaultMethod: 'container_reference',
    defaultConfidence: 0.84,
  },

  // Discrete Snacks
  'kachori': {
    physicalType: 'discrete_snack',
    defaultQuantity: 2,
    unit: 'piece',
    pieceWeightGrams: 45,
    standardGrams: 90,
    defaultMethod: 'piece_count_estimate',
    defaultConfidence: 0.90,
  },
  'samosa': {
    physicalType: 'discrete_snack',
    defaultQuantity: 1,
    unit: 'piece',
    pieceWeightGrams: 85,
    standardGrams: 85,
    defaultMethod: 'piece_count_estimate',
    defaultConfidence: 0.92,
  },
  'idli-sambar': {
    physicalType: 'discrete_snack',
    defaultQuantity: 2,
    unit: 'piece',
    pieceWeightGrams: 60,
    standardGrams: 120,
    defaultMethod: 'piece_count_estimate',
    defaultConfidence: 0.90,
  },
  'boiled-eggs': {
    physicalType: 'discrete_snack',
    defaultQuantity: 2,
    unit: 'piece',
    pieceWeightGrams: 50,
    standardGrams: 100,
    defaultMethod: 'piece_count_estimate',
    defaultConfidence: 0.95,
  },
  'sprouts-chaat': {
    physicalType: 'discrete_snack',
    defaultQuantity: 1,
    unit: 'bowl',
    standardGrams: 180,
    defaultMethod: 'visual_area_estimate',
    defaultConfidence: 0.88,
  },

  // Condiments
  'mango-pickle': {
    physicalType: 'condiment',
    defaultQuantity: 1,
    unit: 'serving',
    standardGrams: 15,
    defaultMethod: 'visual_area_estimate',
    defaultConfidence: 0.85,
  },
  'mint-chutney': {
    physicalType: 'condiment',
    defaultQuantity: 1,
    unit: 'serving',
    standardGrams: 25,
    defaultMethod: 'visual_area_estimate',
    defaultConfidence: 0.85,
  },
};

export class IntelligentPortionService {
  /**
   * Classifies a food into its physical state for tailored portion estimation.
   */
  detectPhysicalType(foodId: string, name: string): FoodPhysicalType {
    const reg = FOOD_PORTION_REGISTRY[foodId];
    if (reg) return reg.physicalType;

    const lower = `${foodId} ${name}`.toLowerCase();
    if (
      lower.includes('roti') ||
      lower.includes('chapati') ||
      lower.includes('phulka') ||
      lower.includes('naan') ||
      lower.includes('paratha') ||
      lower.includes('papad') ||
      lower.includes('bread') ||
      lower.includes('puri')
    ) {
      return 'flat_bread';
    }

    if (
      lower.includes('rice') ||
      lower.includes('poha') ||
      lower.includes('upma') ||
      lower.includes('biryani') ||
      lower.includes('khichdi') ||
      lower.includes('pakhala')
    ) {
      return 'grain_mound';
    }

    if (
      lower.includes('dal') ||
      lower.includes('curry') ||
      lower.includes('sambar') ||
      lower.includes('rasam') ||
      lower.includes('kadhi') ||
      lower.includes('soup') ||
      lower.includes('buttermilk') ||
      lower.includes('curd') ||
      lower.includes('gravy')
    ) {
      return 'liquid_or_gravy';
    }

    if (
      lower.includes('kachori') ||
      lower.includes('samosa') ||
      lower.includes('idli') ||
      lower.includes('vada') ||
      lower.includes('chaat') ||
      lower.includes('egg') ||
      lower.includes('banana')
    ) {
      return 'discrete_snack';
    }

    if (lower.includes('pickle') || lower.includes('chutney') || lower.includes('sauce')) {
      return 'condiment';
    }

    return 'unknown';
  }

  /**
   * Estimates portion for an individual visual region detection.
   * Leverages bounding box cues, visual observations, and food physical characteristics.
   */
  estimateRegionPortion(params: {
    foodId: string;
    foodName: string;
    rawPortion?: EstimatedPortion;
    boundingBox?: BoundingBox;
    visualObservation?: VisualObservation;
    visualNotes?: string;
  }): MealComponentPortion {
    const { foodId, foodName, rawPortion, boundingBox, visualNotes } = params;
    const physicalType = this.detectPhysicalType(foodId, foodName);
    const preset = FOOD_PORTION_REGISTRY[foodId];

    // Handle explicit unmapped/unknown food without cues
    const isUnmapped =
      foodId.startsWith('err-') ||
      foodId === 'unmapped-food' ||
      (!preset && !INDIAN_FOOD_DATABASE.some(f => f.id === foodId) && (!rawPortion || rawPortion.rawGramsEquivalent === 0));

    if (isUnmapped && (!rawPortion || rawPortion.quantity === 0)) {
      return {
        value: null,
        quantity: 0,
        unit: 'g',
        estimatedGrams: null,
        status: 'pending',
        estimationMethod: 'unavailable',
        confidence: 0,
        userConfirmed: false,
        formattedDisplay: 'Portion pending',
        isPieceBased: false,
      };
    }

    // 1. Piece-based foods (Flat breads, discrete snacks, papad)
    if (physicalType === 'flat_bread' || physicalType === 'discrete_snack') {
      const pieceWeight = preset?.pieceWeightGrams || (preset?.standardGrams ? Math.round(preset.standardGrams / (preset.defaultQuantity || 1)) : 40);
      let count = rawPortion?.unit === 'piece' ? Math.max(1, Math.round(rawPortion.quantity)) : (preset?.defaultQuantity || 1);

      // Check visual cues if count is mentioned in notes (e.g. "2 rotis")
      if (visualNotes) {
        const match = visualNotes.match(/(\d+)\s*(piece|roti|chapati|papad|kachori|samosa)/i);
        if (match) count = parseInt(match[1], 10);
      }

      const totalGrams = Math.round(count * pieceWeight);
      const isPieceUnit = true;
      const display = count === 1 ? `1 piece (≈ ${totalGrams}g)` : `${count} pieces (≈ ${totalGrams}g)`;

      return {
        value: count,
        quantity: count,
        unit: 'piece',
        estimatedGrams: totalGrams,
        status: 'estimated',
        estimationMethod: 'piece_count_estimate',
        confidence: preset?.defaultConfidence || 0.85,
        userConfirmed: false,
        formattedDisplay: display,
        isPieceBased: isPieceUnit,
        uncertaintyRange: {
          minGrams: Math.round(totalGrams * 0.85),
          maxGrams: Math.round(totalGrams * 1.15),
        },
      };
    }

    // 2. Grain Mounds (Rice, Poha, Upma)
    if (physicalType === 'grain_mound') {
      let baseGrams = preset?.standardGrams || 180;
      let method: EstimationMethod = 'visual_area_estimate';

      if (rawPortion && rawPortion.rawGramsEquivalent > 0) {
        baseGrams = rawPortion.rawGramsEquivalent;
      } else if (boundingBox) {
        const areaRatio = (boundingBox.width * boundingBox.height) / 10000;
        if (areaRatio > 0.35) baseGrams = Math.round(baseGrams * 1.25);
        else if (areaRatio < 0.15) baseGrams = Math.round(baseGrams * 0.75);
      } else {
        method = 'catalogue_default';
      }

      const conf = method === 'catalogue_default' ? 0.68 : (preset?.defaultConfidence || 0.80);

      return {
        value: baseGrams,
        quantity: baseGrams,
        unit: 'g',
        estimatedGrams: baseGrams,
        status: 'estimated',
        estimationMethod: method,
        confidence: conf,
        userConfirmed: false,
        formattedDisplay: `≈ ${baseGrams}g`,
        isPieceBased: false,
        uncertaintyRange: {
          minGrams: Math.round(baseGrams * 0.80),
          maxGrams: Math.round(baseGrams * 1.20),
        },
      };
    }

    // 3. Liquid / Semi-liquid / Curry (Dal, Sambar, Curry, Buttermilk)
    if (physicalType === 'liquid_or_gravy') {
      let grams = preset?.standardGrams || 150;
      const unit = rawPortion?.unit || preset?.unit || 'bowl';
      let method: EstimationMethod = 'container_reference';

      if (rawPortion && rawPortion.rawGramsEquivalent > 0) {
        grams = rawPortion.rawGramsEquivalent;
      } else if (rawPortion && rawPortion.unit === 'ml') {
        const density = preset?.densityGramsPerMl || 1.15;
        grams = Math.round(rawPortion.quantity * density);
      } else if (!rawPortion || rawPortion.quantity === 0) {
        method = 'catalogue_default';
      }

      const conf = method === 'catalogue_default' ? 0.65 : (preset?.defaultConfidence || 0.80);
      const isBeverage = foodId.includes('buttermilk') || foodId.includes('rasam');
      const display = isBeverage && unit === 'ml' ? `≈ ${rawPortion?.quantity || 200}ml (≈ ${grams}g)` : `≈ ${grams}g`;

      return {
        value: grams,
        quantity: rawPortion?.quantity || 1,
        unit: unit === 'piece' ? 'bowl' : unit,
        estimatedGrams: grams,
        estimatedVolumeMl: unit === 'ml' ? rawPortion?.quantity || Math.round(grams / (preset?.densityGramsPerMl || 1.15)) : undefined,
        status: 'estimated',
        estimationMethod: method,
        confidence: conf,
        userConfirmed: false,
        formattedDisplay: display,
        isPieceBased: false,
        uncertaintyRange: {
          minGrams: Math.round(grams * 0.80),
          maxGrams: Math.round(grams * 1.20),
        },
      };
    }

    // 4. Condiments (Pickle, Chutney)
    if (physicalType === 'condiment') {
      const grams = preset?.standardGrams || 15;
      const method: EstimationMethod = rawPortion?.rawGramsEquivalent ? 'visual_area_estimate' : 'catalogue_default';

      return {
        value: grams,
        quantity: 1,
        unit: 'serving',
        estimatedGrams: grams,
        status: 'estimated',
        estimationMethod: method,
        confidence: 0.85,
        userConfirmed: false,
        formattedDisplay: `≈ ${grams}g`,
        isPieceBased: false,
      };
    }

    // 5. Fallback for other items with database serving info
    const dbItem = INDIAN_FOOD_DATABASE.find(f => f.id === foodId);
    if (dbItem) {
      const isPiece = dbItem.servingUnit === 'piece';
      const defaultGrams = dbItem.weightGramsPerUnit || 150;
      const qty = rawPortion?.quantity || 1;
      const grams = isPiece ? Math.round(qty * defaultGrams) : (rawPortion?.rawGramsEquivalent || defaultGrams);
      const display = isPiece ? (qty === 1 ? `1 piece (≈ ${grams}g)` : `${qty} pieces (≈ ${grams}g)`) : `≈ ${grams}g`;

      return {
        value: isPiece ? qty : grams,
        quantity: qty,
        unit: isPiece ? 'piece' : (rawPortion?.unit || 'serving'),
        estimatedGrams: grams,
        status: 'estimated',
        estimationMethod: 'catalogue_default',
        confidence: 0.70,
        userConfirmed: false,
        formattedDisplay: display,
        isPieceBased: isPiece,
      };
    }

    // Unmapped / ambiguous
    return {
      value: null,
      quantity: 0,
      unit: 'g',
      estimatedGrams: null,
      status: 'pending',
      estimationMethod: 'unavailable',
      confidence: 0,
      userConfirmed: false,
      formattedDisplay: 'Portion pending',
      isPieceBased: false,
    };
  }

  /**
   * Aggregates multiple physical regions of the same food into a single component portion.
   * Handles multi-compartment dishes (e.g. 2 curry regions of 80g + 70g = 150g).
   */
  aggregateComponentPortion(
    regions: MealComponentRegion[],
    foodId: string,
    foodName: string
  ): MealComponentPortion {
    if (regions.length === 0) {
      return {
        value: null,
        quantity: 0,
        unit: 'g',
        estimatedGrams: null,
        status: 'pending',
        estimationMethod: 'unavailable',
        confidence: 0,
        userConfirmed: false,
        formattedDisplay: 'Portion pending',
        isPieceBased: false,
      };
    }

    if (regions.length === 1) {
      return { ...regions[0].portion };
    }

    // Multiple physical regions detected for the same dish
    const physicalType = this.detectPhysicalType(foodId, foodName);
    const isPieceBased =
      physicalType === 'flat_bread' ||
      physicalType === 'discrete_snack' ||
      regions.every(r => r.portion.isPieceBased);
    const anyPending = regions.some(r => r.portion.status === 'pending');

    if (isPieceBased) {
      const totalPieces = regions.reduce((sum, r) => sum + (r.portion.quantity || 1), 0);
      const totalGrams = regions.reduce((sum, r) => sum + (r.portion.estimatedGrams || 0), 0);
      const avgConf = Math.round((regions.reduce((sum, r) => sum + r.portion.confidence, 0) / regions.length) * 100) / 100;
      const display = totalPieces === 1 ? `1 piece (≈ ${totalGrams}g)` : `${totalPieces} pieces (≈ ${totalGrams}g)`;

      return {
        value: totalPieces,
        quantity: totalPieces,
        unit: 'piece',
        estimatedGrams: totalGrams > 0 ? totalGrams : null,
        status: anyPending ? 'pending' : 'estimated',
        estimationMethod: 'piece_count_estimate',
        confidence: avgConf,
        userConfirmed: false,
        formattedDisplay: display,
        isPieceBased: true,
        uncertaintyRange: totalGrams > 0 ? {
          minGrams: Math.round(totalGrams * 0.85),
          maxGrams: Math.round(totalGrams * 1.15),
        } : undefined,
      };
    }

    // Mass / Volume aggregation (e.g. 2 curry compartments: 80g + 70g = 150g)
    const totalGrams = regions.reduce((sum, r) => sum + (r.portion.estimatedGrams || 0), 0);
    const totalVolume = regions.reduce((sum, r) => sum + (r.portion.estimatedVolumeMl || 0), 0);
    const primaryUnit = regions[0].portion.unit === 'piece' ? 'g' : regions[0].portion.unit;

    // Weighted confidence by portion mass
    const weightedConf = Math.round(
      (regions.reduce((sum, r) => sum + r.portion.confidence * Math.max(1, r.portion.estimatedGrams || 1), 0) /
        Math.max(1, totalGrams || regions.length)) *
        100
    ) / 100;

    const display = totalGrams > 0 ? `≈ ${totalGrams}g` : 'Portion pending';

    return {
      value: totalGrams > 0 ? totalGrams : null,
      quantity: totalGrams > 0 ? totalGrams : 0,
      unit: primaryUnit === 'serving' ? 'g' : primaryUnit,
      estimatedGrams: totalGrams > 0 ? totalGrams : null,
      estimatedVolumeMl: totalVolume > 0 ? totalVolume : undefined,
      status: anyPending ? 'pending' : 'estimated',
      estimationMethod: regions[0].portion.estimationMethod || 'container_reference',
      confidence: weightedConf,
      userConfirmed: false,
      formattedDisplay: display,
      isPieceBased: false,
      uncertaintyRange: totalGrams > 0 ? {
        minGrams: Math.round(totalGrams * 0.80),
        maxGrams: Math.round(totalGrams * 1.20),
      } : undefined,
    };
  }

  /**
   * Applies manual user correction to a meal component portion.
   */
  applyUserPortionCorrection(
    currentPortion: MealComponentPortion,
    newQuantity: number,
    newUnit?: string,
    newGrams?: number
  ): MealComponentPortion {
    const unit = newUnit || currentPortion.unit;
    const isPiece = unit === 'piece';
    const grams = newGrams !== undefined ? newGrams : (isPiece ? Math.round(newQuantity * 40) : Math.round(newQuantity));

    const display = isPiece
      ? (newQuantity === 1 ? `1 piece (${grams}g)` : `${newQuantity} pieces (${grams}g)`)
      : `${grams}g`;

    return {
      ...currentPortion,
      value: isPiece ? newQuantity : grams,
      quantity: newQuantity,
      unit,
      estimatedGrams: grams,
      status: 'confirmed',
      estimationMethod: 'user_confirmed',
      confidence: 1.0,
      userConfirmed: true,
      formattedDisplay: display,
      isPieceBased: isPiece,
      uncertaintyRange: undefined,
    };
  }

  /**
   * Calculates portion-scaled nutrition for an individual meal component.
   * Scales linearly: nutrition = referenceNutrition * (estimatedGrams / referenceGrams).
   */
  calculateComponentNutrition(component: MealComponent): ComponentNutrition {
    const { foodId, name, portion, nutritionReference, confidence: idConfidence } = component;

    // Check if food has an unmapped or unavailable nutrition reference
    if (!nutritionReference || !nutritionReference.isAvailable) {
      return {
        calories: null,
        carbohydrates: null,
        protein: null,
        fat: null,
        fiber: null,
        status: 'unmapped',
        confidence: 0,
        isApproximate: true,
        formattedCalories: 'Unmapped',
        disclaimer: `Nutritional reference data is unavailable for "${name}".`,
      };
    }

    // Determine reference baseline values
    let refGrams = 100;
    let refCalories = 100;
    let refCarbs = 15;
    let refProtein = 3;
    let refFat = 2;
    let refFiber = 1;
    const isEstimated = nutritionReference.isEstimated;
    let refDescription = '100g standard reference';

    const normName = name.toLowerCase();
    const dbItem = INDIAN_FOOD_DATABASE.find(
      f =>
        f.id === foodId ||
        f.id === foodId.replace(/^mixed-/, '') ||
        f.aliases.some(a => a.toLowerCase() === foodId.toLowerCase() || a.toLowerCase() === normName) ||
        f.name.toLowerCase().includes(normName)
    );
    if (dbItem) {
      refGrams = dbItem.serving?.weightGrams || dbItem.weightGramsPerUnit || 100;
      refCalories = dbItem.nutrition.calories;
      refCarbs = dbItem.nutrition.carbohydrates;
      refProtein = dbItem.nutrition.protein;
      refFat = dbItem.nutrition.fat;
      refFiber = dbItem.nutrition.fiber;
      refDescription = dbItem.serving?.description || `${refGrams}g reference serving`;
    } else if (nutritionReference.calories !== undefined) {
      // Regional reference (e.g. Buttermilk, Pakhala Bhata, Dalma)
      refCalories = nutritionReference.calories;
      refCarbs = nutritionReference.carbs || 0;
      refProtein = nutritionReference.protein || 0;
      refFat = nutritionReference.fat || 0;
      refFiber = nutritionReference.fiber || 0;
      refGrams = foodId.includes('buttermilk') ? 200 : (foodId.includes('pakhala') ? 250 : 150);
      refDescription = `ICMR-NIN reference serving (${refGrams}g)`;
    }

    // Linear scaling factor based on estimated portion
    let scaleFactor = 1.0;
    if (portion.isPieceBased && portion.quantity && (dbItem?.servingUnit === 'piece' || dbItem?.serving?.unit === 'piece')) {
      const refPieces = dbItem.serving?.size || 1;
      scaleFactor = portion.quantity / refPieces;
    } else if (portion.estimatedGrams && portion.estimatedGrams > 0 && refGrams > 0) {
      scaleFactor = portion.estimatedGrams / refGrams;
    } else if (portion.quantity && dbItem?.serving?.size) {
      scaleFactor = portion.quantity / dbItem.serving.size;
    }

    const scaledCalories = Math.round(refCalories * scaleFactor);
    const scaledCarbs = Math.round(refCarbs * scaleFactor * 10) / 10;
    const scaledProtein = Math.round(refProtein * scaleFactor * 10) / 10;
    const scaledFat = Math.round(refFat * scaleFactor * 10) / 10;
    const scaledFiber = Math.round(refFiber * scaleFactor * 10) / 10;

    // Composite nutrition confidence: food identity conf * portion conf * data trustworthiness
    const dataTrustworthiness = isEstimated ? 0.85 : 0.95;
    const compositeConf = Math.round(idConfidence * portion.confidence * dataTrustworthiness * 100) / 100;

    const approxPrefix = portion.userConfirmed ? '' : '≈ ';

    return {
      calories: scaledCalories,
      carbohydrates: scaledCarbs,
      protein: scaledProtein,
      fat: scaledFat,
      fiber: scaledFiber,
      status: isEstimated ? 'estimated_fallback' : 'linked',
      confidence: compositeConf,
      isApproximate: !portion.userConfirmed || isEstimated,
      referenceServingGrams: refGrams,
      referenceServingDescription: refDescription,
      formattedCalories: `${approxPrefix}${scaledCalories} kcal`,
      formattedProtein: `${approxPrefix}${scaledProtein}g`,
      formattedCarbs: `${approxPrefix}${scaledCarbs}g`,
      formattedFat: `${approxPrefix}${scaledFat}g`,
      formattedFiber: `${approxPrefix}${scaledFiber}g`,
      disclaimer: isEstimated
        ? 'Nutritional estimates based on regional reference data.'
        : undefined,
    };
  }

  /**
   * Aggregates component-level nutrition into a complete meal nutrition summary.
   * If any component has unmapped nutrition, marks completeness as 'partial'
   * and lists the missing items in disclaimer (never silently treats them as zero).
   */
  calculateMealNutrition(components: MealComponent[]): MealNutritionSummary {
    let totalCalories = 0;
    let totalCarbs = 0;
    let totalProtein = 0;
    let totalFat = 0;
    let totalFiber = 0;
    let totalConfidenceWeighted = 0;
    let totalWeightForConf = 0;
    const missingNutritionFoods: string[] = [];

    for (const comp of components) {
      const nut = comp.nutrition;
      if (nut && nut.status !== 'unmapped' && nut.calories !== null) {
        totalCalories += nut.calories;
        totalCarbs += nut.carbohydrates || 0;
        totalProtein += nut.protein || 0;
        totalFat += nut.fat || 0;
        totalFiber += nut.fiber || 0;

        const weight = Math.max(10, nut.calories);
        totalConfidenceWeighted += nut.confidence * weight;
        totalWeightForConf += weight;
      } else {
        missingNutritionFoods.push(comp.name);
      }
    }

    const isPartial = missingNutritionFoods.length > 0;
    const completeness = isPartial ? 'partial' : (components.length === 0 ? 'unmapped' : 'complete');
    const overallConf = totalWeightForConf > 0
      ? Math.round((totalConfidenceWeighted / totalWeightForConf) * 100) / 100
      : 0.50;

    const roundedCarbs = Math.round(totalCarbs * 10) / 10;
    const roundedProtein = Math.round(totalProtein * 10) / 10;
    const roundedFat = Math.round(totalFat * 10) / 10;
    const roundedFiber = Math.round(totalFiber * 10) / 10;

    let disclaimer = 'Total meal nutrition estimated from image portion cues and standard recipes.';
    if (isPartial) {
      disclaimer = `Estimated ≈ ${totalCalories} kcal (partial). Missing nutritional reference for: ${missingNutritionFoods.join(', ')}. Actual meal nutrition will be higher.`;
    }

    return {
      calories: totalCalories,
      carbohydrates: roundedCarbs,
      protein: roundedProtein,
      fat: roundedFat,
      fiber: roundedFiber,
      confidence: overallConf,
      status: completeness,
      nutritionCompleteness: completeness,
      missingNutritionFoods: isPartial ? missingNutritionFoods : undefined,
      disclaimer,
      formattedCalories: `≈ ${totalCalories} kcal`,
    };
  }
}

export const intelligentPortionService = new IntelligentPortionService();
