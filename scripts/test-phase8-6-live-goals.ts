/**
 * TRACK-A-BITE — PHASE 8.6 LIVE FIREBASE VERIFICATION SUITE
 * Dietary Goals & Macro Tuning Live Cloud Lifecycle
 *
 * Verifies live Firestore cloud integration:
 * 1. Register test Firebase Auth user
 * 2. Save custom dietary targets to Firestore users/{uid}
 * 3. Verify users/{uid}.profile in Firestore
 * 4. Reload profile and verify targets persist
 * 5. Write meal to users/{uid}/meals
 * 6. Verify personalized targets in analytics (targetCalories, proteinProgressPercent)
 * 7. Verify exported report contains configured targets and Custom target label
 * 8. Re-authenticate (logout / login) and verify exact same targets
 * 9. Clean up all cloud records and delete test account
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
  writeBatch,
} from 'firebase/firestore';
import type { MealAnalysis } from '../src/lib/types/meal';
import type { UserProfile } from '../src/lib/types/profile';
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

async function runLiveGoalsVerification() {
  console.log('====================================================');
  console.log('TRACK-A-BITE — PHASE 8.6 LIVE FIREBASE VERIFICATION');
  console.log('Verifying End-to-End Dietary Goals Cloud Lifecycle');
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
  const { nutritionAnalyticsService } = await import('../src/lib/services/nutritionAnalyticsService');
  const { nutritionExportService } = await import('../src/lib/services/nutritionExportService');

  const testEmail = `phase86_goal_${Date.now()}@example.com`;
  const testPassword = `Pass#${Date.now()}Live86!`;
  let testUid = '';
  const testMealIds: string[] = [];

  try {
    // -------------------------------------------------------------------------
    // STEP 1: REGISTER REAL FIREBASE AUTH TEST USER
    // -------------------------------------------------------------------------
    console.log('--- STEP 1: REGISTER REAL FIREBASE AUTH USER ---');
    const userCredential = await createUserWithEmailAndPassword(auth, testEmail, testPassword);
    testUid = userCredential.user.uid;
    assert(Boolean(testUid), `Registered Firebase user UID: ${testUid}`);

    // -------------------------------------------------------------------------
    // STEP 2: CONFIGURE & SAVE CUSTOM NUTRITION TARGETS TO FIRESTORE
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 2: CONFIGURE & SAVE CUSTOM NUTRITION TARGETS ---');
    const targetConfig: UserProfile = {
      age: 22,
      heightCm: 178,
      weightKg: 72,
      gender: 'male',
      activityLevel: 'moderately_active',
      healthGoal: 'muscle_gain',
      dietaryRestrictions: 'non_vegetarian',
      isHostelite: true,
      hasMessFood: true,
      hasCookingAccess: false,
      hasFridge: false,
      budgetPreference: 'budget',
      targetCalories: 2350,
      targetProteinG: 135,
      targetCarbsG: 245,
      targetFatG: 70,
      customTargetsActive: true,
      onboardingCompleted: true,
      healthConditions: ['None'],
    };

    const savedProfile = await firestoreProfileService.upsertProfile(testUid, targetConfig, {
      email: testEmail,
      displayName: 'Phase 8.6 Test User',
    });
    assert(savedProfile.targetCalories === 2350, 'Upsert returned targetCalories: 2350');
    assert(savedProfile.targetProteinG === 135, 'Upsert returned targetProteinG: 135');
    assert(savedProfile.customTargetsActive === true, 'Upsert returned customTargetsActive: true');

    // -------------------------------------------------------------------------
    // STEP 3: VERIFY users/{uid}.profile DIRECTLY IN FIRESTORE
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 3: VERIFY users/{uid}.profile DIRECTLY IN FIRESTORE ---');
    const userDocRef = doc(db, 'users', testUid);
    const snap = await getDoc(userDocRef);
    assert(snap.exists(), `Document users/${testUid} exists in Firestore`);
    const docData = snap.data();
    assert(docData !== undefined, 'Document data is defined');
    const nestedProfile = docData?.profile as Record<string, unknown>;
    assert(nestedProfile !== undefined, 'users/{uid}.profile object exists');
    assert(nestedProfile.targetCalories === 2350, `Firestore targetCalories matches 2350 (got ${nestedProfile.targetCalories})`);
    assert(nestedProfile.targetProteinG === 135, `Firestore targetProteinG matches 135 (got ${nestedProfile.targetProteinG})`);
    assert(nestedProfile.customTargetsActive === true, 'Firestore customTargetsActive matches true');
    assert(nestedProfile.healthGoal === 'muscle_gain', 'Firestore healthGoal matches muscle_gain');

    // -------------------------------------------------------------------------
    // STEP 4: RELOAD PROFILE VIA SERVICE AND VERIFY TARGETS PERSIST
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 4: RELOAD PROFILE & VERIFY PERSISTENCE ---');
    const reloadedProfile = await firestoreProfileService.getProfile(testUid);
    assert(reloadedProfile !== null, 'Reloaded profile from Firestore is non-null');
    assert(reloadedProfile?.targetCalories === 2350, 'Reloaded targetCalories is 2350');
    assert(reloadedProfile?.targetProteinG === 135, 'Reloaded targetProteinG is 135');
    assert(reloadedProfile?.targetCarbsG === 245, 'Reloaded targetCarbsG is 245');
    assert(reloadedProfile?.targetFatG === 70, 'Reloaded targetFatG is 70');
    assert(reloadedProfile?.customTargetsActive === true, 'Reloaded customTargetsActive is true');

    // -------------------------------------------------------------------------
    // STEP 5: SEED REAL MEAL SCAN TO CLOUD HISTORY (users/{uid}/meals)
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 5: SEED REAL MEAL SCAN TO CLOUD HISTORY ---');
    const todayStr = getLocalISODate();
    const mealId = `meal_live_86_${Date.now()}`;
    testMealIds.push(mealId);

    const testMeal: MealAnalysis = {
      id: mealId,
      mealTitle: 'Paneer Bhurji with Roti',
      analyzedAt: new Date().toISOString(),
      items: [
        {
          detectionId: 'det-1',
          foodId: 'food-paneer',
          name: 'Paneer Bhurji',
          confidence: 0.96,
          portionMultiplier: 1.0,
          calories: 380,
          protein: 24,
          carbs: 8,
          fat: 28,
          fiber: 2,
          perPortionNutrition: { calories: 380, protein: 24, carbohydrates: 8, fat: 28, fiber: 2 },
        },
        {
          detectionId: 'det-2',
          foodId: 'food-roti',
          name: '2 Phulkas',
          confidence: 0.94,
          portionMultiplier: 1.0,
          calories: 160,
          protein: 6,
          carbs: 32,
          fat: 1,
          fiber: 4,
          perPortionNutrition: { calories: 160, protein: 6, carbohydrates: 32, fat: 1, fiber: 4 },
        },
      ],
      totalNutrition: {
        calories: 540,
        protein: 30,
        carbohydrates: 40,
        fat: 29,
        fiber: 6,
      },
      nutrientRichness: {
        score: 80,
        stars: 4,
        tier: 'rich',
        qualifyingNutrients: ['protein', 'fiber'],
        summary: 'Solid protein source with whole grain roti',
      },
      hostelUpgrades: [],
      analysisStatus: 'complete',
    };

    await firestoreMealHistoryService.saveMeal(testUid, testMeal);
    assert(true, `Successfully saved real meal to users/${testUid}/meals/${mealId}`);

    // -------------------------------------------------------------------------
    // STEP 6: VERIFY PERSONALIZED TARGETS IN ANALYTICS
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 6: VERIFY PERSONALIZED TARGETS IN ANALYTICS ---');
    const liveDaily = await nutritionAnalyticsService.getDailySummary(testUid, todayStr);
    assert(liveDaily.targetCalories === 2350, `Daily targetCalories matches custom target (2350, got ${liveDaily.targetCalories})`);
    assert(liveDaily.targetProteinG === 135, `Daily targetProteinG matches custom target (135, got ${liveDaily.targetProteinG})`);
    assert(liveDaily.totalCalories === 540, `Daily totalCalories matches logged meal (540, got ${liveDaily.totalCalories})`);
    assert(liveDaily.totalProteinG === 30, `Daily totalProteinG matches logged meal (30g, got ${liveDaily.totalProteinG})`);
    // Calorie progress: 540 / 2350 = 23%
    const expectedCalPct = Math.round((540 / 2350) * 100);
    assert(liveDaily.calorieProgressPercent === expectedCalPct, `Calorie progress matches expected ${expectedCalPct}% (got ${liveDaily.calorieProgressPercent}%)`);
    // Protein progress: 30 / 135 = 22%
    const expectedProtPct = Math.round((30 / 135) * 100);
    assert(liveDaily.proteinProgressPercent === expectedProtPct, `Protein progress matches expected ${expectedProtPct}% (got ${liveDaily.proteinProgressPercent}%)`);

    // -------------------------------------------------------------------------
    // STEP 7: VERIFY EXPORT CONTAINS CONFIGURED TARGETS
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 7: VERIFY EXPORT CONTAINS CONFIGURED TARGETS ---');
    const rangeReport = await nutritionAnalyticsService.getDateRangeReport(testUid, {
      startDate: todayStr,
      endDate: todayStr,
      preset: 'today',
    }, reloadedProfile);

    assert(rangeReport.targets?.targetCalories === 2350, 'Range report targets.targetCalories is 2350');
    assert(rangeReport.targets?.targetTypeLabel === 'Custom target', 'Range report labels targets as Custom target');

    const exportPayload = nutritionExportService.buildNutritionExportPayload(rangeReport, reloadedProfile);
    assert(exportPayload.targets?.targetCalories === 2350, 'Export payload contains custom targetCalories 2350');
    assert(exportPayload.targets?.targetTypeLabel === 'Custom target', 'Export payload contains Custom target label');
    assert(exportPayload.user?.targetCalories === 2350, 'Export user contains targetCalories 2350');
    assert(exportPayload.user?.targetProteinG === 135, 'Export user contains targetProteinG 135');

    const jsonExport = nutritionExportService.exportNutritionJSON(rangeReport, reloadedProfile);
    assert(jsonExport.includes('"targetCalories": 2350'), 'JSON export includes "targetCalories": 2350');
    assert(jsonExport.includes('"targetTypeLabel": "Custom target"'), 'JSON export includes "Custom target" label');
    assert(!jsonExport.includes('password'), 'Zero passwords in exported JSON');

    // -------------------------------------------------------------------------
    // STEP 8: SIMULATE LOGOUT & RE-LOGIN -> VERIFY TARGETS REMAIN IDENTICAL
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 8: SIMULATE LOGOUT & RE-LOGIN ---');
    await signOut(auth);
    assert(auth.currentUser === null, 'User signed out successfully');

    const relogCredential = await signInWithEmailAndPassword(auth, testEmail, testPassword);
    assert(relogCredential.user.uid === testUid, 'User re-logged in successfully with same UID');

    const postLoginProfile = await firestoreProfileService.getProfile(testUid);
    assert(postLoginProfile !== null, 'Fetched profile after re-login');
    assert(postLoginProfile?.targetCalories === 2350, 'Target calories exactly preserved across login sessions (2350)');
    assert(postLoginProfile?.targetProteinG === 135, 'Target protein exactly preserved across login sessions (135)');
    assert(postLoginProfile?.targetCarbsG === 245, 'Target carbs exactly preserved across login sessions (245)');
    assert(postLoginProfile?.targetFatG === 70, 'Target fat exactly preserved across login sessions (70)');
    assert(postLoginProfile?.customTargetsActive === true, 'customTargetsActive exactly preserved across login sessions (true)');

  } finally {
    // -------------------------------------------------------------------------
    // STEP 9: CLEAN UP TEST DATA & DELETE FIREBASE ACCOUNT
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 9: CLEAN UP TEST DATA ---');
    try {
      if (testUid && testMealIds.length > 0) {
        const batch = writeBatch(db);
        for (const mId of testMealIds) {
          batch.delete(doc(db, 'users', testUid, 'meals', mId));
        }
        await batch.commit();
        console.log(`Deleted ${testMealIds.length} test meals from Firestore.`);
      }

      if (testUid) {
        await deleteDoc(doc(db, 'users', testUid));
        console.log(`Deleted Firestore user profile document users/${testUid}.`);
      }

      if (auth.currentUser) {
        await deleteUser(auth.currentUser);
        console.log(`Deleted Firebase Auth user: ${testEmail}.`);
      }
      assert(true, 'Test teardown completed cleanly');
    } catch (cleanupErr) {
      console.warn('Cleanup notice:', cleanupErr);
    }
  }

  console.log('\n====================================================');
  console.log('🎉 ALL LIVE FIREBASE GOALS VERIFICATIONS PASSED!');
  console.log('====================================================\n');
}

runLiveGoalsVerification().catch(err => {
  console.error('Live verification failed:', err);
  process.exit(1);
});
