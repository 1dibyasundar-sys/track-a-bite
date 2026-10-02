/**
 * Intelligent Meal Composition Engine (Phase 6.2 & Phase 6.3)
 *
 * Converts individual visual detections into a coherent structured meal:
 * 1. Visual Food Detections
 * 2. Food Identity Normalization
 * 3. General-purpose Intelligent Grouping (Separating physical regions from identity)
 * 4. Region Preservation (tracking constituent physical portions)
 * 5. Food-Type-Aware Portion Estimation (Phase 6.3)
 * 6. Portion-Aware Component Nutrition (Phase 6.3)
 * 7. Meal-Level Nutrition Summary & Completeness (Phase 6.3)
 */

import { FoodDetection, BoundingBox, getConfidenceTier } from '../types/recognition';
import {
  MealComponent,
  MealComponentRegion,
  MealComponentPortion,
  MealComponentNutritionRef,
  StructuredMeal,
} from '../types/mealComposition';
import { UserProfile } from '../types/profile';
import { MealContext } from '../types/personalizedAnalysis';
import { foodNormalizationService } from './foodNormalizationService';
import { intelligentPortionService } from './intelligentPortionService';
import { nutritionAnalysisService } from './nutritionAnalysisService';
import { INDIAN_FOOD_DATABASE } from '../../data/foods';

export class MealCompositionService {
  /**
   * Main Entrypoint:
   * Composes a StructuredMeal from an array of visual food detections.
   * Works for arbitrary meals without hardcoding plate or thali types.
   */
  public composeMeal(
    detections: FoodDetection[],
    imageId?: string,
    profile?: Partial<UserProfile> | null,
    mealContext: MealContext = 'meal'
  ): StructuredMeal {
    const mealId = imageId || `meal-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    if (!detections || detections.length === 0) {
      return {
        id: mealId,
        components: [],
        totalComponents: 0,
        totalRegions: 0,
        metadata: {
          mealId,
          totalComponents: 0,
          totalRegions: 0,
          hasResearchComponents: false,
          hasUncertainComponents: false,
          composedAt: new Date().toISOString(),
        },
      };
    }

    // 1. Flatten all detections into constituent physical visual regions
    interface RegionItem {
      detection: FoodDetection;
      region: MealComponentRegion;
    }

    const flatRegions: RegionItem[] = [];

    for (const det of detections) {
      if (det.regions && det.regions.length > 0) {
        for (const subRegion of det.regions) {
          const regionPortion = intelligentPortionService.estimateRegionPortion({
            foodId: subRegion.foodId || det.foodId,
            foodName: subRegion.foodName || det.name,
            rawPortion: {
              quantity: subRegion.portion?.quantity ?? det.estimatedPortion.quantity,
              unit: subRegion.portion?.unit ?? det.estimatedPortion.unit,
              confidence: subRegion.confidence ?? det.confidence,
              rawGramsEquivalent: subRegion.portion?.rawGramsEquivalent ?? det.estimatedPortion.rawGramsEquivalent ?? 0,
            },
            boundingBox: subRegion.boundingBox || det.boundingBox,
            visualObservation: det.visualObservation,
            visualNotes: subRegion.visualNotes || det.fallbackDescription,
          });

          flatRegions.push({
            detection: det,
            region: {
              regionId: subRegion.regionId || `${det.id}-r`,
              foodId: subRegion.foodId || det.foodId,
              foodName: subRegion.foodName || det.name,
              confidence: subRegion.confidence ?? det.confidence,
              portion: regionPortion,
              boundingBox: subRegion.boundingBox || det.boundingBox,
              visualObservation: det.visualObservation,
              visualNotes: subRegion.visualNotes || det.fallbackDescription,
            },
          });
        }
      } else {
        const regionPortion = intelligentPortionService.estimateRegionPortion({
          foodId: det.foodId,
          foodName: det.name,
          rawPortion: det.estimatedPortion,
          boundingBox: det.boundingBox,
          visualObservation: det.visualObservation,
          visualNotes: det.fallbackDescription,
        });

        flatRegions.push({
          detection: det,
          region: {
            regionId: det.id,
            foodId: det.foodId,
            foodName: det.name,
            confidence: det.confidence,
            portion: regionPortion,
            boundingBox: det.boundingBox,
            visualObservation: det.visualObservation,
            visualNotes: det.fallbackDescription,
          },
        });
      }
    }

    // 2. Cluster visual regions into unique food identities
    //    Enforces cultural distinctions: Sambar != Dal, Paneer Curry != Veg Curry
    const clusters: Array<{
      primaryDetection: FoodDetection;
      regions: MealComponentRegion[];
      detections: FoodDetection[];
    }> = [];

    for (const item of flatRegions) {
      let matchedCluster = null;

      for (const cluster of clusters) {
        const isSame = foodNormalizationService.areSameFoodIdentity(
          {
            name: cluster.primaryDetection.name,
            foodId: cluster.primaryDetection.foodId,
            visualObservation: cluster.primaryDetection.visualObservation,
          },
          {
            name: item.detection.name,
            foodId: item.detection.foodId,
            visualObservation: item.detection.visualObservation,
          }
        );

        if (isSame) {
          matchedCluster = cluster;
          break;
        }
      }

      if (matchedCluster) {
        matchedCluster.regions.push(item.region);
        if (!matchedCluster.detections.includes(item.detection)) {
          matchedCluster.detections.push(item.detection);
        }
      } else {
        clusters.push({
          primaryDetection: item.detection,
          regions: [item.region],
          detections: [item.detection],
        });
      }
    }

    // 3. Build typed MealComponent objects from clustered regions
    const components: MealComponent[] = [];

    for (let cIdx = 0; cIdx < clusters.length; cIdx++) {
      const cluster = clusters[cIdx];
      const primary = cluster.primaryDetection;
      const regions = cluster.regions;
      const normIdentity = foodNormalizationService.normalize(primary.name, primary.foodId);

      // Aggregate portion estimation across regions (Phase 6.3 intelligent aggregation)
      const combinedPortion: MealComponentPortion = intelligentPortionService.aggregateComponentPortion(
        regions,
        normIdentity.canonicalId,
        primary.name
      );

      // Weighted average perception confidence across constituent physical mass
      const totalGrams = combinedPortion.estimatedGrams || 1;
      const combinedConfidence =
        regions.length === 1
          ? primary.confidence
          : Math.round(
              (regions.reduce((sum, r) => sum + r.confidence * Math.max(1, r.portion.estimatedGrams || 1), 0) /
                Math.max(1, totalGrams)) *
                100
            ) / 100;

      // Combined bounding box
      let combinedBox: BoundingBox | undefined;
      const boxes = regions.map(r => r.boundingBox).filter((b): b is BoundingBox => Boolean(b));
      if (boxes.length > 0) {
        const minX = Math.min(...boxes.map(b => b.x));
        const minY = Math.min(...boxes.map(b => b.y));
        const maxX = Math.max(...boxes.map(b => b.x + b.width));
        const maxY = Math.max(...boxes.map(b => b.y + b.height));
        combinedBox = {
          x: Math.round(minX * 10) / 10,
          y: Math.round(minY * 10) / 10,
          width: Math.round((maxX - minX) * 10) / 10,
          height: Math.round((maxY - minY) * 10) / 10,
        };
      }

      // Merge evidence without duplicates
      const allEvidence = cluster.detections.flatMap(d => d.evidence || []);
      const uniqueEvidence = Array.from(
        new Map(allEvidence.map(e => [e.title || e.relevance || Math.random().toString(), e])).values()
      );

      // Resolve nutrition reference
      const nutritionRef = this.resolveNutritionReference(
        normIdentity.canonicalId,
        primary.name,
        primary.isEstimatedNutrition
      );

      // Preserve identificationMode: research if any constituent item was research-derived
      const hasResearch = cluster.detections.some(d => d.identificationMode === 'research');
      const identificationMode = hasResearch ? 'research' : (primary.identificationMode || 'local');

      const needsConfirmation =
        cluster.detections.some(d => d.needsConfirmation) || combinedConfidence < 0.65;

      const component: MealComponent = {
        id: `comp-${normIdentity.canonicalId}-${cIdx + 1}`,
        foodId: normIdentity.canonicalId,
        name: primary.name,
        normalizedName: normIdentity.normalizedName,
        category: normIdentity.category,
        confidence: combinedConfidence,
        confidenceTier: getConfidenceTier(combinedConfidence),
        identificationMode,
        totalRegions: regions.length,
        regionIds: regions.map(r => r.regionId),
        regions,
        portion: combinedPortion,
        boundingBox: combinedBox,
        evidence: uniqueEvidence.length > 0 ? uniqueEvidence : undefined,
        nutritionReference: nutritionRef,
        needsConfirmation,
        fallbackDescription: primary.fallbackDescription,
      };

      // Calculate component-level nutrition (Phase 6.3)
      component.nutrition = intelligentPortionService.calculateComponentNutrition(component);

      components.push(component);
    }

    const totalRegionsCount = components.reduce((sum, c) => sum + c.totalRegions, 0);

    // Calculate overall meal nutrition summary (Phase 6.3)
    const mealNutrition = intelligentPortionService.calculateMealNutrition(components);

    // Calculate personalized nutrition analysis + 5-star score + hostel recommendations (Phase 6.4)
    const analysis = nutritionAnalysisService.analyzeMeal(mealNutrition, components, profile, mealContext);

    return {
      id: mealId,
      components,
      totalComponents: components.length,
      totalRegions: totalRegionsCount,
      nutrition: mealNutrition,
      analysis,
      metadata: {
        mealId,
        totalComponents: components.length,
        totalRegions: totalRegionsCount,
        hasResearchComponents: components.some(c => c.identificationMode === 'research'),
        hasUncertainComponents: components.some(c => c.needsConfirmation),
        composedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Resolves nutrition availability reference for a meal component.
   */
  private resolveNutritionReference(
    foodId: string,
    foodName: string,
    isEstimatedNutrition?: boolean
  ): MealComponentNutritionRef {
    // 1. Check local catalog
    const normName = foodName.toLowerCase();
    const catalogItem = INDIAN_FOOD_DATABASE.find(
      f =>
        f.id === foodId ||
        f.id === foodId.replace(/^mixed-/, '') ||
        f.aliases.some(a => a.toLowerCase() === foodId.toLowerCase() || a.toLowerCase() === normName) ||
        f.name.toLowerCase().includes(normName)
    );
    if (catalogItem) {
      return {
        isAvailable: true,
        isEstimated: Boolean(catalogItem.nutrition.isApproximate) || Boolean(isEstimatedNutrition),
        nutrition: catalogItem.nutrition,
        calories: catalogItem.nutrition.calories,
        protein: catalogItem.nutrition.protein,
        carbs: catalogItem.nutrition.carbohydrates,
        fat: catalogItem.nutrition.fat,
        fiber: catalogItem.nutrition.fiber,
        source: 'local_database',
      };
    }

    // 2. Check regional ICMR-NIN references
    const lower = foodName.toLowerCase();
    if (lower.includes('pakhala')) {
      return {
        isAvailable: true,
        isEstimated: true,
        calories: 145,
        protein: 3.2,
        carbs: 31.0,
        fat: 0.8,
        fiber: 1.5,
        source: 'regional_reference',
        recipeReferenceName: 'ICMR-NIN Fermented Rice Reference',
      };
    }

    if (lower.includes('dalma')) {
      return {
        isAvailable: true,
        isEstimated: true,
        calories: 135,
        protein: 7.2,
        carbs: 18.5,
        fat: 3.5,
        fiber: 4.5,
        source: 'regional_reference',
        recipeReferenceName: 'ICMR-NIN Lentil & Vegetable Reference',
      };
    }

    if (lower.includes('buttermilk')) {
      return {
        isAvailable: true,
        isEstimated: true,
        calories: 40,
        protein: 2.2,
        carbs: 3.6,
        fat: 1.8,
        fiber: 0.0,
        source: 'regional_reference',
        recipeReferenceName: 'ICMR-NIN Spiced Buttermilk Reference',
      };
    }

    return {
      isAvailable: false,
      isEstimated: true,
      source: 'none',
    };
  }
}

export const mealCompositionService = new MealCompositionService();
