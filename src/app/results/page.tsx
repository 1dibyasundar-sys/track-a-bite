'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Container } from '../../components/layout/container';
import { AuthGuard } from '../../components/auth/AuthGuard';
import { useAuth } from '../../components/auth/AuthProvider';
import { NutrientStarRating } from '../../components/nutrition/nutrient-star-rating';
import { NutritionBreakdown } from '../../components/nutrition/nutrition-breakdown';
import { MealQualityExplanation } from '../../components/nutrition/meal-quality-explanation';
import { MacroDistributionBar } from '../../components/nutrition/macro-distribution-bar';
import { NutrientGapCard } from '../../components/nutrition/nutrient-gap-card';
import { HostelUpgradesCard } from '../../components/nutrition/hostel-upgrades-card';
import { RecommendationCard } from '../../components/nutrition/recommendation-card';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import {
  mealHistoryService,
  firestoreMealHistoryService,
  mealAnalysisService,
  foodDatabaseService,
  useUserProfile,
} from '../../lib/services';
import {
  MealAnalysis,
  BalancingRecommendation,
  DetectedFoodItem,
  MealNutritionSummary,
  MealComponent,
  NutrientRecommendation,
} from '../../lib/types';
import { PersonalizedMealAnalysis } from '../../components/nutrition/personalized-meal-analysis';
import { nutritionAnalysisService } from '../../lib/services';
import { MOCK_SAVED_MEALS } from '../../data/mockMeals';
import {
  CameraIcon,
  ShieldCheckIcon,
  HistoryIcon,
  SparklesIcon,
  CheckIcon,
  InfoIcon,
} from '../../components/ui/icons';
import { formatDate } from '../../lib/utils';

function createUniqueId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 9)}`;
}

function ResultsContent() {
  const searchParams = useSearchParams();
  const mealId = searchParams.get('id');
  const { user } = useAuth();

  const [meal, setMeal] = useState<MealAnalysis | null>(null);
  const profile = useUserProfile();
  const [isLoading, setIsLoading] = useState(true);
  const [addedRecommendations, setAddedRecommendations] = useState<string[]>([]);
  const [cloudStatus, setCloudStatus] = useState<'synced' | 'local-only' | 'sync-failed' | 'loading'>('loading');

  useEffect(() => {
    let isCancelled = false;

    async function loadMeal() {
      if (mealId) {
        // 1. Try local cache first for instant optimistic response
        const localFound = await mealHistoryService.getMealById(mealId);
        if (localFound && !isCancelled) {
          setMeal(localFound);
          setIsLoading(false);
        }

        // 2. If authenticated user, fetch cloud record or sync
        if (user?.uid) {
          try {
            const cloudFound = await firestoreMealHistoryService.getMeal(user.uid, mealId);
            if (cloudFound && !isCancelled) {
              setMeal(cloudFound);
              setCloudStatus('synced');
              // Ensure local cache also holds latest authoritative cloud copy
              await mealHistoryService.saveMeal(cloudFound);
              setIsLoading(false);
              return;
            } else if (localFound && !isCancelled) {
              setCloudStatus('local-only');
            }
          } catch {
            if (!isCancelled) setCloudStatus('sync-failed');
          }
        } else if (!isCancelled) {
          setCloudStatus('local-only');
        }

        if (localFound) return;

        // If specific mealId was queried and not found in local or cloud, do not fabricate mock meal
        if (!isCancelled) {
          setMeal(null);
          setIsLoading(false);
          return;
        }
      }

      // Fallback to recent mock meal only if no query ID was provided
      if (!isCancelled) {
        setMeal(MOCK_SAVED_MEALS[0]);
        setCloudStatus('local-only');
        setIsLoading(false);
      }
    }
    loadMeal();

    return () => {
      isCancelled = true;
    };
  }, [mealId, user?.uid]);

  // Handle adding a suggested upgrade directly to the meal to dynamically recompute
  const handleAddRecommendation = async (rec: BalancingRecommendation) => {
    if (!meal || !rec.foodId || addedRecommendations.includes(rec.id)) return;

    const food = await foodDatabaseService.getFoodById(rec.foodId);
    if (!food) return;

    const newItem: DetectedFoodItem = {
      detectionId: createUniqueId('add'),
      foodId: food.id,
      name: food.name,
      localNameHindi: food.localNames.hindi,
      confidence: 1.0,
      portionMultiplier: 1.0,
      portionUnit: food.servingUnit,
      estimatedGrams: food.weightGramsPerUnit,
      nutrition: food.nutritionPerServing,
      isUserModified: true,
    };

    const updatedItems = [...meal.items, newItem];
    const analyzed = await mealAnalysisService.analyzeMeal(
      updatedItems,
      `${meal.mealTitle} + ${food.name}`,
      meal.imagePreviewUrl,
      profile || undefined
    );
    // Crucial: preserve canonical meal ID and original timestamp to prevent duplicate records
    const updatedAnalysis: MealAnalysis = {
      ...analyzed,
      id: meal.id,
      analyzedAt: meal.analyzedAt,
    };

    setMeal(updatedAnalysis);
    setAddedRecommendations(prev => [...prev, rec.id]);
    await mealHistoryService.saveMeal(updatedAnalysis);
    if (user?.uid) {
      firestoreMealHistoryService
        .saveMeal(user.uid, updatedAnalysis)
        .then(() => setCloudStatus('synced'))
        .catch(err => {
          console.warn('[ResultsPage] Cloud meal update notice:', err);
          setCloudStatus('sync-failed');
        });
    }
  };

  // Handle adding a Phase 6.4 personalized recommendation directly to the meal
  const handleAddPersonalizedRecommendation = async (rec: NutrientRecommendation) => {
    if (!meal || !rec.foodId || addedRecommendations.includes(rec.id)) return;

    const food = await foodDatabaseService.getFoodById(rec.foodId);
    if (!food) return;

    const newItem: DetectedFoodItem = {
      detectionId: createUniqueId('add'),
      foodId: food.id,
      name: food.name,
      localNameHindi: food.localNames?.hindi,
      confidence: 1.0,
      portionMultiplier: 1.0,
      portionUnit: food.servingUnit,
      estimatedGrams: food.weightGramsPerUnit,
      nutrition: food.nutritionPerServing,
      isUserModified: true,
    };

    const updatedItems = [...meal.items, newItem];
    const analyzed = await mealAnalysisService.analyzeMeal(
      updatedItems,
      `${meal.mealTitle} + ${food.name}`,
      meal.imagePreviewUrl,
      profile || undefined
    );
    // Crucial: preserve canonical meal ID and original timestamp to prevent duplicate records
    const updatedAnalysis: MealAnalysis = {
      ...analyzed,
      id: meal.id,
      analyzedAt: meal.analyzedAt,
    };

    setMeal(updatedAnalysis);
    setAddedRecommendations(prev => [...prev, rec.id]);
    await mealHistoryService.saveMeal(updatedAnalysis);
    if (user?.uid) {
      firestoreMealHistoryService
        .saveMeal(user.uid, updatedAnalysis)
        .then(() => setCloudStatus('synced'))
        .catch(err => {
          console.warn('[ResultsPage] Cloud meal update notice:', err);
          setCloudStatus('sync-failed');
        });
    }
  };

  const personalizedAnalysis = React.useMemo(() => {
    if (!meal) return null;
    if (meal.analysis) return meal.analysis;
    const summary: MealNutritionSummary = {
      calories: meal.totalNutrition.calories,
      carbohydrates: meal.totalNutrition.carbohydrates,
      protein: meal.totalNutrition.protein,
      fat: meal.totalNutrition.fat,
      fiber: meal.totalNutrition.fiber,
      confidence: 0.9,
      status: 'complete',
      nutritionCompleteness: 'complete',
      disclaimer: 'Calculated from meal items',
      formattedCalories: `${meal.totalNutrition.calories} kcal`,
    };
    const comps: MealComponent[] = meal.items.map((item, idx) => ({
      id: item.detectionId || `comp-${idx}`,
      foodId: item.foodId,
      name: item.name,
      normalizedName: item.name.toLowerCase(),
      category: 'dish',
      confidence: item.confidence,
      confidenceTier: 'high',
      totalRegions: 1,
      regionIds: [item.detectionId || `reg-${idx}`],
      regions: [],
      portion: {
        value: item.estimatedGrams,
        quantity: item.portionMultiplier,
        unit: item.portionUnit,
        estimatedGrams: item.estimatedGrams,
        status: 'estimated',
        estimationMethod: 'catalogue_default',
        confidence: item.confidence,
        userConfirmed: false,
        formattedDisplay: `≈ ${item.estimatedGrams}g`,
        isPieceBased: item.portionUnit === 'piece',
      },
      identificationMode: 'local',
      nutritionReference: {
        isAvailable: true,
        isEstimated: false,
        source: 'local_database',
      },
      needsConfirmation: false,
    }));
    return nutritionAnalysisService.analyzeMeal(summary, comps, profile, 'meal');
  }, [meal, profile]);

  if (isLoading) {
    return (
      <div className="py-24 text-center">
        <div className="inline-block w-8 h-8 border-3 border-emerald-700 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm text-stone-600 font-medium">Analyzing meal nutrients...</p>
      </div>
    );
  }

  if (!meal) {
    return (
      <div className="py-20">
        <Container size="md">
          <div className="text-center space-y-4 max-w-md mx-auto p-8 rounded-3xl bg-white border border-stone-200 shadow-sm">
            <div className="w-16 h-16 rounded-full bg-stone-100 text-stone-600 flex items-center justify-center mx-auto">
              <InfoIcon size={28} />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-stone-900">Meal result not found.</h2>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              The requested meal analysis could not be retrieved from your local or cloud nutrition journal.
            </p>
            <div className="pt-2">
              <Link
                href="/scan"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm transition-colors shadow-xs"
              >
                <CameraIcon size={16} />
                <span>Back to Scan</span>
              </Link>
            </div>
          </div>
        </Container>
      </div>
    );
  }

  const primaryItem = meal.items[0];
  const isHostelMode = profile ? profile.isHostelite : meal.hostelModeActive;

  return (
    <div className="py-6 sm:py-10 space-y-6 sm:space-y-8">
      <Container size="lg">
        {/* ========================================================= */}
        {/* 1. FOOD IDENTIFIED & 2. ESTIMATED SERVING (HERO CARD)     */}
        {/* ========================================================= */}
        <div className="p-5 sm:p-7 rounded-3xl bg-gradient-to-br from-emerald-900 via-stone-900 to-stone-950 text-white shadow-xl relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-2xs font-extrabold tracking-widest uppercase px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Food Identified
                </span>
                <span className="text-2xs text-stone-400 font-medium">
                  {formatDate(meal.analyzedAt)}
                </span>
                {isHostelMode && (
                  <span className="text-2xs font-bold px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    Hostel Mode Active
                  </span>
                )}
                {cloudStatus === 'synced' && (
                  <span className="text-2xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                    <CheckIcon size={12} /> Cloud Saved
                  </span>
                )}
                {cloudStatus === 'local-only' && (
                  <span className="text-2xs font-medium px-2.5 py-0.5 rounded-full bg-stone-500/20 text-stone-300 border border-stone-500/30" title="Stored locally on this device">
                    Local Only
                  </span>
                )}
                {cloudStatus === 'sync-failed' && (
                  <span className="text-2xs font-medium px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30" title="Cloud sync temporarily unavailable">
                    Sync Failed (Local Copy)
                  </span>
                )}
                {cloudStatus === 'loading' && (
                  <span className="text-2xs font-medium px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Checking Cloud...
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
                {meal.mealTitle}
              </h1>

              {/* Serving details for items */}
              <div className="flex items-center gap-3 text-xs sm:text-sm text-stone-300 flex-wrap pt-1">
                {meal.items.map(item => (
                  <div key={item.detectionId} className="flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-xl">
                    <span className="font-semibold text-white">{item.name}</span>
                    {item.localNameHindi && (
                      <span className="text-stone-400">({item.localNameHindi})</span>
                    )}
                    <span className="text-emerald-400">•</span>
                    <span className="text-stone-300">
                      Est. {item.portionMultiplier} {item.portionUnit} (~{item.estimatedGrams}g)
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2.5 shrink-0 self-start md:self-auto">
              <Link href="/scan">
                <Button variant="primary" size="md" leftIcon={<CameraIcon size={16} />}>
                  Scan Another Food
                </Button>
              </Link>
              <Link href="/history">
                <Button variant="outline" size="md" leftIcon={<HistoryIcon size={16} />} className="text-white border-white/20 hover:bg-white/10">
                  History
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Personalization Context Banner */}
        <div className="p-3.5 rounded-2xl bg-stone-100 border border-stone-200 text-xs text-stone-600 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-base">🎯</span>
            <span>
              <strong>Personalized Recommendation:</strong> Suggested based on your profile{' '}
              {profile?.age ? `(${profile.age}y, ${profile.isHostelite ? 'Hostel resident' : 'Day scholar'})` : ''} and estimated meal nutrition.
            </span>
          </div>
          <span className="text-2xs text-stone-500 italic">No medical claims</span>
        </div>

        {/* Phase 6.4: Personalized Nutrition Analysis, 5-Star Score & Hostel Recommendations */}
        {personalizedAnalysis && (
          <PersonalizedMealAnalysis
            analysis={personalizedAnalysis}
            calories={meal.totalNutrition.calories}
            protein={meal.totalNutrition.protein}
            carbs={meal.totalNutrition.carbohydrates}
            fat={meal.totalNutrition.fat}
            fiber={meal.totalNutrition.fiber}
            onAddRecommendation={handleAddPersonalizedRecommendation}
          />
        )}

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
          {/* Left Column: Richness, Nutrition Breakdown & Gaps (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* ========================================================= */}
            {/* 3. FIVE-STAR NUTRIENT RICHNESS                            */}
            {/* ========================================================= */}
            <NutrientStarRating richness={meal.nutrientRichness} />

            {/* ========================================================= */}
            {/* 4. NUTRIENT BREAKDOWN WITH PROGRESS BARS                  */}
            {/* ========================================================= */}
            <NutritionBreakdown
              nutrition={meal.totalNutrition}
              servingDescription={primaryItem ? `${primaryItem.portionMultiplier} ${primaryItem.portionUnit} (~${primaryItem.estimatedGrams}g)` : undefined}
            />

            {/* Meal Quality Explanation ("What does this mean?") */}
            <MealQualityExplanation
              nutrition={meal.totalNutrition}
              items={meal.items}
              targetProteinG={profile?.targetProteinG || 60}
            />

            {/* Caloric Energy Distribution */}
            <Card className="border-stone-200/90 shadow-sm">
              <CardContent className="p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-stone-800 uppercase tracking-wider text-2xs">
                    Caloric Source Breakdown
                  </span>
                  <span className="text-stone-500 font-medium">Energy split</span>
                </div>
                <MacroDistributionBar distribution={meal.macroDistribution} showLabels={true} />
              </CardContent>
            </Card>

            {/* ========================================================= */}
            {/* 5. "WHAT AM I MISSING?" (WHAT YOU'RE GETTING VS GAPS)     */}
            {/* ========================================================= */}
            <NutrientGapCard gaps={meal.nutrientGaps} />

            {/* Positive highlights */}
            {meal.positiveHighlights.length > 0 && (
              <Card className="border-emerald-200/80 bg-emerald-50/40">
                <CardContent className="p-4 sm:p-5 space-y-2">
                  <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                    <SparklesIcon size={14} className="text-emerald-700" />
                    <span>Key Nutritional Highlights</span>
                  </span>
                  <ul className="space-y-1.5 text-xs text-emerald-950">
                    {meal.positiveHighlights.map((hl, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckIcon size={14} className="text-emerald-700 shrink-0 mt-0.5" />
                        <span>{hl}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column: Upgrades, Recommendations & Disclaimer (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* ========================================================= */}
            {/* 7. HOSTEL-FRIENDLY RECOMMENDATIONS ("Easy upgrades")      */}
            {/* ========================================================= */}
            <HostelUpgradesCard
              upgrades={meal.hostelFriendlyUpgrades}
              onAddUpgrade={handleAddRecommendation}
            />

            {/* ========================================================= */}
            {/* 6. "WHAT CAN I ADD?" (REGIONAL BALANCING SUGGESTIONS)     */}
            {/* ========================================================= */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-stone-900">
                    What You Can Add Realistically
                  </h3>
                  <p className="text-2xs text-stone-500">
                    Affordable local additions to elevate nutrient richness
                  </p>
                </div>
                <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Tap to add
                </span>
              </div>

              {meal.balancingRecommendations.length === 0 ? (
                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 text-xs text-stone-600">
                  This meal is already rich across fiber, protein, and energy. Great selection!
                </div>
              ) : (
                <div className="space-y-3">
                  {meal.balancingRecommendations.map(rec => (
                    <RecommendationCard
                      key={rec.id}
                      recommendation={rec}
                      onAddSuggestion={
                        addedRecommendations.includes(rec.id)
                          ? undefined
                          : () => handleAddRecommendation(rec)
                      }
                    />
                  ))}
                </div>
              )}
            </div>

            {/* ========================================================= */}
            {/* 8. CAMPUS REALITY / CONSTRUCTIVE COMBINATION TIP          */}
            {/* ========================================================= */}
            <Card className="border-amber-200/80 bg-amber-50/50">
              <CardContent className="p-4 sm:p-5 space-y-2">
                <span className="text-xs font-bold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                  <InfoIcon size={14} className="text-amber-800" />
                  <span>Campus Reality Note</span>
                </span>
                <p className="text-xs text-amber-950 leading-relaxed">
                  No food choice is &quot;bad&quot; or forbidden. Deep-fried snacks or quick noodles provide high energy. To prevent sluggish afternoon lectures, balance them with ₹10–₹20 zero-cooking protein sides like roasted chana, dahi, or sprouts.
                </p>
              </CardContent>
            </Card>

            {/* Everyday Practical Tips */}
            {meal.practicalAdjustments.length > 0 && (
              <Card className="border-stone-200/90">
                <CardContent className="p-4 sm:p-5 space-y-2">
                  <span className="text-xs font-bold text-stone-800 uppercase tracking-wider block">
                    Everyday Practical Tips
                  </span>
                  <div className="space-y-1.5 text-xs text-stone-600">
                    {meal.practicalAdjustments.map((tip, idx) => (
                      <p key={idx} className="leading-relaxed">
                        • {tip}
                      </p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ========================================================= */}
            {/* 9. NUTRITION DISCLAIMER                                   */}
            {/* ========================================================= */}
            <div className="p-4 rounded-2xl bg-stone-100/90 border border-stone-200 text-stone-700 text-2xs leading-relaxed flex items-start gap-2.5">
              <ShieldCheckIcon size={16} className="text-stone-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-stone-900 block">
                  Educational Nutrition Disclaimer:
                </span>
                <p>
                  {meal.disclaimer ||
                    'Track-a-Bite provides educational nutrition estimates based on standard regional recipes and visual plate volume. It does not provide medical diagnoses or prescribe treatment.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <AuthGuard>
      <Suspense
        fallback={
          <div className="py-24 text-center">
            <div className="inline-block w-8 h-8 border-3 border-emerald-700 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm text-stone-600 font-medium">Loading nutritional assessment...</p>
          </div>
        }
      >
        <ResultsContent />
      </Suspense>
    </AuthGuard>
  );
}
