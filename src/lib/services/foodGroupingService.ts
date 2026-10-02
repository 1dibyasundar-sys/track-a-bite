import {
  FoodDetection,
  DetectedFoodRegion,
  BoundingBox,
  EstimatedPortion,
  getConfidenceTier,
} from '../types/recognition';
import { INDIAN_FOOD_DATABASE } from '../../data/foods';

/**
 * General-purpose Food Region Grouping Mechanism (Phase 5.2.1)
 *
 * Separates physical visual regions from food identity.
 *
 * Visual regions
 *   ↓
 * Food identity matching
 *   ↓
 * Group identical/sufficiently similar food identities
 *   ↓
 * Aggregate portions
 *   ↓
 * Nutrition calculation (performed once using aggregated portion)
 *
 * CONSTRAINTS:
 * - Do NOT merge foods merely because they look similar.
 * - Only merge when the recognized food identity is the same (identical foodId)
 *   or when there is strong evidence that they represent physical portions of the same food.
 */
export function groupDetectionsByFoodIdentity(
  detections: FoodDetection[]
): FoodDetection[] {
  if (detections.length <= 1) {
    return detections.map(d => ({
      ...d,
      regions: d.regions || [
        {
          regionId: d.id,
          foodId: d.foodId,
          foodName: d.name,
          confidence: d.confidence,
          portion: { ...d.estimatedPortion },
          boundingBox: d.boundingBox,
        },
      ],
    }));
  }

  const groups = new Map<string, FoodDetection[]>();

  for (const det of detections) {
    // Unmapped foods are only grouped if their normalized canonical name is identical
    const groupKey =
      det.foodId === 'unmapped-food'
        ? `unmapped:${det.name.toLowerCase().trim()}`
        : det.foodId;

    const existing = groups.get(groupKey) || [];
    existing.push(det);
    groups.set(groupKey, existing);
  }

  const groupedResults: FoodDetection[] = [];

  for (const [, group] of groups.entries()) {
    // Case 1: Single physical region for this food identity
    if (group.length === 1) {
      const single = group[0];
      groupedResults.push({
        ...single,
        regions: single.regions || [
          {
            regionId: single.id,
            foodId: single.foodId,
            foodName: single.name,
            confidence: single.confidence,
            portion: { ...single.estimatedPortion },
            boundingBox: single.boundingBox,
          },
        ],
      });
      continue;
    }

    // Case 2: Multiple physical regions representing the SAME food identity
    // (e.g. two curry compartments on a thali, two rice mounds, multiple papads)
    const primary = group[0];
    const catalogItem = INDIAN_FOOD_DATABASE.find(f => f.id === primary.foodId);
    const standardServingWeight = catalogItem?.weightGramsPerUnit || 150;

    // Collect all constituent physical food regions
    const regions: DetectedFoodRegion[] = [];
    for (const d of group) {
      if (d.regions && d.regions.length > 0) {
        regions.push(...d.regions);
      } else {
        regions.push({
          regionId: d.id,
          foodId: d.foodId,
          foodName: d.name,
          confidence: d.confidence,
          portion: { ...d.estimatedPortion },
          boundingBox: d.boundingBox,
        });
      }
    }

    // Aggregate portion weights
    const totalGramsEquivalent = group.reduce(
      (sum, d) => sum + (d.estimatedPortion.rawGramsEquivalent || standardServingWeight),
      0
    );

    // Determine aggregated unit and quantity
    const firstUnit = group[0].estimatedPortion.unit;
    const allSameUnit = group.every(d => d.estimatedPortion.unit === firstUnit);

    let aggregatedQuantity: number;
    let aggregatedUnit = firstUnit;

    if (allSameUnit) {
      // If all regions share the exact same unit, sum numerical quantities directly
      aggregatedQuantity = Math.round(
        group.reduce((sum, d) => sum + d.estimatedPortion.quantity, 0) * 100
      ) / 100;
    } else {
      // If units differ (e.g. grams and bowls), normalize against reference catalog weight
      aggregatedUnit = 'serving';
      aggregatedQuantity = Math.round((totalGramsEquivalent / Math.max(1, standardServingWeight)) * 100) / 100;
    }

    // Portion confidence: weighted average across regions
    const aggregatedPortionConfidence =
      Math.round(
        (group.reduce(
          (sum, d) =>
            sum + d.estimatedPortion.confidence * (d.estimatedPortion.rawGramsEquivalent || 1),
          0
        ) /
          Math.max(1, totalGramsEquivalent)) *
          100
      ) / 100;

    const aggregatedPortion: EstimatedPortion = {
      quantity: aggregatedQuantity,
      unit: aggregatedUnit,
      confidence: aggregatedPortionConfidence,
      rawGramsEquivalent: totalGramsEquivalent,
    };

    // Overall recognition confidence: weighted average by physical mass
    const combinedConfidence =
      Math.round(
        (group.reduce(
          (sum, d) => sum + d.confidence * (d.estimatedPortion.rawGramsEquivalent || 1),
          0
        ) /
          Math.max(1, totalGramsEquivalent)) *
          100
      ) / 100;

    // Combine bounding boxes if available
    let combinedBoundingBox: BoundingBox | undefined;
    const boxesWithCoords = group.map(d => d.boundingBox).filter((b): b is BoundingBox => Boolean(b));
    if (boxesWithCoords.length > 0) {
      const minX = Math.min(...boxesWithCoords.map(b => b.x));
      const minY = Math.min(...boxesWithCoords.map(b => b.y));
      const maxX = Math.max(...boxesWithCoords.map(b => b.x + b.width));
      const maxY = Math.max(...boxesWithCoords.map(b => b.y + b.height));
      combinedBoundingBox = {
        x: Math.round(minX * 10) / 10,
        y: Math.round(minY * 10) / 10,
        width: Math.round((maxX - minX) * 10) / 10,
        height: Math.round((maxY - minY) * 10) / 10,
      };
    }

    // Merge candidate matches without duplicates
    const allCandidates = group.flatMap(d => d.candidateMatches || []);
    const uniqueCandidates = Array.from(
      new Map(allCandidates.map(c => [c.foodId, c])).values()
    );

    // needsConfirmation: true if any constituent region flagged uncertainty
    const combinedNeedsConfirmation =
      group.some(d => d.needsConfirmation) || combinedConfidence < 0.60;

    const combinedDetection: FoodDetection = {
      id: `grouped-${primary.foodId}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`,
      foodId: primary.foodId,
      name: primary.name,
      localNameHindi: primary.localNameHindi,
      confidence: combinedConfidence,
      confidenceTier: getConfidenceTier(combinedConfidence),
      estimatedPortion: aggregatedPortion,
      boundingBox: combinedBoundingBox || primary.boundingBox,
      source: group.some(d => d.source === 'user-corrected') ? 'user-corrected' : primary.source,
      candidateMatches: uniqueCandidates.length > 0 ? uniqueCandidates : primary.candidateMatches,
      needsConfirmation: combinedNeedsConfirmation,
      regions,
      identificationMode: primary.identificationMode,
      visualObservation: primary.visualObservation,
      evidence: primary.evidence,
      researchCandidates: primary.researchCandidates,
      isEstimatedNutrition: primary.isEstimatedNutrition,
      fallbackDescription: primary.fallbackDescription,
    };

    groupedResults.push(combinedDetection);
  }

  return groupedResults;
}
