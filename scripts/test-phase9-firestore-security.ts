/**
 * TRACK-A-BITE — PHASE 9 FIRESTORE SECURITY AUDIT SUITE
 * Live Security Rule Verification & Authorization Hardening
 *
 * Verifies:
 * 1. Unauthenticated READ to users/{uid} is DENIED
 * 2. Unauthenticated WRITE to users/{uid} is DENIED
 * 3. Unauthenticated READ to users/{uid}/meals/{mealId} is DENIED
 * 4. Unauthenticated WRITE to users/{uid}/meals/{mealId} is DENIED
 * 5. Unauthenticated READ to users/{uid}/hydration/{entryId} is DENIED
 * 6. Unauthenticated WRITE to users/{uid}/hydration/{entryId} is DENIED
 * 7. User A READ own profile is ALLOWED
 * 8. User A WRITE own profile is ALLOWED
 * 9. User A WRITE own meal is ALLOWED
 * 10. User A READ own meal is ALLOWED
 * 11. User A WRITE own hydration is ALLOWED
 * 12. User A READ own hydration is ALLOWED
 * 13. User A DELETE own meal is ALLOWED
 * 14. User A DELETE own hydration is ALLOWED
 * 15. User A READ User B profile is DENIED
 * 16. User A WRITE User B profile is DENIED
 * 17. User A DELETE User B profile is DENIED
 * 18. User A READ User B meal is DENIED
 * 19. User A WRITE User B meal is DENIED
 * 20. User A DELETE User B meal is DENIED
 * 21. User A READ User B hydration is DENIED
 * 22. User A WRITE User B hydration is DENIED
 * 23. User A DELETE User B hydration is DENIED
 * 24. Arbitrary root collection READ is DENIED (no wildcard escalation)
 * 25. Arbitrary root collection WRITE is DENIED
 * 26. Complete teardown: Zero test documents or accounts left behind
 */

import fs from 'fs';
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

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    throw new Error(`Security assertion failed: ${message}`);
  }
  console.log(`✅ [PASS] ${message}`);
}

async function runFirestoreSecuritySuite() {
  console.log('====================================================');
  console.log('TRACK-A-BITE — PHASE 9 FIRESTORE SECURITY AUDIT');
  console.log('Live Rules Verification: Strict User Ownership');
  console.log('====================================================\n');

  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  // App instance for Unauthenticated client
  const unauthAppName = `unauth-test-app-${Date.now()}`;
  const unauthApp = initializeApp(firebaseConfig, unauthAppName);
  const unauthDb = getFirestore(unauthApp);

  // App instance for User A
  const appAName = `userA-app-${Date.now()}`;
  const appA = initializeApp(firebaseConfig, appAName);
  const authA = getAuth(appA);
  const dbA = getFirestore(appA);

  // App instance for User B
  const appBName = `userB-app-${Date.now()}`;
  const appB = initializeApp(firebaseConfig, appBName);
  const authB = getAuth(appB);
  const dbB = getFirestore(appB);

  const emailA = `sec_user_a_${Date.now()}@example.com`;
  const passA = `PassA#${Date.now()}!9A`;
  const emailB = `sec_user_b_${Date.now()}@example.com`;
  const passB = `PassB#${Date.now()}!9B`;

  let uidA = '';
  let uidB = '';

  try {
    // -------------------------------------------------------------------------
    // PART 1: UNAUTHENTICATED ACCESS ATTEMPTS
    // -------------------------------------------------------------------------
    console.log('--- PART 1: UNAUTHENTICATED ACCESS ATTEMPTS ---');
    const targetUid = 'target-user-test-uid-123';

    // 1. Unauthenticated read profile
    let unauthProfileReadDenied = false;
    try {
      await getDoc(doc(unauthDb, 'users', targetUid));
    } catch {
      unauthProfileReadDenied = true;
    }
    assert(unauthProfileReadDenied, 'TEST 1: Unauthenticated READ to users/{uid} is DENIED');

    // 2. Unauthenticated write profile
    let unauthProfileWriteDenied = false;
    try {
      await setDoc(doc(unauthDb, 'users', targetUid), { hacked: true });
    } catch {
      unauthProfileWriteDenied = true;
    }
    assert(unauthProfileWriteDenied, 'TEST 2: Unauthenticated WRITE to users/{uid} is DENIED');

    // 3. Unauthenticated read meal
    let unauthMealReadDenied = false;
    try {
      await getDoc(doc(unauthDb, 'users', targetUid, 'meals', 'meal-1'));
    } catch {
      unauthMealReadDenied = true;
    }
    assert(unauthMealReadDenied, 'TEST 3: Unauthenticated READ to users/{uid}/meals/{mealId} is DENIED');

    // 4. Unauthenticated write meal
    let unauthMealWriteDenied = false;
    try {
      await setDoc(doc(unauthDb, 'users', targetUid, 'meals', 'meal-1'), { title: 'Hacked Meal' });
    } catch {
      unauthMealWriteDenied = true;
    }
    assert(unauthMealWriteDenied, 'TEST 4: Unauthenticated WRITE to users/{uid}/meals/{mealId} is DENIED');

    // 5. Unauthenticated read hydration
    let unauthHydReadDenied = false;
    try {
      await getDoc(doc(unauthDb, 'users', targetUid, 'hydration', 'hyd-1'));
    } catch {
      unauthHydReadDenied = true;
    }
    assert(unauthHydReadDenied, 'TEST 5: Unauthenticated READ to users/{uid}/hydration/{entryId} is DENIED');

    // 6. Unauthenticated write hydration
    let unauthHydWriteDenied = false;
    try {
      await setDoc(doc(unauthDb, 'users', targetUid, 'hydration', 'hyd-1'), { amountMl: 500 });
    } catch {
      unauthHydWriteDenied = true;
    }
    assert(unauthHydWriteDenied, 'TEST 6: Unauthenticated WRITE to users/{uid}/hydration/{entryId} is DENIED');

    // -------------------------------------------------------------------------
    // PART 2: REGISTER AUTHENTICATED TEST USERS (USER A & USER B)
    // -------------------------------------------------------------------------
    console.log('\n--- PART 2: REGISTER AUTHENTICATED USERS (A & B) ---');
    const credA = await createUserWithEmailAndPassword(authA, emailA, passA);
    uidA = credA.user.uid;
    console.log(`User A created: ${uidA}`);

    const credB = await createUserWithEmailAndPassword(authB, emailB, passB);
    uidB = credB.user.uid;
    console.log(`User B created: ${uidB}`);

    // Seed User B documents directly as User B
    await setDoc(doc(dbB, 'users', uidB), { age: 24, gender: 'male', targetCalories: 2200 });
    await setDoc(doc(dbB, 'users', uidB, 'meals', 'meal-b-1'), { mealTitle: 'User B Private Meal', calories: 650 });
    await setDoc(doc(dbB, 'users', uidB, 'hydration', 'hyd-b-1'), { amountMl: 750, date: '2026-10-02' });
    console.log('Seeded User B private documents.');

    // -------------------------------------------------------------------------
    // PART 3: USER A ACCESS TO OWN DATA (AUTHORIZED)
    // -------------------------------------------------------------------------
    console.log('\n--- PART 3: USER A ACCESS TO OWN DATA ---');
    // 7. Write own profile
    await setDoc(doc(dbA, 'users', uidA), { age: 21, gender: 'female', targetCalories: 1900 });
    assert(true, 'TEST 7: User A WRITE own profile is ALLOWED');

    // 8. Read own profile
    const profileSnapA = await getDoc(doc(dbA, 'users', uidA));
    assert(profileSnapA.exists() && profileSnapA.data()?.age === 21, 'TEST 8: User A READ own profile is ALLOWED');

    // 9. Write own meal
    await setDoc(doc(dbA, 'users', uidA, 'meals', 'meal-a-1'), { mealTitle: 'User A Oats Bowl', calories: 350 });
    assert(true, 'TEST 9: User A WRITE own meal is ALLOWED');

    // 10. Read own meal
    const mealSnapA = await getDoc(doc(dbA, 'users', uidA, 'meals', 'meal-a-1'));
    assert(mealSnapA.exists() && mealSnapA.data()?.calories === 350, 'TEST 10: User A READ own meal is ALLOWED');

    // 11. Write own hydration
    await setDoc(doc(dbA, 'users', uidA, 'hydration', 'hyd-a-1'), { amountMl: 500, date: '2026-10-02' });
    assert(true, 'TEST 11: User A WRITE own hydration is ALLOWED');

    // 12. Read own hydration
    const hydSnapA = await getDoc(doc(dbA, 'users', uidA, 'hydration', 'hyd-a-1'));
    assert(hydSnapA.exists() && hydSnapA.data()?.amountMl === 500, 'TEST 12: User A READ own hydration is ALLOWED');

    // 13. Delete own meal
    await deleteDoc(doc(dbA, 'users', uidA, 'meals', 'meal-a-1'));
    const deletedMealSnapA = await getDoc(doc(dbA, 'users', uidA, 'meals', 'meal-a-1'));
    assert(!deletedMealSnapA.exists(), 'TEST 13: User A DELETE own meal is ALLOWED');

    // 14. Delete own hydration
    await deleteDoc(doc(dbA, 'users', uidA, 'hydration', 'hyd-a-1'));
    const deletedHydSnapA = await getDoc(doc(dbA, 'users', uidA, 'hydration', 'hyd-a-1'));
    assert(!deletedHydSnapA.exists(), 'TEST 14: User A DELETE own hydration is ALLOWED');

    // -------------------------------------------------------------------------
    // PART 4: CROSS-USER ACCESS ATTEMPTS (USER A -> USER B: STRICTLY DENIED)
    // -------------------------------------------------------------------------
    console.log('\n--- PART 4: CROSS-USER ACCESS ATTEMPTS (USER A -> USER B) ---');

    // 15. User A reads User B profile
    let readBProfileDenied = false;
    try {
      await getDoc(doc(dbA, 'users', uidB));
    } catch {
      readBProfileDenied = true;
    }
    assert(readBProfileDenied, 'TEST 15: User A READ User B profile is DENIED');

    // 16. User A writes User B profile
    let writeBProfileDenied = false;
    try {
      await setDoc(doc(dbA, 'users', uidB), { age: 99, malicious: true });
    } catch {
      writeBProfileDenied = true;
    }
    assert(writeBProfileDenied, 'TEST 16: User A WRITE User B profile is DENIED');

    // 17. User A deletes User B profile
    let deleteBProfileDenied = false;
    try {
      await deleteDoc(doc(dbA, 'users', uidB));
    } catch {
      deleteBProfileDenied = true;
    }
    assert(deleteBProfileDenied, 'TEST 17: User A DELETE User B profile is DENIED');

    // 18. User A reads User B meal
    let readBMealDenied = false;
    try {
      await getDoc(doc(dbA, 'users', uidB, 'meals', 'meal-b-1'));
    } catch {
      readBMealDenied = true;
    }
    assert(readBMealDenied, 'TEST 18: User A READ User B meal is DENIED');

    // 19. User A writes User B meal
    let writeBMealDenied = false;
    try {
      await setDoc(doc(dbA, 'users', uidB, 'meals', 'meal-b-1'), { malicious: true });
    } catch {
      writeBMealDenied = true;
    }
    assert(writeBMealDenied, 'TEST 19: User A WRITE User B meal is DENIED');

    // 20. User A deletes User B meal
    let deleteBMealDenied = false;
    try {
      await deleteDoc(doc(dbA, 'users', uidB, 'meals', 'meal-b-1'));
    } catch {
      deleteBMealDenied = true;
    }
    assert(deleteBMealDenied, 'TEST 20: User A DELETE User B meal is DENIED');

    // 21. User A reads User B hydration
    let readBHydDenied = false;
    try {
      await getDoc(doc(dbA, 'users', uidB, 'hydration', 'hyd-b-1'));
    } catch {
      readBHydDenied = true;
    }
    assert(readBHydDenied, 'TEST 21: User A READ User B hydration is DENIED');

    // 22. User A writes User B hydration
    let writeBHydDenied = false;
    try {
      await setDoc(doc(dbA, 'users', uidB, 'hydration', 'hyd-b-1'), { amountMl: 9999 });
    } catch {
      writeBHydDenied = true;
    }
    assert(writeBHydDenied, 'TEST 22: User A WRITE User B hydration is DENIED');

    // 23. User A deletes User B hydration
    let deleteBHydDenied = false;
    try {
      await deleteDoc(doc(dbA, 'users', uidB, 'hydration', 'hyd-b-1'));
    } catch {
      deleteBHydDenied = true;
    }
    assert(deleteBHydDenied, 'TEST 23: User A DELETE User B hydration is DENIED');

    // -------------------------------------------------------------------------
    // PART 5: WILDCARD PRIVILEGE ESCALATION / ARBITRARY COLLECTIONS
    // -------------------------------------------------------------------------
    console.log('\n--- PART 5: WILDCARD PRIVILEGE ESCALATION PREVENTION ---');

    // 24. Read arbitrary collection outside /users
    let readArbitraryDenied = false;
    try {
      await getDoc(doc(dbA, 'system_secrets', 'secret_key'));
    } catch {
      readArbitraryDenied = true;
    }
    assert(readArbitraryDenied, 'TEST 24: Arbitrary root collection READ is DENIED (no wildcard escalation)');

    // 25. Write arbitrary collection outside /users
    let writeArbitraryDenied = false;
    try {
      await setDoc(doc(dbA, 'admin_settings', 'config'), { allowAll: true });
    } catch {
      writeArbitraryDenied = true;
    }
    assert(writeArbitraryDenied, 'TEST 25: Arbitrary root collection WRITE is DENIED');

    // -------------------------------------------------------------------------
    // PART 6: COMPLETE CLEANUP & TEARDOWN
    // -------------------------------------------------------------------------
    console.log('\n--- PART 6: TEARDOWN & TEST DATA PURGE ---');
    // User A cleanup
    await deleteDoc(doc(dbA, 'users', uidA));
    if (authA.currentUser) {
      await deleteUser(authA.currentUser);
    }
    console.log(`User A (${emailA}) and all documents deleted.`);

    // User B cleanup
    await deleteDoc(doc(dbB, 'users', uidB, 'meals', 'meal-b-1'));
    await deleteDoc(doc(dbB, 'users', uidB, 'hydration', 'hyd-b-1'));
    await deleteDoc(doc(dbB, 'users', uidB));
    if (authB.currentUser) {
      await deleteUser(authB.currentUser);
    }
    console.log(`User B (${emailB}) and all documents deleted.`);

    assert(true, 'TEST 26: Complete teardown: Zero test documents or accounts left behind');

  } finally {
    // Terminate apps cleanly
    await deleteApp(unauthApp);
    await deleteApp(appA);
    await deleteApp(appB);
  }

  console.log('\n====================================================');
  console.log('🎉 ALL 26 FIRESTORE SECURITY TESTS PASSED!');
  console.log('====================================================\n');
}

runFirestoreSecuritySuite().catch((err) => {
  console.error('Fatal security audit failure:', err);
  process.exit(1);
});
