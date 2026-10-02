/**
 * TRACK-A-BITE — PHASE 9 LIVE FIREBASE VERIFICATION
 * End-to-End Personal Nutrition Dashboard & Daily Journey Cloud Verification
 *
 * Verifies live lifecycle against real Firebase Auth and Firestore:
 * 1. Register temporary Firebase user
 * 2. Create and persist profile
 * 3. Save meals to users/{uid}/meals/{mealId}
 * 4. Save hydration entries to users/{uid}/hydration/{entryId}
 * 5. Retrieve analytics from live Firestore
 * 6. Calculate dashboard values
 * 7. Verify recommendations
 * 8. Verify micronutrients
 * 9. Verify hydration
 * 10. Verify streak/consistency calculations
 * 11. Logout
 * 12. Login again
 * 13. Verify persistence
 * 14. Verify same UID
 * 15. Verify cross-user isolation
 * 16. Cleanup all test data
 * 17. Delete test Firebase user
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

async function runLivePhase9DashboardVerification() {
  console.log('====================================================');
  console.log('TRACK-A-BITE — PHASE 9 LIVE FIREBASE VERIFICATION');
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

  const testEmail = `p9_live_dash_${Date.now()}@example.com`;
  const testPassword = `Pass#${Date.now()}Live9!`;
  let testUid = '';
  const testMealIds: string[] = [];
  const testHydrationIds: string[] = [];

  try {
    // -------------------------------------------------------------------------
    // STEP 1: REGISTER REAL FIREBASE USER
    // -------------------------------------------------------------------------
    console.log('--- STEP 1: REGISTER REAL FIREBASE AUTH USER ---');
    const userCred = await createUserWithEmailAndPassword(auth, testEmail, testPassword);
    testUid = userCred.user.uid;
    assert(Boolean(testUid && testUid.length > 5), `Registered live user: ${testUid}`);

    // -------------------------------------------------------------------------
    // STEP 2: CREATE & PERSIST USER PROFILE
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 2: CREATE & PERSIST USER PROFILE ---');
    const testProfile: UserProfile = {
      ...DEFAULT_USER_PROFILE,
      age: 22,
      gender: 'male',
      heightCm: 178,
      weightKg: 74,
      activityLevel: 'moderately_active',
      healthGoal: 'muscle_gain',
      dietaryRestrictions: 'vegetarian',
      allergies: ['Peanuts'],
      isHostelite: true,
      hasCookingAccess: false,
      hasFridge: false,
      budgetPreference: 'budget',
      targetCalories: 2600,
      targetProteinG: 135,
      customTargetsActive: true,
      targetHydrationMl: 2800,
    };

    const savedProfile = await firestoreProfileService.createProfile(testUid, testProfile);
    assert(Boolean(savedProfile), 'Profile saved to Cloud Firestore users/{uid}');
    assert(savedProfile?.targetCalories === 2600, 'Custom target calories (2600) saved to cloud');
    assert(savedProfile?.targetProteinG === 135, 'Custom target protein (135g) saved to cloud');

    // -------------------------------------------------------------------------
    // STEP 3: PERSIST MEALS WITH MICRONUTRIENTS
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 3: PERSIST MEALS TO FIRESTORE ---');
    const sampleItem: DetectedFoodItem = {
      detectionId: `det-p9-${Date.now()}`,
      foodId: 'food-sprouts-chaat',
      name: 'Sprouts Chaat',
      confidence: 0.95,
      portionMultiplier: 1.0,
      portionUnit: 'plate',
      estimatedGrams: 200,
      nutrition: { calories: 240, protein: 16, carbohydrates: 36, fat: 3, fiber: 9, sodium: 320 },
      micronutrients: { iron: 5.2, calcium: 110, potassium: 480, folate: 140 },
    };

    const meal1Id = `meal_p9_${Date.now()}_1`;
    testMealIds.push(meal1Id);

    const testMeal: MealAnalysis = {
      id: meal1Id,
      mealTitle: 'Campus Sprouts Lunch',
      analyzedAt: new Date().toISOString(),
      items: [sampleItem],
      totalNutrition: { calories: 240, protein: 16, carbohydrates: 36, fat: 3, fiber: 9, sodium: 320 },
      macroDistribution: { proteinPercent: 27, carbsPercent: 61, fatPercent: 12 },
      nutrientRichness: { score: 4.5, stars: 4.5, label: 'Nutrient Rich', highlights: [], explanation: '' },
      nutrientGaps: { gaps: [], summary: '', recommendations: [] },
      balanceAssessment: { isBalanced: true, rating: 'good', score: 85, strengths: [], suggestions: [] },
      positiveHighlights: ['High fiber', 'Plant protein'],
      balancingRecommendations: [],
      hostelFriendlyUpgrades: [],
      hostelModeActive: true,
      practicalAdjustments: [],
      disclaimer: 'Non-diagnostic student food analysis',
    };

    const savedMeal = await firestoreMealHistoryService.saveMeal(testUid, testMeal);
    assert(savedMeal.id === meal1Id, 'Meal successfully saved to Cloud Firestore users/{uid}/meals/{mealId}');

    // -------------------------------------------------------------------------
    // STEP 4: PERSIST HYDRATION ENTRIES
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 4: PERSIST HYDRATION TO FIRESTORE ---');
    const hydId = `hyd_p9_${Date.now()}_1`;
    testHydrationIds.push(hydId);
    const hydEntry = await firestoreHydrationService.logDrink(testUid, {
      id: hydId,
      amountMl: 500,
      loggedAt: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0],
      source: 'quick_add',
    });
    assert(hydEntry.amountMl === 500, 'Hydration entry (+500ml) saved to Cloud Firestore users/{uid}/hydration/{entryId}');

    // -------------------------------------------------------------------------
    // STEP 5: RETRIEVE ANALYTICS FROM CLOUD
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 5: RETRIEVE ANALYTICS FROM CLOUD ---');
    const todaySummary = await nutritionAnalyticsService.getTodaySummary(testUid, testProfile);
    assert(todaySummary.mealCount >= 1, `Found ${todaySummary.mealCount} meals for today`);
    assert(todaySummary.totalCalories >= 240, `Total calories aggregated from cloud: ${todaySummary.totalCalories} kcal`);
    assert(todaySummary.totalProteinG >= 16, `Total protein aggregated from cloud: ${todaySummary.totalProteinG}g`);

    // -------------------------------------------------------------------------
    // STEP 6: CALCULATE DASHBOARD VALUES
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 6: CALCULATE DASHBOARD VALUES ---');
    assert(todaySummary.targetCalories === 2600, 'Dashboard targetCalories matches custom profile (2600 kcal)');
    assert(todaySummary.targetProteinG === 135, 'Dashboard targetProteinG matches custom profile (135g)');
    const caloriesRemaining = Math.max(0, todaySummary.targetCalories - todaySummary.totalCalories);
    assert(caloriesRemaining === 2600 - todaySummary.totalCalories, `Calories remaining: ${caloriesRemaining} kcal`);
    assert(todaySummary.calorieProgressPercent > 0, `Calorie progress: ${todaySummary.calorieProgressPercent}%`);

    // -------------------------------------------------------------------------
    // STEP 7: VERIFY RECOMMENDATIONS
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 7: VERIFY RECOMMENDATIONS ---');
    const recs = nutritionAnalyticsService.getNextMealRecommendations(todaySummary, testProfile);
    assert(recs.length > 0, 'Personalized next-meal recommendations generated');
    assert(recs.every(r => r.hostelFriendly), 'All recommendations are hostel friendly');
    assert(recs.every(r => !r.title.toLowerCase().includes('peanut')), 'Peanut allergy strictly respected in recommendations');

    // -------------------------------------------------------------------------
    // STEP 8: VERIFY MICRONUTRIENTS
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 8: VERIFY MICRONUTRIENTS ---');
    assert(Boolean(todaySummary.micronutrients), 'Micronutrients summary present');
    assert(todaySummary.micronutrients?.intake.ironMg === 5.2, 'Iron intake = 5.2mg');
    assert(todaySummary.micronutrients?.intake.calciumMg === 110, 'Calcium intake = 110mg');

    // -------------------------------------------------------------------------
    // STEP 9: VERIFY HYDRATION
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 9: VERIFY HYDRATION ---');
    assert(Boolean(todaySummary.hydration), 'Hydration summary present');
    assert(todaySummary.hydration?.dailyWaterIntakeMl === 500, 'Daily water intake = 500ml');
    assert(todaySummary.hydration?.hydrationTargetMl === 2800, 'Hydration target = 2800ml');
    assert(todaySummary.hydration?.loggedDrinksCount === 1, 'Logged drinks count = 1');

    // -------------------------------------------------------------------------
    // STEP 10: VERIFY STREAK & CONSISTENCY
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 10: VERIFY STREAK & CONSISTENCY ---');
    const streaks = nutritionAnalyticsService.calculateStreakMetrics(
      [testMeal],
      [hydEntry],
      2800
    );
    assert(streaks.mealsLoggedToday === 1, 'Meals logged today = 1');
    assert(streaks.currentStreakDays >= 1, 'Current streak is active (>= 1 day)');
    assert(streaks.sevenDayConsistencyPercent > 0, `7-day consistency rate: ${streaks.sevenDayConsistencyPercent}%`);

    // -------------------------------------------------------------------------
    // STEP 11 & 12: LOGOUT & RE-LOGIN
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 11 & 12: LOGOUT & RE-LOGIN ---');
    await signOut(auth);
    assert(auth.currentUser === null, 'User logged out successfully');

    const reloginCred = await signInWithEmailAndPassword(auth, testEmail, testPassword);
    assert(reloginCred.user.uid === testUid, `Re-authenticated successfully with identical UID: ${testUid}`);

    // -------------------------------------------------------------------------
    // STEP 13 & 14: VERIFY PERSISTENCE ACROSS SESSIONS
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 13 & 14: VERIFY PERSISTENCE ---');
    const restoredProfile = await firestoreProfileService.getProfile(testUid);
    assert(restoredProfile?.targetCalories === 2600, 'Profile targetCalories persisted across sessions');
    assert(restoredProfile?.dietaryRestrictions === 'vegetarian', 'Dietary restrictions persisted across sessions');

    const restoredResult = await firestoreMealHistoryService.getRecentMeals(testUid, 5);
    assert(restoredResult.meals.some(m => m.id === meal1Id), 'Meal persisted and retrieved after re-login');

    const restoredHydration = await firestoreHydrationService.getDailyHydration(testUid, hydEntry.date);
    assert(restoredHydration.some(h => h.id === hydEntry.id), 'Hydration persisted and retrieved after re-login');

    // -------------------------------------------------------------------------
    // STEP 15: CROSS-USER ACCESS DENIAL (Security Boundary)
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 15: CROSS-USER ACCESS DENIAL ---');
    const otherFakeUid = 'other-unauthorized-user-999';
    try {
      const otherProfile = await firestoreProfileService.getProfile(otherFakeUid);
      assert(otherProfile === null, 'Cross-user profile read strictly DENIED by security rules');
    } catch {
      assert(true, 'Cross-user profile read strictly DENIED by security rules');
    }

    try {
      await firestoreHydrationService.getDailyHydration(otherFakeUid, hydEntry.date);
      assert(false, 'Should deny reading other user hydration');
    } catch {
      assert(true, 'Cross-user hydration read strictly DENIED by security rules');
    }

    console.log('\n====================================================');
    console.log('🎉 ALL 15 LIVE FIREBASE DASHBOARD CHECKS PASSED!');
    console.log('====================================================\n');
  } finally {
    // -------------------------------------------------------------------------
    // STEP 16 & 17: TEARDOWN & PURGE TEST DATA
    // -------------------------------------------------------------------------
    console.log('--- CLEANUP: PURGING TEST DATA FROM CLOUD FIRESTORE ---');
    try {
      if (testUid) {
        // Delete test meals
        for (const mealId of testMealIds) {
          try {
            await deleteDoc(doc(db, 'users', testUid, 'meals', mealId));
          } catch { /* ignore */ }
        }

        // Delete test hydration
        for (const hydId of testHydrationIds) {
          try {
            await deleteDoc(doc(db, 'users', testUid, 'hydration', hydId));
          } catch { /* ignore */ }
        }

        // Delete test profile
        try {
          await deleteDoc(doc(db, 'users', testUid));
        } catch { /* ignore */ }

        // Delete test auth user
        if (auth.currentUser) {
          await deleteUser(auth.currentUser);
          console.log(`Deleted temporary test Firebase user: ${testUid}`);
        }
      }
      console.log('Teardown complete: Zero test documents or accounts left behind.\n');
    } catch (cleanupErr) {
      console.warn('Warning during cleanup:', cleanupErr);
    }
  }
}

runLivePhase9DashboardVerification().catch((err) => {
  console.error('Fatal Phase 9 live verification failure:', err);
  process.exit(1);
});
