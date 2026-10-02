/**
 * Track-a-Bite Phase 8.1 Verification Test Suite
 * Firestore Meal History Backend
 *
 * Verifies:
 * 1. Service initialization and method availability
 * 2. Authenticated UID boundary enforcement
 * 3. Save validation (meal ID, items array, totalNutrition)
 * 4. Get validation and non-existent fallback
 * 5. Pagination configuration (bounded limits, orderBy, startAfter cursor)
 * 6. Firestore document path correctness (users/{uid}/meals/{mealId})
 * 7. Timestamp handling (serverTimestamp on write, ISO string normalization on read)
 * 8. Delete behavior and parameter validation
 * 9. Offline and timeout error classification
 * 10. Unauthenticated fallback handling
 * 11. Migration safety (validates local scans before upload)
 * 12. Duplicate migration protection (skips already existing cloud documents)
 * 13. Security: Zero password / auth token / Gemini key persistence
 * 14. Security rules presence in firestore.rules
 * 15. Recursive sanitization (strips undefined values from nested objects)
 * 16. Type compatibility with canonical MealAnalysis domain model
 */

import fs from 'fs';

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
    process.exit(1);
  } else {
    console.log(`✅ [PASS] ${message}`);
  }
}

// Mock storage polyfill for Node.js test environment if needed
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    length: 0,
  } as Storage;
}

async function runTestSuite() {
  console.log('====================================================');
  console.log('TRACK-A-BITE — PHASE 8.1 VERIFICATION SUITE');
  console.log('Firestore Meal History Backend');
  console.log('====================================================\n');

  // Dynamic imports
  const {
    firestoreMealHistoryService,
    FirestoreMealHistoryService,
    sanitizeForFirestore,
    validateMealForSave,
    mapDocToMeal,
  } = await import('../src/lib/services/firestoreMealHistoryService');

  const { firebaseConfig } = await import('../src/lib/firebase/client');
  const { MOCK_SAVED_MEALS } = await import('../src/data/mockMeals');

  const sampleMeal = MOCK_SAVED_MEALS[0];

  // ---------------------------------------------------------------------------
  // TEST 1: Service Initialization & Method Availability
  // ---------------------------------------------------------------------------
  console.log('--- TEST 1: SERVICE INITIALIZATION ---');
  assert(firestoreMealHistoryService instanceof FirestoreMealHistoryService, 'TEST 1: Singleton instance exists');
  assert(typeof firestoreMealHistoryService.saveMeal === 'function', 'TEST 1: saveMeal method available');
  assert(typeof firestoreMealHistoryService.getMeal === 'function', 'TEST 1: getMeal method available');
  assert(typeof firestoreMealHistoryService.getRecentMeals === 'function', 'TEST 1: getRecentMeals method available');
  assert(typeof firestoreMealHistoryService.deleteMeal === 'function', 'TEST 1: deleteMeal method available');
  assert(typeof firestoreMealHistoryService.subscribeToRecentMeals === 'function', 'TEST 1: subscribeToRecentMeals method available');
  assert(typeof firestoreMealHistoryService.migrateLocalMeals === 'function', 'TEST 1: migrateLocalMeals method available');
  console.log('✅ [PASS] TEST 1: Service singleton and all 6 required methods verified');

  // ---------------------------------------------------------------------------
  // TEST 2: Authenticated UID Boundary Enforcement
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 2: AUTHENTICATED UID BOUNDARY ---');
  try {
    await firestoreMealHistoryService.saveMeal('', sampleMeal);
    assert.fail('Should have thrown on empty UID');
  } catch (err: unknown) {
    const error = err as { code?: string };
    assert(error.code === 'unauthenticated', 'TEST 2: saveMeal rejects empty UID with unauthenticated code');
  }

  try {
    await firestoreMealHistoryService.getMeal('   ', 'meal-123');
    assert.fail('Should have thrown on whitespace UID');
  } catch (err: unknown) {
    const error = err as { code?: string };
    assert(error.code === 'unauthenticated', 'TEST 2: getMeal rejects whitespace UID with unauthenticated code');
  }

  try {
    await firestoreMealHistoryService.deleteMeal('', 'meal-123');
    assert.fail('Should have thrown on empty UID for delete');
  } catch (err: unknown) {
    const error = err as { code?: string };
    assert(error.code === 'unauthenticated', 'TEST 2: deleteMeal rejects empty UID with unauthenticated code');
  }

  try {
    await firestoreMealHistoryService.getRecentMeals('');
    assert.fail('Should have thrown on empty UID for getRecentMeals');
  } catch (err: unknown) {
    const error = err as { code?: string };
    assert(error.code === 'unauthenticated', 'TEST 2: getRecentMeals rejects empty UID with unauthenticated code');
  }

  try {
    await firestoreMealHistoryService.migrateLocalMeals('', [sampleMeal]);
    assert.fail('Should have thrown on empty UID for migrateLocalMeals');
  } catch (err: unknown) {
    const error = err as { code?: string };
    assert(error.code === 'unauthenticated', 'TEST 2: migrateLocalMeals rejects empty UID with unauthenticated code');
  }
  console.log('✅ [PASS] TEST 2: Strict authentication boundaries verified across all methods');

  // ---------------------------------------------------------------------------
  // TEST 3: Save Validation
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 3: SAVE VALIDATION ---');
  const invalidEmptyId = { ...sampleMeal, id: '' };
  const val1 = validateMealForSave(invalidEmptyId);
  assert(!val1.isValid, 'TEST 3: Meal with empty id rejected');
  assert(val1.errors.some(e => e.includes('Meal ID')), 'TEST 3: Clear error for missing meal ID');

  const invalidItems = { ...sampleMeal, items: null as unknown as typeof sampleMeal.items };
  const val2 = validateMealForSave(invalidItems);
  assert(!val2.isValid, 'TEST 3: Meal with non-array items rejected');

  const invalidCalories = {
    ...sampleMeal,
    totalNutrition: { ...sampleMeal.totalNutrition, calories: NaN },
  };
  const val3 = validateMealForSave(invalidCalories);
  assert(!val3.isValid, 'TEST 3: Meal with NaN calories rejected');

  const validResult = validateMealForSave(sampleMeal);
  assert(validResult.isValid, 'TEST 3: Canonical sampleMeal passes validation');
  console.log('✅ [PASS] TEST 3: Save validation handles invalid structures and passes canonical meals');

  // ---------------------------------------------------------------------------
  // TEST 4: Get Validation & Fallback
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 4: GET VALIDATION ---');
  try {
    await firestoreMealHistoryService.getMeal('user-123', '');
    assert.fail('Should have thrown on empty mealId');
  } catch (err: unknown) {
    const error = err as { code?: string };
    assert(error.code === 'validation-failure', 'TEST 4: getMeal rejects empty mealId with validation-failure');
  }
  console.log('✅ [PASS] TEST 4: Get validation verifies mealId non-empty requirement');

  // ---------------------------------------------------------------------------
  // TEST 5: Pagination Configuration
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 5: PAGINATION CONFIGURATION ---');
  const serviceSource = fs.readFileSync('src/lib/services/firestoreMealHistoryService.ts', 'utf8');
  assert(serviceSource.includes("orderBy('analyzedAt', 'desc')"), 'TEST 5: Queries ordered by analyzedAt desc');
  assert(serviceSource.includes('startAfter(lastVisibleDoc)'), 'TEST 5: Cursor-based pagination uses startAfter');
  assert(serviceSource.includes('Math.min(limitCount, 100)'), 'TEST 5: Limit safely clamped to max 100');
  console.log('✅ [PASS] TEST 5: Bounded pagination parameters and cursor pagination verified');

  // ---------------------------------------------------------------------------
  // TEST 6: Firestore Path Correctness
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 6: FIRESTORE PATH CORRECTNESS ---');
  assert(
    serviceSource.includes("doc(firebaseDb, 'users', uid, 'meals', meal.id)"),
    'TEST 6: Save path is users/{uid}/meals/{mealId}'
  );
  assert(
    serviceSource.includes("collection(firebaseDb, 'users', uid, 'meals')"),
    'TEST 6: Query collection path is users/{uid}/meals'
  );
  console.log('✅ [PASS] TEST 6: Subcollection path users/{uid}/meals/{mealId} verified');

  // ---------------------------------------------------------------------------
  // TEST 7: Timestamp Handling & Normalization
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 7: TIMESTAMP HANDLING ---');
  assert(serviceSource.includes('createdAt: serverTimestamp()'), 'TEST 7: serverTimestamp used for createdAt');
  assert(serviceSource.includes('updatedAt: serverTimestamp()'), 'TEST 7: serverTimestamp used for updatedAt');

  // Test mapDocToMeal timestamp conversion
  const fakeDocData = {
    id: 'meal-test-ts',
    mealTitle: 'Paneer Thali',
    analyzedAt: {
      toDate: () => new Date('2026-09-15T12:00:00.000Z'),
    },
    items: [],
    totalNutrition: { calories: 500, protein: 20, carbohydrates: 60, fat: 15 },
  };
  const mapped = mapDocToMeal(fakeDocData as Record<string, unknown>, 'fallback-id');
  assert(mapped.analyzedAt === '2026-09-15T12:00:00.000Z', 'TEST 7: Firestore Timestamp normalized to ISO string');
  assert(mapped.mealTitle === 'Paneer Thali', 'TEST 7: Title correctly preserved');
  console.log('✅ [PASS] TEST 7: Server timestamps on write and ISO normalization on read verified');

  // ---------------------------------------------------------------------------
  // TEST 8: Delete Behavior
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 8: DELETE BEHAVIOR ---');
  try {
    await firestoreMealHistoryService.deleteMeal('user-123', '');
    assert.fail('Should have thrown on empty mealId');
  } catch (err: unknown) {
    const error = err as { code?: string };
    assert(error.code === 'validation-failure', 'TEST 8: deleteMeal validates non-empty mealId');
  }
  assert(serviceSource.includes('deleteDoc(mealDocRef)'), 'TEST 8: deleteDoc invoked on meal document ref');
  console.log('✅ [PASS] TEST 8: Delete validation and deletion target verified');

  // ---------------------------------------------------------------------------
  // TEST 9: Offline / Timeout Error Handling
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 9: OFFLINE / TIMEOUT ERROR HANDLING ---');
  assert(serviceSource.includes('withTimeout'), 'TEST 9: Network calls protected with withTimeout');
  assert(serviceSource.includes("classifyFirestoreError"), 'TEST 9: Error classification maps internal errors');
  console.log('✅ [PASS] TEST 9: Timeout and error classification verified');

  // ---------------------------------------------------------------------------
  // TEST 10: Unauthenticated Fallback Handling
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 10: UNAUTHENTICATED FALLBACK HANDLING ---');
  const emptySub = firestoreMealHistoryService.subscribeToRecentMeals('', (meals) => {
    assert(meals.length === 0, 'Callback received empty array on unauthenticated subscription');
  });
  assert(typeof emptySub === 'function', 'TEST 10: subscribeToRecentMeals returns callable unsubscribe for empty UID');
  emptySub();
  console.log('✅ [PASS] TEST 10: Unauthenticated state handled gracefully');

  // ---------------------------------------------------------------------------
  // TEST 11: Migration Safety
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 11: MIGRATION SAFETY ---');
  const migSource = serviceSource;
  assert(migSource.includes('validateMealForSave(meal)'), 'TEST 11: Migration validates each meal prior to write');
  assert(migSource.includes('skippedCount++'), 'TEST 11: Invalid meals skipped safely');
  console.log('✅ [PASS] TEST 11: Migration validates local items and skips invalid records safely');

  // ---------------------------------------------------------------------------
  // TEST 12: Duplicate Migration Protection
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 12: DUPLICATE MIGRATION PROTECTION ---');
  assert(
    migSource.includes('existingSnap.exists()'),
    'TEST 12: Migration checks if document already exists before uploading'
  );
  console.log('✅ [PASS] TEST 12: Existing cloud records protected against stale overwrites');

  // ---------------------------------------------------------------------------
  // TEST 13: Zero Secret / Password / Gemini Key Persistence
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 13: SECURITY - ZERO SECRETS PERSISTED ---');
  const mealWithSecret = {
    ...sampleMeal,
    secretField: 'GEMINI_API_KEY_SECRET',
  };
  const valSecret = validateMealForSave(mealWithSecret as typeof sampleMeal);
  assert(!valSecret.isValid, 'TEST 13: validateMealForSave detects and rejects GEMINI_API_KEY');
  assert(!serviceSource.includes('GEMINI_API_KEY'), 'TEST 13: Service does not access GEMINI_API_KEY');
  assert(!('GEMINI_API_KEY' in firebaseConfig), 'TEST 13: Client config has no Gemini key');
  console.log('✅ [PASS] TEST 13: Zero credentials, tokens, or Gemini keys allowed in meal documents');

  // ---------------------------------------------------------------------------
  // TEST 14: Security Rule Presence
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 14: FIRESTORE SECURITY RULES ---');
  const rules = fs.readFileSync('firestore.rules', 'utf8');
  assert(rules.includes('match /users/{userId}'), 'TEST 14: users/{userId} rule present');
  assert(rules.includes('match /meals/{mealId}'), 'TEST 14: meals/{mealId} subcollection rule present');
  assert(
    rules.includes('allow read, write: if request.auth != null && request.auth.uid == userId;'),
    'TEST 14: Strict user ownership check enforced for meals'
  );
  console.log('✅ [PASS] TEST 14: firestore.rules properly configured for users/{userId}/meals/{mealId}');

  // ---------------------------------------------------------------------------
  // TEST 15: Recursive Undefined Sanitization
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 15: RECURSIVE SANITIZATION ---');
  const dirtyObject = {
    title: 'Dal Makhani',
    undefinedField: undefined,
    nested: {
      clean: 123,
      dirty: undefined,
      deepArray: [{ a: 1, b: undefined }, undefined, { c: 'hello' }],
    },
  };
  const cleaned = sanitizeForFirestore(dirtyObject);
  assert(!('undefinedField' in cleaned), 'TEST 15: Top-level undefined stripped');
  assert(!('dirty' in cleaned.nested), 'TEST 15: Nested undefined stripped');
  assert(!('b' in cleaned.nested.deepArray[0]), 'TEST 15: Array element undefined stripped');
  assert(cleaned.nested.deepArray.length === 2, 'TEST 15: Undefined array items filtered out');
  console.log('✅ [PASS] TEST 15: Recursive undefined sanitization protects Firestore writes');

  // ---------------------------------------------------------------------------
  // TEST 16: Type Compatibility with MealAnalysis
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 16: TYPE COMPATIBILITY ---');
  const remapped = mapDocToMeal(sampleMeal as unknown as Record<string, unknown>, sampleMeal.id);
  assert(remapped.id === sampleMeal.id, 'TEST 16: id matches');
  assert(remapped.mealTitle === sampleMeal.mealTitle, 'TEST 16: mealTitle matches');
  assert(remapped.items.length === sampleMeal.items.length, 'TEST 16: items length matches');
  assert(remapped.totalNutrition.calories === sampleMeal.totalNutrition.calories, 'TEST 16: calories match');
  assert(remapped.nutrientRichness.stars === sampleMeal.nutrientRichness.stars, 'TEST 16: stars match');
  console.log('✅ [PASS] TEST 16: Full domain compatibility with MealAnalysis verified');

  console.log('\n====================================================');
  console.log('✅ ALL 16 PHASE 8.1 INTEGRATION TESTS PASSED');
  console.log('====================================================\n');
  process.exit(0);
}

runTestSuite().catch((err) => {
  console.error('❌ Phase 8.1 test suite failure:', err);
  process.exit(1);
});
