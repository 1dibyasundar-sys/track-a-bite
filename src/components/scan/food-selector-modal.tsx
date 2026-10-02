'use client';

import React, { useState, useMemo } from 'react';
import { FoodItem } from '../../lib/types';
import { INDIAN_FOOD_DATABASE } from '../../data/foods';
import { Dialog } from '../ui/dialog';
import { SearchIcon, PlusIcon } from '../ui/icons';
import { Badge } from '../ui/badge';

export interface FoodSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFood: (food: FoodItem) => void;
  title?: string;
  description?: string;
}

export function FoodSelectorModal({
  isOpen,
  onClose,
  onSelectFood,
  title = 'Select Food Item',
  description = 'Choose a dish from our regional Indian food database.',
}: FoodSelectorModalProps) {
  const [query, setQuery] = useState('');

  const filteredFoods = useMemo(() => {
    if (!query.trim()) return INDIAN_FOOD_DATABASE;
    const q = query.toLowerCase().trim();
    return INDIAN_FOOD_DATABASE.filter(f => {
      const matchName = f.name.toLowerCase().includes(q);
      const matchLocal = Object.values(f.localNames).some(n => n?.toLowerCase().includes(q));
      const matchCat = f.category.toLowerCase().includes(q);
      return matchName || matchLocal || matchCat;
    });
  }, [query]);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <SearchIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search rice, dal, roti, poha, sabzi..."
            className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-emerald-700 focus:bg-white"
          />
        </div>

        {/* List of selectable foods */}
        <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1">
          {filteredFoods.map(food => (
            <div
              key={food.id}
              className="p-3 rounded-xl border border-stone-200 hover:border-emerald-500 hover:bg-emerald-50/40 transition-all flex items-center justify-between gap-3 cursor-pointer group"
              onClick={() => {
                onSelectFood(food);
                onClose();
              }}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-stone-900 truncate group-hover:text-emerald-950">
                    {food.name}
                  </h4>
                  <Badge variant="stone" size="sm">
                    {food.region}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-stone-500">
                  <span>{food.category}</span>
                  <span>•</span>
                  <span>{food.standardServingSize}</span>
                  <span>•</span>
                  <span className="font-semibold text-emerald-800">{food.nutritionPerServing.calories} kcal</span>
                </div>
              </div>

              <button
                type="button"
                className="shrink-0 p-2 rounded-lg bg-stone-100 group-hover:bg-emerald-700 group-hover:text-white text-stone-700 transition-colors"
                aria-label={`Select ${food.name}`}
              >
                <PlusIcon size={16} />
              </button>
            </div>
          ))}

          {filteredFoods.length === 0 && (
            <div className="py-8 text-center text-stone-500 text-xs">
              No matching foods found for &quot;{query}&quot;. Try a different search term.
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
