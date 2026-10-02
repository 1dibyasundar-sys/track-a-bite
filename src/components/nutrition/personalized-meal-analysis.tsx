'use client';

import React, { useState } from 'react';
import { MealPersonalizedAnalysis, NutrientRecommendation } from '../../lib/types/personalizedAnalysis';
import { Card, CardContent } from '../ui/card';
import { ChevronDownIcon, SparklesIcon, ShieldCheckIcon, PlusIcon, CheckIcon } from '../ui/icons';

export interface PersonalizedMealAnalysisProps {
  analysis: MealPersonalizedAnalysis;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  onAddRecommendation?: (rec: NutrientRecommendation) => void;
  className?: string;
}

export function PersonalizedMealAnalysis({
  analysis,
  calories,
  protein,
  carbs,
  fat,
  fiber,
  onAddRecommendation,
  className = '',
}: PersonalizedMealAnalysisProps) {
  const [isWhyScoreExpanded, setIsWhyScoreExpanded] = useState(false);

  const {
    overallScore,
    starDisplay,
    summary,
    dimensions,
    recommendations,
    hostelModeActive,
    healthNotice,
    profileStatus,
    disclaimer,
  } = analysis;

  const displayCal = calories !== undefined ? Math.round(calories) : 573;
  const displayProtein = protein !== undefined ? protein.toFixed(1) : '20.2';
  const displayCarbs = carbs !== undefined ? carbs.toFixed(1) : '95.2';
  const displayFat = fat !== undefined ? fat.toFixed(1) : '12.0';
  const displayFiber = fiber !== undefined ? fiber.toFixed(1) : '10.2';

  // Dimension status styling helper
  const getStatusBadge = (status: string, label: string) => {
    switch (status) {
      case 'good':
      case 'balanced':
        return (
          <span className="text-2xs font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-200">
            {label}
          </span>
        );
      case 'could_improve':
        return (
          <span className="text-2xs font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200">
            {label}
          </span>
        );
      case 'relatively_high':
        return (
          <span className="text-2xs font-bold px-2 py-0.5 rounded-md bg-orange-100 text-orange-900 border border-orange-200">
            {label}
          </span>
        );
      case 'low':
      case 'relatively_low':
        return (
          <span className="text-2xs font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-900 border border-rose-200">
            {label}
          </span>
        );
      default:
        return (
          <span className="text-2xs font-bold px-2 py-0.5 rounded-md bg-stone-100 text-stone-700">
            {label}
          </span>
        );
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* ========================================================= */}
      {/* 1. YOUR MEAL & 5-STAR SCORE HERO                         */}
      {/* ========================================================= */}
      <Card className="border-stone-200 shadow-sm overflow-hidden bg-white">
        <div className="p-6 sm:p-7 text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <span className="text-xs font-black tracking-widest text-stone-500 uppercase">
              YOUR MEAL
            </span>
          </div>

          {/* Hostel Badge if active */}
          {hostelModeActive && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-900 text-2xs font-bold shadow-2xs">
              <span>🏠 HOSTEL MODE</span>
              <span className="text-emerald-700">•</span>
              <span className="font-medium text-emerald-800">
                Optimized for foods you can realistically find around campus.
              </span>
            </div>
          )}

          {/* Missing profile reminder */}
          {profileStatus === 'insufficient_profile' && (
            <div className="text-2xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl max-w-md mx-auto">
              ℹ Complete your profile for more personalized recommendations.
            </div>
          )}

          {/* Stars & Numeric Score */}
          <div className="space-y-1.5">
            <div className="text-3xl sm:text-4xl text-amber-400 tracking-wider">
              {starDisplay}
            </div>
            <div className="text-2xl sm:text-3xl font-black text-stone-900 font-mono">
              {overallScore.toFixed(1)} / 5
            </div>
          </div>

          {/* Summary Quote */}
          <p className="text-sm sm:text-base text-stone-700 font-medium max-w-lg mx-auto italic leading-relaxed">
            &ldquo;{summary}&rdquo;
          </p>
        </div>

        {/* ========================================================= */}
        {/* 2. WHY THIS SCORE? (EXPANDABLE DIMENSIONS)                */}
        {/* ========================================================= */}
        <div className="border-t border-stone-100 bg-stone-50/60 p-4 sm:p-5">
          <button
            type="button"
            onClick={() => setIsWhyScoreExpanded(!isWhyScoreExpanded)}
            className="w-full flex items-center justify-between text-xs font-bold text-stone-800 hover:text-emerald-800 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5 uppercase tracking-wider text-2xs">
              <SparklesIcon size={14} className="text-emerald-700" />
              <span>Why this score?</span>
            </span>
            <div className="flex items-center gap-1 text-stone-500 font-normal text-2xs">
              <span>{isWhyScoreExpanded ? 'Hide details' : 'View breakdown'}</span>
              <ChevronDownIcon
                size={14}
                className={`transition-transform duration-200 ${
                  isWhyScoreExpanded ? 'rotate-180 text-emerald-700' : ''
                }`}
              />
            </div>
          </button>

          {isWhyScoreExpanded && (
            <div className="mt-4 pt-3 border-t border-stone-200/80 space-y-3 animate-in fade-in duration-200">
              {/* Protein Dimension */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs font-mono">
                <div className="flex items-center justify-between sm:justify-start gap-3 min-w-[210px]">
                  <span className="w-24 font-bold text-stone-700 font-sans">Protein</span>
                  <span className="text-emerald-800 tracking-tighter font-mono font-bold">
                    {dimensions.protein.textBar}
                  </span>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-2 font-sans">
                  {getStatusBadge(dimensions.protein.status, dimensions.protein.label)}
                  <span className="text-3xs text-stone-500 font-normal sm:max-w-xs text-right">
                    {dimensions.protein.commentary}
                  </span>
                </div>
              </div>

              {/* Fiber Dimension */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs font-mono">
                <div className="flex items-center justify-between sm:justify-start gap-3 min-w-[210px]">
                  <span className="w-24 font-bold text-stone-700 font-sans">Fiber</span>
                  <span className="text-emerald-800 tracking-tighter font-mono font-bold">
                    {dimensions.fiber.textBar}
                  </span>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-2 font-sans">
                  {getStatusBadge(dimensions.fiber.status, dimensions.fiber.label)}
                  <span className="text-3xs text-stone-500 font-normal sm:max-w-xs text-right">
                    {dimensions.fiber.commentary}
                  </span>
                </div>
              </div>

              {/* Carbohydrates Dimension */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs font-mono">
                <div className="flex items-center justify-between sm:justify-start gap-3 min-w-[210px]">
                  <span className="w-24 font-bold text-stone-700 font-sans">Carbs</span>
                  <span className="text-emerald-800 tracking-tighter font-mono font-bold">
                    {dimensions.carbohydrates.textBar}
                  </span>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-2 font-sans">
                  {getStatusBadge(dimensions.carbohydrates.status, dimensions.carbohydrates.label)}
                  <span className="text-3xs text-stone-500 font-normal sm:max-w-xs text-right">
                    {dimensions.carbohydrates.commentary}
                  </span>
                </div>
              </div>

              {/* Fat Dimension */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs font-mono">
                <div className="flex items-center justify-between sm:justify-start gap-3 min-w-[210px]">
                  <span className="w-24 font-bold text-stone-700 font-sans">Fat</span>
                  <span className="text-emerald-800 tracking-tighter font-mono font-bold">
                    {dimensions.fat.textBar}
                  </span>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-2 font-sans">
                  {getStatusBadge(dimensions.fat.status, dimensions.fat.label)}
                  <span className="text-3xs text-stone-500 font-normal sm:max-w-xs text-right">
                    {dimensions.fat.commentary}
                  </span>
                </div>
              </div>

              {/* Variety / Meal Balance Dimension */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs font-mono">
                <div className="flex items-center justify-between sm:justify-start gap-3 min-w-[210px]">
                  <span className="w-24 font-bold text-stone-700 font-sans">Meal balance</span>
                  <span className="text-emerald-800 tracking-tighter font-mono font-bold">
                    {dimensions.mealBalance.textBar}
                  </span>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-2 font-sans">
                  {getStatusBadge(dimensions.mealBalance.status, dimensions.mealBalance.label)}
                  <span className="text-3xs text-stone-500 font-normal sm:max-w-xs text-right">
                    {dimensions.mealBalance.commentary}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* ========================================================= */}
      {/* 3. BIG CLEAN MACRO GRID (CALORIES, PROTEIN, CARBS, FAT, FIBER) */}
      {/* ========================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {/* Calories */}
        <div className="col-span-2 sm:col-span-1 p-4 rounded-2xl bg-white border border-stone-200 shadow-2xs text-center space-y-1">
          <span className="text-3xs font-extrabold uppercase tracking-wider text-stone-500 block">
            CALORIES
          </span>
          <span className="text-xl sm:text-2xl font-black text-stone-900 font-mono block">
            ≈ {displayCal} <span className="text-xs font-semibold text-stone-500">kcal</span>
          </span>
        </div>

        {/* Protein */}
        <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 shadow-2xs text-center space-y-1">
          <span className="text-3xs font-extrabold uppercase tracking-wider text-emerald-800 block">
            PROTEIN
          </span>
          <span className="text-xl sm:text-2xl font-black text-emerald-950 font-mono block">
            {displayProtein} <span className="text-xs font-semibold text-emerald-700">g</span>
          </span>
        </div>

        {/* Carbs */}
        <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 shadow-2xs text-center space-y-1">
          <span className="text-3xs font-extrabold uppercase tracking-wider text-amber-800 block">
            CARBS
          </span>
          <span className="text-xl sm:text-2xl font-black text-amber-950 font-mono block">
            {displayCarbs} <span className="text-xs font-semibold text-amber-700">g</span>
          </span>
        </div>

        {/* Fat */}
        <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200/80 shadow-2xs text-center space-y-1">
          <span className="text-3xs font-extrabold uppercase tracking-wider text-rose-800 block">
            FAT
          </span>
          <span className="text-xl sm:text-2xl font-black text-rose-950 font-mono block">
            {displayFat} <span className="text-xs font-semibold text-rose-700">g</span>
          </span>
        </div>

        {/* Fiber */}
        <div className="p-4 rounded-2xl bg-teal-50/60 border border-teal-200/80 shadow-2xs text-center space-y-1">
          <span className="text-3xs font-extrabold uppercase tracking-wider text-teal-800 block">
            FIBER
          </span>
          <span className="text-xl sm:text-2xl font-black text-teal-950 font-mono block">
            {displayFiber} <span className="text-xs font-semibold text-teal-700">g</span>
          </span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4. WHAT COULD YOU ADD? (RECOMMENDATIONS)                  */}
      {/* ========================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-stone-900 flex items-center gap-1.5">
              <span>💡</span>
              <span>WHAT COULD YOU ADD?</span>
            </h3>
            <p className="text-2xs text-stone-500">
              Affordable, hostel-friendly additions tailored to balance this meal
            </p>
          </div>
          {onAddRecommendation && (
            <span className="text-3xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              Tap to add
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {recommendations.slice(0, 3).map((rec) => (
            <div
              key={rec.id}
              className="p-4 rounded-2xl bg-white border border-stone-200/90 hover:border-emerald-300 transition-all shadow-2xs flex flex-col justify-between space-y-3 group"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{rec.emoji}</span>
                  <div>
                    <h4 className="text-sm font-black text-stone-900 group-hover:text-emerald-900 transition-colors">
                      {rec.food}
                    </h4>
                    <span className="text-2xs font-bold text-emerald-700">
                      Best for: {rec.bestFor}
                    </span>
                  </div>
                </div>

                <p className="text-2xs text-stone-600 leading-snug">
                  {rec.reason}
                </p>
              </div>

              <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-3xs">
                <span className="text-stone-500 font-medium">
                  {rec.availabilityNote}
                </span>

                {onAddRecommendation && (
                  <button
                    type="button"
                    onClick={() => onAddRecommendation(rec)}
                    className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <PlusIcon size={11} />
                    <span>Add</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 5. HOSTEL-FRIENDLY OPTIONS SUMMARY CARD                   */}
      {/* ========================================================= */}
      <Card className="border-emerald-200/80 bg-emerald-50/40 shadow-2xs">
        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="text-xs font-black tracking-wide text-emerald-950 uppercase block">
              HOSTEL-FRIENDLY OPTIONS
            </span>
            <p className="text-2xs text-emerald-900">
              Campus staples ready without cooking equipment or refrigeration.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-bold text-emerald-900 flex-wrap">
            <span className="flex items-center gap-1">
              <CheckIcon size={14} className="text-emerald-700" />
              <span>Affordable</span>
            </span>
            <span className="flex items-center gap-1">
              <CheckIcon size={14} className="text-emerald-700" />
              <span>Easy to find</span>
            </span>
            <span className="flex items-center gap-1">
              <CheckIcon size={14} className="text-emerald-700" />
              <span>Minimal preparation</span>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ========================================================= */}
      {/* 6. HEALTH CONDITION SAFETY NOTICE (NO MEDICAL DIAGNOSIS)  */}
      {/* ========================================================= */}
      {healthNotice && (
        <div className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200 text-blue-950 text-xs flex items-start gap-2.5">
          <ShieldCheckIcon size={16} className="text-blue-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold block">Health Condition Guidance</span>
            <p className="text-2xs leading-relaxed text-blue-900">
              {healthNotice}
            </p>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. DISCLAIMER                                             */}
      {/* ========================================================= */}
      <p className="text-3xs text-center text-stone-500 pt-1 leading-relaxed">
        * {disclaimer}
      </p>
    </div>
  );
}
