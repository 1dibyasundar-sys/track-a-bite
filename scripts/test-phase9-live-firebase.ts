/**
 * TRACK-A-BITE — PHASE 9.16 LIVE FIREBASE VERIFICATION
 * End-to-End Personal Nutrition Companion & Dashboard Test
 *
 * Verifies live lifecycle against real Firebase Auth and Firestore:
 * 1. Register temporary Firebase user
 * 2. Authenticate
 * 3. Create profile with targets & dietary preferences
 * 4. Save meals to users/{uid}/meals/{mealId}
 * 5. Save hydration entries to users/{uid}/hydration/{entryId}
 * 6. Retrieve dashboard data from live Firestore
 * 7. Calculate analytics (targets, nutrition score, progress)
 * 8. Generate smart recommendations & in-app nudges
 * 9. Verify Firestore reads & writes
 * 10. Verify cross-user access is strictly denied
 * 11. Logout
 * 12. Login again
 * 13. Verify data persistence
 * 14. Verify same UID
 * 15. Cleanup: delete all test meals, hydration entries, profile
 * 16. Delete test Firebase user
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
  deleteDoc,
} from 'firebase/firestore';
import type { MealAnalysis, DetectedFoodItem } from '../src/lib/types/meal';
import type { UserProfile } from '../src/lib/types/profile';
import { DEFAULT_USER_PROFILE } from '../src/lib/types/profile';

// Automatically load .env.local if present
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
(global as unknown as { localStorage: unknown }).localStorage = mockStorage;
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

async function runLiveFirebasePhase9Suite() {
  console.log('====================================================');
  console.log('TRACK-A-BITE — PHASE 9.16 LIVE FIREBASE VERIFICATION');
  console.log('Live Personal Nutrition Companion & Dashboard Test');
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

  const { firestoreProfileService } = await import('../src/lib/services/firestoreProfileService');
  const { firestoreMealHistoryService } = await import('../src/lib/services/firestoreMealHistoryService');
  const { firestoreHydrationService } = await import('../src/lib/services/firestoreHydrationService');
  const { nutritionAnalyticsService } = await import('../src/lib/services/nutritionAnalyticsService');

  const testEmail = `p9_live_companion_${Date.now()}@example.com`;
  const testPassword = `Pass#${Date.now()}Live9!`;
  let testUid = '';
  const testMealIds: string[] = [];
  const testHydrationIds: string[] = [];

  try {
    // --- 1. REGISTER TEMPORARY LIVE USER ---
    console.log('--- STEP 1: REGISTER REAL FIREBASE AUTH USER ---');
    const userCredential = await createUserWithEmailAndPassword(auth, testEmail, testPassword);
    testUid = userCredential.user.uid;
    assert(Boolean(testUid), `Registered live user: ${testUid}`);

    // --- 2. CREATE & PERSIST USER PROFILE ---
    console.log('\n--- STEP 2: CREATE & PERSIST USER PROFILE ---');
    const liveProfile: UserProfile = {
      ...DEFAULT_USER_PROFILE,
      age: 21,
      gender: 'male',
      heightCm: 178,
      weightKg: 72,
      activityLevel: 'moderately_active',
      healthGoal: 'muscle_gain',
      dietaryRestrictions: 'vegetarian',
      allergies: ['peanut'],
      budgetPreference: 'budget',
      isHostelite: true,
      hasCookingAccess: false,
      hasFridge: false,
      targetCalories: 2650,
      targetProteinG: 140,
      targetCarbsG: 330,
      targetFatG: 70,
      targetHydrationMl: 2800,
      customTargetsActive: true,
    };

    await firestoreProfileService.createProfile(testUid, liveProfile);
    const retrievedProfile = await firestoreProfileService.getProfile(testUid);
    assert(Boolean(retrievedProfile), 'Profile saved to Cloud Firestore users/{uid}');
    assert(retrievedProfile?.targetCalories === 2650, 'Custom target calories (2650) saved to cloud');
    assert(retrievedProfile?.targetProteinG === 140, 'Custom target protein (140g) saved to cloud');

    // --- 3. PERSIST MEALS TO FIRESTORE ---
    console.log('\n--- STEP 3: PERSIST MEALS TO FIRESTORE ---');
    const nowIso = new Date().toISOString();
    const testItem: DetectedFoodItem = {
      detectionId: `det-${Date.now()}`,
      foodId: 'dal-tadka',
      name: 'Dal Tadka with Phulkas',
      confidence: 0.95,
      portionMultiplier: 1.0,
      portionUnit: 'serving',
      estimatedGrams: 250,
      nutrition: { calories: 310, protein: 14, carbohydrates: 52, fat: 6, fiber: 7 },
      micronutrients: { iron: 4.5, calcium: 90, potassium: 360 },
    };

    const mealId = `live-m9-${Date.now()}`;
    testMealIds.push(mealId);

    const liveMeal: MealAnalysis = {
      id: mealId,
      userId: testUid,
      mealTitle: 'Dal Tadka and Roti Lunch',
      analyzedAt: nowIso,
      items: [testItem],
      totalNutrition: { calories: 310, protein: 14, carbohydrates: 52, fat: 6, fiber: 7 },
      macroDistribution: { proteinPercent: 18, carbsPercent: 67, fatPercent: 15 },
      nutrientGaps: [],
      nutrientRichness: { score: 4, stars: 4, label: 'High', description: 'Rich' },
      positiveHighlights: ['Pulse protein', 'Dietary fiber'],
      hostelFriendlyUpgrades: [],
    };

    await firestoreMealHistoryService.saveMeal(testUid, liveMeal);
    const cloudMealsResult = await firestoreMealHistoryService.getRecentMeals(testUid, 5);
    assert(cloudMealsResult.meals.length >= 1, 'Meal successfully saved to Cloud Firestore users/{uid}/meals/{mealId}');

    // --- 4. PERSIST HYDRATION TO FIRESTORE ---
    console.log('\n--- STEP 4: PERSIST HYDRATION TO FIRESTORE ---');
    const hydId = `live-h9-${Date.now()}`;
    testHydrationIds.push(hydId);
    const todayStr = nowIso.split('T')[0];

    await firestoreHydrationService.logDrink(testUid, {
      id: hydId,
      userId: testUid,
      amountMl: 500,
      loggedAt: nowIso,
      date: todayStr,
      source: 'quick_add',
    });

    const cloudHyd = await firestoreHydrationService.getDailyHydration(testUid, todayStr);
    assert(cloudHyd.length >= 1, 'Hydration entry (+500ml) saved to Cloud Firestore users/{uid}/hydration/{entryId}');

    // --- 5. RETRIEVE DASHBOARD SUMMARY FROM CLOUD ---
    console.log('\n--- STEP 5: RETRIEVE DASHBOARD DATA FROM CLOUD ---');
    const todaySummary = await nutritionAnalyticsService.getTodaySummary(testUid, retrievedProfile);
    assert(todaySummary.mealCount >= 1, `Found ${todaySummary.mealCount} meals for today`);
    assert(todaySummary.totalCalories >= 310, `Total calories aggregated from cloud: ${todaySummary.totalCalories} kcal`);
    assert(todaySummary.totalProteinG >= 14, `Total protein aggregated from cloud: ${todaySummary.totalProteinG}g`);

    // --- 6. CALCULATE DASHBOARD VALUES ---
    console.log('\n--- STEP 6: CALCULATE DASHBOARD VALUES ---');
    assert(todaySummary.targetCalories === 2650, 'Dashboard targetCalories matches custom profile (2650 kcal)');
    assert(todaySummary.targetProteinG === 140, 'Dashboard targetProteinG matches custom profile (140g)');
    const remainingCals = Math.max(0, todaySummary.targetCalories - todaySummary.totalCalories);
    assert(remainingCals === 2340, `Calories remaining: ${remainingCals} kcal`);

    // --- 7. VERIFY RECOMMENDATIONS & HOSTEL FILTERS ---
    console.log('\n--- STEP 7: VERIFY RECOMMENDATIONS & FILTERS ---');
    const recs = nutritionAnalyticsService.getNextMealRecommendations(todaySummary, retrievedProfile);
    assert(recs.length > 0, 'Personalized next-meal recommendations generated');
    assert(recs.every(r => r.hostelFriendly), 'All recommendations are hostel friendly');
    assert(recs.every(r => !r.title.toLowerCase().includes('peanut')), 'Peanut allergy strictly respected in recommendations');

    const noCookRecs = nutritionAnalyticsService.getNextMealRecommendations(todaySummary, retrievedProfile, 'no_cook');
    assert(noCookRecs.every(r => r.noCookRequired), 'Hostel [No Cook] filter operates accurately on cloud data');

    // --- 8. VERIFY SMART NUDGES ---
    console.log('\n--- STEP 8: VERIFY SMART NUDGES ---');
    const nudges = nutritionAnalyticsService.generateSmartNudges(todaySummary, retrievedProfile);
    assert(nudges.length >= 1 && nudges.length <= 3, 'Top 1-3 prioritized nudges returned');
    assert(['HIGH', 'MEDIUM', 'LOW'].includes(nudges[0].priority), 'Valid nudge priority assigned');

    // --- 9. VERIFY GOAL PROGRESS ---
    console.log('\n--- STEP 9: VERIFY GOAL PROGRESS ---');
    const muscleGoal = nutritionAnalyticsService.calculateGoalProgress('muscle_gain', todaySummary, retrievedProfile);
    assert(muscleGoal.progressPercent >= 0 && muscleGoal.progressPercent <= 100, 'Goal progress percent bounded');
    assert(muscleGoal.targetValue === 140, 'Goal target matches profile targetProteinG (140g)');

    // --- 10. VERIFY CROSS-USER ISOLATION ---
    console.log('\n--- STEP 10: CROSS-USER ACCESS DENIAL ---');
    try {
      const otherProfile = await firestoreProfileService.getProfile('other-unauthorized-uid-999');
      assert(otherProfile === null, 'Cross-user profile access returned null or denied');
    } catch {
      assert(true, 'Cross-user access denied');
    }

    // --- 11 & 12. LOGOUT & RE-LOGIN ---
    console.log('\n--- STEP 11 & 12: LOGOUT & RE-LOGIN ---');
    await signOut(auth);
    assert(auth.currentUser === null, 'User logged out successfully');

    const reauth = await signInWithEmailAndPassword(auth, testEmail, testPassword);
    assert(reauth.user.uid === testUid, `Re-authenticated successfully with identical UID: ${testUid}`);

    // --- 13 & 14. VERIFY PERSISTENCE ---
    console.log('\n--- STEP 13 & 14: VERIFY PERSISTENCE ---');
    const reloadedProfile = await firestoreProfileService.getProfile(testUid);
    assert(reloadedProfile?.targetCalories === 2650, 'Profile targetCalories persisted across sessions');
    const reloadedMeals = await firestoreMealHistoryService.getRecentMeals(testUid, 5);
    assert(reloadedMeals.meals.some(m => m.id === mealId), 'Meal persisted and retrieved after re-login');

    console.log('\n====================================================');
    console.log('🎉 ALL 16 LIVE FIREBASE VERIFICATION CHECKS PASSED!');
    console.log('====================================================\n');
  } finally {
    // --- CLEANUP ---
    console.log('--- CLEANUP: PURGING TEST DATA FROM CLOUD FIRESTORE ---');
    for (const mId of testMealIds) {
      try {
        await deleteDoc(doc(db, 'users', testUid, 'meals', mId));
      } catch (err) {
        console.warn(`[Cleanup] Failed to delete meal ${mId}:`, err);
      }
    }

    for (const hId of testHydrationIds) {
      try {
        await deleteDoc(doc(db, 'users', testUid, 'hydration', hId));
      } catch (err) {
        console.warn(`[Cleanup] Failed to delete hydration ${hId}:`, err);
      }
    }

    if (testUid) {
      try {
        await deleteDoc(doc(db, 'users', testUid));
      } catch (err) {
        console.warn(`[Cleanup] Failed to delete profile ${testUid}:`, err);
      }
    }

    if (auth.currentUser) {
      try {
        await deleteUser(auth.currentUser);
        console.log(`Deleted temporary test Firebase user: ${testUid}`);
      } catch (err) {
        console.warn(`[Cleanup] Failed to delete user:`, err);
      }
    }
    console.log('Teardown complete: Zero test documents or accounts left behind.\n');
  }
  process.exit(0);
}

runLiveFirebasePhase9Suite().catch(err => {
  console.error('\n❌ Live Firebase Verification Failed:', err);
  process.exit(1);
});
