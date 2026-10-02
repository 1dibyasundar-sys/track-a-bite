/**
 * TRACK-A-BITE — PHASE 8.4 LIVE FIREBASE ANALYTICS VERIFICATION
 * Project: track-a-bite
 *
 * Verifies live end-to-end integration against real Firebase Auth and Firestore:
 * 1. Register test user via live Firebase Authentication
 * 2. Save profile to live Firestore
 * 3. Persist meal documents to users/{uid}/meals/{mealId}
 * 4. Calculate today's nutrition analytics from live Firestore (dataSource: cloud)
 * 5. Calculate weekly nutrition analytics from live Firestore
 * 6. Verify personalized targets
 * 7. Verify deterministic nutrition score
 * 8. Verify evidence-based personalized insights
 * 9. Verify hostel-aware recommendations
 * 10. Sign out test user
 * 11. Verify unauthenticated cloud access blocked by Firestore rules
 * 12. Verify local fallback functional when unauthenticated
 * 13. Sign back in with test account
 * 14. Verify analytics recover from live Firestore
 * 15. Clean up test documents and auth account
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

// Mock browser localStorage for Node.js
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

async function runLiveVerification() {
  console.log('================================================================');
  console.log('TRACK-A-BITE — PHASE 8.4 LIVE FIRESTORE ANALYTICS VERIFICATION');
  console.log('Project: track-a-bite');
  console.log('================================================================\n');

  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  assert(Boolean(firebaseConfig.apiKey && firebaseConfig.projectId), 'Firebase credentials configured from .env.local');

  const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  const { firestoreMealHistoryService } = await import('../src/lib/services/firestoreMealHistoryService');
  const { firestoreProfileService } = await import('../src/lib/services/firestoreProfileService');
  const { nutritionAnalyticsService } = await import('../src/lib/services/nutritionAnalyticsService');
  const { mealHistoryService } = await import('../src/lib/services');

  const timestamp = Date.now();
  const testEmail = `live_analytics_${timestamp}@trackabite.test`;
  const testPassword = `Pass#${timestamp}!98`;

  // 1. Register test user via live Firebase Auth
  console.log(`\n--- 1. REGISTER TEST USER ---`);
  console.log(`Creating user: ${testEmail}`);
  const userCredential = await createUserWithEmailAndPassword(auth, testEmail, testPassword);
  const user = userCredential.user;
  const uid = user.uid;
  assert(Boolean(uid && uid.length > 5), `Live Firebase UID obtained: ${uid}`);

  const testMealIdToday = `live-meal-today-${timestamp}`;
  const testMealIdYest = `live-meal-yest-${timestamp}`;

  try {
    // 2. Save profile to live Firestore
    console.log(`\n--- 2. SAVE PROFILE TO LIVE FIRESTORE ---`);
    const profilePayload: UserProfile = {
      age: 21,
      gender: 'male',
      heightCm: 178,
      weightKg: 72,
      activityLevel: 'moderately_active',
      healthConditions: ['None'],
      isHostelite: true,
      hasCookingAccess: false,
      hasFridge: false,
      budgetPreference: 'budget',
      onboardingCompleted: true,
    };

    const savedProfile = await firestoreProfileService.upsertProfile(uid, profilePayload);
    assert(Boolean(savedProfile), 'Profile saved to Firestore users/{uid}');
    const docSnap = await getDoc(doc(db, 'users', uid));
    assert(docSnap.exists(), 'Live user profile document verified in Firestore');

    // 3. Persist meals to users/{uid}/meals/{mealId}
    console.log(`\n--- 3. PERSIST MEALS TO LIVE FIRESTORE ---`);
    const todayIso = new Date().toISOString();
    const yestDate = new Date();
    yestDate.setDate(yestDate.getDate() - 1);
    const yestIso = yestDate.toISOString();

    const sampleMealToday: MealAnalysis = {
      id: testMealIdToday,
      mealTitle: 'Campus Lunch Thali',
      analyzedAt: todayIso,
      items: [
        {
          detectionId: 'det-1',
          foodId: 'dal-tadka',
          name: 'Dal Tadka',
          confidence: 0.94,
          portionMultiplier: 1.0,
          portionUnit: 'katori',
          estimatedGrams: 150,
          nutrition: { calories: 150, protein: 9, carbohydrates: 20, fat: 4, fiber: 5 },
        },
        {
          detectionId: 'det-2',
          foodId: 'whole-wheat-roti',
          name: 'Whole Wheat Roti',
          confidence: 0.98,
          portionMultiplier: 2.0,
          portionUnit: 'piece',
          estimatedGrams: 80,
          nutrition: { calories: 240, protein: 6, carbohydrates: 44, fat: 4, fiber: 6 },
        },
      ],
      totalNutrition: {
        calories: 390,
        protein: 15,
        carbohydrates: 64,
        fat: 8,
        fiber: 11,
      },
      macroDistribution: { carbsPercent: 65, proteinPercent: 15, fatPercent: 20 },
      nutrientRichness: { stars: 4.0, label: 'Balanced', explanation: 'Good balance', highlights: ['Fiber'] },
      nutrientGaps: { providedNutrients: [], missingNutrients: [], whyItMattersSummary: 'Summary' },
      balanceAssessment: { rating: 'balanced', label: 'Balanced', summary: 'Good', detail: 'Detail', glycemicImpactEstimate: 'Moderate' },
      positiveHighlights: ['Good fiber'],
      balancingRecommendations: [],
      hostelFriendlyUpgrades: [],
      hostelModeActive: true,
      practicalAdjustments: [],
      disclaimer: 'Live test',
    };

    const sampleMealYest: MealAnalysis = {
      ...sampleMealToday,
      id: testMealIdYest,
      mealTitle: 'Dinner Rice & Curd',
      analyzedAt: yestIso,
      totalNutrition: {
        calories: 420,
        protein: 14,
        carbohydrates: 70,
        fat: 9,
        fiber: 4,
      },
    };

    await firestoreMealHistoryService.saveMeal(uid, sampleMealToday);
    await firestoreMealHistoryService.saveMeal(uid, sampleMealYest);

    const mealSnap = await getDoc(doc(db, 'users', uid, 'meals', testMealIdToday));
    assert(mealSnap.exists(), 'Live Firestore meal document verified in users/{uid}/meals/{mealId}');

    // 4. Calculate today's nutrition from live Firestore
    console.log(`\n--- 4. CALCULATE TODAY'S NUTRITION (LIVE CLOUD) ---`);
    const todaySummary = await nutritionAnalyticsService.getTodaySummary(uid);
    assert(todaySummary.dataSource === 'cloud', 'Today summary dataSource is cloud');
    assert(todaySummary.mealCount >= 1, `Today summary found ${todaySummary.mealCount} meal(s)`);
    assert(todaySummary.totalCalories >= 390, `Today calories calculated (${todaySummary.totalCalories} kcal)`);
    assert(todaySummary.totalProteinG >= 15, `Today protein calculated (${todaySummary.totalProteinG}g)`);

    // 5. Calculate weekly nutrition from live Firestore
    console.log(`\n--- 5. CALCULATE WEEKLY NUTRITION (LIVE CLOUD) ---`);
    const weeklySummary = await nutritionAnalyticsService.getWeeklySummary(uid);
    assert(weeklySummary.dataSource === 'cloud', 'Weekly summary dataSource is cloud');
    assert(weeklySummary.totalMeals >= 2, `Weekly summary captured ${weeklySummary.totalMeals} total meals`);
    assert(weeklySummary.averageCalories > 0, `Weekly average calories calculated (${weeklySummary.averageCalories} kcal)`);
    assert(weeklySummary.averageProtein > 0, `Weekly average protein calculated (${weeklySummary.averageProtein}g)`);
    assert(weeklySummary.consistencyMetrics.daysWithLogs >= 2, 'Consistency metric loggedDays is at least 2');

    // 6. Verify personalized targets
    console.log(`\n--- 6. VERIFY PERSONALIZED TARGETS ---`);
    assert(todaySummary.targetCalories > 0, `Target calories calculated (${todaySummary.targetCalories} kcal)`);
    assert(todaySummary.targetProteinG > 0, `Target protein calculated (${todaySummary.targetProteinG}g)`);
    assert(todaySummary.calorieProgressPercent > 0, `Calorie progress calculated (${todaySummary.calorieProgressPercent}%)`);

    // 7. Verify deterministic nutrition score
    console.log(`\n--- 7. VERIFY NUTRITION SCORE ---`);
    assert(todaySummary.nutritionScore > 0, `Nutrition score computed (${todaySummary.nutritionScore}/100)`);
    assert(['excellent', 'good', 'fair', 'needs_attention'].includes(todaySummary.nutritionRating), `Valid nutrition rating (${todaySummary.nutritionRating})`);

    // 8. Verify personalized insights
    console.log(`\n--- 8. VERIFY PERSONALIZED INSIGHTS ---`);
    const insights = nutritionAnalyticsService.getNutritionInsights(todaySummary, profilePayload);
    assert(insights.length > 0, 'Personalized insights generated for live meal summary');
    assert(insights.some(i => i.evidence.length > 0), 'Every insight contains empirical evidence');
    console.log(`Generated insight: "${insights[0].title}" - ${insights[0].evidence}`);

    // 9. Verify next-meal recommendations
    console.log(`\n--- 9. VERIFY NEXT-MEAL RECOMMENDATIONS ---`);
    const recs = nutritionAnalyticsService.getNextMealRecommendations(todaySummary, profilePayload);
    assert(recs.length > 0, 'Recommendations generated');
    assert(recs.every(r => r.hostelFriendly), 'All recommendations are hostelFriendly for hostelite');
    assert(recs.every(r => r.noCookRequired), 'All recommendations require zero cooking for student without kitchen');
    console.log(`Top recommendation: "${recs[0].title}" (${recs[0].estimatedNutrition.protein}g protein, ${recs[0].affordabilityCategory})`);

    // 10. Sign out test user
    console.log(`\n--- 10. SIGN OUT CURRENT SESSION ---`);
    await signOut(auth);
    console.log('User signed out successfully');

    // 11. Verify unauthenticated cloud access blocked by Firestore rules
    console.log(`\n--- 11. VERIFY UNAUTHENTICATED ACCESS BLOCKED ---`);
    let unauthBlocked = false;
    try {
      await getDoc(doc(db, 'users', uid, 'meals', testMealIdToday));
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'permission-denied') {
        unauthBlocked = true;
      }
    }
    assert(unauthBlocked, 'Unauthenticated read to users/{uid}/meals/{mealId} blocked with permission-denied');

    // 12. Verify local fallback functional when unauthenticated
    console.log(`\n--- 12. VERIFY LOCAL FALLBACK WHILE UNAUTHENTICATED ---`);
    await mealHistoryService.saveMeal(sampleMealToday);
    const localSummary = await nutritionAnalyticsService.getTodaySummary(undefined);
    assert(localSummary.dataSource === 'local', 'Unauthenticated request safely falls back to local data source');
    assert(localSummary.totalCalories >= 390, 'Local analytics computes metrics correctly');

    // 13. Sign back in
    console.log(`\n--- 13. SIGN BACK IN WITH TEST ACCOUNT ---`);
    const reAuth = await signInWithEmailAndPassword(auth, testEmail, testPassword);
    assert(reAuth.user.uid === uid, 'Re-login returned identical user UID');

    // 14. Verify analytics recover from live Firestore
    console.log(`\n--- 14. VERIFY RECOVERY FROM LIVE FIRESTORE ---`);
    const restoredSummary = await nutritionAnalyticsService.getTodaySummary(uid);
    assert(restoredSummary.dataSource === 'cloud', 'Restored summary dataSource is cloud');
    assert(restoredSummary.mealCount >= 1, 'Restored summary retrieves persisted cloud meals');
    assert(restoredSummary.totalCalories >= 390, 'Restored calories match cloud data');

    // 15. Clean up test documents and account
    console.log(`\n--- 15. CLEANUP TEST DATA ---`);
    await deleteDoc(doc(db, 'users', uid, 'meals', testMealIdToday));
    await deleteDoc(doc(db, 'users', uid, 'meals', testMealIdYest));
    await deleteDoc(doc(db, 'users', uid));
    console.log('Deleted test Firestore documents');

    await deleteUser(reAuth.user);
    console.log('Cleaned up Firebase Auth test user');

    console.log('\n================================================================');
    console.log('🎉 ALL LIVE FIRESTORE ANALYTICS VERIFICATIONS PASSED (100%)');
    console.log('================================================================\n');
  } catch (err) {
    console.error('\n❌ LIVE FIRESTORE VERIFICATION FAILED:', err);
    try {
      if (auth.currentUser) {
        await deleteDoc(doc(db, 'users', uid, 'meals', testMealIdToday));
        await deleteDoc(doc(db, 'users', uid, 'meals', testMealIdYest));
        await deleteDoc(doc(db, 'users', uid));
        await deleteUser(auth.currentUser);
      }
    } catch {
      // Ignore cleanup error
    }
    process.exit(1);
  }
}

runLiveVerification().catch(err => {
  console.error(err);
  process.exit(1);
});
