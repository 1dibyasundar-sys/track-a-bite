'use client';

import React, { useState } from 'react';
import { CAMPUS_CHOICES } from '../../data/campusChoices';
import { SparklesIcon, CheckIcon } from '../ui/icons';

export function CampusRealitySection() {
  const [selectedIds, setSelectedIds] = useState<string[]>(['kachori', 'packaged-juice']);

  const toggleItem = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter(i => i !== id);
      }
      if (prev.length >= 3) {
        return [...prev.slice(1), id];
      }
      return [...prev, id];
    });
  };

  const selectedItems = CAMPUS_CHOICES.filter(c => selectedIds.includes(c.id));

  const totalCalories = selectedItems.reduce((acc, i) => acc + i.calories, 0);
  const totalProtein = Math.round(selectedItems.reduce((acc, i) => acc + i.protein, 0) * 10) / 10;
  const totalCarbs = Math.round(selectedItems.reduce((acc, i) => acc + i.carbs, 0) * 10) / 10;
  const totalFat = Math.round(selectedItems.reduce((acc, i) => acc + i.fat, 0) * 10) / 10;
  const totalFiber = Math.round(selectedItems.reduce((acc, i) => acc + i.fiber, 0) * 10) / 10;

  // Derive intelligent, non-judgmental advice based on combination
  const hasOnlyCarbSnacks = selectedItems.every(i => i.category === 'snack' || i.category === 'drink');
  const hasUpgrade = selectedItems.some(i => i.category === 'upgrade' || i.id === 'sprouts-chaat');

  return (
    <div className="p-6 sm:p-8 rounded-3xl bg-stone-900 text-white border border-stone-800 space-y-6 shadow-md">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-stone-800">
        <div>
          <div className="flex items-center gap-1.5 text-emerald-400 text-2xs font-bold uppercase tracking-wider mb-1">
            <SparklesIcon size={14} />
            <span>Interactive Campus Feature</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Campus Reality: Making the Better Call
          </h2>
          <p className="text-xs sm:text-sm text-stone-400 mt-1 max-w-2xl">
            College canteens don’t serve clinical diets. Select 1 to 3 items you actually have access to right now:
          </p>
        </div>

        <span className="self-start md:self-auto text-2xs font-semibold px-2.5 py-1 rounded-full bg-stone-800 text-stone-300 border border-stone-700">
          Tap items to combine
        </span>
      </div>

      {/* Item Pill Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
        {CAMPUS_CHOICES.map(item => {
          const isSelected = selectedIds.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggleItem(item.id)}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between h-24 ${
                isSelected
                  ? 'bg-emerald-950/80 border-emerald-400 text-white shadow-xs'
                  : 'bg-stone-800/80 border-stone-700 text-stone-300 hover:bg-stone-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl">{item.emoji}</span>
                {isSelected && (
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-stone-950 flex items-center justify-center font-bold">
                    <CheckIcon size={12} />
                  </span>
                )}
              </div>
              <div>
                <span className="text-xs font-bold block truncate">{item.name}</span>
                <span className="text-3xs text-stone-400">{item.approximatePrice}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Analysis & Better Combo Output */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
        {/* Left: Combined Numbers (5 cols) */}
        <div className="lg:col-span-5 p-4 rounded-2xl bg-stone-950 border border-stone-800 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-300 uppercase tracking-wide">
              Selected Combo ({selectedItems.length})
            </span>
            <span className="text-xs font-black text-emerald-400 font-mono">
              ~{totalCalories} kcal
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {selectedItems.map(item => (
              <span
                key={item.id}
                className="text-2xs font-semibold px-2 py-1 rounded-lg bg-stone-800 text-stone-200"
              >
                {item.emoji} {item.name}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-4 gap-2 text-center text-xs pt-1">
            <div className="p-2 rounded-xl bg-stone-900 border border-stone-800">
              <span className="block text-3xs font-bold text-stone-400 uppercase">Protein</span>
              <span className="text-sm font-bold text-emerald-400">{totalProtein}g</span>
            </div>
            <div className="p-2 rounded-xl bg-stone-900 border border-stone-800">
              <span className="block text-3xs font-bold text-stone-400 uppercase">Carbs</span>
              <span className="text-sm font-bold text-amber-400">{totalCarbs}g</span>
            </div>
            <div className="p-2 rounded-xl bg-stone-900 border border-stone-800">
              <span className="block text-3xs font-bold text-stone-400 uppercase">Fat</span>
              <span className="text-sm font-bold text-rose-400">{totalFat}g</span>
            </div>
            <div className="p-2 rounded-xl bg-stone-900 border border-stone-800">
              <span className="block text-3xs font-bold text-stone-400 uppercase">Fiber</span>
              <span className="text-sm font-bold text-teal-400">{totalFiber}g</span>
            </div>
          </div>
        </div>

        {/* Right: Constructive Pairing Insight (7 cols) */}
        <div className="lg:col-span-7 p-4 sm:p-5 rounded-2xl bg-stone-800/80 border border-stone-700/80 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <span className="text-2xs font-bold uppercase tracking-wider text-emerald-400 block">
              Nutrition Intelligence Breakdown:
            </span>

            {hasOnlyCarbSnacks ? (
              <div className="space-y-2 text-xs sm:text-sm text-stone-200 leading-relaxed">
                <p>
                  This combination provides plenty of fast energy primarily from refined carbohydrates and cooking fats.
                </p>
                <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-800/50 text-2xs text-emerald-300 space-y-1">
                  <span className="font-bold block text-white text-xs">Better Way to Pair It:</span>
                  <p>
                    Instead of feeling guilty, balance the plate: grab <strong>1 katori of curd (₹15)</strong> or <strong>2 boiled eggs (₹15–25)</strong> from the counter. This adds 12g+ of protein to sustain your study focus through the afternoon.
                  </p>
                </div>
              </div>
            ) : hasUpgrade ? (
              <div className="space-y-2 text-xs sm:text-sm text-stone-200 leading-relaxed">
                <p>
                  <strong>Great combination!</strong> Adding an upgrade like {selectedItems.find(i => i.category === 'upgrade' || i.id === 'sprouts-chaat')?.name} brings essential protein, active enzymes, or calcium to balance your energy.
                </p>
                <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-800/50 text-2xs text-emerald-300">
                  You are getting {totalProtein}g of protein and {totalFiber}g of fiber for a student-friendly budget.
                </div>
              </div>
            ) : (
              <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
                {selectedItems[0]?.tradeoffNote} {selectedItems[0]?.betterCombinationTip}
              </p>
            )}
          </div>

          <div className="text-3xs text-stone-400 flex items-center justify-between pt-2 border-t border-stone-700">
            <span>No foods are labeled &quot;evil&quot;. Balance is about what you pair them with.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
