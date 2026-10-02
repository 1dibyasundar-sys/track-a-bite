'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Container } from '../../components/layout/container';
import { AuthGuard } from '../../components/auth/AuthGuard';
import { useAuth } from '../../components/auth/AuthProvider';
import { NutritionBreakdown } from '../../components/nutrition/nutrition-breakdown';
import { MacroDistributionBar } from '../../components/nutrition/macro-distribution-bar';
import { NutrientGapCard } from '../../components/nutrition/nutrient-gap-card';
import { HostelUpgradesCard } from '../../components/nutrition/hostel-upgrades-card';
import { RecommendationCard } from '../../components/nutrition/recommendation-card';
import { Button } from '../../components/ui/button';
import { DisclaimerBanner } from '../../components/layout/disclaimer-banner';
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
} from '../../lib/types';
import { MOCK_SAVED_MEALS } from '../../data/mockMeals';
import {
  CameraIcon,
  HistoryIcon,
  CheckIcon,
  InfoIcon,
  RefreshCwIcon,
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

  if (isLoading) {
    return (
      <div className="py-24 text-center">
        <div className="inline-block w-8 h-8 border-3 border-emerald-700 dark:border-emerald-400 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm text-stone-600 dark:text-stone-400 font-medium">Analyzing meal nutrients...</p>
      </div>
    );
  }

  if (!meal) {
    return (
      <div className="py-20">
        <Container size="md">
          <div className="text-center space-y-4 max-w-md mx-auto p-8 rounded-3xl bg-white dark:bg-[#1D1A17] border border-stone-200 dark:border-[#38312A] shadow-sm">
            <div className="w-16 h-16 rounded-full bg-stone-100 dark:bg-[#25211D] text-stone-600 dark:text-stone-300 flex items-center justify-center mx-auto">
              <InfoIcon size={28} />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-stone-100">Meal result not found.</h2>
            <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
              The requested meal analysis could not be retrieved from your local or cloud nutrition journal.
            </p>
            <div className="pt-2">
              <Link
                href="/scan"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#E86A33] hover:bg-[#d65f2c] text-white font-semibold text-sm transition-colors shadow-xs"
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
  const scoreValue = meal.nutrientRichness?.stars ? (meal.nutrientRichness.stars * 2).toFixed(1) : '8.4';

  return (
    <div className="py-6 sm:py-10 space-y-8 sm:space-y-10">
      <Container size="lg">
        {/* =====================================================================
            HERO CARD WITH FLOATING INSIGHT ANNOTATION CARDS
            ===================================================================== */}
        <div className="card-3d p-6 sm:p-8 bg-gradient-to-br from-[#1D1A17] via-[#151311] to-[#25211D] text-white border border-[#38312A] shadow-xl relative overflow-hidden">
          {/* Ambient warm glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#E86A33]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-2xs font-extrabold tracking-widest uppercase px-3 py-1 rounded-full bg-[#E86A33]/15 text-[#F4A340] border border-[#E86A33]/30 font-mono">
                  Meal Analysis Complete
                </span>
                <span className="text-2xs text-stone-400 font-medium">
                  {formatDate(meal.analyzedAt)}
                </span>
                {isHostelMode && (
                  <span className="text-2xs font-bold px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    🏠 Hostel Mode Active
                  </span>
                )}
                {cloudStatus === 'synced' && (
                  <span className="text-2xs font-bold px-2.5 py-0.5 rounded-full bg-[#3F8F68]/20 text-[#5FA77F] border border-[#3F8F68]/30 flex items-center gap-1">
                    <CheckIcon size={12} /> Saved to Journal
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
                {meal.mealTitle}
              </h1>

              {/* FLOATING INSIGHT ANNOTATIONS */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="card-float px-3 py-1 text-2xs font-bold text-[#9185E8] bg-black/60 border border-[#7C6CE7]/40 flex items-center gap-1.5 shadow-sm">
                  <span>✨</span> {meal.items.length} foods detected
                </span>
                <span className="card-float px-3 py-1 text-2xs font-bold text-[#F4A340] bg-black/60 border border-[#E86A33]/40 flex items-center gap-1.5 shadow-sm">
                  <span>💪</span> {meal.totalNutrition.protein}g protein
                </span>
                <span className="card-float px-3 py-1 text-2xs font-bold text-stone-200 bg-black/60 border border-stone-700/60 flex items-center gap-1.5 shadow-sm">
                  <span>🔥</span> {meal.totalNutrition.calories} kcal
                </span>
                {meal.hostelFriendlyUpgrades.length > 0 && (
                  <span className="card-float px-3 py-1 text-2xs font-bold text-amber-300 bg-black/60 border border-amber-500/30 flex items-center gap-1.5 shadow-sm">
                    <span>💡</span> {meal.hostelFriendlyUpgrades[0].approximatePriceRange || '₹15'} affordable upgrade available
                  </span>
                )}
              </div>
            </div>

            {/* Quick Navigation Actions */}
            <div className="flex items-center gap-3 shrink-0 self-start md:self-auto flex-wrap">
              <Link href="/scan?reanalyze=true">
                <Button variant="primary" size="md" leftIcon={<RefreshCwIcon size={16} />}>
                  Re-analyze
                </Button>
              </Link>
              <Link href="/scan">
                <Button variant="outline" size="md" leftIcon={<CameraIcon size={16} />} className="text-white border-white/20 hover:bg-white/10">
                  Scan Another Meal
                </Button>
              </Link>
              <Link href="/history">
                <Button variant="outline" size="md" leftIcon={<HistoryIcon size={16} />} className="text-white border-white/20 hover:bg-white/10">
                  Food Journal
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* =====================================================================
            STEP 1: "HERE'S WHAT WE FOUND." — BEAUTIFUL FOOD DETECTION CARDS
            ===================================================================== */}
        <section className="space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="text-2xs font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-[#F3EDE4] dark:bg-[#25211D] text-[#E86A33] border border-[#E8DED2] dark:border-[#38312A]">
              Step 01
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-stone-900 dark:text-stone-100">
              Here&apos;s what we found.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {meal.items.map((item, idx) => {
              const confPct = Math.round(item.confidence * 100);
              const itemImg = item.name.toLowerCase().includes('paneer')
                ? '/images/food/grilled-paneer.jpg'
                : item.name.toLowerCase().includes('sprouts') || item.name.toLowerCase().includes('chaat') || item.name.toLowerCase().includes('banana')
                ? '/images/food/sprouts-chaat.jpg'
                : item.name.toLowerCase().includes('samosa') || item.name.toLowerCase().includes('kachori')
                ? '/images/food/canteen-samosa.jpg'
                : '/images/food/hostel-mess-thali.jpg';

              return (
                <div
                  key={item.detectionId || idx}
                  className="card-3d-interactive overflow-hidden bg-white dark:bg-[#1D1A17] border border-stone-200/90 dark:border-[#38312A] flex flex-col justify-between"
                >
                  <div className="relative w-full aspect-16/10 bg-stone-900 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={itemImg}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
                    <div className="absolute top-2.5 left-2.5">
                      <span className="text-3xs font-extrabold px-2 py-0.5 rounded-full bg-black/60 text-[#5FA77F] backdrop-blur-md border border-[#3F8F68]/40">
                        {confPct}% Confidence
                      </span>
                    </div>
                    <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-white text-xs">
                      <span className="font-bold">{item.name}</span>
                      {item.localNameHindi && (
                        <span className="text-3xs text-stone-300">({item.localNameHindi})</span>
                      )}
                    </div>
                  </div>

                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs text-stone-600 dark:text-stone-400">
                      <span>Serving Portion:</span>
                      <span className="font-bold text-stone-900 dark:text-stone-100">
                        {item.portionMultiplier} {item.portionUnit} (~{item.estimatedGrams}g)
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1 text-center">
                      <div className="p-2 rounded-lg bg-stone-50 dark:bg-[#25211D] text-2xs">
                        <span className="text-stone-500 dark:text-stone-400 block font-medium">Calories</span>
                        <span className="font-bold text-stone-900 dark:text-stone-100">{item.nutrition.calories} kcal</span>
                      </div>
                      <div className="p-2 rounded-lg bg-stone-50 dark:bg-[#25211D] text-2xs">
                        <span className="text-stone-500 dark:text-stone-400 block font-medium">Protein</span>
                        <span className="font-bold text-[#E86A33] dark:text-[#F4A340]">{item.nutrition.protein}g</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* =====================================================================
            STEP 2: "YOUR NUTRITION" — STRONG VISUAL NUTRITION SCORE & MACROS
            ===================================================================== */}
        <section className="space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="text-2xs font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-[#F3EDE4] dark:bg-[#25211D] text-[#E86A33] border border-[#E8DED2] dark:border-[#38312A]">
              Step 02
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-stone-900 dark:text-stone-100">
              Your nutrition.
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Visual Score Card */}
            <div className="lg:col-span-5 card-3d p-6 sm:p-8 bg-white dark:bg-[#1D1A17] border border-stone-200/90 dark:border-[#38312A] flex flex-col items-center justify-center text-center space-y-4">
              <span className="text-3xs font-extrabold uppercase tracking-widest text-[#3F8F68] dark:text-[#5FA77F]">
                MEAL NUTRITION SCORE
              </span>
              <div className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-full bg-[#F0FDF4] dark:bg-[#15251C] border-4 border-[#3F8F68] flex flex-col items-center justify-center shadow-inner">
                <span className="text-4xl sm:text-5xl font-black text-[#22543D] dark:text-[#5FA77F] tracking-tight">
                  {scoreValue}
                </span>
                <span className="text-3xs text-stone-500 dark:text-stone-400 font-bold">/ 10.0</span>
              </div>
              <div className="w-16 h-0.5 bg-[#3F8F68]/30 rounded-full" />
              <div>
                <h3 className="text-base font-extrabold text-stone-900 dark:text-stone-100 uppercase tracking-wide">
                  {meal.balanceAssessment.label}
                </h3>
                <p className="text-xs text-stone-600 dark:text-stone-400 mt-1 max-w-xs">
                  {meal.balanceAssessment.summary}
                </p>
              </div>
            </div>

            {/* Macro Distribution Breakdown */}
            <div className="lg:col-span-7 card-3d p-6 sm:p-8 bg-white dark:bg-[#1D1A17] border border-stone-200/90 dark:border-[#38312A] flex flex-col justify-between space-y-6">
              <NutritionBreakdown
                nutrition={meal.totalNutrition}
                servingDescription={primaryItem ? `${primaryItem.portionMultiplier} ${primaryItem.portionUnit} (~${primaryItem.estimatedGrams}g)` : undefined}
              />
              <div className="pt-2">
                <span className="text-3xs font-extrabold uppercase text-stone-500 dark:text-stone-400 block mb-2">
                  Caloric Source Split
                </span>
                <MacroDistributionBar distribution={meal.macroDistribution} showLabels={true} />
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================================
            STEP 3: "WHAT'S WORKING" — POSITIVE INSIGHTS (GREEN ACCENT)
            ===================================================================== */}
        <section className="space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="text-2xs font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-[#EBF7F0] dark:bg-[#1A2E22] text-[#2E6B4E] dark:text-[#5FA77F] border border-[#3F8F68]/30 dark:border-[#3F8F68]/40">
              Step 03
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-stone-900 dark:text-stone-100">
              What&apos;s working.
            </h2>
          </div>

          <div className="card-3d p-5 sm:p-6 bg-[#F0FDF4]/70 dark:bg-[#14231A]/30 border border-[#3F8F68]/20 dark:border-[#3F8F68]/30">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {meal.positiveHighlights.map((hl, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-white/90 dark:bg-[#1D1A17]/90 border border-[#3F8F68]/20 dark:border-[#3F8F68]/30">
                  <div className="w-5 h-5 rounded-full bg-[#3F8F68] text-white flex items-center justify-center shrink-0 mt-0.5">
                    <CheckIcon size={12} />
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-[#1C4332] dark:text-[#88D4A8]">{hl}</span>
                </div>
              ))}
              {meal.positiveHighlights.length === 0 && (
                <div className="text-xs text-stone-600 dark:text-stone-400">
                  Provides quick calories and energy for campus work.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* =====================================================================
            STEP 4: "WHAT YOU'RE MISSING" — NUTRIENT GAPS (ORANGE ACCENT)
            ===================================================================== */}
        <section className="space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="text-2xs font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-[#FEF3C7] dark:bg-[#2D2115] text-[#D97706] dark:text-[#F4A340] border border-[#FDE68A] dark:border-[#523B22]">
              Step 04
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-stone-900 dark:text-stone-100">
              What you&apos;re missing.
            </h2>
          </div>

          <NutrientGapCard gaps={meal.nutrientGaps} />
        </section>

        {/* =====================================================================
            STEP 5: "YOUR NEXT MOVE" — HOSTEL UPGRADES & PERSONALIZED RECOMMENDATIONS (TERRACOTTA ACCENT)
            ===================================================================== */}
        <section className="space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="text-2xs font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-[#FEF7EE] dark:bg-[#2A1C14] text-[#E86A33] border border-[#FBD5BD] dark:border-[#4D2918]">
              Step 05
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-stone-900 dark:text-stone-100">
              Your next move.
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 space-y-4">
              <HostelUpgradesCard
                upgrades={meal.hostelFriendlyUpgrades}
                onAddUpgrade={handleAddRecommendation}
              />
            </div>

            <div className="lg:col-span-6 space-y-4">
              <div className="card-3d p-5 sm:p-6 bg-white dark:bg-[#1D1A17] border border-stone-200/90 dark:border-[#38312A] space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                    What You Can Realistically Add
                  </h3>
                  <p className="text-2xs text-stone-500 dark:text-stone-400 mt-0.5">
                    Zero-cooking local additions available near your hostel
                  </p>
                </div>

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
                  {meal.balancingRecommendations.length === 0 && (
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      This meal already meets all key macro thresholds.
                    </p>
                  )}
                </div>
              </div>

              {/* Campus Reality Context */}
              <div className="card-3d p-4 bg-[#FEF7EE]/80 dark:bg-[#2A1C14]/40 border border-[#FBD5BD]/60 dark:border-[#4D2918]/60 text-xs text-stone-800 dark:text-stone-300 flex items-start gap-2.5">
                <InfoIcon size={16} className="text-[#E86A33] shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  No food choice is &quot;bad&quot; or forbidden. Deep-fried snacks or quick noodles provide high energy. To prevent sluggish afternoon lectures, balance them with ₹10–₹20 zero-cooking protein sides like roasted chana, dahi, or sprouts.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Re-analyze Action Callout */}
        <div className="card-3d p-6 bg-white dark:bg-[#1D1A17] border border-stone-200/90 dark:border-[#38312A] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
              Want to analyze another dish or meal?
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              Re-analyze a freshly captured camera photo or upload an image to identify actual meal items.
            </p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link href="/scan?reanalyze=true" className="flex-1 sm:flex-none">
              <Button fullWidth variant="primary" size="md" leftIcon={<RefreshCwIcon size={16} />}>
                Re-analyze
              </Button>
            </Link>
            <Link href="/scan" className="flex-1 sm:flex-none">
              <Button fullWidth variant="outline" size="md" leftIcon={<CameraIcon size={16} />}>
                New Scan
              </Button>
            </Link>
          </div>
        </div>

        {/* Disclaimer Notice */}
        <DisclaimerBanner variant="subtle" />
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
            <div className="inline-block w-8 h-8 border-3 border-[#E86A33] border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm text-stone-600 dark:text-stone-400 font-medium">Loading nutritional assessment...</p>
          </div>
        }
      >
        <ResultsContent />
      </Suspense>
    </AuthGuard>
  );
}
