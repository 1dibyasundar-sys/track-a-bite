'use client';

import React from 'react';
import { DetectedFoodItem } from '../../lib/types';
import { PlusIcon, MinusIcon, TrashIcon, EditIcon } from '../ui/icons';

export interface DetectedItemsEditorProps {
  items: DetectedFoodItem[];
  onUpdatePortion: (detectionId: string, deltaMultiplier: number) => void;
  onRemoveItem: (detectionId: string) => void;
  onRequestChangeFood: (detectionId: string) => void;
  onRequestAddFood: () => void;
}

export function DetectedItemsEditor({
  items,
  onUpdatePortion,
  onRemoveItem,
  onRequestChangeFood,
  onRequestAddFood,
}: DetectedItemsEditorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-1">
        <div>
          <h3 className="text-sm font-bold text-stone-900">
            Detected Items ({items.length})
          </h3>
          <p className="text-2xs text-stone-500">
            Review, adjust portions, swap misidentifications, or add missed items.
          </p>
        </div>
        <button
          type="button"
          onClick={onRequestAddFood}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/80 flex items-center gap-1 transition-colors cursor-pointer"
        >
          <PlusIcon size={14} />
          <span>Add Item</span>
        </button>
      </div>

      {items.length === 0 ? (
        <div className="p-6 text-center rounded-xl border border-dashed border-stone-300 text-stone-500 text-xs">
          No food items on the plate currently. Tap &quot;Add Item&quot; to pick foods.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => {
            const confidencePercent = Math.round(item.confidence * 100);

            return (
              <div
                key={item.detectionId}
                className="p-3.5 rounded-xl bg-white border border-stone-200 shadow-2xs hover:border-stone-300 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                {/* Item Details */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-stone-900 truncate">
                      {item.name}
                    </span>
                    {item.localNameHindi && (
                      <span className="text-xs text-stone-500">
                        ({item.localNameHindi})
                      </span>
                    )}
                    {item.isUserModified && (
                      <span className="text-2xs font-semibold px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200">
                        Edited
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 mt-1 text-2xs text-stone-500">
                    <span className="font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                      {confidencePercent}% match
                    </span>
                    <span>•</span>
                    <span>~{item.estimatedGrams}g est.</span>
                    <span>•</span>
                    <span className="font-bold text-stone-800">
                      {item.nutrition.calories} kcal
                    </span>
                    <span>({item.nutrition.protein}g P / {item.nutrition.carbohydrates}g C / {item.nutrition.fiber}g F)</span>
                  </div>
                </div>

                {/* Actions: Portion control & Edit/Delete */}
                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                  {/* Portion Adjustment */}
                  <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-lg">
                    <button
                      type="button"
                      aria-label="Decrease portion"
                      onClick={() => onUpdatePortion(item.detectionId, -0.25)}
                      disabled={item.portionMultiplier <= 0.25}
                      className="w-7 h-7 rounded-md bg-white text-stone-700 hover:text-stone-900 flex items-center justify-center disabled:opacity-40 shadow-2xs cursor-pointer"
                    >
                      <MinusIcon size={13} />
                    </button>
                    <span className="text-xs font-bold text-stone-800 px-2 min-w-[40px] text-center">
                      {item.portionMultiplier}x
                    </span>
                    <button
                      type="button"
                      aria-label="Increase portion"
                      onClick={() => onUpdatePortion(item.detectionId, 0.25)}
                      disabled={item.portionMultiplier >= 4.0}
                      className="w-7 h-7 rounded-md bg-white text-stone-700 hover:text-stone-900 flex items-center justify-center disabled:opacity-40 shadow-2xs cursor-pointer"
                    >
                      <PlusIcon size={13} />
                    </button>
                  </div>

                  {/* Change Food Button */}
                  <button
                    type="button"
                    onClick={() => onRequestChangeFood(item.detectionId)}
                    title="Change food match"
                    className="p-2 text-stone-500 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <EditIcon size={16} />
                  </button>

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.detectionId)}
                    title="Remove item"
                    className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <TrashIcon size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
