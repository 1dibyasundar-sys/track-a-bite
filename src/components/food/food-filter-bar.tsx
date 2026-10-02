'use client';

import React from 'react';
import { FoodFilterOptions, Region, FoodCategory, AffordabilityLevel } from '../../lib/types';
import { SearchIcon, FilterIcon } from '../ui/icons';

export interface FoodFilterBarProps {
  filters: FoodFilterOptions;
  onChange: (updated: FoodFilterOptions) => void;
  resultCount: number;
}

export function FoodFilterBar({ filters, onChange, resultCount }: FoodFilterBarProps) {
  const regions: Array<Region | 'All'> = [
    'All',
    'Pan-India',
    'North Indian',
    'South Indian',
    'East Indian',
    'West Indian',
    'Central Indian',
    'Tribal & Regional Heritage',
  ];

  const categories: Array<FoodCategory | 'All'> = [
    'All',
    'Grains & Millets',
    'Lentils & Pulses (Dal)',
    'Vegetables & Sabzi',
    'Breads & Rotis',
    'Dairy & Plant Proteins',
    'Fermented & Traditional',
    'Healthy Snacks & Sattu',
    'Snacks & Street Food',
  ];

  const affordabilities: Array<AffordabilityLevel | 'All'> = [
    'All',
    'Budget-Friendly',
    'Moderate',
  ];

  return (
    <div className="bg-white dark:bg-[#1D1A17] p-5 rounded-2xl border border-stone-200/90 dark:border-[#38312A] shadow-2xs space-y-4">
      {/* Search Input & Sort Row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <SearchIcon size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500" />
          <input
            type="text"
            value={filters.query || ''}
            onChange={e => onChange({ ...filters, query: e.target.value })}
            placeholder="Search by dish name, Hindi name, dal, millet, or ingredient..."
            className="w-full pl-10 pr-4 py-2.5 bg-stone-50 dark:bg-[#25211D] border border-stone-200 dark:border-[#38312A] rounded-xl text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-[#E86A33] focus:bg-white dark:focus:bg-[#25211D] transition-all"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor="sort-by" className="text-xs font-semibold text-stone-600 dark:text-stone-400">Sort by:</label>
          <select
            id="sort-by"
            value={filters.sortBy || 'name'}
            onChange={e => onChange({ ...filters, sortBy: e.target.value as FoodFilterOptions['sortBy'] })}
            className="text-xs font-medium bg-stone-50 dark:bg-[#25211D] border border-stone-200 dark:border-[#38312A] rounded-lg px-2.5 py-2 text-stone-800 dark:text-stone-200 focus:outline-none focus:border-[#E86A33]"
          >
            <option value="name">Name (A-Z)</option>
            <option value="protein">Highest Protein</option>
            <option value="fiber">Highest Fiber</option>
            <option value="calories">Lowest Calories</option>
            <option value="affordability">Most Budget-Friendly</option>
          </select>
        </div>
      </div>

      {/* Region Pills */}
      <div>
        <div className="flex items-center gap-2 mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
          <FilterIcon size={13} />
          <span>Regional Cuisines</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {regions.map(reg => {
            const isSelected = (filters.region || 'All') === reg;
            return (
              <button
                key={reg}
                type="button"
                onClick={() => onChange({ ...filters, region: reg })}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#E86A33] text-white font-semibold shadow-2xs'
                    : 'bg-stone-100 dark:bg-[#25211D] text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-[#2D2620]'
                }`}
              >
                {reg}
              </button>
            );
          })}
        </div>
      </div>

      {/* Category Pills & Affordability */}
      <div className="pt-2 border-t border-stone-100 dark:border-[#38312A] flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 mr-1">Category:</span>
          {categories.slice(0, 5).map(cat => {
            const isSelected = (filters.category || 'All') === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => onChange({ ...filters, category: cat })}
                className={`text-2xs px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#1D1A17] dark:bg-[#E86A33] text-white font-semibold'
                    : 'bg-stone-100 dark:bg-[#25211D] text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-[#2D2620]'
                }`}
              >
                {cat}
              </button>
            );
          })}
          {categories.length > 5 && (
            <select
              value={categories.slice(5).includes(filters.category as FoodCategory) ? (filters.category as string) : 'more'}
              onChange={e => {
                if (e.target.value !== 'more') {
                  onChange({ ...filters, category: e.target.value as FoodCategory });
                }
              }}
              className="text-2xs bg-stone-100 dark:bg-[#25211D] text-stone-600 dark:text-stone-300 rounded-md px-2 py-1 border-none focus:outline-none"
            >
              <option value="more">More categories...</option>
              {categories.slice(5).map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Affordability & Count */}
        <div className="flex items-center justify-between sm:justify-end gap-3 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-stone-500 dark:text-stone-400 font-medium">Budget:</span>
            {affordabilities.map(aff => {
              const isSelected = (filters.affordability || 'All') === aff;
              return (
                <button
                  key={aff}
                  type="button"
                  onClick={() => onChange({ ...filters, affordability: aff })}
                  className={`px-2 py-0.5 rounded text-2xs font-medium transition-colors cursor-pointer ${
                    isSelected ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 font-bold' : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                  }`}
                >
                  {aff}
                </button>
              );
            })}
          </div>

          <span className="text-2xs font-bold text-stone-500 dark:text-stone-400 pl-2 border-l border-stone-200 dark:border-[#38312A]">
            {resultCount} {resultCount === 1 ? 'dish' : 'dishes'}
          </span>
        </div>
      </div>
    </div>
  );
}
