/**
 * TRACK-A-BITE — PHASE 8.5.1 LIVE FIRESTORE PAGINATION VERIFICATION
 * Project: track-a-bite
 *
 * Verifies live Firestore cursor-based pagination surpassing the 100-meal ceiling:
 * 1. Register temporary test Firebase Auth user
 * 2. Persist 125 synthetic meals across multiple days using Firestore writeBatch
 * 3. Verify getMealsForDateRange retrieves all 125 meals across >=3 pages
 * 4. Verify no duplicates across pages
 * 5. Verify live date range filtering (105 today, 20 yesterday)
 * 6. Verify getDailySummary processes all 105 meals without 100-meal truncation
 * 7. Verify getDateRangeReport processes all 125 meals across the multi-day range
 * 8. Verify security rules prevent cross-user access
 * 9. Clean up all 125 meals and auth user
 */

import fs from 'fs';
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  deleteUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  writeBatch,
  getDocs,
  collection,
} from 'firebase/firestore';
import type { MealAnalysis } from '../src/lib/types/meal';
import { getLocalISODate } from '../src/lib/utils';

// Load .env.local BEFORE initializing services
if (fs.existsSync('.env.local')) {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

// Mock browser localStorage for Node.js runtime
class MockStorage {
  private store: Record<string, string> = {};
  getItem(key: string): string | null { return this.store[key] || null; }
  setItem(key: string, value: string): void { this.store[key] = value; }
  removeItem(key: string): void { delete this.store[key]; }
  clear(): void { this.store = {}; }
  getAllKeys(): string[] { return Object.keys(this.store); }
  getAllValues(): string[] { return Object.values(this.store); }
}

const mockStorage = new MockStorage();
(global as unknown as { window: unknown }).window = {
  localStorage: mockStorage,
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true,
};

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ [PASS] ${message}`);
}

async function runLivePaginationVerification() {
  console.log('====================================================');
  console.log('TRACK-A-BITE — PHASE 8.5.1 LIVE FIRESTORE PAGINATION');
  console.log('Verifying >100 Meal Cursor Traversal in Cloud Firestore');
  console.log('====================================================\n');

  const app = getApps().length === 0
    ? initializeApp({
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      })
    : getApps()[0];

  const auth = getAuth(app);
  const db = getFirestore(app);

  // Dynamic import services AFTER environment and window mock are in place
  const { firestoreMealHistoryService } = await import('../src/lib/services/firestoreMealHistoryService');
  const { nutritionAnalyticsService } = await import('../src/lib/services/nutritionAnalyticsService');

  const testEmail = `phase851_page_${Date.now()}@example.com`;
  const testPassword = `Pass#${Date.now()}Secure!`;
  let testUid = '';
  const testMealIds: string[] = [];

  try {
    // 1. REGISTER TEMPORARY TEST USER
    console.log('--- STEP 1: CREATE DEDICATED TEMPORARY TEST USER ---');
    const userCredential = await createUserWithEmailAndPassword(auth, testEmail, testPassword);
    testUid = userCredential.user.uid;
    console.log(`Created test user: ${testEmail} (UID: ${testUid})`);
    assert(Boolean(testUid) && testUid.length >= 20, 'STEP 1: Authenticated test UID established');

    // 2. GENERATE 125 SYNTHETIC MEALS (SURPASSING 100-MEAL LIMIT)
    console.log('\n--- STEP 2: BATCH-WRITE 125 MEALS TO CLOUD FIRESTORE ---');
    const now = new Date();
    const todayStr = getLocalISODate(now);

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getLocalISODate(yesterday);

    console.log(`Targeting dates: Today (${todayStr}) and Yesterday (${yesterdayStr})`);

    const TOTAL_MEALS = 125;
    const TODAY_MEALS_COUNT = 105;
    const YESTERDAY_MEALS_COUNT = 20;

    const mealsToInsert: MealAnalysis[] = [];

    // 105 meals today
    for (let i = 0; i < TODAY_MEALS_COUNT; i++) {
      const mealId = `live-meal-today-${Date.now()}-${i}`;
      testMealIds.push(mealId);
      // Stagger hours/minutes throughout the day
      const hour = (Math.floor(i / 5)) % 24;
      const min = (i * 11) % 60;
      const d = new Date(now);
      d.setHours(hour, min, 0, 0);

      mealsToInsert.push({
        id: mealId,
        mealTitle: `Synthetic Today Meal #${i + 1}`,
        analyzedAt: d.toISOString(),
        items: [
          {
            detectionId: `det-td-${i}`,
            foodId: 'roti-standard',
            name: 'Chapati Roti',
            confidence: 0.95,
            portionMultiplier: 1.0,
            portionUnit: 'piece',
            estimatedGrams: 50,
            nutrition: {
              calories: 200,
              protein: 10,
              carbohydrates: 25,
              fat: 5,
              fiber: 2,
            },
          },
        ],
        totalNutrition: {
          calories: 200,
          protein: 10,
          carbohydrates: 25,
          fat: 5,
          fiber: 2,
        },
        macroDistribution: { carbsPercent: 50, proteinPercent: 25, fatPercent: 25 },
        nutrientRichness: { stars: 4, label: 'Good', explanation: 'Balanced', highlights: [] },
        nutrientGaps: { providedNutrients: [], missingNutrients: [], whyItMattersSummary: '' },
        balanceAssessment: {
          rating: 'balanced',
          label: 'Balanced',
          summary: 'Balanced',
          detail: 'Balanced',
          glycemicImpactEstimate: 'Moderate',
        },
        positiveHighlights: ['Good protein source'],
        balancingRecommendations: [],
        hostelFriendlyUpgrades: [],
        hostelModeActive: true,
        practicalAdjustments: [],
        disclaimer: 'Calculated nutritional values are estimates for reference.',
      });
    }

    // 20 meals yesterday
    for (let i = 0; i < YESTERDAY_MEALS_COUNT; i++) {
      const mealId = `live-meal-yest-${Date.now()}-${i}`;
      testMealIds.push(mealId);
      const hour = (Math.floor(i / 2)) % 24;
      const min = (i * 13) % 60;
      const d = new Date(yesterday);
      d.setHours(hour, min, 0, 0);

      mealsToInsert.push({
        id: mealId,
        mealTitle: `Synthetic Yesterday Meal #${i + 1}`,
        analyzedAt: d.toISOString(),
        items: [
          {
            detectionId: `det-yest-${i}`,
            foodId: 'dal-standard',
            name: 'Yellow Dal',
            confidence: 0.92,
            portionMultiplier: 1.0,
            portionUnit: 'bowl',
            estimatedGrams: 150,
            nutrition: {
              calories: 200,
              protein: 10,
              carbohydrates: 25,
              fat: 5,
              fiber: 2,
            },
          },
        ],
        totalNutrition: {
          calories: 200,
          protein: 10,
          carbohydrates: 25,
          fat: 5,
          fiber: 2,
        },
        macroDistribution: { carbsPercent: 50, proteinPercent: 25, fatPercent: 25 },
        nutrientRichness: { stars: 4, label: 'Good', explanation: 'Balanced', highlights: [] },
        nutrientGaps: { providedNutrients: [], missingNutrients: [], whyItMattersSummary: '' },
        balanceAssessment: {
          rating: 'balanced',
          label: 'Balanced',
          summary: 'Balanced',
          detail: 'Balanced',
          glycemicImpactEstimate: 'Moderate',
        },
        positiveHighlights: ['Good protein source'],
        balancingRecommendations: [],
        hostelFriendlyUpgrades: [],
        hostelModeActive: true,
        practicalAdjustments: [],
        disclaimer: 'Calculated nutritional values are estimates for reference.',
      });
    }

    console.log(`Writing ${mealsToInsert.length} documents in atomic Firestore writeBatch...`);
    const batch = writeBatch(db);
    for (const meal of mealsToInsert) {
      const mealRef = doc(db, 'users', testUid, 'meals', meal.id);
      batch.set(mealRef, meal);
    }
    await batch.commit();
    console.log(`Successfully committed 125 documents to users/${testUid}/meals/`);
    assert(mealsToInsert.length === 125, 'STEP 2: 125 synthetic meals written to cloud');

    // 3. CURSOR-BASED RETRIEVAL OF ALL 125 MEALS
    console.log('\n--- STEP 3: CURSOR-BASED RETRIEVAL ACROSS ALL PAGES ---');
    const startTime = Date.now();
    const paginatedAll = await firestoreMealHistoryService.getMealsForDateRange(testUid);
    const elapsedMs = Date.now() - startTime;

    console.log(`Fetched ${paginatedAll.meals.length} meals in ${paginatedAll.pagesProcessed} pages (${elapsedMs}ms)`);
    assert(paginatedAll.meals.length === TOTAL_MEALS, `STEP 3: Retrieved exactly 125 meals (received ${paginatedAll.meals.length})`);
    assert(paginatedAll.pagesProcessed >= 3, `STEP 3: Traversed >= 3 Firestore pages (pages: ${paginatedAll.pagesProcessed})`);
    assert(paginatedAll.complete === true, 'STEP 3: Dataset marked complete (no unhandled page drops)');

    // 4. DUPLICATE CHECK ACROSS ALL RETRIEVED MEALS
    console.log('\n--- STEP 4: VERIFY ZERO DUPLICATE MEALS BETWEEN PAGES ---');
    const uniqueIds = new Set(paginatedAll.meals.map(m => m.id));
    assert(uniqueIds.size === TOTAL_MEALS, `STEP 4: All ${TOTAL_MEALS} retrieved IDs are unique (zero pagination duplicates)`);

    // 5. DATE RANGE FILTERING IN CLOUD
    console.log('\n--- STEP 5: VERIFY DATE RANGE FILTERING (TODAY ONLY) ---');
    const paginatedToday = await firestoreMealHistoryService.getMealsForDateRange(testUid, todayStr, todayStr);
    console.log(`Filtered today's meals: ${paginatedToday.meals.length} meals in ${paginatedToday.pagesProcessed} pages`);
    assert(paginatedToday.meals.length === TODAY_MEALS_COUNT, `STEP 5: Exactly ${TODAY_MEALS_COUNT} today's meals retrieved (excluded yesterday's 20 meals)`);
    assert(paginatedToday.meals.every(m => getLocalISODate(m.analyzedAt) === todayStr), 'STEP 5: All returned meals strictly belong to today in local calendar');

    // 6. NUTRITION ANALYTICS DAILY SUMMARY SURPASSING 100 MEALS
    console.log('\n--- STEP 6: VERIFY DAILY SUMMARY SURPASSES 100-MEAL CEILING ---');
    const dailySummary = await nutritionAnalyticsService.getDailySummary(testUid, todayStr);
    console.log(`Daily summary mealCount: ${dailySummary.mealCount}, dataSource: ${dailySummary.dataSource}`);
    console.log(`Total calories: ${dailySummary.totalCalories} kcal, Protein: ${dailySummary.totalProteinG} g`);

    assert(dailySummary.dataSource === 'cloud', 'STEP 6: Daily summary marked as cloud dataSource');
    assert(dailySummary.mealCount === TODAY_MEALS_COUNT, `STEP 6: Daily summary processed all ${TODAY_MEALS_COUNT} meals (>100 limit!)`);
    assert(dailySummary.totalCalories === TODAY_MEALS_COUNT * 200, `STEP 6: Total calories correctly equals ${TODAY_MEALS_COUNT * 200}`);
    assert(dailySummary.totalProteinG === TODAY_MEALS_COUNT * 10, `STEP 6: Total protein correctly equals ${TODAY_MEALS_COUNT * 10}`);

    // 7. NUTRITION ANALYTICS DATE RANGE REPORT (ALL 125 MEALS)
    console.log('\n--- STEP 7: VERIFY DATE-RANGE REPORT ACROSS ALL 125 MEALS ---');
    const dateRangeReport = await nutritionAnalyticsService.getDateRangeReport(testUid, {
      startDate: yesterdayStr,
      endDate: todayStr,
      preset: 'custom',
    });
    const reportTotalCalories = dateRangeReport.meals.reduce(
      (sum, m) => sum + (m.totalNutrition?.calories || 0),
      0
    );
    console.log(`Report total meals: ${dateRangeReport.totalMeals}, dataSource: ${dateRangeReport.dataSource}`);
    console.log(`Report total calories: ${reportTotalCalories} kcal, avg daily cal: ${dateRangeReport.averageCalories}`);

    assert(dateRangeReport.dataSource === 'cloud', 'STEP 7: Date-range report marked as cloud dataSource');
    assert(dateRangeReport.totalMeals === TOTAL_MEALS, `STEP 7: Report processed all ${TOTAL_MEALS} meals across date range`);
    assert(reportTotalCalories === TOTAL_MEALS * 200, `STEP 7: Report total calories equals ${TOTAL_MEALS * 200}`);
    assert(dateRangeReport.averageCalories > 0, 'STEP 7: Daily average calories correctly computed');

    // 8. SECURITY RULES: CROSS-USER ACCESS REJECTED
    console.log('\n--- STEP 8: SECURITY RULES ENFORCEMENT ---');
    let crossUserRejected = false;
    try {
      // Attempt to read a different user's subcollection
      await getDocs(collection(db, 'users', 'arbitrary-victim-uid-xyz', 'meals'));
    } catch (err: unknown) {
      crossUserRejected = true;
      console.log('Cross-user query rejected by Firestore rules as expected:', (err as Error).message);
    }
    assert(crossUserRejected, 'STEP 8: Cross-user query rejected by request.auth.uid == userId rule');

    // 9. CLEANUP
    console.log('\n--- STEP 9: CLEANUP TEMPORARY TEST DATA ---');
    console.log(`Deleting ${testMealIds.length} synthetic meal documents...`);
    // Delete in batches of 500
    const cleanupBatch = writeBatch(db);
    for (const id of testMealIds) {
      cleanupBatch.delete(doc(db, 'users', testUid, 'meals', id));
    }
    await cleanupBatch.commit();
    console.log('Deleted all synthetic meal documents from Firestore');

    // Delete user account
    if (auth.currentUser) {
      await deleteUser(auth.currentUser);
      console.log(`Deleted temporary test auth account ${testEmail}`);
    }

    console.log('\n====================================================');
    console.log('🎉 ALL 9 LIVE FIRESTORE PAGINATION TESTS PASSED!');
    console.log('====================================================\n');
  } catch (error) {
    console.error('\n❌ LIVE FIRESTORE PAGINATION VERIFICATION FAILED:', error);
    // Cleanup if possible
    if (testUid && auth.currentUser) {
      try {
        const batch = writeBatch(db);
        for (const id of testMealIds) {
          batch.delete(doc(db, 'users', testUid, 'meals', id));
        }
        await batch.commit();
        await deleteUser(auth.currentUser);
      } catch (cleanupErr) {
        console.warn('Cleanup error during error handling:', cleanupErr);
      }
    }
    process.exit(1);
  }
}

runLivePaginationVerification().catch(err => {
  console.error('\n❌ SCRIPT FATAL ERROR:', err);
  process.exit(1);
});
