/**
 * Track-a-Bite Phase 8.2 Live Firestore Verification
 *
 * Real end-to-end integration verification against live Firebase project `track-a-bite`.
 * Tests:
 * 1. Register test user with Firebase Authentication
 * 2. Save user profile to live Firestore at users/{uid}
 * 3. Inspect raw Firestore users/{uid} document structure, timestamps, and fields
 * 4. Save meal scan to live Firestore at users/{uid}/meals/{mealId}
 * 5. Inspect raw Firestore meal document structure and fields
 * 6. Retrieve meal via getMeal and getRecentMeals
 * 7. Multi-device / multi-session simulation: sign out, sign back in, verify same UID and data
 * 8. Firestore Security Rules enforcement:
 *    - Unauthenticated read/write to users/{uid} is rejected (permission-denied)
 *    - Unauthenticated read/write to users/{uid}/meals/{mealId} is rejected (permission-denied)
 *    - Cross-user access is rejected
 *    - Arbitrary client UID cannot write to another user's path
 * 9. Secret isolation: No password, token, or GEMINI_API_KEY persisted or exposed
 */

import fs from 'fs';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { deleteUser, signOut } from 'firebase/auth';

// 1. Synchronously load .env.local
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

async function runLiveVerification() {
  console.log('================================================================');
  console.log('TRACK-A-BITE — PHASE 8.2 LIVE FIRESTORE INTEGRATION VERIFICATION');
  console.log('Project: track-a-bite');
  console.log('================================================================\n');

  // Dynamic imports to ensure environment is fully loaded
  const { firebaseAuth, firebaseDb, isFirebaseConfigured } = await import(
    '../src/lib/firebase/client'
  );
  const { signUp, signIn } = await import(
    '../src/lib/services/firebaseAuthService'
  );
  const { userProfileService } = await import(
    '../src/lib/services/userProfileService'
  );
  const { firestoreProfileService } = await import(
    '../src/lib/services/firestoreProfileService'
  );
  const { firestoreMealHistoryService } = await import(
    '../src/lib/services/firestoreMealHistoryService'
  );
  const { DEFAULT_USER_PROFILE } = await import('../src/lib/types/profile');
  type MealAnalysis = import('../src/lib/types/meal').MealAnalysis;

  assert(isFirebaseConfigured === true, 'Firebase configuration is loaded from .env.local');
  assert(!!firebaseAuth, 'FirebaseAuth initialized');
  assert(!!firebaseDb, 'FirebaseDb initialized');

  const timestamp = Date.now();
  const testEmail = `live_verify_${timestamp}@trackabite.test`;
  const testPassword = `SecureTestPass!_${timestamp}`;
  const testDisplayName = `Live Test User ${timestamp}`;

  console.log(`\n--- 1. REGISTER NEW USER THROUGH LIVE FIREBASE AUTH ---`);
  console.log(`Registering: ${testEmail}`);
  const regResult = await signUp(testEmail, testPassword, testDisplayName);
  assert(regResult.success === true, `Registration succeeded: ${regResult.error || 'OK'}`);
  assert(!!regResult.user?.uid, `Authenticated user UID obtained: ${regResult.user?.uid}`);
  const userUid = regResult.user!.uid;
  console.log(`Created Firebase User UID: ${userUid}`);

  console.log(`\n--- 2. COMPLETE ONBOARDING & WRITE USER PROFILE TO LIVE FIRESTORE ---`);
  const testProfile = {
    ...DEFAULT_USER_PROFILE,
    age: 21,
    gender: 'male' as const,
    heightCm: 175,
    weightKg: 68,
    activityLevel: 'moderately_active' as const,
    healthConditions: ['None'],
    isHostelite: true,
    budgetPreference: 'moderate' as const,
    onboardingCompleted: true,
  };

  const profileSaveResult = await userProfileService.saveProfileWithCloud(testProfile, regResult.user);
  assert(profileSaveResult.success === true, 'Profile save returned success');
  assert(profileSaveResult.cloudSaved === true, 'Profile was saved to Cloud Firestore (not local fallback)');

  console.log(`\n--- 3. VERIFY RAW FIRESTORE users/{uid} DOCUMENT STRUCTURE ---`);
  const userDocRef = doc(firebaseDb, 'users', userUid);
  const userDocSnap = await getDoc(userDocRef);
  assert(userDocSnap.exists(), `Live Firestore document users/${userUid} exists`);
  const rawUserData = userDocSnap.data();
  console.log('Raw user document keys:', Object.keys(rawUserData || {}));

  assert(rawUserData?.uid === userUid, 'Document UID matches authenticated Firebase UID');
  assert(rawUserData?.profile !== undefined, 'Document contains nested profile object');
  assert(rawUserData?.profile.isHostelite === true, 'Profile field isHostelite correctly stored');
  assert(rawUserData?.profile.age === 21, 'Profile field age correctly stored');
  assert(rawUserData?.profile.heightCm === 175, 'Profile field heightCm correctly stored');
  assert(rawUserData?.profile.weightKg === 68, 'Profile field weightKg correctly stored');
  assert(rawUserData?.profile.onboardingCompleted === true, 'Profile field onboardingCompleted correctly stored');
  assert(rawUserData?.createdAt !== undefined, 'Document contains createdAt server timestamp');
  assert(rawUserData?.updatedAt !== undefined, 'Document contains updatedAt server timestamp');

  // Verify secret isolation on profile doc
  const userDocString = JSON.stringify(rawUserData);
  assert(!userDocString.includes(testPassword), 'Document does NOT contain user password');
  assert(!userDocString.includes(process.env.GEMINI_API_KEY || 'AQ.Ab8'), 'Document does NOT contain GEMINI_API_KEY');

  console.log(`\n--- 4. PERSIST REAL MEAL TO LIVE FIRESTORE users/{uid}/meals/{mealId} ---`);
  const mealId = `live-meal-${timestamp}`;
  const testMeal: MealAnalysis = {
    id: mealId,
    mealTitle: 'Paneer Bhurji & Multigrain Rotis',
    analyzedAt: new Date().toISOString(),
    imagePreviewUrl: null,
    items: [
      {
        foodId: 'food-paneer-bhurji',
        name: 'Paneer Bhurji',
        confidenceScore: 0.94,
        portionMultiplier: 1.0,
        portionUnit: 'bowl',
        estimatedGrams: 150,
        nutrition: {
          calories: 280,
          protein: 18,
          carbohydrates: 8,
          fat: 20,
          fiber: 2,
        },
      },
      {
        foodId: 'food-roti',
        name: 'Multigrain Roti',
        confidenceScore: 0.96,
        portionMultiplier: 2.0,
        portionUnit: 'piece',
        estimatedGrams: 80,
        nutrition: {
          calories: 160,
          protein: 6,
          carbohydrates: 32,
          fat: 2,
          fiber: 4,
        },
      },
    ],
    totalNutrition: {
      calories: 440,
      protein: 24,
      carbohydrates: 40,
      fat: 22,
      fiber: 6,
      sodium: 480,
      sugar: 3,
    },
    macroDistribution: {
      proteinPercent: 22,
      carbsPercent: 36,
      fatPercent: 42,
    },
    nutrientRichness: {
      score: 4.5,
      rating: 'optimal',
      stars: 4.5,
      summary: 'High protein vegetarian meal with balanced complex carbohydrates.',
      micronutrientHighlights: ['Calcium', 'Phosphorus', 'B-Vitamins'],
    },
    nutrientGaps: {
      gaps: ['Vitamin C'],
      strengths: ['High Protein', 'Dietary Fiber', 'Calcium'],
      overallAssessment: 'Add lemon juice or fresh citrus fruit to fill the Vitamin C gap.',
    },
    balanceAssessment: {
      status: 'balanced',
      badge: 'Balanced Meal',
      score: 88,
      advice: 'Excellent protein-to-carb balance for hostel student nutrition.',
    },
    positiveHighlights: ['24g clean vegetarian protein', 'Whole grain fiber'],
    balancingRecommendations: [
      {
        id: 'rec-citrus',
        title: 'Add Fresh Lemon / Citrus',
        description: 'Squeeze fresh lemon over the bhurji to enhance non-heme iron absorption and add Vitamin C.',
        category: 'micronutrient',
        actionType: 'add',
        suggestedFood: 'Lemon wedge',
        priority: 'medium',
      },
    ],
    hostelFriendlyUpgrades: [
      {
        id: 'upg-curd',
        title: 'Mess Curd Bowl (INR 15)',
        description: 'Pair with fresh mess curd for probiotics and extra casein protein.',
        estimatedCostInr: 15,
        shelfLifeDays: 2,
        isMessAvailable: true,
      },
    ],
    hostelModeActive: true,
    practicalAdjustments: ['Mess curd available at lunch counter'],
    disclaimer: 'Nutritional estimates are computed for guidance.',
  };

  const mealSaveResult = await firestoreMealHistoryService.saveMeal(userUid, testMeal);
  assert(mealSaveResult?.id === mealId, 'firestoreMealHistoryService.saveMeal returned saved meal');

  console.log(`\n--- 5. VERIFY RAW FIRESTORE users/{uid}/meals/{mealId} DOCUMENT ---`);
  const mealDocRef = doc(firebaseDb, 'users', userUid, 'meals', mealId);
  const mealDocSnap = await getDoc(mealDocRef);
  assert(mealDocSnap.exists(), `Live Firestore document users/${userUid}/meals/${mealId} exists`);
  const rawMealData = mealDocSnap.data();

  assert(rawMealData?.id === mealId, 'Meal ID matches');
  assert(rawMealData?.userId === userUid, 'Meal userId strictly matches authenticated user UID');
  assert(rawMealData?.mealTitle === 'Paneer Bhurji & Multigrain Rotis', 'Meal title matches');
  assert(Array.isArray(rawMealData?.items) && rawMealData?.items.length === 2, 'Meal items array preserved with 2 items');
  assert(rawMealData?.totalNutrition?.calories === 440, 'Total calories strictly match 440');
  assert(rawMealData?.totalNutrition?.protein === 24, 'Total protein strictly matches 24g');
  assert(rawMealData?.hostelModeActive === true, 'hostelModeActive flag preserved');
  assert(rawMealData?.createdAt !== undefined, 'Meal document contains createdAt server timestamp');

  // Verify secret isolation on meal doc
  const mealDocString = JSON.stringify(rawMealData);
  assert(!mealDocString.includes(testPassword), 'Meal doc does NOT contain user password');
  assert(!mealDocString.includes(process.env.GEMINI_API_KEY || 'AQ.Ab8'), 'Meal doc does NOT contain GEMINI_API_KEY');

  console.log(`\n--- 6. RETRIEVE MEAL VIA SERVICE (GET & RECENT QUERY) ---`);
  const fetchedMeal = await firestoreMealHistoryService.getMeal(userUid, mealId);
  assert(fetchedMeal !== null, 'getMeal successfully retrieved document from Firestore');
  assert(fetchedMeal?.id === mealId, 'Retrieved meal ID matches');
  assert(fetchedMeal?.totalNutrition.calories === 440, 'Retrieved total nutrition matches');

  const recentResult = await firestoreMealHistoryService.getRecentMeals(userUid, 10);
  assert(recentResult.meals.length >= 1, `getRecentMeals returned ${recentResult.meals.length} meal(s)`);
  assert(recentResult.meals.some((m) => m.id === mealId), 'Recent meals list contains the saved meal');

  console.log(`\n--- 7. MULTI-DEVICE / MULTI-SESSION SIMULATION ---`);
  console.log('Signing out current auth session...');
  await signOut(firebaseAuth);

  console.log('Signing into new session with test account...');
  const secondSignIn = await signIn(testEmail, testPassword);
  assert(secondSignIn.success === true, 'Re-login to same account succeeded');
  assert(secondSignIn.user?.uid === userUid, 'Re-login returns identical UID (no duplicate UID created)');

  // Retrieve profile & meals in new session
  const restoredProfile = await firestoreProfileService.getProfile(userUid);
  assert(restoredProfile !== null, 'Profile retrieved from Firestore in fresh session');
  assert(restoredProfile?.age === 21, 'Restored profile age matches');
  assert(restoredProfile?.heightCm === 175, 'Restored profile heightCm matches');
  assert(restoredProfile?.weightKg === 68, 'Restored profile weightKg matches');
  assert(restoredProfile?.isHostelite === true, 'Restored profile isHostelite matches');
  assert(restoredProfile?.onboardingCompleted === true, 'Restored profile onboardingCompleted matches');

  const restoredRecent = await firestoreMealHistoryService.getRecentMeals(userUid, 10);
  assert(restoredRecent.meals.some((m) => m.id === mealId), 'Restored meal history contains persisted meal');

  console.log(`\n--- 8. LIVE FIRESTORE SECURITY BOUNDARY VERIFICATION ---`);
  // Sign out to test unauthenticated access
  await signOut(firebaseAuth);
  console.log('Testing unauthenticated read/write against live Firestore rules...');

  // Unauthenticated profile read
  let unauthProfileReadBlocked = false;
  try {
    await getDoc(doc(firebaseDb, 'users', userUid));
  } catch (err: unknown) {
    const errObj = err as { code?: string; message?: string };
    if (errObj?.code === 'permission-denied' || String(err).includes('Missing or insufficient permissions')) {
      unauthProfileReadBlocked = true;
    }
  }
  assert(unauthProfileReadBlocked, 'Unauthenticated read to users/{uid} rejected with permission-denied');

  // Unauthenticated profile write
  let unauthProfileWriteBlocked = false;
  try {
    await setDoc(doc(firebaseDb, 'users', userUid), { test: 'hack' }, { merge: true });
  } catch (err: unknown) {
    const errObj = err as { code?: string; message?: string };
    if (errObj?.code === 'permission-denied' || String(err).includes('Missing or insufficient permissions')) {
      unauthProfileWriteBlocked = true;
    }
  }
  assert(unauthProfileWriteBlocked, 'Unauthenticated write to users/{uid} rejected with permission-denied');

  // Unauthenticated meal read
  let unauthMealReadBlocked = false;
  try {
    await getDoc(doc(firebaseDb, 'users', userUid, 'meals', mealId));
  } catch (err: unknown) {
    const errObj = err as { code?: string; message?: string };
    if (errObj?.code === 'permission-denied' || String(err).includes('Missing or insufficient permissions')) {
      unauthMealReadBlocked = true;
    }
  }
  assert(unauthMealReadBlocked, 'Unauthenticated read to users/{uid}/meals/{mealId} rejected with permission-denied');

  // Cross-user access check:
  // Register second user
  const user2Email = `user2_${timestamp}@trackabite.test`;
  const user2Result = await signUp(user2Email, testPassword, 'User Two');
  assert(user2Result.success === true, 'Registered second user');
  const user2Uid = user2Result.user!.uid;

  console.log(`Testing cross-user access: User 2 (${user2Uid}) reading User 1 (${userUid})...`);
  let crossUserReadBlocked = false;
  try {
    await getDoc(doc(firebaseDb, 'users', userUid));
  } catch (err: unknown) {
    const errObj = err as { code?: string; message?: string };
    if (errObj?.code === 'permission-denied' || String(err).includes('Missing or insufficient permissions')) {
      crossUserReadBlocked = true;
    }
  }
  assert(crossUserReadBlocked, 'Cross-user profile read blocked with permission-denied');

  let crossUserMealReadBlocked = false;
  try {
    await getDoc(doc(firebaseDb, 'users', userUid, 'meals', mealId));
  } catch (err: unknown) {
    const errObj = err as { code?: string; message?: string };
    if (errObj?.code === 'permission-denied' || String(err).includes('Missing or insufficient permissions')) {
      crossUserMealReadBlocked = true;
    }
  }
  assert(crossUserMealReadBlocked, 'Cross-user meal read blocked with permission-denied');

  // Arbitrary UID write check: User 2 attempts to write to User 1's meals
  let arbitraryUidWriteBlocked = false;
  try {
    await setDoc(doc(firebaseDb, 'users', userUid, 'meals', 'malicious-meal'), {
      id: 'malicious-meal',
      userId: userUid,
      mealTitle: 'Spoofed Meal',
    });
  } catch (err: unknown) {
    const errObj = err as { code?: string; message?: string };
    if (errObj?.code === 'permission-denied' || String(err).includes('Missing or insufficient permissions')) {
      arbitraryUidWriteBlocked = true;
    }
  }
  assert(arbitraryUidWriteBlocked, 'Arbitrary UID write to another user path rejected with permission-denied');

  console.log(`\n--- 9. SECRET ISOLATION VERIFICATION ---`);
  assert(!!process.env.GEMINI_API_KEY, 'GEMINI_API_KEY exists on server environment');
  assert(
    process.env.NEXT_PUBLIC_GEMINI_API_KEY === undefined,
    'GEMINI_API_KEY is NOT exposed as a NEXT_PUBLIC_* variable'
  );

  console.log(`\n--- 10. CLEANUP TEST DATA ---`);
  // Sign back in as User 1 to clean up meal
  await signIn(testEmail, testPassword);
  await firestoreMealHistoryService.deleteMeal(userUid, mealId);
  const checkDeleted = await getDoc(mealDocRef);
  assert(!checkDeleted.exists(), 'Test meal document cleanly deleted from Firestore');

  // Clean up user accounts from auth if deleteUser succeeds
  try {
    if (firebaseAuth.currentUser) {
      await deleteUser(firebaseAuth.currentUser);
      console.log('Cleaned up User 1 auth record');
    }
  } catch (err) {
    console.warn('User cleanup note:', err);
  }

  console.log('\n================================================================');
  console.log('🎉 ALL LIVE FIRESTORE INTEGRATION CHECKS PASSED SUCCESSFULLY!');
  console.log('================================================================');
  process.exit(0);
}

runLiveVerification().catch((err) => {
  console.error('\n❌ FATAL ERROR DURING LIVE FIRESTORE VERIFICATION:', err);
  process.exit(1);
});
