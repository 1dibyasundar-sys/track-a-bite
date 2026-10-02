import React from 'react';
import { BalancingRecommendation } from '../../lib/types';
import { PlusIcon, SparklesIcon } from '../ui/icons';
import { Badge } from '../ui/badge';

export interface RecommendationCardProps {
  recommendation: BalancingRecommendation;
  onAddSuggestion?: (recommendation: BalancingRecommendation) => void;
}

export function RecommendationCard({
  recommendation,
  onAddSuggestion,
}: RecommendationCardProps) {
  return (
    <div className="p-4 rounded-xl bg-white border border-stone-200/90 shadow-2xs hover:shadow-xs transition-shadow space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
            <SparklesIcon size={14} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-stone-900 leading-snug">
              {recommendation.title}
            </h4>
            <span className="text-2xs text-stone-500 font-medium">
              Action: {recommendation.actionType.toUpperCase()}
            </span>
          </div>
        </div>

        <Badge variant={recommendation.affordability === 'Budget-Friendly' ? 'emerald' : 'stone'} size="sm">
          {recommendation.affordability}
        </Badge>
      </div>

      <p className="text-xs text-stone-600 leading-relaxed">
        {recommendation.description}
      </p>

      <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-100 text-xs text-emerald-950 flex flex-col gap-1">
        <span className="font-semibold text-2xs uppercase tracking-wider text-emerald-800">
          Why this balances your plate
        </span>
        <p className="text-2xs text-emerald-900 leading-normal">
          {recommendation.impactReason}
        </p>
      </div>

      {recommendation.localIngredientsSuggested.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-2xs text-stone-500 font-medium mr-1">Local options:</span>
          {recommendation.localIngredientsSuggested.map((ing, idx) => (
            <span
              key={idx}
              className="text-2xs px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 font-medium"
            >
              {ing}
            </span>
          ))}
        </div>
      )}

      {onAddSuggestion && recommendation.foodId && (
        <div className="pt-2">
          <button
            onClick={() => onAddSuggestion(recommendation)}
            className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-stone-100 hover:bg-emerald-50 text-stone-800 hover:text-emerald-900 border border-stone-200 hover:border-emerald-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <PlusIcon size={14} />
            <span>Add this to my meal calculation</span>
          </button>
        </div>
      )}
    </div>
  );
}
