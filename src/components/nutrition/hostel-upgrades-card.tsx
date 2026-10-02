import React from 'react';
import { BalancingRecommendation } from '../../lib/types';
import { SparklesIcon, PlusIcon } from '../ui/icons';

export interface HostelUpgradesCardProps {
  upgrades: BalancingRecommendation[];
  onAddUpgrade?: (upgrade: BalancingRecommendation) => void;
  className?: string;
}

export function HostelUpgradesCard({
  upgrades,
  onAddUpgrade,
  className = '',
}: HostelUpgradesCardProps) {
  // Predefined student campus staples
  const campusStaples = [
    { emoji: '🥚', name: '2 Boiled Eggs', price: '₹15–25', benefit: '+12.6g complete protein & choline for focus', location: 'Campus tea / egg stall' },
    { emoji: '🌱', name: 'Sprouts Chaat', price: '₹20–30', benefit: '+13.5g plant protein, live enzymes & fiber', location: 'Gate cart / mess counter' },
    { emoji: '🥜', name: 'Roasted Chana / Peanuts', price: '₹10–20', benefit: '+10g slow-burning protein & minerals', location: 'Local stationary / kirana' },
    { emoji: '🥛', name: 'Fresh Dahi / Curd', price: '₹15–25', benefit: '+5.2g protein, calcium & active gut probiotics', location: 'Amul booth / Mess' },
    { emoji: '🍌', name: 'Desi Banana', price: '₹5–10', benefit: '+420mg potassium & natural study stamina', location: 'Fruit vendor outside campus' },
  ];

  return (
    <div
      className={`p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#1D1A17] border border-stone-200/90 dark:border-[#38312A] text-stone-900 dark:text-stone-100 shadow-2xs space-y-5 ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-100 dark:border-[#38312A]">
        <div>
          <div className="flex items-center gap-1.5 text-[#E86A33] text-2xs font-bold uppercase tracking-wider mb-0.5">
            <SparklesIcon size={13} className="text-[#E86A33]" />
            <span>Campus Friendly</span>
          </div>
          <h3 className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100 tracking-tight">
            Easy Upgrades for Hostel Life
          </h3>
          <p className="text-2xs text-stone-500 dark:text-stone-400">
            Pocket-friendly additions requiring zero cooking, available within 5 minutes of your hostel.
          </p>
        </div>

        <span className="self-start sm:self-auto text-3xs font-semibold px-2 py-0.5 rounded-full bg-stone-100 dark:bg-[#25211D] text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-[#38312A]">
          Estimated Local Prices
        </span>
      </div>

      {/* Dynamic Scanned Upgrades */}
      {upgrades.length > 0 && (
        <div className="space-y-3">
          <span className="text-2xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 block">
            Recommended Specifically for This Meal:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {upgrades.map(upgrade => (
              <div
                key={upgrade.id}
                className="p-3.5 rounded-xl bg-[#FEF7EE] dark:bg-[#251A14] border border-[#FBD5BD] dark:border-[#4D2918] flex flex-col justify-between space-y-2"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100 leading-snug">
                      {upgrade.title}
                    </h4>
                    {upgrade.approximatePriceRange && (
                      <span className="text-3xs font-bold px-1.5 py-0.5 rounded bg-white dark:bg-[#1D1A17] text-[#E86A33] border border-[#FBD5BD] dark:border-[#4D2918] shrink-0">
                        {upgrade.approximatePriceRange}
                      </span>
                    )}
                  </div>
                  <p className="text-2xs text-stone-700 dark:text-stone-300 mt-1 leading-snug">
                    {upgrade.description}
                  </p>
                  {upgrade.campusLocation && (
                    <span className="text-3xs text-stone-500 dark:text-stone-400 font-medium block mt-1">
                      📍 {upgrade.campusLocation}
                    </span>
                  )}
                </div>

                {onAddUpgrade && upgrade.foodId && (
                  <button
                    type="button"
                    onClick={() => onAddUpgrade(upgrade)}
                    className="w-full py-1.5 px-2 text-2xs font-bold rounded-lg bg-[#E86A33] hover:bg-[#d65f2c] text-white transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <PlusIcon size={12} />
                    <span>Add to this meal</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Hostel Staples Reference Grid */}
      <div className="space-y-2 pt-2 border-t border-stone-100 dark:border-[#38312A]">
        <span className="text-2xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 block">
          Everyday Student Power Upgrades:
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {campusStaples.map((staple, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl bg-stone-50 dark:bg-[#25211D] border border-stone-200/70 dark:border-[#38312A] hover:border-stone-300 dark:hover:border-stone-700 transition-colors flex items-start gap-3"
            >
              <span className="text-2xl shrink-0 mt-0.5">{staple.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                    {staple.name}
                  </span>
                  <span className="text-3xs font-extrabold text-[#E86A33] bg-[#FEF7EE] dark:bg-[#2A1C14] px-1.5 py-0.5 rounded">
                    {staple.price}
                  </span>
                </div>
                <p className="text-3xs text-stone-600 dark:text-stone-400 mt-0.5 leading-snug">
                  {staple.benefit}
                </p>
                <span className="text-3xs text-stone-400 dark:text-stone-500 block mt-1">
                  📍 {staple.location}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
