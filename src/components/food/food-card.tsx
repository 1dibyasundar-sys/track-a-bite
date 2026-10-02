import React from 'react';
import Link from 'next/link';
import { FoodItem } from '../../lib/types';
import { Badge } from '../ui/badge';
import { ChevronRightIcon } from '../ui/icons';

export interface FoodCardProps {
  food: FoodItem;
}

export function getFoodImage(food: FoodItem): string {
  if (food.imageUrl) return food.imageUrl;
  const name = food.name.toLowerCase();
  const cat = food.category.toLowerCase();
  const id = food.id.toLowerCase();

  if (name.includes('paneer') || id.includes('paneer') || cat.includes('dairy') || cat.includes('milk')) {
    return '/images/food/grilled-paneer.jpg';
  }
  if (name.includes('sprouts') || name.includes('chaat') || name.includes('salad') || cat.includes('snack') || name.includes('chana') || id.includes('banana')) {
    return '/images/food/sprouts-chaat.jpg';
  }
  if (name.includes('samosa') || name.includes('kachori') || name.includes('pakora') || name.includes('fried') || name.includes('bhajia')) {
    return '/images/food/canteen-samosa.jpg';
  }
  if (name.includes('thali') || name.includes('mess') || name.includes('plate') || id.includes('thali')) {
    return '/images/food/hostel-mess-thali.jpg';
  }
  return '/images/food/hero-meal-platter.jpg';
}

export function FoodCard({ food }: FoodCardProps) {
  const primaryLocal = food.localNames.hindi || food.localNames.tamil || Object.values(food.localNames)[0];
  const foodImage = getFoodImage(food);

  // Derive high protein or high fiber badge
  const isHighProtein = food.nutritionPerServing.protein >= 10;
  const isHighFiber = food.nutritionPerServing.fiber >= 5;

  return (
    <div className="card-3d-interactive overflow-hidden group flex flex-col justify-between h-full bg-white dark:bg-[#131d16] border border-stone-200/90 dark:border-[#23382b]">
      {/* 1. DOMINANT FOOD IMAGE HEADER */}
      <div className="relative w-full aspect-16/10 overflow-hidden bg-stone-900 shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={foodImage}
          alt={food.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
          loading="lazy"
        />
        {/* Soft gradient edge */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

        {/* Floating Badges over Photo */}
        <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between pointer-events-none z-10">
          <span className="text-3xs font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-emerald-300 border border-emerald-400/40">
            {food.region}
          </span>
          {isHighProtein ? (
            <span className="text-3xs font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-600/90 text-white backdrop-blur-md shadow-xs">
              High Protein
            </span>
          ) : isHighFiber ? (
            <span className="text-3xs font-extrabold uppercase px-2 py-0.5 rounded-full bg-teal-600/90 text-white backdrop-blur-md shadow-xs">
              High Fiber
            </span>
          ) : (
            <Badge
              variant={food.affordability === 'Budget-Friendly' ? 'emerald' : food.affordability === 'Moderate' ? 'amber' : 'stone'}
              size="sm"
              className="backdrop-blur-md"
            >
              {food.affordability}
            </Badge>
          )}
        </div>

        {/* Serving Unit Indicator at Bottom of Image */}
        <div className="absolute bottom-2 right-2.5 text-3xs font-semibold text-stone-200 bg-black/50 backdrop-blur-md px-2 py-0.5 rounded pointer-events-none">
          {food.standardServingSize || `${food.serving.size} ${food.serving.unit}`}
        </div>
      </div>

      {/* 2. CARD CONTENT & CONCISE NUTRITION */}
      <div className="p-4 sm:p-5 flex flex-col justify-between flex-1 space-y-3.5">
        <div>
          {/* Dish Name & Local Script */}
          <div className="mb-1">
            <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors line-clamp-1">
              {food.name}
            </h3>
            {primaryLocal && (
              <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">
                {primaryLocal}
              </p>
            )}
          </div>

          {/* Category / Description */}
          <p className="text-xs text-stone-600 dark:text-stone-400 line-clamp-2 leading-relaxed">
            {food.description}
          </p>
        </div>

        <div>
          {/* Concise Nutrition Row */}
          <div className="grid grid-cols-3 gap-2 py-2 px-2.5 rounded-xl bg-stone-50 dark:bg-[#19271e] border border-stone-200/80 dark:border-[#23382b] text-center mb-3">
            <div>
              <span className="block text-3xs text-stone-500 dark:text-stone-400 font-bold uppercase">Calories</span>
              <span className="text-xs sm:text-sm font-extrabold text-stone-900 dark:text-stone-100">{food.nutritionPerServing.calories}</span>
            </div>
            <div className="border-x border-stone-200 dark:border-[#23382b]">
              <span className="block text-3xs text-stone-500 dark:text-stone-400 font-bold uppercase">Protein</span>
              <span className="text-xs sm:text-sm font-extrabold text-emerald-700 dark:text-emerald-400">{food.nutritionPerServing.protein}g</span>
            </div>
            <div>
              <span className="block text-3xs text-stone-500 dark:text-stone-400 font-bold uppercase">Fiber</span>
              <span className="text-xs sm:text-sm font-extrabold text-teal-700 dark:text-teal-400">{food.nutritionPerServing.fiber}g</span>
            </div>
          </div>

          {/* View Link */}
          <Link
            href={`/foods/${food.id}`}
            className="w-full py-2 px-3 text-xs font-semibold rounded-xl bg-stone-100 dark:bg-[#19271e] text-stone-800 dark:text-stone-200 hover:bg-emerald-800 hover:text-white dark:hover:bg-emerald-700 transition-colors flex items-center justify-between group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/40 group-hover:text-emerald-900 dark:group-hover:text-emerald-300"
          >
            <span>View Nutrition Profile</span>
            <ChevronRightIcon size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
