import React from 'react';
import { MealAnalysisResult } from '../../lib/types';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { CheckIcon, AlertCircleIcon, PlusIcon, SparklesIcon, InfoIcon } from '../ui/icons';

export interface MealIntelligenceCardProps {
  analysis: MealAnalysisResult;
  onAddRecommendation?: (foodId: string) => void;
  isHostelite?: boolean;
  className?: string;
}

const FOOD_EMOJIS: Record<string, string> = {
  'boiled-eggs': '🥚',
  'roasted-chana': '🥜',
  'banana': '🍌',
  'fresh-curd': '🥣',
  'sprouts-chaat': '🌱',
  'roasted-peanuts': '🥜',
  'fresh-guava': '🍐',
  'fresh-milk': '🥛',
  'palak-paneer': '🥬',
  'vegetable-curry': '🍲',
  'dal-tadka': '🥣',
};

export function MealIntelligenceCard({
  analysis,
  onAddRecommendation,
  isHostelite = true,
  className = '',
}: MealIntelligenceCardProps) {
  const { nutrientRichness, composition, gaps, recommendations, professionalGuidanceNote, disclaimer } = analysis;

  // Star elements generator
  const starsArray = [1, 2, 3, 4, 5];

  const getScoreVariant = (score: number) => {
    switch (score) {
      case 5:
        return 'emerald';
      case 4:
        return 'emerald';
      case 3:
        return 'amber';
      case 2:
        return 'amber';
      default:
        return 'stone';
    }
  };

  return (
    <Card className={`border-stone-200/90 shadow-sm overflow-hidden ${className}`}>
      {/* Top Header: 5-Star Nutrient Richness */}
      <div className="p-4 sm:p-5 bg-gradient-to-br from-stone-900 to-stone-800 text-white space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-3xs font-extrabold uppercase tracking-widest text-emerald-400">
            Nutrient Intelligence
          </span>
          {isHostelite && (
            <Badge variant="emerald" size="sm" className="bg-emerald-950/80 text-emerald-300 border-emerald-800">
              Hostel Mode Active
            </Badge>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-amber-400 text-lg">
              {starsArray.map(star => (
                <span key={star} className={star <= nutrientRichness.score ? 'text-amber-400' : 'text-stone-600'}>
                  ★
                </span>
              ))}
            </div>
            <span className="text-base font-extrabold text-white">
              {nutrientRichness.score}/5
            </span>
          </div>

          <Badge variant={getScoreVariant(nutrientRichness.score)} size="md" className="self-start sm:self-auto font-bold">
            {nutrientRichness.label}
          </Badge>
        </div>

        <p className="text-xs text-stone-300 leading-relaxed font-normal">
          {nutrientRichness.explanation}
        </p>
      </div>

      <CardContent className="p-4 sm:p-5 space-y-5">
        {/* SECTION 1: WHAT'S GOOD */}
        {composition.strengths && composition.strengths.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-900 uppercase tracking-wider">
              <CheckIcon size={14} className="text-emerald-700" />
              <span>What&apos;s Good</span>
            </div>
            <div className="space-y-1.5">
              {composition.strengths.map((str, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 p-2 rounded-xl bg-emerald-50/70 border border-emerald-100/80 text-xs text-emerald-950"
                >
                  <span className="text-emerald-700 font-bold shrink-0 mt-0.5">✓</span>
                  <span className="leading-snug">{str}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 2: WHAT COULD BE BETTER (NUTRIENT GAPS) */}
        {gaps && gaps.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-900 uppercase tracking-wider">
              <AlertCircleIcon size={14} className="text-amber-700" />
              <span>What Could Be Better</span>
            </div>
            <div className="space-y-1.5">
              {gaps.slice(0, 3).map((gap, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50/70 border border-amber-100 text-xs text-amber-950"
                >
                  <span className="text-amber-700 font-bold shrink-0 mt-0.5">⚠</span>
                  <div className="space-y-0.5">
                    <span className="font-bold capitalize">{gap.nutrient}: </span>
                    <span className="text-amber-900">{gap.explanation}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 3: TRY ADDING (RECOMMENDED ADDITIONS) */}
        {recommendations && recommendations.length > 0 && (
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-stone-900 uppercase tracking-wider">
                <SparklesIcon size={14} className="text-emerald-700" />
                <span>Try Adding</span>
              </div>
              <span className="text-3xs text-stone-500 font-medium">
                {isHostelite ? 'Prioritized for hostel/campus' : 'Balanced additions'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {recommendations.map(rec => {
                const emoji = FOOD_EMOJIS[rec.foodId] || '🥗';
                return (
                  <div
                    key={rec.foodId}
                    className="p-3 rounded-2xl bg-white border border-stone-200 hover:border-emerald-300 transition-all flex flex-col justify-between space-y-2 group shadow-2xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-lg">{emoji}</span>
                          <span className="text-xs font-bold text-stone-900 group-hover:text-emerald-800 transition-colors">
                            {rec.foodName}
                          </span>
                        </div>
                        <span className="text-3xs font-semibold px-1.5 py-0.5 rounded-md bg-stone-100 text-stone-600 uppercase">
                          {rec.affordability}
                        </span>
                      </div>

                      <p className="text-2xs text-stone-600 leading-snug">
                        &quot;{rec.reason}&quot;
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-stone-100 text-3xs">
                      {rec.hostelFriendly ? (
                        <span className="text-emerald-700 font-semibold flex items-center gap-1">
                          ⚡ Zero/Easy Cook
                        </span>
                      ) : (
                        <span className="text-stone-500 font-medium">Standard Dish</span>
                      )}

                      {onAddRecommendation && (
                        <button
                          type="button"
                          onClick={() => onAddRecommendation(rec.foodId)}
                          className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-bold flex items-center gap-0.5 transition-colors cursor-pointer"
                        >
                          <PlusIcon size={10} />
                          <span>Add</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Professional Guidance Notice if Profile has Medical Considerations */}
        {professionalGuidanceNote && (
          <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-200/80 text-2xs text-blue-950 flex items-start gap-2">
            <InfoIcon size={14} className="text-blue-700 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <span className="font-bold">Health Notice: </span>
              {professionalGuidanceNote}
            </p>
          </div>
        )}

        {/* Ethical Disclaimer */}
        <p className="text-3xs text-center text-stone-500 pt-1 leading-relaxed border-t border-stone-100">
          * {disclaimer}
        </p>
      </CardContent>
    </Card>
  );
}
