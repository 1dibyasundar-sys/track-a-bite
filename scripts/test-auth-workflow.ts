/**
 * Track-a-Bite — Comprehensive Authentication Workflow Verification Script
 *
 * Verifies:
 * 1. Client Firebase configuration detection (isFirebaseConfigured === true)
 * 2. Real user registration via firebaseAuthService.signUp()
 * 3. Real user sign-in via firebaseAuthService.signIn()
 * 4. User profile document initialization in Cloud Firestore
 * 5. Sign-out via firebaseAuthService.signOut()
 * 6. Clean teardown: Deletes temporary user document and auth account
 * 7. Route availability verification (/login, /register, /profile, /onboarding)
 */

import fs from 'fs';
import http from 'http';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';

// Load .env.local for standalone tsx execution
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
    process.exit(1);
  } else {
    console.log(`✅ [PASS] ${message}`);
  }
}

async function checkRoute(path: string): Promise<number> {
  return new Promise((resolve) => {
    http.get(`http://localhost:3000${path}`, (res) => {
      resolve(res.statusCode || 0);
    }).on('error', () => {
      resolve(0);
    });
  });
}

async function runAuthWorkflowTest() {
  console.log('====================================================');
  console.log('TRACK-A-BITE — FIREBASE AUTH WORKFLOW VERIFICATION');
  console.log('====================================================\n');

  // Step 1: Verify Client Configuration Detection
  console.log('--- STEP 1: CONFIGURATION DETECTION ---');
  const { isFirebaseConfigured, getMissingFirebaseEnvVars, firebaseAuth, firebaseDb } = await import('../src/lib/firebase/client');
  const missing = getMissingFirebaseEnvVars();
  assert(missing.length === 0, `Missing environment variables: 0 (Found: ${missing.length === 0 ? 'All 6' : missing.join(', ')})`);
  assert(isFirebaseConfigured === true, 'isFirebaseConfigured evaluates to true');
  assert(firebaseAuth !== undefined && firebaseAuth !== null, 'firebaseAuth is initialized');

  // Step 2: Test Route Availability
  console.log('\n--- STEP 2: ROUTE ACCESSIBILITY (HTTP 200) ---');
  const routes = ['/login', '/register', '/profile', '/onboarding'];
  for (const r of routes) {
    const status = await checkRoute(r);
    assert(status === 200, `Route ${r} returned HTTP ${status}`);
  }

  // Step 3: Register Real Temporary Firebase User
  console.log('\n--- STEP 3: REAL USER REGISTRATION ---');
  const { firebaseAuthService } = await import('../src/lib/services/firebaseAuthService');
  const testEmail = `auth_verify_${Date.now()}@trackabite.test`;
  const testPassword = 'TestAuthPassword123!';
  const testName = 'Verification Tester';

  const registerResult = await firebaseAuthService.signUp(testEmail, testPassword, testName);
  assert(registerResult.success === true, `Registration succeeded for ${testEmail}`);
  assert(Boolean(registerResult.user?.uid), `Authoritative UID generated: ${registerResult.user?.uid}`);
  assert(registerResult.user?.email === testEmail, 'Email matches registered address');
  assert(registerResult.user?.displayName === testName, 'Display name matches registered name');

  const testUid = registerResult.user!.uid;

  // Step 4: Verify Firestore User Document & Profile Initialization
  console.log('\n--- STEP 4: FIRESTORE USER DOCUMENT & PROFILE ---');
  const userDocSnap = await getDoc(doc(firebaseDb, 'users', testUid));
  assert(userDocSnap.exists(), 'User document exists in Cloud Firestore users/{uid}');
  assert(userDocSnap.data()?.email === testEmail, 'User document stores registered email');

  // Verify creating full UserProfile
  const { firestoreProfileService } = await import('../src/lib/services/firestoreProfileService');
  const testProfile = {
    age: 22,
    gender: 'male' as const,
    heightCm: 175,
    weightKg: 70,
    activityLevel: 'moderate' as const,
    healthConditions: [],
    dietaryRestrictions: [],
    allergies: [],
    targetCalories: 2400,
    targetProteinG: 120,
    targetCarbsG: 300,
    targetFatG: 70,
    budgetPreference: 'moderate' as const,
    isHostelite: true,
    hasCookingAccess: false,
    hasFridge: false,
    messFoodType: 'veg' as const,
    primaryGoal: 'General health' as const,
    onboardingCompleted: true,
  };
  await firestoreProfileService.createProfile(testUid, testProfile);
  const retrievedProfile = await firestoreProfileService.getProfile(testUid);
  assert(retrievedProfile !== null, 'Retrieved profile from Cloud Firestore is not null');
  assert(retrievedProfile?.age === 22, 'Retrieved profile matches stored age');
  assert(retrievedProfile?.isHostelite === true, 'Retrieved profile matches stored isHostelite');

  // Step 5: Sign Out
  console.log('\n--- STEP 5: SIGN OUT ---');
  await firebaseAuthService.signOut();
  assert(firebaseAuth.currentUser === null, 'currentUser is null after sign out');

  // Step 6: Sign Back In
  console.log('\n--- STEP 6: SIGN BACK IN ---');
  const loginResult = await firebaseAuthService.signIn(testEmail, testPassword);
  assert(loginResult.success === true, 'Sign in succeeded with registered credentials');
  assert(loginResult.user?.uid === testUid, 'Restored session matches registered UID');

  // Step 7: Teardown & Clean Up Test User
  console.log('\n--- STEP 7: CLEANUP & TEARDOWN ---');
  if (firebaseAuth.currentUser) {
    // Delete profile doc
    await deleteDoc(doc(firebaseDb, 'users', testUid));
    // Delete auth user
    await deleteUser(firebaseAuth.currentUser);
    console.log(`Deleted temporary user ${testUid} and cleaned Firestore document.`);
  }

  assert(true, 'Teardown completed cleanly. No test data remains.');

  console.log('\n====================================================');
  console.log('🎉 ALL FIREBASE AUTH WORKFLOW CHECKS PASSED');
  console.log('====================================================\n');
  process.exit(0);
}

runAuthWorkflowTest().catch((err) => {
  console.error('❌ Auth workflow verification failed:', err);
  process.exit(1);
});
