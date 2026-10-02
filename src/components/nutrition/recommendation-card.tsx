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
    <div className="p-4 rounded-xl bg-white dark:bg-[#1D1A17] border border-stone-200/90 dark:border-[#38312A] shadow-2xs hover:shadow-xs transition-shadow space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#FEF7EE] dark:bg-[#2A1C14] text-[#E86A33] flex items-center justify-center shrink-0">
            <SparklesIcon size={14} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100 leading-snug">
              {recommendation.title}
            </h4>
            <span className="text-2xs text-stone-500 dark:text-stone-400 font-medium">
              Action: {recommendation.actionType.toUpperCase()}
            </span>
          </div>
        </div>

        <Badge variant={recommendation.affordability === 'Budget-Friendly' ? 'emerald' : 'stone'} size="sm">
          {recommendation.affordability}
        </Badge>
      </div>

      <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
        {recommendation.description}
      </p>

      <div className="p-2.5 rounded-lg bg-[#FEF7EE] dark:bg-[#251A14] border border-[#FBD5BD] dark:border-[#4D2918] text-xs text-stone-800 dark:text-stone-300 flex flex-col gap-1">
        <span className="font-semibold text-2xs uppercase tracking-wider text-[#E86A33]">
          Why this balances your plate
        </span>
        <p className="text-2xs text-stone-700 dark:text-stone-300 leading-normal">
          {recommendation.impactReason}
        </p>
      </div>

      {recommendation.localIngredientsSuggested.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-2xs text-stone-500 dark:text-stone-400 font-medium mr-1">Local options:</span>
          {recommendation.localIngredientsSuggested.map((ing, idx) => (
            <span
              key={idx}
              className="text-2xs px-2 py-0.5 rounded-md bg-stone-100 dark:bg-[#25211D] text-stone-700 dark:text-stone-300 font-medium"
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
            className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-stone-100 dark:bg-[#25211D] hover:bg-[#FEF7EE] dark:hover:bg-[#2A1C14] text-stone-800 dark:text-stone-200 hover:text-[#E86A33] border border-stone-200 dark:border-[#38312A] hover:border-[#E86A33]/40 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <PlusIcon size={14} />
            <span>Add this to my meal calculation</span>
          </button>
        </div>
      )}
    </div>
  );
}
