'use client';

import React from 'react';
import { DetectedFoodItem, getConfidenceTier } from '../../lib/types';
import { EditIcon, PlusIcon, MinusIcon, TrashIcon, AlertCircleIcon } from '../ui/icons';

export interface FoodDetectionCardProps {
  item: DetectedFoodItem;
  alternativeCandidates?: Array<{ foodId: string; name: string; confidence: number }>;
  onUpdatePortion: (detectionId: string, deltaMultiplier: number) => void;
  onRemoveItem?: (detectionId: string) => void;
  onRequestChangeFood: (detectionId: string) => void;
  onSelectAlternative?: (detectionId: string, foodId: string) => void;
  canRemove?: boolean;
}

export function FoodDetectionCard({
  item,
  alternativeCandidates,
  onUpdatePortion,
  onRemoveItem,
  onRequestChangeFood,
  onSelectAlternative,
  canRemove = false,
}: FoodDetectionCardProps) {
  const confidencePercent = Math.round(item.confidence * 100);
  const confidenceTier = getConfidenceTier(item.confidence);

  let confidenceBadgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
  let confidenceLabel = `High confidence (${confidencePercent}%)`;
  if (confidenceTier === 'medium') {
    confidenceBadgeClass = 'bg-amber-50 text-amber-900 border-amber-200';
    confidenceLabel = `Medium confidence (${confidencePercent}%)`;
  } else if (confidenceTier === 'low') {
    confidenceBadgeClass = 'bg-rose-50 text-rose-900 border-rose-200';
    confidenceLabel = `Low confidence (${confidencePercent}%)`;
  }

  // Dominant nutrient identification
  const proteinCals = item.nutrition.protein * 4;
  const carbCals = item.nutrition.carbohydrates * 4;
  const fatCals = item.nutrition.fat * 9;
  const maxCals = Math.max(proteinCals, carbCals, fatCals);

  let dominantTag = 'Balanced mix';
  let dominantClass = 'bg-stone-100 text-stone-700 border-stone-200';
  if (carbCals === maxCals && carbCals > (proteinCals + fatCals) * 0.6) {
    dominantTag = 'Carb dominant';
    dominantClass = 'bg-amber-50 text-amber-800 border-amber-200';
  } else if (fatCals === maxCals && fatCals > (proteinCals + carbCals) * 0.5) {
    dominantTag = 'Fat dominant';
    dominantClass = 'bg-rose-50 text-rose-800 border-rose-200';
  } else if (proteinCals >= 20 || proteinCals >= maxCals * 0.7) {
    dominantTag = 'Protein source';
    dominantClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
  }

  const [showMicronutrients, setShowMicronutrients] = React.useState(false);
  const [showEvidence, setShowEvidence] = React.useState(false);

  const hasMicronutrients =
    item.micronutrients &&
    (item.micronutrients.iron !== undefined ||
      item.micronutrients.calcium !== undefined ||
      item.micronutrients.vitaminC !== undefined ||
      item.micronutrients.vitaminA !== undefined ||
      item.micronutrients.potassium !== undefined);

  return (
    <div
      className={`p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1D1A17] border transition-colors space-y-4 shadow-sm ${
        confidenceTier === 'low' || item.needsConfirmation
          ? 'border-amber-300 dark:border-amber-700/80 ring-1 ring-amber-200/50 dark:ring-amber-900/30'
          : 'border-stone-200 dark:border-[#38312A] hover:border-[#E86A33]/50 dark:hover:border-[#E86A33]/50'
      }`}
    >
      {/* Header: Food Identification & Confidence */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FEF7EE] dark:bg-[#2A1C14] text-[#E86A33]">
              Food Detected
            </span>
            <span
              className={`text-2xs font-bold px-2.5 py-0.5 rounded-full border ${confidenceBadgeClass}`}
            >
              {confidenceLabel}
            </span>
            {/* Identification Source Mode (Phase 6) */}
            <span
              className={`text-2xs font-bold px-2 py-0.5 rounded-full border ${
                item.identificationMode === 'research'
                  ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800/50'
                  : item.identificationMode === 'local'
                    ? 'bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800/50'
                    : 'bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800/50'
              }`}
            >
              {item.identificationMode === 'research'
                ? '🔬 Researched'
                : item.identificationMode === 'local'
                  ? '⚡ Local Match'
                  : '👁️ AI Vision'}
            </span>
            {item.isEstimatedNutrition && (
              <span
                className="text-2xs font-medium px-2 py-0.5 rounded-full bg-stone-100 dark:bg-[#25211D] text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-[#38312A]"
                title="Estimated nutritional profile based on regional recipe reference data, not laboratory measurements"
              >
                ~ Estimated Nutrition
              </span>
            )}
            {item.nutritionAvailable !== false && (
              <span className={`text-2xs font-semibold px-2 py-0.5 rounded-full border ${dominantClass}`}>
                {dominantTag}
              </span>
            )}
            {item.isUserModified && (
              <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
                User edited
              </span>
            )}
            {(confidenceTier === 'low' || item.needsConfirmation || item.confidence < 0.60) && (
              <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800/60 flex items-center gap-1">
                <span>⚠️</span>
                <span>Please confirm this food</span>
              </span>
            )}
            {item.regions && item.regions.length > 1 && (
              <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800/50">
                {item.regions.length} compartments combined
              </span>
            )}
          </div>

          <h3 className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100 leading-snug">
            {item.name}
          </h3>

          <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            {item.localNameHindi && (
              <span className="text-stone-600 dark:text-stone-400 font-medium">({item.localNameHindi})</span>
            )}
            <span>•</span>
            <span className="text-stone-700 dark:text-stone-300 font-medium">
              {item.regions && item.regions.length > 1
                ? `Estimated total: ≈ ${item.estimatedGrams}g (${item.portionMultiplier}x ${item.portionUnit})`
                : item.portionUnit === 'piece'
                  ? `Estimated: ${item.portionMultiplier} piece${item.portionMultiplier > 1 ? 's' : ''} (≈ ${item.estimatedGrams}g)`
                  : `Estimated: ${item.portionMultiplier} ${item.portionUnit} (≈ ${item.estimatedGrams}g)`}
            </span>
          </div>
        </div>

        {/* "Not correct?" correction trigger */}
        <button
          type="button"
          onClick={() => onRequestChangeFood(item.detectionId)}
          className="shrink-0 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 px-2.5 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800/60 transition-colors flex items-center gap-1 cursor-pointer"
          title="Change detected food"
        >
          <EditIcon size={13} />
          <span>Not correct?</span>
        </button>
      </div>

      {/* Low-confidence guidance prompt: explicit user confirmation */}
      {(confidenceTier === 'low' || item.needsConfirmation || item.confidence < 0.60) && (
        <div className="p-3 sm:p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
          <AlertCircleIcon size={16} className="text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="font-bold text-amber-950 dark:text-amber-200 text-xs sm:text-sm">
                Please confirm this food
              </p>
              <span className="text-3xs font-semibold px-2 py-0.5 rounded bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
                Visual match uncertain ({confidencePercent}%)
              </span>
            </div>
            <p className="text-2xs text-amber-800 dark:text-amber-300 leading-relaxed">
              Visual evidence for this item is ambiguous. Rather than assuming &quot;{item.name}&quot; is definitely correct, please verify or choose your exact meal dish.
            </p>
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <button
                type="button"
                onClick={() => onRequestChangeFood(item.detectionId)}
                className="text-2xs font-bold text-emerald-800 dark:text-emerald-300 bg-white dark:bg-[#25211D] hover:bg-emerald-50 dark:hover:bg-emerald-950/50 px-2.5 py-1 rounded-lg border border-emerald-300 dark:border-emerald-800/60 transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
              >
                <EditIcon size={11} />
                <span>Change food / Correct</span>
              </button>
              {canRemove && onRemoveItem && (
                <button
                  type="button"
                  onClick={() => onRemoveItem(item.detectionId)}
                  className="text-2xs font-medium text-rose-700 dark:text-rose-400 hover:text-rose-900 dark:hover:text-rose-200 bg-white dark:bg-[#25211D] hover:bg-rose-50 dark:hover:bg-rose-950/40 px-2 py-1 rounded-lg border border-rose-200 dark:border-rose-900/40 transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  <TrashIcon size={11} />
                  <span>Remove item</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Physical Compartment / Multi-region breakdown */}
      {item.regions && item.regions.length > 1 && (
        <div className="p-2.5 rounded-xl bg-sky-50/60 dark:bg-sky-950/20 border border-sky-200/80 dark:border-sky-900/40 text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-3xs font-bold text-sky-800 dark:text-sky-300 uppercase tracking-wider block">
              Grouped Physical Regions ({item.regions.length} compartments):
            </span>
            <span className="text-3xs text-sky-700 dark:text-sky-400 font-medium">
              Total: ~{item.estimatedGrams}g
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {item.regions.map((reg, idx) => (
              <span
                key={reg.regionId || idx}
                className="text-2xs py-0.5 px-2 rounded-md bg-white dark:bg-[#25211D] border border-sky-200 dark:border-sky-800/50 text-sky-900 dark:text-sky-200 font-mono"
              >
                Region #{idx + 1}: ~{reg.portion.rawGramsEquivalent || Math.round(reg.portion.quantity)}g ({Math.round(reg.confidence * 100)}% conf)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Alternative candidate quick switches */}
      {alternativeCandidates && alternativeCandidates.length > 0 && onSelectAlternative && (
        <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-[#25211D] border border-stone-200/80 dark:border-[#38312A] text-xs space-y-1.5">
          <span className="text-3xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider block">
            Alternative Visual Matches:
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {alternativeCandidates.map(alt => (
              <button
                key={alt.foodId}
                type="button"
                onClick={() => onSelectAlternative(item.detectionId, alt.foodId)}
                className="text-xs py-1 px-2.5 rounded-lg bg-white dark:bg-[#1D1A17] border border-stone-200 dark:border-[#38312A] hover:border-[#E86A33] hover:bg-[#FEF7EE] dark:hover:bg-[#2A1C14] text-stone-700 dark:text-stone-300 font-medium transition-colors cursor-pointer"
              >
                <span>{alt.name}</span>
                <span className="text-3xs text-stone-400 dark:text-stone-500 ml-1.5">({Math.round(alt.confidence * 100)}%)</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Fallback Notice for Uncertain Foods (Phase 6 Stage 12) */}
      {item.fallbackDescription && (
        <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/90 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
          <span className="text-amber-600 dark:text-amber-400 mt-0.5 font-bold">ℹ️</span>
          <div>
            <span className="font-semibold block text-amber-950 dark:text-amber-100">Identification Note:</span>
            <p className="text-2xs text-amber-800 dark:text-amber-300 leading-relaxed italic">
              &ldquo;{item.fallbackDescription}&rdquo;
            </p>
          </div>
        </div>
      )}

      {/* Evidence & Sources Disclosure (Phase 6 Stage 6) */}
      {item.evidence && item.evidence.length > 0 && (
        <div className="pt-0.5">
          <button
            type="button"
            onClick={() => setShowEvidence(!showEvidence)}
            className="text-3xs font-semibold text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 flex items-center gap-1 cursor-pointer transition-colors py-1 px-1.5 rounded hover:bg-stone-50 dark:hover:bg-stone-800/40"
          >
            <span>{showEvidence ? '▼ Hide' : '▶ Show'} Grounding Evidence & Sources ({item.evidence.length})</span>
          </button>
          {showEvidence && (
            <div className="mt-1.5 p-2.5 rounded-xl bg-stone-50 dark:bg-[#25211D] border border-stone-200 dark:border-[#38312A] text-2xs space-y-2 text-stone-700 dark:text-stone-300">
              {item.visualObservation && (
                <div className="pb-1.5 border-b border-stone-200/60 dark:border-[#38312A]">
                  <span className="font-bold text-stone-800 dark:text-stone-200 block text-3xs uppercase tracking-wider mb-0.5">
                    Visual Evidence Observed:
                  </span>
                  <p className="text-3xs text-stone-600 dark:text-stone-400 leading-relaxed">
                    {[
                      item.visualObservation.appearance && `Appearance: ${item.visualObservation.appearance}`,
                      item.visualObservation.color && `Color: ${item.visualObservation.color}`,
                      item.visualObservation.texture && `Texture: ${item.visualObservation.texture}`,
                      item.visualObservation.visibleIngredients &&
                        item.visualObservation.visibleIngredients.length > 0 &&
                        `Ingredients: ${item.visualObservation.visibleIngredients.join(', ')}`,
                      item.visualObservation.cookingStyle && `Style: ${item.visualObservation.cookingStyle}`,
                    ]
                      .filter(Boolean)
                      .join(' • ')}
                  </p>
                </div>
              )}
              <div className="space-y-1.5">
                {item.evidence.map((ev, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-3xs">
                    <span className="font-bold text-stone-400 shrink-0">
                      {ev.type === 'web' ? '🌐' : ev.type === 'visual' ? '👁️' : '⚡'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-stone-800 dark:text-stone-200">{ev.title || ev.type}: </span>
                      <span className="text-stone-600 dark:text-stone-400">{ev.relevance}</span>
                      {ev.source && ev.type === 'web' && (
                        <a
                          href={ev.source}
                          target="_blank"
                          rel="noreferrer"
                          className="block text-3xs text-emerald-700 dark:text-emerald-400 hover:underline truncate max-w-xs mt-0.5"
                        >
                          {ev.source}
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* UNKNOWN / UNCONFIRMED FOOD: Do not invent nutrition */}
      {item.nutritionAvailable === false ? (
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
          <div className="flex items-center gap-2">
            <AlertCircleIcon size={15} className="text-amber-700 dark:text-amber-400 shrink-0" />
            <span className="font-bold">Nutrition Unverified</span>
          </div>
          <p className="text-2xs text-amber-800 dark:text-amber-300 leading-relaxed">
            This item is not yet matched to our internal database. Tap <span className="font-semibold underline cursor-pointer" onClick={() => onRequestChangeFood(item.detectionId)}>&quot;Not correct?&quot;</span> above to select your exact dish and calculate real nutrition.
          </p>
        </div>
      ) : (
        <>
          {/* Nutrient Breakdown Strip */}
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 pt-2 border-t border-stone-100 dark:border-[#38312A] text-center text-xs">
            <div className="p-2 rounded-xl bg-stone-50 dark:bg-[#25211D] border border-stone-200/80 dark:border-[#38312A]">
              <span className="block text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase">Calories</span>
              <span className="text-sm font-bold text-stone-900 dark:text-stone-100">{item.isUserModified ? '' : '≈ '}{item.nutrition.calories}</span>
              <span className="text-3xs text-stone-500 dark:text-stone-400 block">kcal</span>
            </div>
            <div className="p-2 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
              <span className="block text-3xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase">Protein</span>
              <span className="text-sm font-bold text-emerald-800 dark:text-emerald-300">{item.isUserModified ? '' : '≈ '}{item.nutrition.protein}g</span>
              <span className="text-3xs text-emerald-600 dark:text-emerald-400 block">
                {Math.round((item.nutrition.protein * 4 / Math.max(1, item.nutrition.calories)) * 100)}% cals
              </span>
            </div>
            <div className="p-2 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40">
              <span className="block text-3xs font-semibold text-amber-700 dark:text-amber-400 uppercase">Carbs</span>
              <span className="text-sm font-bold text-amber-800 dark:text-amber-300">{item.isUserModified ? '' : '≈ '}{item.nutrition.carbohydrates}g</span>
              <span className="text-3xs text-amber-600 dark:text-amber-400 block">
                {Math.round((item.nutrition.carbohydrates * 4 / Math.max(1, item.nutrition.calories)) * 100)}% cals
              </span>
            </div>
            <div className="p-2 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40">
              <span className="block text-3xs font-semibold text-rose-700 dark:text-rose-400 uppercase">Fat</span>
              <span className="text-sm font-bold text-rose-800 dark:text-rose-300">{item.isUserModified ? '' : '≈ '}{item.nutrition.fat}g</span>
              <span className="text-3xs text-rose-600 dark:text-rose-400 block">
                {Math.round((item.nutrition.fat * 9 / Math.max(1, item.nutrition.calories)) * 100)}% cals
              </span>
            </div>
            <div className="hidden sm:block p-2 rounded-xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900/40">
              <span className="block text-3xs font-semibold text-teal-700 dark:text-teal-400 uppercase">Fiber</span>
              <span className="text-sm font-bold text-teal-800 dark:text-teal-300">{item.isUserModified ? '' : '≈ '}{item.nutrition.fiber}g</span>
              <span className="text-3xs text-teal-600 dark:text-teal-400 block">gut fiber</span>
            </div>
          </div>

          {/* Secondary Expandable Micronutrients Section */}
          {hasMicronutrients && (
            <div className="pt-1 border-t border-stone-100 dark:border-[#38312A]">
              <button
                type="button"
                onClick={() => setShowMicronutrients(!showMicronutrients)}
                className="text-3xs font-bold text-stone-500 dark:text-stone-400 hover:text-emerald-700 dark:hover:text-emerald-400 uppercase tracking-wider flex items-center justify-between w-full transition-colors cursor-pointer py-1"
              >
                <span>Micronutrients & Minerals</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{showMicronutrients ? '▲ Hide' : '▼ View'}</span>
              </button>
              {showMicronutrients && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 pt-2 text-xs animate-in fade-in duration-200">
                  {item.micronutrients?.iron !== undefined && (
                    <div className="p-1.5 rounded-lg bg-stone-50 dark:bg-[#25211D] border border-stone-200/80 dark:border-[#38312A] text-center">
                      <span className="block text-3xs text-stone-500 dark:text-stone-400 font-semibold uppercase">Iron</span>
                      <span className="font-bold text-stone-800 dark:text-stone-200">{item.micronutrients.iron} mg</span>
                    </div>
                  )}
                  {item.micronutrients?.calcium !== undefined && (
                    <div className="p-1.5 rounded-lg bg-stone-50 dark:bg-[#25211D] border border-stone-200/80 dark:border-[#38312A] text-center">
                      <span className="block text-3xs text-stone-500 dark:text-stone-400 font-semibold uppercase">Calcium</span>
                      <span className="font-bold text-stone-800 dark:text-stone-200">{item.micronutrients.calcium} mg</span>
                    </div>
                  )}
                  {item.micronutrients?.vitaminC !== undefined && (
                    <div className="p-1.5 rounded-lg bg-stone-50 dark:bg-[#25211D] border border-stone-200/80 dark:border-[#38312A] text-center">
                      <span className="block text-3xs text-stone-500 dark:text-stone-400 font-semibold uppercase">Vitamin C</span>
                      <span className="font-bold text-stone-800 dark:text-stone-200">{item.micronutrients.vitaminC} mg</span>
                    </div>
                  )}
                  {item.micronutrients?.vitaminA !== undefined && (
                    <div className="p-1.5 rounded-lg bg-stone-50 dark:bg-[#25211D] border border-stone-200/80 dark:border-[#38312A] text-center">
                      <span className="block text-3xs text-stone-500 dark:text-stone-400 font-semibold uppercase">Vitamin A</span>
                      <span className="font-bold text-stone-800 dark:text-stone-200">{item.micronutrients.vitaminA} mcg</span>
                    </div>
                  )}
                  {item.micronutrients?.potassium !== undefined && (
                    <div className="p-1.5 rounded-lg bg-stone-50 dark:bg-[#25211D] border border-stone-200/80 dark:border-[#38312A] text-center">
                      <span className="block text-3xs text-stone-500 dark:text-stone-400 font-semibold uppercase">Potassium</span>
                      <span className="font-bold text-stone-800 dark:text-stone-200">{item.micronutrients.potassium} mg</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Portion Adjuster & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-stone-100 dark:border-[#38312A]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">Portion:</span>
          {/* Quick presets */}
          <div className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-stone-100 dark:bg-[#25211D] border border-stone-200 dark:border-[#38312A]">
            <button
              type="button"
              onClick={() => onUpdatePortion(item.detectionId, Math.round((0.75 - item.portionMultiplier) * 100) / 100)}
              className={`px-2 py-0.5 text-2xs font-semibold rounded-md transition-colors cursor-pointer ${
                Math.abs(item.portionMultiplier - 0.75) < 0.05
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              Small (0.75x)
            </button>
            <button
              type="button"
              onClick={() => onUpdatePortion(item.detectionId, Math.round((1.0 - item.portionMultiplier) * 100) / 100)}
              className={`px-2 py-0.5 text-2xs font-semibold rounded-md transition-colors cursor-pointer ${
                Math.abs(item.portionMultiplier - 1.0) < 0.05
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              Regular (1x)
            </button>
            <button
              type="button"
              onClick={() => onUpdatePortion(item.detectionId, Math.round((1.5 - item.portionMultiplier) * 100) / 100)}
              className={`px-2 py-0.5 text-2xs font-semibold rounded-md transition-colors cursor-pointer ${
                Math.abs(item.portionMultiplier - 1.5) < 0.05
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              Large (1.5x)
            </button>
          </div>

          {/* Fine-tuning +/- */}
          <div className="flex items-center gap-1 bg-stone-100 dark:bg-[#25211D] p-0.5 rounded-lg border border-stone-200 dark:border-[#38312A]">
            <button
              type="button"
              aria-label="Decrease portion"
              onClick={() => onUpdatePortion(item.detectionId, -0.25)}
              disabled={item.portionMultiplier <= 0.25}
              className="w-7 h-7 sm:w-6 sm:h-6 rounded bg-white dark:bg-[#1D1A17] text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 flex items-center justify-center disabled:opacity-40 shadow-2xs cursor-pointer min-w-[28px] min-h-[28px]"
            >
              <MinusIcon size={12} />
            </button>
            <span className="text-2xs font-bold text-stone-800 dark:text-stone-200 px-1.5 min-w-[32px] text-center font-mono">
              {item.portionMultiplier}x
            </span>
            <button
              type="button"
              aria-label="Increase portion"
              onClick={() => onUpdatePortion(item.detectionId, 0.25)}
              disabled={item.portionMultiplier >= 4.0}
              className="w-7 h-7 sm:w-6 sm:h-6 rounded bg-white dark:bg-[#1D1A17] text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 flex items-center justify-center disabled:opacity-40 shadow-2xs cursor-pointer min-w-[28px] min-h-[28px]"
            >
              <PlusIcon size={12} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
          <span className="text-3xs text-stone-400 dark:text-stone-500 italic">
            AI estimate — verify portion if needed
          </span>
          {canRemove && onRemoveItem && (
            <button
              type="button"
              onClick={() => onRemoveItem(item.detectionId)}
              className="text-xs text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors flex items-center gap-1 cursor-pointer"
              title="Remove item"
            >
              <TrashIcon size={14} />
              <span className="hidden sm:inline">Remove</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
