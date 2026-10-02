import React from 'react';
import Link from 'next/link';
import { FoodItem } from '../../lib/types';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { ChevronRightIcon } from '../ui/icons';

export interface FoodCardProps {
  food: FoodItem;
}

export function FoodCard({ food }: FoodCardProps) {
  const primaryLocal = food.localNames.hindi || food.localNames.tamil || Object.values(food.localNames)[0];

  return (
    <Card className="hover:border-emerald-300 transition-all duration-200 group flex flex-col justify-between h-full bg-white">
      <CardContent className="p-5 flex flex-col justify-between h-full">
        <div>
          {/* Header Row: Region & Affordability */}
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <span className="text-2xs font-semibold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/50">
              {food.region}
            </span>
            <Badge
              variant={food.affordability === 'Budget-Friendly' ? 'emerald' : food.affordability === 'Moderate' ? 'amber' : 'stone'}
              size="sm"
            >
              {food.affordability}
            </Badge>
          </div>

          {/* Dish Name & Local Script */}
          <div className="mb-2">
            <h3 className="text-base font-bold text-stone-900 group-hover:text-emerald-900 transition-colors">
              {food.name}
            </h3>
            {primaryLocal && (
              <p className="text-xs text-stone-500 font-medium mt-0.5">
                {primaryLocal}
              </p>
            )}
          </div>

          {/* Category */}
          <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed mb-4">
            {food.description}
          </p>
        </div>

        <div>
          {/* Nutrition Snapshot */}
          <div className="grid grid-cols-3 gap-2 py-2.5 px-3 rounded-xl bg-stone-50 border border-stone-200/70 text-center mb-3">
            <div>
              <span className="block text-2xs text-stone-500 font-semibold uppercase">Calories</span>
              <span className="text-sm font-bold text-stone-900">{food.nutritionPerServing.calories}</span>
            </div>
            <div className="border-x border-stone-200">
              <span className="block text-2xs text-stone-500 font-semibold uppercase">Protein</span>
              <span className="text-sm font-bold text-emerald-700">{food.nutritionPerServing.protein}g</span>
            </div>
            <div>
              <span className="block text-2xs text-stone-500 font-semibold uppercase">Fiber</span>
              <span className="text-sm font-bold text-teal-700">{food.nutritionPerServing.fiber}g</span>
            </div>
          </div>

          {/* Dietary Tags */}
          <div className="flex flex-wrap items-center gap-1 mb-4">
            {food.dietaryTags.slice(0, 3).map((tag, idx) => (
              <span
                key={idx}
                className="text-2xs px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 font-medium"
              >
                {tag}
              </span>
            ))}
            {food.dietaryTags.length > 3 && (
              <span className="text-2xs text-stone-400 font-medium">
                +{food.dietaryTags.length - 3} more
              </span>
            )}
          </div>

          {/* View Link */}
          <Link
            href={`/foods/${food.id}`}
            className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-stone-100 text-stone-800 hover:bg-emerald-800 hover:text-white transition-colors flex items-center justify-center gap-1.5 group-hover:bg-emerald-50 group-hover:text-emerald-900"
          >
            <span>View Nutrition & Cultural Details</span>
            <ChevronRightIcon size={14} />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
