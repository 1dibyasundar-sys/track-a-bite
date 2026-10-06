'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { TABVoiceAssistant } from '../../components/voice/TABVoiceAssistant';
import { useUserProfile, mealHistoryService, barcodeProductService } from '../../lib/services';
import { buildTABContext } from '../../lib/voice/tabContext';
import { TABContext } from '../../lib/voice/types';
import { MealAnalysis } from '../../lib/types/meal';
import { PackagedProduct } from '../../lib/types/barcode';

export function TABVoicePageContent() {
  const profile = useUserProfile();
  const searchParams = useSearchParams();
  const mealIdParam = searchParams.get('mealId') || searchParams.get('id');
  const barcodeParam = searchParams.get('barcode');

  const [activeMeal, setActiveMeal] = useState<MealAnalysis | null>(null);
  const [activeProduct, setActiveProduct] = useState<PackagedProduct | null>(null);
  const [recentMealTitles, setRecentMealTitles] = useState<string[]>([]);

  useEffect(() => {
    let isCancelled = false;

    async function loadContextData() {
      try {
        let resolvedMeal: MealAnalysis | null = null;
        let resolvedProduct: PackagedProduct | null = null;

        // 1. Fetch recent meals for context awareness
        const recentMeals = await mealHistoryService.getRecentMeals();
        if (recentMeals && recentMeals.length > 0) {
          const titles = recentMeals.map((m) => m.mealTitle).filter(Boolean);
          if (!isCancelled) {
            setRecentMealTitles(titles.slice(0, 5));
          }

          if (mealIdParam) {
            const matched = recentMeals.find((m) => m.id === mealIdParam);
            if (matched) {
              resolvedMeal = matched;
            }
          } else if (!barcodeParam) {
            // Automatically ground in the user's latest meal if analyzed recently
            const latest = recentMeals[0];
            if (latest && !latest.id.startsWith('mock-meal-')) {
              resolvedMeal = latest;
            }
          }
        }

        // 2. If a specific meal ID was passed but not found in recent list, fetch by ID
        if (mealIdParam && !resolvedMeal) {
          const specificMeal = await mealHistoryService.getMealById(mealIdParam);
          if (specificMeal) {
            resolvedMeal = specificMeal;
          }
        }

        // 3. If a barcode was passed, fetch the packaged product
        if (barcodeParam) {
          const lookup = await barcodeProductService.lookupProduct(barcodeParam);
          if (lookup.status === 'found' && lookup.product) {
            resolvedProduct = lookup.product;
          }
        }

        if (!isCancelled) {
          if (resolvedMeal) setActiveMeal(resolvedMeal);
          if (resolvedProduct) setActiveProduct(resolvedProduct);
        }
      } catch (err) {
        console.warn('[TABVoicePageContent] Context load notice:', err);
      }
    }

    loadContextData();

    return () => {
      isCancelled = true;
    };
  }, [mealIdParam, barcodeParam]);

  const initialContext: TABContext = buildTABContext({
    userProfile: profile,
    currentMeal: activeMeal,
    currentProduct: activeProduct,
    recentMealTitles,
  });

  return <TABVoiceAssistant initialContext={initialContext} />;
}

