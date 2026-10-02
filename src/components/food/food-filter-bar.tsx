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
    <div className="bg-white p-5 rounded-2xl border border-stone-200/90 shadow-2xs space-y-4">
      {/* Search Input & Sort Row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <SearchIcon size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={filters.query || ''}
            onChange={e => onChange({ ...filters, query: e.target.value })}
            placeholder="Search by dish name, Hindi name, dal, millet, or ingredient..."
            className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-emerald-700 focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor="sort-by" className="text-xs font-semibold text-stone-600">Sort by:</label>
          <select
            id="sort-by"
            value={filters.sortBy || 'name'}
            onChange={e => onChange({ ...filters, sortBy: e.target.value as FoodFilterOptions['sortBy'] })}
            className="text-xs font-medium bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-2 text-stone-800 focus:outline-none focus:border-emerald-700"
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
        <div className="flex items-center gap-2 mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
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
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                  isSelected
                    ? 'bg-emerald-800 text-white font-semibold shadow-2xs'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                {reg}
              </button>
            );
          })}
        </div>
      </div>

      {/* Category Pills & Affordability */}
      <div className="pt-2 border-t border-stone-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs font-semibold text-stone-500 mr-1">Category:</span>
          {categories.slice(0, 5).map(cat => {
            const isSelected = (filters.category || 'All') === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => onChange({ ...filters, category: cat })}
                className={`text-2xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                  isSelected
                    ? 'bg-stone-900 text-white font-semibold'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
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
              className="text-2xs bg-stone-100 text-stone-600 rounded-md px-2 py-1 border-none focus:outline-none"
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
            <span className="text-stone-500 font-medium">Budget:</span>
            {affordabilities.map(aff => {
              const isSelected = (filters.affordability || 'All') === aff;
              return (
                <button
                  key={aff}
                  type="button"
                  onClick={() => onChange({ ...filters, affordability: aff })}
                  className={`px-2 py-0.5 rounded text-2xs font-medium transition-colors ${
                    isSelected ? 'bg-amber-100 text-amber-900 font-bold' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {aff}
                </button>
              );
            })}
          </div>

          <span className="text-2xs font-bold text-stone-500 pl-2 border-l border-stone-200">
            {resultCount} {resultCount === 1 ? 'dish' : 'dishes'}
          </span>
        </div>
      </div>
    </div>
  );
}
