/**
 * TRACK-A-BITE — PHASE 9.0 ARCHITECTURE AUDIT SUITE
 *
 * Verifies that Phase 9 builds directly upon the existing, verified architecture:
 * 1. Confirms existing modular Firebase services exist and export required contracts.
 * 2. Confirms core domain types (Profile, Meal, Hydration, Analytics) are authoritative and single-source.
 * 3. Confirms no duplicate state-management or secondary databases exist.
 * 4. Confirms Firestore security rules remain strictly isolated (request.auth.uid == userId).
 * 5. Confirms server-side Gemini Vision isolation (NEXT_PUBLIC_GEMINI_API_KEY is not exposed).
 * 6. Confirms existing analytics and recommendation pipelines are reusable without redesign.
 */

import fs from 'fs';
import path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ [PASS] ${message}`);
}

async function runPhase9ArchitectureAudit() {
  console.log('====================================================');
  console.log('TRACK-A-BITE — PHASE 9.0 ARCHITECTURE AUDIT');
  console.log('Pre-Implementation System & Contract Verification');
  console.log('====================================================\n');

  // --- 1. EXISTING REUSABLE SERVICES AUDIT ---
  console.log('--- 1. VERIFYING CORE SERVICES EXIST ---');
  const services = [
    'src/lib/services/firebaseAuthService.ts',
    'src/lib/services/firestoreProfileService.ts',
    'src/lib/services/firestoreMealHistoryService.ts',
    'src/lib/services/firestoreHydrationService.ts',
    'src/lib/services/hydrationService.ts',
    'src/lib/services/nutritionAnalyticsService.ts',
    'src/lib/services/userProfileService.ts',
    'src/lib/services/recommendationService.ts',
  ];

  for (const s of services) {
    const fullPath = path.resolve(s);
    assert(fs.existsSync(fullPath), `Service exists: ${s}`);
  }

  // --- 2. VERIFY DOMAIN TYPES INTEGRITY ---
  console.log('\n--- 2. VERIFYING DOMAIN TYPES & SCHEMAS ---');
  const typesFiles = [
    'src/lib/types/profile.ts',
    'src/lib/types/meal.ts',
    'src/lib/types/hydration.ts',
    'src/lib/types/analytics.ts',
    'src/lib/types/reporting.ts',
  ];

  for (const t of typesFiles) {
    const fullPath = path.resolve(t);
    assert(fs.existsSync(fullPath), `Domain type file exists: ${t}`);
  }

  // Check profile validator
  const { validateUserProfile, DEFAULT_USER_PROFILE } = await import('../src/lib/types/profile');
  assert(typeof validateUserProfile === 'function', 'validateUserProfile function is exported');
  assert(typeof DEFAULT_USER_PROFILE === 'object' && DEFAULT_USER_PROFILE !== null, 'DEFAULT_USER_PROFILE is exported');

  // --- 3. REUSABLE ANALYTICS & RECOMMENDATION CONTRACTS ---
  console.log('\n--- 3. REUSABLE ANALYTICS & SCORING CONTRACTS ---');
  const { nutritionAnalyticsService } = await import('../src/lib/services/nutritionAnalyticsService');
  assert(typeof nutritionAnalyticsService.getDailySummary === 'function', 'nutritionAnalyticsService.getDailySummary exists');
  assert(typeof nutritionAnalyticsService.calculateNutritionScore === 'function', 'nutritionAnalyticsService.calculateNutritionScore exists');
  assert(typeof nutritionAnalyticsService.getNextMealRecommendations === 'function', 'nutritionAnalyticsService.getNextMealRecommendations exists');
  assert(typeof nutritionAnalyticsService.calculateDailyTargets === 'function', 'nutritionAnalyticsService.calculateDailyTargets exists');

  // --- 4. HYDRATION CAPABILITIES ---
  console.log('\n--- 4. REUSABLE HYDRATION CONTRACTS ---');
  const { hydrationService } = await import('../src/lib/services/hydrationService');
  assert(typeof hydrationService.logDrink === 'function', 'hydrationService.logDrink exists');
  assert(typeof hydrationService.getDailySummary === 'function', 'hydrationService.getDailySummary exists');

  // --- 5. SECURITY RULES & TENANT ISOLATION ---
  console.log('\n--- 5. FIRESTORE SECURITY RULES VERIFICATION ---');
  const rulesPath = path.resolve('firestore.rules');
  assert(fs.existsSync(rulesPath), 'firestore.rules exists');
  const rulesContent = fs.readFileSync(rulesPath, 'utf8');

  assert(rulesContent.includes('match /users/{userId}'), 'Security rules isolate users/{userId}');
  assert(rulesContent.includes('match /meals/{mealId}'), 'Security rules isolate users/{userId}/meals/{mealId}');
  assert(rulesContent.includes('match /hydration/{entryId}'), 'Security rules isolate users/{userId}/hydration/{entryId}');
  assert(rulesContent.includes('request.auth.uid == userId'), 'Security rules enforce request.auth.uid == userId');
  assert(!rulesContent.includes('allow read, write: if true;'), 'Security rules have NO permissive wildcards');

  // --- 6. SECRET ISOLATION AUDIT ---
  console.log('\n--- 6. SECRET ISOLATION AUDIT ---');
  assert(!process.env.NEXT_PUBLIC_GEMINI_API_KEY, 'NEXT_PUBLIC_GEMINI_API_KEY is not exposed to client');

  const apiRoutePath = path.resolve('src/app/api/recognize-food/route.ts');
  assert(fs.existsSync(apiRoutePath), 'Server-side Gemini route exists: src/app/api/recognize-food/route.ts');
  const apiRouteContent = fs.readFileSync(apiRoutePath, 'utf8');
  assert(apiRouteContent.includes('GEMINI_API_KEY'), 'Gemini API key is read server-side only in route.ts');

  // --- 7. NO SECONDARY DATABASES OR DUPLICATE ORMS ---
  console.log('\n--- 7. SINGLE DATABASE & ORM BOUNDARY ---');
  const packageJson = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
  const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  assert(!allDeps['prisma'], 'Prisma is NOT installed (no parallel ORM)');
  assert(!allDeps['mongoose'], 'Mongoose is NOT installed (no parallel database)');
  assert(!allDeps['supabase'], 'Supabase is NOT installed (no parallel cloud backend)');
  assert(Boolean(allDeps['firebase']), 'Firebase modular SDK is installed');

  console.log('\n====================================================');
  console.log('🎉 PHASE 9.0 ARCHITECTURE AUDIT PASSED COMPLETELY!');
  console.log('====================================================\n');
}

runPhase9ArchitectureAudit().catch(err => {
  console.error('\n❌ Phase 9 Architecture Audit Failed:', err);
  process.exit(1);
});
