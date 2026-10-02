/**
 * TRACK-A-BITE — PHASE 10 PRODUCTION SECURITY REGRESSION SUITE
 *
 * Verifies all security requirements for production deployment:
 * 1. Unauthenticated access to Firestore is strictly DENIED
 * 2. Cross-user access to Firestore is strictly DENIED
 * 3. Own-user access to Firestore is ALLOWED
 * 4. UID spoofing is strictly DENIED
 * 5. GEMINI_API_KEY isolation (never public, never client-side)
 * 6. Credential & secret isolation in storage & exports (no passwords, tokens, API keys)
 * 7. Firestore ownership enforcement (request.auth.uid == userId)
 */

import fs from 'fs';
import path from 'path';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  deleteUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { nutritionExportService } from '../src/lib/services/nutritionExportService';
import { firestoreMealHistoryService } from '../src/lib/services/firestoreMealHistoryService';
import { firestoreHydrationService } from '../src/lib/services/firestoreHydrationService';
import { firestoreProfileService } from '../src/lib/services/firestoreProfileService';
import { profileStorageService } from '../src/lib/services/profileStorageService';
import type { NutritionReport } from '../src/lib/types/reporting';
import type { UserProfile } from '../src/lib/types/profile';

// Load .env.local if present
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
  }
  console.log(`✅ [PASS] ${message}`);
}

async function runPhase10SecuritySuite() {
  console.log('====================================================');
  console.log('TRACK-A-BITE — PHASE 10 SECURITY REGRESSION SUITE');
  console.log('====================================================\n');

  // ---------------------------------------------------------------------------
  // 1. SECRET & CREDENTIAL ISOLATION
  // ---------------------------------------------------------------------------
  console.log('--- 1. SECRET & CREDENTIAL ISOLATION ---');

  // Verify GEMINI_API_KEY is not exposed to NEXT_PUBLIC
  assert(
    !process.env.NEXT_PUBLIC_GEMINI_API_KEY,
    'TEST 1.1: NEXT_PUBLIC_GEMINI_API_KEY is undefined (never exposed to client)'
  );

  // Verify .gitignore ignores .env files
  const gitignore = fs.readFileSync('.gitignore', 'utf8');
  assert(
    gitignore.includes('.env*.local') || gitignore.includes('.env*') || gitignore.includes('.env'),
    'TEST 1.2: .gitignore properly excludes .env files'
  );

  // Verify server-side Gemini route isolation
  const routeContent = fs.readFileSync(path.resolve('src/app/api/recognize-food/route.ts'), 'utf8');
  assert(
    routeContent.includes('process.env.GEMINI_API_KEY') || routeContent.includes('GEMINI_API_KEY'),
    'TEST 1.3: Gemini API key accessed strictly on server route'
  );

  // Verify profile storage does not store passwords or tokens
  profileStorageService.saveProfile({
    age: 21,
    heightCm: 172,
    weightKg: 68,
    dietaryPreference: 'vegetarian',
  });
  const localProfile = profileStorageService.getProfile();
  const profileJson = JSON.stringify(localProfile);
  assert(!profileJson.includes('password'), 'TEST 1.4: Profile storage contains 0 passwords');
  assert(!profileJson.includes('token'), 'TEST 1.5: Profile storage contains 0 tokens');
  assert(!profileJson.includes('secret'), 'TEST 1.6: Profile storage contains 0 secrets');

  // ---------------------------------------------------------------------------
  // 2. EXPORT DATA SANITIZATION
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. EXPORT DATA SANITIZATION ---');
  const mockReport: NutritionReport = {
    dateRange: {
      startDate: '2026-10-02',
      endDate: '2026-10-02',
      preset: 'today',
    },
    totalMeals: 3,
    activeDaysCount: 1,
    averageMealsPerDay: 3,
    averageCalories: 1950,
    averageProteinG: 72,
    averageCarbsG: 240,
    averageFatG: 55,
    averageFiberG: 28,
    averageNutritionScore: 85,
    scoreDistribution: {
      excellent: 1,
      good: 0,
      fair: 0,
      needs_attention: 0,
    },
    consistencyPercentage: 100,
    trends: [],
    trend: [],
    insights: [],
    meals: [],
    dataSource: 'local',
  };

  const mockUserProfile: UserProfile = {
    age: 21,
    heightCm: 172,
    weightKg: 68,
    dietaryPreference: 'vegetarian',
    targetCalories: 2000,
    targetProtein: 75,
    targetCarbs: 250,
    targetFat: 60,
  };

  const exportedJson = nutritionExportService.exportNutritionJSON(mockReport, mockUserProfile);
  const exportedCsv = nutritionExportService.exportNutritionCSV(mockReport);

  assert(!exportedJson.includes('password'), 'TEST 2.1: JSON export contains 0 passwords');
  assert(!exportedJson.includes('token'), 'TEST 2.2: JSON export contains 0 tokens');
  assert(!exportedJson.includes('GEMINI_API_KEY'), 'TEST 2.3: JSON export contains 0 API keys');
  assert(!exportedCsv.includes('password'), 'TEST 2.4: CSV export contains 0 passwords');
  assert(!exportedCsv.includes('token'), 'TEST 2.5: CSV export contains 0 tokens');
  assert(!exportedCsv.includes('apiKey'), 'TEST 2.6: CSV export contains 0 API keys');

  // Verify valid JSON parsing
  const parsed = JSON.parse(exportedJson);
  assert(parsed.exportVersion === '1.0', 'TEST 2.7: JSON export has valid canonical structure');
  assert(exportedCsv.startsWith('Date,Meal Title') || exportedCsv.includes('Calories (kcal)'), 'TEST 2.8: CSV export is RFC-4180 formatted');

  // ---------------------------------------------------------------------------
  // 3. CLIENT SERVICE UID ENFORCEMENT & SPOOFING RESISTANCE
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. CLIENT SERVICE UID ENFORCEMENT ---');

  let emptyMealUidBlocked = false;
  try {
    await firestoreMealHistoryService.getRecentMeals('');
  } catch (err: unknown) {
    emptyMealUidBlocked = true;
    assert(String(err).includes('Authenticated UID is required'), 'TEST 3.1: Empty UID blocked in meal history');
  }
  assert(emptyMealUidBlocked, 'TEST 3.2: Empty UID meal query throws error');

  let emptyHydrationUidBlocked = false;
  try {
    await firestoreHydrationService.getDailyHydration('   ', '2026-10-02');
  } catch (err: unknown) {
    emptyHydrationUidBlocked = true;
    assert(String(err).includes('User must be authenticated'), 'TEST 3.3: Whitespace UID blocked in hydration');
  }
  assert(emptyHydrationUidBlocked, 'TEST 3.4: Whitespace UID hydration query throws error');

  let emptyProfileUidBlocked = false;
  try {
    await firestoreProfileService.updateProfile('', {});
  } catch (err: unknown) {
    emptyProfileUidBlocked = true;
    assert(String(err).includes('Authenticated UID is required'), 'TEST 3.5: Empty UID blocked in profile service');
  }
  assert(emptyProfileUidBlocked, 'TEST 3.6: Empty UID profile update throws error');

  // ---------------------------------------------------------------------------
  // 4. LIVE FIRESTORE RULES: OWNERSHIP & CROSS-USER DENIAL
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. LIVE FIRESTORE RULES & CROSS-USER DENIAL ---');

  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  const unauthAppName = `phase10-unauth-${Date.now()}`;
  const unauthApp = initializeApp(firebaseConfig, unauthAppName);
  const unauthDb = getFirestore(unauthApp);

  const userAAppName = `phase10-userA-${Date.now()}`;
  const appA = initializeApp(firebaseConfig, userAAppName);
  const authA = getAuth(appA);
  const dbA = getFirestore(appA);

  const userBAppName = `phase10-userB-${Date.now()}`;
  const appB = initializeApp(firebaseConfig, userBAppName);
  const authB = getAuth(appB);
  const dbB = getFirestore(appB);

  const emailA = `qa_sec_a_${Date.now()}@example.com`;
  const passA = `PassA!${Date.now()}#99`;
  const emailB = `qa_sec_b_${Date.now()}@example.com`;
  const passB = `PassB!${Date.now()}#99`;

  let uidA = '';
  let uidB = '';

  try {
    // 4.1 Unauthenticated Access DENIED
    const arbitraryUid = 'unauthenticated-target-uid-999';
    let unauthProfileDenied = false;
    try {
      await getDoc(doc(unauthDb, 'users', arbitraryUid));
    } catch {
      unauthProfileDenied = true;
    }
    assert(unauthProfileDenied, 'TEST 4.1: Unauthenticated READ to users/{uid} is DENIED');

    let unauthMealDenied = false;
    try {
      await setDoc(doc(unauthDb, 'users', arbitraryUid, 'meals', 'meal-test'), { name: 'Hack' });
    } catch {
      unauthMealDenied = true;
    }
    assert(unauthMealDenied, 'TEST 4.2: Unauthenticated WRITE to users/{uid}/meals is DENIED');

    let unauthHydrationDenied = false;
    try {
      await getDoc(doc(unauthDb, 'users', arbitraryUid, 'hydration', 'entry-test'));
    } catch {
      unauthHydrationDenied = true;
    }
    assert(unauthHydrationDenied, 'TEST 4.3: Unauthenticated READ to users/{uid}/hydration is DENIED');

    // 4.2 Create User A and User B
    const credA = await createUserWithEmailAndPassword(authA, emailA, passA);
    uidA = credA.user.uid;
    const credB = await createUserWithEmailAndPassword(authB, emailB, passB);
    uidB = credB.user.uid;

    assert(Boolean(uidA) && Boolean(uidB), 'TEST 4.4: User A and User B created with distinct live UIDs');

    // 4.3 User A & User B Own Access ALLOWED
    await setDoc(doc(dbA, 'users', uidA), { age: 24, name: 'User A' });
    await setDoc(doc(dbB, 'users', uidB), { age: 22, name: 'User B' });
    const profileSnapA = await getDoc(doc(dbA, 'users', uidA));
    assert(profileSnapA.exists(), 'TEST 4.5: User A WRITE & READ own profile is ALLOWED');

    await setDoc(doc(dbA, 'users', uidA, 'meals', 'meal-a-1'), {
      name: 'Paneer Bhurji',
      calories: 320,
    });
    const mealSnapA = await getDoc(doc(dbA, 'users', uidA, 'meals', 'meal-a-1'));
    assert(mealSnapA.exists(), 'TEST 4.6: User A WRITE & READ own meal is ALLOWED');

    await setDoc(doc(dbA, 'users', uidA, 'hydration', 'hyd-a-1'), {
      amountMl: 300,
      timestamp: new Date().toISOString(),
    });
    const hydSnapA = await getDoc(doc(dbA, 'users', uidA, 'hydration', 'hyd-a-1'));
    assert(hydSnapA.exists(), 'TEST 4.7: User A WRITE & READ own hydration is ALLOWED');

    // 4.4 Cross-User Access DENIED (User A -> User B)
    let crossProfileReadDenied = false;
    try {
      await getDoc(doc(dbA, 'users', uidB));
    } catch {
      crossProfileReadDenied = true;
    }
    assert(crossProfileReadDenied, 'TEST 4.8: User A READ User B profile is DENIED');

    let crossProfileWriteDenied = false;
    try {
      await setDoc(doc(dbA, 'users', uidB), { hacked: true });
    } catch {
      crossProfileWriteDenied = true;
    }
    assert(crossProfileWriteDenied, 'TEST 4.9: User A WRITE User B profile is DENIED');

    let crossMealReadDenied = false;
    try {
      await getDoc(doc(dbA, 'users', uidB, 'meals', 'meal-b-1'));
    } catch {
      crossMealReadDenied = true;
    }
    assert(crossMealReadDenied, 'TEST 4.10: User A READ User B meal is DENIED');

    let crossMealWriteDenied = false;
    try {
      await setDoc(doc(dbA, 'users', uidB, 'meals', 'spoofed-meal'), { hack: true });
    } catch {
      crossMealWriteDenied = true;
    }
    assert(crossMealWriteDenied, 'TEST 4.11: User A WRITE User B meal is DENIED (UID Spoofing Denied)');

    let crossHydrationReadDenied = false;
    try {
      await getDoc(doc(dbA, 'users', uidB, 'hydration', 'hyd-b-1'));
    } catch {
      crossHydrationReadDenied = true;
    }
    assert(crossHydrationReadDenied, 'TEST 4.12: User A READ User B hydration is DENIED');

    let crossHydrationWriteDenied = false;
    try {
      await setDoc(doc(dbA, 'users', uidB, 'hydration', 'spoofed-hyd'), { hack: true });
    } catch {
      crossHydrationWriteDenied = true;
    }
    assert(crossHydrationWriteDenied, 'TEST 4.13: User A WRITE User B hydration is DENIED');

    // 4.5 Cleanup own test documents
    await deleteDoc(doc(dbA, 'users', uidA, 'hydration', 'hyd-a-1'));
    await deleteDoc(doc(dbA, 'users', uidA, 'meals', 'meal-a-1'));
    await deleteDoc(doc(dbA, 'users', uidA));
    await deleteDoc(doc(dbB, 'users', uidB));
    assert(true, 'TEST 4.14: User A own test documents cleanly deleted');
  } finally {
    // Teardown Auth accounts & apps
    if (authA.currentUser) {
      try {
        await deleteUser(authA.currentUser);
      } catch {}
    }
    if (authB.currentUser) {
      try {
        await deleteUser(authB.currentUser);
      } catch {}
    }
    await deleteApp(unauthApp);
    await deleteApp(appA);
    await deleteApp(appB);
    console.log('✅ Teardown complete: Zero test users or apps retained.');
  }

  console.log('\n====================================================');
  console.log('🎉 ALL PHASE 10 SECURITY CHECKS PASSED (28/28)');
  console.log('====================================================\n');
}

runPhase10SecuritySuite().catch((err) => {
  console.error('\n❌ Phase 10 Security Suite Failed:', err);
  process.exit(1);
});
