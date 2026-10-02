/**
 * TRACK-A-BITE — PHASE 9.13 SECURITY AUDIT SUITE
 *
 * Verifies security boundaries and tenant isolation:
 * 1. Authenticated UID context strictly enforced (never trusted from forms or URLs)
 * 2. firestoreMealHistoryService rejects missing/empty UID
 * 3. firestoreHydrationService rejects missing/empty UID
 * 4. firestoreProfileService rejects missing/empty UID
 * 5. Server-side Gemini Vision isolation (NEXT_PUBLIC_GEMINI_API_KEY is undefined)
 * 6. Zero credential storage (passwords and refresh tokens never persisted in localStorage)
 * 7. Firestore security rules enforce request.auth.uid == userId
 */

import fs from 'fs';
import path from 'path';
import { firestoreMealHistoryService } from '../src/lib/services/firestoreMealHistoryService';
import { firestoreHydrationService } from '../src/lib/services/firestoreHydrationService';
import { firestoreProfileService } from '../src/lib/services/firestoreProfileService';
import { profileStorageService } from '../src/lib/services/profileStorageService';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`✅ [PASS] ${msg}`);
}

async function runSecurityAudit() {
  console.log('====================================================');
  console.log('TRACK-A-BITE — PHASE 9.13 SECURITY AUDIT SUITE');
  console.log('====================================================\n');

  // --- 1. UID CONTEXT ENFORCEMENT ---
  console.log('--- 1. UID CONTEXT ENFORCEMENT ---');
  let mealRejected = false;
  try {
    await firestoreMealHistoryService.getRecentMeals('');
  } catch (err: unknown) {
    mealRejected = true;
    assert(String(err).includes('Authenticated UID is required'), 'TEST 1.1: Empty UID rejected by meal service');
  }
  assert(mealRejected, 'TEST 1.2: Empty UID call must throw error');

  let hydRejected = false;
  try {
    await firestoreHydrationService.getDailyHydration('', '2026-10-02');
  } catch (err: unknown) {
    hydRejected = true;
    assert(String(err).includes('User must be authenticated'), 'TEST 1.3: Empty UID rejected by hydration service');
  }
  assert(hydRejected, 'TEST 1.4: Empty UID hydration call must throw error');

  let profileRejected = false;
  try {
    await firestoreProfileService.updateProfile('', {});
  } catch (err: unknown) {
    profileRejected = true;
    assert(String(err).includes('Authenticated UID is required'), 'TEST 1.5: Empty UID rejected by profile service');
  }
  assert(profileRejected, 'TEST 1.6: Empty UID profile update must throw error');

  // --- 2. SECRET ISOLATION ---
  console.log('\n--- 2. SECRET ISOLATION ---');
  assert(!process.env.NEXT_PUBLIC_GEMINI_API_KEY, 'TEST 2.1: NEXT_PUBLIC_GEMINI_API_KEY is not defined');

  const apiRoutePath = path.resolve('src/app/api/recognize-food/route.ts');
  const apiRouteContent = fs.readFileSync(apiRoutePath, 'utf8');
  assert(apiRouteContent.includes('GEMINI_API_KEY'), 'TEST 2.2: Gemini key used strictly in server-side route');

  // --- 3. ZERO CREDENTIAL STORAGE ---
  console.log('\n--- 3. ZERO CREDENTIAL STORAGE ---');
  profileStorageService.saveProfile({ age: 22, heightCm: 175, weightKg: 70 });
  const stored = profileStorageService.getProfile();
  const serialized = JSON.stringify(stored);
  assert(!serialized.includes('password'), 'TEST 3.1: Stored profile contains zero passwords');
  assert(!serialized.includes('refreshToken'), 'TEST 3.2: Stored profile contains zero refresh tokens');
  assert(!serialized.includes('secret'), 'TEST 3.3: Stored profile contains zero secrets');

  // --- 4. FIRESTORE RULES AUDIT ---
  console.log('\n--- 4. FIRESTORE SECURITY RULES ---');
  const rules = fs.readFileSync(path.resolve('firestore.rules'), 'utf8');
  assert(rules.includes('request.auth != null'), 'TEST 4.1: Rules require authentication');
  assert(rules.includes('request.auth.uid == userId'), 'TEST 4.2: Rules require exact UID match');
  assert(!rules.includes('allow read, write: if true;'), 'TEST 4.3: Rules contain zero wide-open access clauses');

  console.log('\n====================================================');
  console.log('🎉 ALL PHASE 9.13 SECURITY CHECKS PASSED!');
  console.log('====================================================\n');
}

runSecurityAudit().catch(err => {
  console.error('\n❌ Security Audit Failed:', err);
  process.exit(1);
});
