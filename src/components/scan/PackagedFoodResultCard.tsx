'use client';

import React from 'react';
import { PackagedProduct, ExpiryStatus } from '../../lib/types/barcode';
import { expiryCalculationService } from '../../lib/services/expiryCalculationService';
import { AlertCircleIcon, PlusIcon, RefreshCwIcon } from '../ui/icons';

interface PackagedFoodResultCardProps {
  product: PackagedProduct;
  onOpenOcr: () => void;
  onAddToMeal: () => void;
  onReset: () => void;
  isSaving?: boolean;
}

export function PackagedFoodResultCard({
  product,
  onOpenOcr,
  onAddToMeal,
  onReset,
  isSaving = false,
}: PackagedFoodResultCardProps) {
  const { nutrition, packageDetails } = product;

  // Determine current effective expiry status
  const effectiveStatus: ExpiryStatus =
    packageDetails?.expiryStatus || product.expiryStatus || 'UNKNOWN';

  const mfgDisplay =
    packageDetails?.manufacturingDate ||
    product.manufacturingDate ||
    null;

  const expDisplay =
    packageDetails?.expiryDate ||
    product.expiryDate ||
    null;

  const derivedExpDisplay =
    packageDetails?.derivedBestBeforeDate || null;

  const batchDisplay =
    packageDetails?.batchNumber ||
    product.batchNumber ||
    null;

  const displayImage = product.imageUrl || product.productImage;
  const proteinDisplay = nutrition.protein ?? nutrition.proteinGrams ?? 0;
  const carbsDisplay = nutrition.carbohydrates ?? nutrition.carbsGrams ?? 0;
  const fatDisplay = nutrition.fat ?? nutrition.fatGrams ?? 0;
  const sugarDisplay = nutrition.sugar ?? nutrition.sugarGrams;
  const sodiumDisplay = nutrition.sodium ?? nutrition.sodiumMilligrams;
  const fiberDisplay = nutrition.fiber ?? nutrition.fiberGrams;

  return (
    <div className="bg-white dark:bg-[#131d16] rounded-3xl border border-stone-200 dark:border-[#23382b] text-stone-900 dark:text-stone-100 shadow-md overflow-hidden transition-all">
      {/* Top Banner / Type Tag */}
      <div className="bg-stone-900 dark:bg-[#0c130e] px-5 py-3 text-white flex items-center justify-between border-b border-stone-800 dark:border-[#23382b]">
        <div className="flex items-center gap-2">
          <span className="text-base">🔳</span>
          <span className="text-xs font-extrabold tracking-wider uppercase text-emerald-400">
            Packaged Food
          </span>
        </div>
        <span className="text-2xs font-mono text-stone-400 bg-stone-800 dark:bg-stone-900 px-2.5 py-1 rounded-md">
          GTIN / EAN: {product.barcode}
        </span>
      </div>

      {/* Safety Warning Banner if Expired */}
      {effectiveStatus === 'EXPIRED' && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900/60 border border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-300 flex items-center justify-center shrink-0">
            <AlertCircleIcon size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300 bg-rose-200/60 dark:bg-rose-900/80 px-2 py-0.5 rounded">
                🔴 EXPIRED
              </span>
            </div>
            <p className="text-xs font-medium text-rose-800 dark:text-rose-200 mt-1">
              This product appears to be past its detected expiry date.
            </p>
            {packageDetails?.expiryExplanation && (
              <p className="text-2xs text-rose-600 dark:text-rose-400 mt-0.5">
                {packageDetails.expiryExplanation}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Expiring Soon Alert */}
      {effectiveStatus === 'EXPIRING_SOON' && (
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/60 text-amber-950 dark:text-amber-200 flex items-start gap-3">
          <span className="text-lg">⚠️</span>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 bg-amber-200/60 dark:bg-amber-900/80 px-2 py-0.5 rounded">
              🟡 Expiring Soon
            </span>
            <p className="text-xs text-amber-900 dark:text-amber-200 mt-1">
              {packageDetails?.expiryExplanation || 'This item is approaching its expiration date.'}
            </p>
          </div>
        </div>
      )}

      <div className="p-5 sm:p-6 space-y-6">
        {/* Product Identity Header */}
        <div className="flex flex-col sm:flex-row items-start gap-4">
          {displayImage ? (
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-stone-50 dark:bg-[#16231a] border border-stone-200 dark:border-[#23382b] p-1 shrink-0 flex items-center justify-center overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={displayImage}
                alt={product.productName}
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center justify-center text-stone-400 text-3xl shrink-0">
              🥫
            </div>
          )}

          <div className="space-y-1 flex-1 min-w-0">
            {product.brand && (
              <span className="text-2xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-full inline-block">
                {product.brand}
              </span>
            )}
            <h2 className="text-xl sm:text-2xl font-extrabold text-stone-900 dark:text-stone-100 leading-tight">
              {product.productName}
            </h2>
            {product.servingSize && (
              <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">
                Serving size: {product.servingSize}
              </p>
            )}
            {product.quantity && (
              <p className="text-xs text-stone-400 dark:text-stone-500">
                Package net weight: {product.quantity}
              </p>
            )}
          </div>
        </div>

        {/* Nutrition Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
              Nutrition Information
            </h3>
            <span className="text-3xs text-stone-400 dark:text-stone-500">
              {product.servingSize ? `Per ${product.servingSize}` : 'Per 100g / ml'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* Calories */}
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 text-center">
              <span className="text-3xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">
                Energy
              </span>
              <span className="text-lg font-black text-emerald-950 dark:text-emerald-100">
                {Math.round(nutrition.calories || 0)}
              </span>
              <span className="text-3xs text-emerald-700 dark:text-emerald-400 block">kcal</span>
            </div>

            {/* Protein */}
            <div className="p-3 rounded-2xl bg-stone-50 dark:bg-[#16231a] border border-stone-200 dark:border-[#23382b] text-center">
              <span className="text-3xs font-semibold text-stone-600 dark:text-stone-400 uppercase tracking-wider block">
                Protein
              </span>
              <span className="text-lg font-black text-stone-900 dark:text-stone-100">
                {proteinDisplay}g
              </span>
            </div>

            {/* Carbohydrates */}
            <div className="p-3 rounded-2xl bg-stone-50 dark:bg-[#16231a] border border-stone-200 dark:border-[#23382b] text-center">
              <span className="text-3xs font-semibold text-stone-600 dark:text-stone-400 uppercase tracking-wider block">
                Carbs
              </span>
              <span className="text-lg font-black text-stone-900 dark:text-stone-100">
                {carbsDisplay}g
              </span>
            </div>

            {/* Fat */}
            <div className="p-3 rounded-2xl bg-stone-50 dark:bg-[#16231a] border border-stone-200 dark:border-[#23382b] text-center">
              <span className="text-3xs font-semibold text-stone-600 dark:text-stone-400 uppercase tracking-wider block">
                Fat
              </span>
              <span className="text-lg font-black text-stone-900 dark:text-stone-100">
                {fatDisplay}g
              </span>
            </div>
          </div>

          {/* Secondary Nutrients: Sugar, Sodium, Fiber */}
          <div className="grid grid-cols-3 gap-2 text-center pt-1">
            <div className="p-2 rounded-xl bg-stone-50/70 dark:bg-[#16231a]/70 border border-stone-200/70 dark:border-[#23382b]/70">
              <span className="text-3xs text-stone-500 dark:text-stone-400 block">Sugar</span>
              <span className="text-xs font-bold text-stone-800 dark:text-stone-200">
                {sugarDisplay !== undefined && sugarDisplay !== null ? `${sugarDisplay}g` : '—'}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-stone-50/70 dark:bg-[#16231a]/70 border border-stone-200/70 dark:border-[#23382b]/70">
              <span className="text-3xs text-stone-500 dark:text-stone-400 block">Sodium</span>
              <span className="text-xs font-bold text-stone-800 dark:text-stone-200">
                {sodiumDisplay !== undefined && sodiumDisplay !== null ? `${sodiumDisplay}mg` : '—'}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-stone-50/70 dark:bg-[#16231a]/70 border border-stone-200/70 dark:border-[#23382b]/70">
              <span className="text-3xs text-stone-500 dark:text-stone-400 block">Dietary Fiber</span>
              <span className="text-xs font-bold text-stone-800 dark:text-stone-200">
                {fiberDisplay !== undefined && fiberDisplay !== null ? `${fiberDisplay}g` : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Ingredients & Allergens (if available) */}
        {(product.ingredientsText || product.allergens) && (
          <div className="space-y-2 pt-1">
            {product.allergens && (
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-2xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
                <span className="font-bold text-amber-800 dark:text-amber-300">Allergen Notice:</span>
                <span>{Array.isArray(product.allergens) ? product.allergens.join(', ') : product.allergens}</span>
              </div>
            )}
            {product.ingredientsText && (
              <div className="text-2xs text-stone-600 dark:text-stone-300 leading-relaxed bg-stone-50 dark:bg-[#16231a] p-3 rounded-2xl border border-stone-200 dark:border-[#23382b]">
                <span className="font-bold text-stone-700 dark:text-stone-200 block mb-0.5">Ingredients:</span>
                <span className="line-clamp-3">{product.ingredientsText}</span>
              </div>
            )}
          </div>
        )}

        {/* Package Details (MFG / EXP / Batch) Section */}
        <div className="bg-stone-50 dark:bg-[#16231a] rounded-2xl p-4 border border-stone-200 dark:border-[#23382b] space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
              <span>📅</span> Package Verification &amp; Dates
            </h3>
            <button
              type="button"
              onClick={onOpenOcr}
              className="text-2xs font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 underline cursor-pointer"
            >
              {packageDetails ? 'Re-scan / Edit Details' : 'Scan Package Details'}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {/* Manufacturing Date */}
            <div className="p-2.5 rounded-xl bg-white dark:bg-[#19271e] border border-stone-200 dark:border-[#23382b]">
              <span className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider block">
                MFG Date
              </span>
              <span className="font-bold text-stone-900 dark:text-stone-100 font-mono mt-0.5 block truncate">
                {mfgDisplay
                  ? expiryCalculationService.formatHumanDate(mfgDisplay)
                  : 'Unverified'}
              </span>
            </div>

            {/* Expiry Date */}
            <div className="p-2.5 rounded-xl bg-white dark:bg-[#19271e] border border-stone-200 dark:border-[#23382b]">
              <span className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider block">
                EXP Date
              </span>
              <span className="font-bold text-stone-900 dark:text-stone-100 font-mono mt-0.5 block truncate">
                {expDisplay
                  ? expiryCalculationService.formatHumanDate(expDisplay)
                  : 'Unverified'}
              </span>
            </div>

            {/* Batch / Lot */}
            <div className="p-2.5 rounded-xl bg-white dark:bg-[#19271e] border border-stone-200 dark:border-[#23382b]">
              <span className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider block">
                Batch / Lot
              </span>
              <span className="font-bold text-stone-900 dark:text-stone-100 font-mono mt-0.5 block truncate">
                {batchDisplay || 'Unverified'}
              </span>
            </div>

            {/* Status */}
            <div className="p-2.5 rounded-xl bg-white dark:bg-[#19271e] border border-stone-200 dark:border-[#23382b] flex flex-col justify-center">
              <span className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider block">
                Status
              </span>
              <div className="mt-0.5">
                {effectiveStatus === 'VALID' && (
                  <span className="text-2xs font-bold text-emerald-700 dark:text-emerald-400">🟢 Valid</span>
                )}
                {effectiveStatus === 'EXPIRING_SOON' && (
                  <span className="text-2xs font-bold text-amber-700 dark:text-amber-400">🟡 Expiring Soon</span>
                )}
                {effectiveStatus === 'EXPIRED' && (
                  <span className="text-2xs font-bold text-rose-700 dark:text-rose-400">🔴 Expired</span>
                )}
                {effectiveStatus === 'UNKNOWN' && (
                  <span className="text-2xs font-medium text-stone-500 dark:text-stone-400">⚪ Unverified</span>
                )}
              </div>
            </div>
          </div>

          {/* Derived Best Before notice */}
          {derivedExpDisplay && (
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-2xs text-emerald-900 dark:text-emerald-200">
              <span className="font-bold">Estimated Best Before:</span>{' '}
              {expiryCalculationService.formatHumanDate(derivedExpDisplay)}{' '}
              <span className="text-emerald-700 dark:text-emerald-400">(Calculated from printed MFG date)</span>
            </div>
          )}

          {/* Explicit unverified date disclaimer when neither date is known */}
          {!mfgDisplay && !expDisplay && (
            <p className="text-2xs text-stone-500 dark:text-stone-400 italic">
              &quot;Manufacturing/expiry date could not be verified from the package.&quot;
            </p>
          )}

          {/* Call-to-action to scan package details if not done yet */}
          {!packageDetails && (
            <button
              type="button"
              onClick={onOpenOcr}
              className="w-full py-2.5 px-4 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>📷</span> Scan Package Details (MFG / EXP / Batch)
            </button>
          )}
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-stone-100 dark:border-stone-800">
          <button
            type="button"
            onClick={onReset}
            className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RefreshCwIcon size={14} /> Scan Another Product
          </button>

          <button
            type="button"
            onClick={onAddToMeal}
            disabled={isSaving}
            className="w-full sm:flex-1 py-3 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 disabled:opacity-50 text-white font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSaving ? (
              <>
                <RefreshCwIcon size={16} className="animate-spin" /> Saving Meal...
              </>
            ) : (
              <>
                <PlusIcon size={16} /> Add to Meal
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
