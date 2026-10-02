/**
 * TRACK-A-BITE — PHASE 8.5 LIVE FIREBASE REPORTING VERIFICATION
 * Project: track-a-bite
 *
 * Verifies all 13 live verification requirements against real Firebase Auth & Firestore:
 * 1. Login / Register with real test account
 * 2. Resolve real Firebase UID
 * 3. Write test meal & Read cloud meal history
 * 4. Generate monthly report (getMonthlySummary)
 * 5. Generate date-range report (getDateRangeReport)
 * 6. Export JSON (exportReportAsJSON)
 * 7. Export CSV (exportReportAsCSV)
 * 8. Verify exported data belongs only to authenticated user (no secrets, UID isolation)
 * 9. Logout
 * 10. Confirm cloud data is inaccessible
 * 11. Confirm local fallback remains functional
 * 12. Login again
 * 13. Confirm cloud analytics restore correctly
 * + Clean up test documents and auth account
 */

import fs from 'fs';
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  deleteUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  deleteDoc,
} from 'firebase/firestore';
import type { MealAnalysis } from '../src/lib/types/meal';
import type { UserProfile } from '../src/lib/types/profile';

// Automatically load .env.local for live credentials
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

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`✅ [PASS] ${message}`);
  }
}

// Mock browser localStorage for Node.js fallback testing
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
(global as unknown as { localStorage: unknown }).localStorage = mockStorage;
(global as unknown as { window: unknown }).window = {
  localStorage: mockStorage,
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true,
  print: () => {},
};

async function runLiveVerification() {
  console.log('====================================================');
  console.log('TRACK-A-BITE — PHASE 8.5 LIVE FIREBASE VERIFICATION');
  console.log('Real Auth, Firestore Reports, Exports & Data Isolation');
  console.log('====================================================\n');

  // Verify Firebase credentials in env
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  assert(Boolean(apiKey && projectId), 'STEP 0: Firebase environment variables configured');
  assert(projectId === 'track-a-bite', `STEP 0: Target project is track-a-bite (got: ${projectId})`);

  // Dynamically import client services
  const {
    firestoreMealHistoryService,
  } = await import('../src/lib/services');

  const {
    nutritionAnalyticsService,
    getLocalISODate,
  } = await import('../src/lib/services/nutritionAnalyticsService');

  // Initialize client Firebase app instance for test runner
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

  const testEmail = `phase85_live_${Date.now()}@example.com`;
  const testPassword = `Pass#${Date.now()}Secure!`;
  let testUid = '';
  const testMealIds: string[] = [];

  try {
    // 1. REGISTER / LOGIN TEST ACCOUNT
    console.log('--- STEP 1: LOGIN / REGISTER REAL TEST ACCOUNT ---');
    const userCredential = await createUserWithEmailAndPassword(auth, testEmail, testPassword);
    testUid = userCredential.user.uid;
    console.log(`Created test account: ${testEmail}`);
    assert(Boolean(testUid), 'STEP 1: Firebase Auth successfully created user credential');

    // 2. RESOLVE FIREBASE UID
    console.log('\n--- STEP 2: RESOLVE FIREBASE UID ---');
    console.log(`Resolved authenticated UID: ${testUid}`);
    assert(typeof testUid === 'string' && testUid.length >= 20, 'STEP 2: Authenticated UID is valid Firebase UID');

    // 3. READ CLOUD MEAL HISTORY & WRITE TEST MEAL
    console.log('\n--- STEP 3: READ CLOUD MEAL HISTORY & PERSIST LIVE MEAL ---');
    const todayStr = getLocalISODate(new Date());
    const testMealId = `live-meal-85-${Date.now()}`;
    testMealIds.push(testMealId);

    const testMeal: MealAnalysis = {
      id: testMealId,
      mealTitle: 'Live Dal Makhani & Roti',
      analyzedAt: `${todayStr}T13:00:00.000Z`,
      items: [
        {
          detectionId: 'det-live-1',
          foodId: 'dal-makhani',
          name: 'Dal Makhani',
          confidence: 0.94,
          portionMultiplier: 1.0,
          portionUnit: 'katori',
          estimatedGrams: 180,
          nutrition: { calories: 350, protein: 14, carbohydrates: 38, fat: 16, fiber: 7 },
        },
      ],
      totalNutrition: { calories: 350, protein: 14, carbohydrates: 38, fat: 16, fiber: 7 },
      macroDistribution: { carbsPercent: 44, proteinPercent: 16, fatPercent: 40 },
      nutrientRichness: {
        stars: 4.2,
        label: 'Nutrient Dense',
        explanation: 'Good mineral and protein content',
        highlights: ['High Protein', 'Rich in Iron'],
      },
      nutrientGaps: {
        providedNutrients: ['Iron', 'Protein'],
        missingNutrients: [],
        whyItMattersSummary: 'Fulfills midday protein needs',
      },
      balanceAssessment: {
        rating: 'balanced',
        label: 'Balanced',
        summary: 'Hearty protein-rich meal',
        detail: 'Optimal protein and carbs',
        glycemicImpactEstimate: 'Moderate',
      },
      positiveHighlights: ['High fiber dal'],
      balancingRecommendations: [],
      hostelFriendlyUpgrades: [],
      hostelModeActive: true,
      practicalAdjustments: [],
      disclaimer: 'Informational purpose only',
    };

    // Save meal to Firestore
    await firestoreMealHistoryService.saveMeal(testUid, testMeal);
    console.log(`Persisted meal to users/${testUid}/meals/${testMealId}`);

    // Read back meal from Firestore
    const cloudHistory = await firestoreMealHistoryService.getRecentMeals(testUid, 10);
    assert(cloudHistory.meals.length >= 1, 'STEP 3: Read back live meal history from Firestore');
    assert(cloudHistory.meals.some(m => m.id === testMealId), 'STEP 3: Live meal retrieved matches persisted record');

    // 4. GENERATE MONTHLY REPORT
    console.log('\n--- STEP 4: GENERATE MONTHLY REPORT ---');
    const monthlyReport = await nutritionAnalyticsService.getMonthlySummary(testUid);
    assert(monthlyReport.dataSource === 'cloud', 'STEP 4: Monthly report data source is "cloud"');
    assert(monthlyReport.totalMeals >= 1, 'STEP 4: Monthly report reflects persisted cloud meal');
    assert(monthlyReport.averageCalories > 0, 'STEP 4: Monthly report calculated average calories');
    assert(Array.isArray(monthlyReport.strongestDays), 'STEP 4: Monthly report identifies strongest days');
    assert(Array.isArray(monthlyReport.insights) && monthlyReport.insights.length > 0, 'STEP 4: Monthly report contains evidence-based insights');

    // 5. GENERATE DATE-RANGE REPORT
    console.log('\n--- STEP 5: GENERATE DATE-RANGE REPORT ---');
    const rangeReport = await nutritionAnalyticsService.getDateRangeReport(testUid, 'last_7_days');
    assert(rangeReport.dataSource === 'cloud', 'STEP 5: Date range report data source is "cloud"');
    assert(rangeReport.totalMeals >= 1, 'STEP 5: Date range report aggregates cloud meals');
    assert(rangeReport.trend.length === 7, 'STEP 5: Date range report produces 7-day longitudinal trend points');
    assert(rangeReport.activeDaysCount >= 1, 'STEP 5: Date range report has at least 1 active logging day');

    // 6. EXPORT JSON
    console.log('\n--- STEP 6: EXPORT JSON ---');
    const mockProfile: UserProfile = {
      age: 22,
      gender: 'male',
      heightCm: 175,
      weightKg: 70,
      activityLevel: 'moderately_active',
      healthConditions: [],
      isHostelite: true,
      hasCookingAccess: false,
      hasFridge: false,
      budgetPreference: 'budget',
      onboardingCompleted: true,
    };
    const jsonExportStr = nutritionAnalyticsService.exportReportAsJSON(rangeReport, mockProfile);
    const parsedJSON = JSON.parse(jsonExportStr);
    assert(parsedJSON.exportVersion === '1.0', 'STEP 6: JSON export contains version 1.0');
    assert(parsedJSON.meals.length >= 1, 'STEP 6: JSON export contains meals array');
    assert(parsedJSON.nutritionSummary.totalMeals >= 1, 'STEP 6: JSON export includes nutrition summary');

    // 7. EXPORT CSV
    console.log('\n--- STEP 7: EXPORT CSV ---');
    const csvExportStr = nutritionAnalyticsService.exportReportAsCSV(rangeReport);
    assert(csvExportStr.startsWith('\uFEFF'), 'STEP 7: CSV export has UTF-8 BOM');
    assert(csvExportStr.includes('Live Dal Makhani & Roti'), 'STEP 7: CSV contains meal title');
    assert(csvExportStr.includes('350'), 'STEP 7: CSV contains correct caloric value');

    // 8. VERIFY EXPORTED DATA BELONGS ONLY TO AUTHENTICATED USER
    console.log('\n--- STEP 8: VERIFY EXPORT CONTAINS ONLY AUTHENTICATED USER DATA & NO SECRETS ---');
    assert(!jsonExportStr.toLowerCase().includes('password'), 'STEP 8: JSON export strictly excludes password');
    assert(!csvExportStr.toLowerCase().includes('password'), 'STEP 8: CSV export strictly excludes password');
    assert(!jsonExportStr.includes('refreshToken'), 'STEP 8: No auth tokens in JSON export');
    assert(!jsonExportStr.includes(process.env.GEMINI_API_KEY || 'AIzaKey'), 'STEP 8: No GEMINI_API_KEY in export');
    // Ensure all meals in export match the authenticated user's meals
    for (const m of parsedJSON.meals) {
      assert(testMealIds.includes(m.id), `STEP 8: Exported meal (${m.id}) belongs strictly to authenticated test user`);
    }

    // 9. LOGOUT
    console.log('\n--- STEP 9: LOGOUT TEST USER ---');
    await signOut(auth);
    assert(auth.currentUser === null, 'STEP 9: User successfully signed out');

    // 10. CONFIRM CLOUD DATA IS INACCESSIBLE WHEN UNAUTHENTICATED
    console.log('\n--- STEP 10: CONFIRM CLOUD DATA INACCESSIBLE WHEN UNAUTHENTICATED ---');
    let cloudAccessBlocked = false;
    try {
      // Trying to directly read test user's meal document directly with unauthenticated client
      const mealDocRef = doc(db, 'users', testUid, 'meals', testMealId);
      await getDoc(mealDocRef);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'permission-denied' || String(err).includes('permission')) {
        cloudAccessBlocked = true;
      }
    }
    assert(cloudAccessBlocked, 'STEP 10: Unauthenticated access to users/{uid}/meals/{mealId} strictly blocked by Firestore rules');

    // 11. CONFIRM LOCAL FALLBACK REMAINS FUNCTIONAL
    console.log('\n--- STEP 11: CONFIRM LOCAL FALLBACK FUNCTIONAL ---');
    // Calling getDateRangeReport without authenticated UID
    const unauthReport = await nutritionAnalyticsService.getDateRangeReport(undefined, 'last_7_days');
    assert(unauthReport.dataSource === 'local', 'STEP 11: Unauthenticated request gracefully falls back to local storage');
    assert(Array.isArray(unauthReport.trend), 'STEP 11: Local report successfully calculates trend points');

    // 12. LOGIN AGAIN
    console.log('\n--- STEP 12: LOGIN AGAIN WITH TEST ACCOUNT ---');
    const signInCredential = await signInWithEmailAndPassword(auth, testEmail, testPassword);
    const restoredUid = signInCredential.user.uid;
    assert(restoredUid === testUid, 'STEP 12: Successfully logged back in and resolved identical UID');

    // 13. CONFIRM CLOUD ANALYTICS RESTORE CORRECTLY
    console.log('\n--- STEP 13: CONFIRM CLOUD ANALYTICS RESTORE CORRECTLY ---');
    const restoredReport = await nutritionAnalyticsService.getDateRangeReport(restoredUid, 'last_7_days');
    assert(restoredReport.dataSource === 'cloud', 'STEP 13: Restored analytics successfully sourced from live cloud Firestore');
    assert(restoredReport.totalMeals >= 1, 'STEP 13: Cloud meal history fully restored in analytics');
    assert(restoredReport.trends.some(t => t.calories >= 350), 'STEP 13: Caloric trend points accurately recovered from cloud');

    // CLEANUP TEST DATA
    console.log('\n--- CLEANUP: REMOVING LIVE TEST DATA ---');
    for (const id of testMealIds) {
      try {
        await deleteDoc(doc(db, 'users', testUid, 'meals', id));
        console.log(`Deleted test meal users/${testUid}/meals/${id}`);
      } catch (err) {
        console.warn(`Failed to delete test meal ${id}:`, err);
      }
    }
    try {
      await deleteDoc(doc(db, 'users', testUid));
      console.log(`Deleted user profile doc users/${testUid}`);
    } catch {
      // Profile doc might not exist
    }

    try {
      await deleteUser(signInCredential.user);
      console.log(`Deleted test user auth account: ${testEmail}`);
    } catch (err) {
      console.warn(`Failed to delete auth user:`, err);
    }

    console.log('\n====================================================');
    console.log('🎉 ALL 13 PHASE 8.5 LIVE FIREBASE VERIFICATIONS PASSED!');
    console.log('====================================================\n');
  } catch (error) {
    console.error('\n❌ LIVE FIREBASE VERIFICATION FAILED:', error);
    // Attempt cleanup even on failure
    if (testUid && auth.currentUser) {
      for (const id of testMealIds) {
        try { await deleteDoc(doc(db, 'users', testUid, 'meals', id)); } catch {}
      }
      try { await deleteDoc(doc(db, 'users', testUid)); } catch {}
      try { await deleteUser(auth.currentUser); } catch {}
    }
    process.exit(1);
  }
}

runLiveVerification().catch(err => {
  console.error('\n❌ SCRIPT FATAL ERROR:', err);
  process.exit(1);
});
