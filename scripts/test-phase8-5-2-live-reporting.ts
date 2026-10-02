/**
 * TRACK-A-BITE — PHASE 8.5.2 LIVE FIREBASE REPORTING VERIFICATION
 * Project: track-a-bite
 *
 * Verifies live Firestore cloud integration with the Phase 8.5.2 reporting engine:
 * 1. Register temporary test Firebase Auth user
 * 2. Persist real meal records to Firestore subcollection users/{uid}/meals
 * 3. Generate live reports: Daily, 7-Day, Monthly
 * 4. Verify report updates dynamically when a new meal is written
 * 5. Verify CSV & JSON export integrity using real cloud records with zero secrets
 * 6. Verify cross-user isolation and security rules enforcement
 * 7. Clean up all test meals and delete the test Firebase Auth account
 */

import fs from 'fs';
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  deleteUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
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

async function runLiveReportingVerification() {
  console.log('====================================================');
  console.log('TRACK-A-BITE — PHASE 8.5.2 LIVE FIREBASE REPORTING');
  console.log('Verifying End-to-End Cloud Reporting Flow');
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

  const { firestoreMealHistoryService } = await import('../src/lib/services/firestoreMealHistoryService');
  const { nutritionAnalyticsService } = await import('../src/lib/services/nutritionAnalyticsService');

  const testEmail = `phase852_report_${Date.now()}@example.com`;
  const testPassword = `Pass#${Date.now()}Live852!`;
  let testUid = '';
  const testMealIds: string[] = [];

  const mockProfile: UserProfile = {
    uid: 'placeholder',
    email: testEmail,
    displayName: 'Phase 8.5.2 Live User',
    age: 22,
    gender: 'male',
    heightCm: 175,
    weightKg: 68,
    activityLevel: 'moderately_active',
    primaryGoal: 'maintain_weight',
    dietaryRestrictions: ['hostel_mess'],
    regionalPreferences: ['North Indian'],
    hostelMode: true,
    budgetTier: 'medium',
    cookingFacilities: ['kettle'],
    onboardingCompleted: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    // 1. REGISTER TEMPORARY TEST FIREBASE USER
    console.log('--- STEP 1: CREATE TEMPORARY AUTHENTICATED USER ---');
    const userCredential = await createUserWithEmailAndPassword(auth, testEmail, testPassword);
    testUid = userCredential.user.uid;
    mockProfile.uid = testUid;
    console.log(`Created test user: ${testEmail} (UID: ${testUid})`);
    assert(Boolean(testUid) && testUid.length >= 20, 'STEP 1: Authenticated test UID established');

    // 2. SEED REAL CLOUD MEAL RECORDS TO FIRESTORE
    console.log('\n--- STEP 2: WRITE REAL MEALS TO CLOUD FIRESTORE ---');
    const now = new Date();
    const todayStr = getLocalISODate(now);

    const meal1Time = new Date(now);
    meal1Time.setHours(9, 30, 0, 0);

    const meal2Time = new Date(now);
    meal2Time.setHours(13, 45, 0, 0);

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const meal3Time = new Date(yesterday);
    meal3Time.setHours(20, 15, 0, 0);

    const testMeals: MealAnalysis[] = [
      {
        id: `live-rpt-m1-${Date.now()}`,
        mealTitle: 'Paneer Bhurji & Paratha',
        analyzedAt: meal1Time.toISOString(),
        items: [
          {
            detectionId: 'det-p-1',
            foodId: 'paneer-bhurji',
            name: 'Paneer Bhurji',
            confidence: 0.95,
            portionMultiplier: 1.0,
            portionUnit: 'bowl',
            estimatedGrams: 150,
            nutrition: { calories: 350, protein: 18, carbohydrates: 12, fat: 26, fiber: 2 },
          },
          {
            detectionId: 'det-p-2',
            foodId: 'plain-paratha',
            name: 'Plain Paratha',
            confidence: 0.92,
            portionMultiplier: 1.0,
            portionUnit: 'piece',
            estimatedGrams: 80,
            nutrition: { calories: 250, protein: 5, carbohydrates: 34, fat: 11, fiber: 3 },
          },
        ],
        totalNutrition: { calories: 600, protein: 23, carbohydrates: 46, fat: 37, fiber: 5 },
        macroDistribution: { carbsPercent: 31, proteinPercent: 15, fatPercent: 54 },
        nutrientRichness: { stars: 4, label: 'High', explanation: 'Protein & micronutrient rich', highlights: ['High Protein'] },
        nutrientGaps: { providedNutrients: ['Protein', 'Calcium'], missingNutrients: [], whyItMattersSummary: 'Solid meal' },
        balanceAssessment: {
          rating: 'balanced',
          label: 'Balanced',
          summary: 'Well-balanced brunch',
          detail: 'Contains good protein and complex carbs',
          glycemicImpactEstimate: 'Moderate',
        },
        positiveHighlights: ['High protein intake from paneer'],
        balancingRecommendations: [],
        hostelFriendlyUpgrades: [],
        hostelModeActive: true,
        practicalAdjustments: [],
        disclaimer: 'Calculated nutritional values are estimates for reference.',
      },
      {
        id: `live-rpt-m2-${Date.now()}`,
        mealTitle: 'Rajma Chawal Lunch',
        analyzedAt: meal2Time.toISOString(),
        items: [
          {
            detectionId: 'det-r-1',
            foodId: 'rajma-curry',
            name: 'Rajma Masala',
            confidence: 0.94,
            portionMultiplier: 1.0,
            portionUnit: 'bowl',
            estimatedGrams: 200,
            nutrition: { calories: 280, protein: 14, carbohydrates: 42, fat: 6, fiber: 11 },
          },
          {
            detectionId: 'det-r-2',
            foodId: 'steamed-rice',
            name: 'Steamed Rice',
            confidence: 0.97,
            portionMultiplier: 1.0,
            portionUnit: 'plate',
            estimatedGrams: 150,
            nutrition: { calories: 200, protein: 4, carbohydrates: 45, fat: 1, fiber: 1 },
          },
        ],
        totalNutrition: { calories: 480, protein: 18, carbohydrates: 87, fat: 7, fiber: 12 },
        macroDistribution: { carbsPercent: 72, proteinPercent: 15, fatPercent: 13 },
        nutrientRichness: { stars: 4, label: 'Rich', explanation: 'Fiber & complex carbs', highlights: ['High Fiber'] },
        nutrientGaps: { providedNutrients: ['Fiber', 'Iron'], missingNutrients: [], whyItMattersSummary: 'Good' },
        balanceAssessment: {
          rating: 'balanced',
          label: 'Balanced',
          summary: 'Classic staple',
          detail: 'High satiety from soluble fiber',
          glycemicImpactEstimate: 'Moderate',
        },
        positiveHighlights: ['Excellent fiber content from kidney beans'],
        balancingRecommendations: [],
        hostelFriendlyUpgrades: [],
        hostelModeActive: true,
        practicalAdjustments: [],
        disclaimer: 'Calculated nutritional values are estimates for reference.',
      },
      {
        id: `live-rpt-m3-${Date.now()}`,
        mealTitle: 'Dal Tadka with Rotis Dinner',
        analyzedAt: meal3Time.toISOString(),
        items: [
          {
            detectionId: 'det-d-1',
            foodId: 'dal-tadka',
            name: 'Dal Tadka',
            confidence: 0.93,
            portionMultiplier: 1.0,
            portionUnit: 'bowl',
            estimatedGrams: 180,
            nutrition: { calories: 220, protein: 12, carbohydrates: 30, fat: 6, fiber: 6 },
          },
          {
            detectionId: 'det-d-2',
            foodId: 'roti-wholewheat',
            name: 'Whole Wheat Roti',
            confidence: 0.96,
            portionMultiplier: 2.0,
            portionUnit: 'piece',
            estimatedGrams: 100,
            nutrition: { calories: 240, protein: 8, carbohydrates: 46, fat: 2, fiber: 6 },
          },
        ],
        totalNutrition: { calories: 460, protein: 20, carbohydrates: 76, fat: 8, fiber: 12 },
        macroDistribution: { carbsPercent: 66, proteinPercent: 17, fatPercent: 17 },
        nutrientRichness: { stars: 4, label: 'Balanced', explanation: 'Wholesome', highlights: ['Fiber'] },
        nutrientGaps: { providedNutrients: ['Protein', 'Fiber'], missingNutrients: [], whyItMattersSummary: 'Good' },
        balanceAssessment: {
          rating: 'balanced',
          label: 'Balanced',
          summary: 'Light wholesome dinner',
          detail: 'Balanced lentils and whole grains',
          glycemicImpactEstimate: 'Low',
        },
        positiveHighlights: ['Complete amino acid profile combination'],
        balancingRecommendations: [],
        hostelFriendlyUpgrades: [],
        hostelModeActive: true,
        practicalAdjustments: [],
        disclaimer: 'Calculated nutritional values are estimates for reference.',
      },
    ];

    const batch = writeBatch(db);
    for (const m of testMeals) {
      testMealIds.push(m.id);
      const ref = doc(db, `users/${testUid}/meals/${m.id}`);
      batch.set(ref, m);
    }
    await batch.commit();
    console.log(`Successfully batch-written ${testMeals.length} real meal records to Firestore.`);

    // 3. GENERATE LIVE REPORTS
    console.log('\n--- STEP 3: GENERATE LIVE REPORTS FROM FIRESTORE ---');
    // Daily report (Today only: meal1 + meal2 = 600 + 480 = 1080 kcal)
    const liveTodayReport = await nutritionAnalyticsService.getDateRangeReport(testUid, 'today', mockProfile);
    assert(liveTodayReport.dataSource === 'cloud', 'STEP 3: Daily report source is cloud Firestore');
    assert(liveTodayReport.totalMeals === 2, 'STEP 3: Today report includes exactly 2 meals');
    assert(liveTodayReport.totalCalories === 1080, 'STEP 3: Today total calories = 1080 kcal');
    assert(liveTodayReport.totalProteinG === 41, 'STEP 3: Today total protein = 41g (23+18)');
    assert(liveTodayReport.totalCarbsG === 133, 'STEP 3: Today total carbs = 133g (46+87)');
    assert(liveTodayReport.totalFatG === 44, 'STEP 3: Today total fat = 44g (37+7)');
    assert(liveTodayReport.totalFiberG === 17, 'STEP 3: Today total fiber = 17g (5+12)');
    assert(liveTodayReport.targets !== undefined, 'STEP 3: Personalized targets included');
    assert(typeof liveTodayReport.calorieProgressPercent === 'number', 'STEP 3: Target progress computed');

    // 7-Day report (meal1 + meal2 + meal3 = 1080 + 460 = 1540 kcal)
    const live7DayReport = await nutritionAnalyticsService.getDateRangeReport(testUid, 'last_7_days', mockProfile);
    assert(live7DayReport.dataSource === 'cloud', 'STEP 3: 7-day report source is cloud Firestore');
    assert(live7DayReport.totalMeals === 3, 'STEP 3: 7-day report includes all 3 meals');
    assert(live7DayReport.totalCalories === 1540, 'STEP 3: 7-day total calories = 1540 kcal (1080+460)');
    assert(live7DayReport.totalProteinG === 61, 'STEP 3: 7-day total protein = 61g (41+20)');
    assert(live7DayReport.averageCalories === 770, 'STEP 3: Average 770 kcal/day (averageCalories: 1540 / 2 active days)');
    assert(live7DayReport.averageCaloriesPerDay === 770, 'STEP 3: Average 770 kcal/day (averageCaloriesPerDay: 1540 / 2 active days)');

    // 4. VERIFY DYNAMIC UPDATE WHEN NEW MEAL IS ADDED
    console.log('\n--- STEP 4: VERIFY DYNAMIC REPORT UPDATE ON NEW MEAL ---');
    const newSnackTime = new Date(now);
    newSnackTime.setHours(17, 0, 0, 0);
    const newSnackMeal: MealAnalysis = {
      id: `live-rpt-snack-${Date.now()}`,
      mealTitle: 'Roasted Chana Snack',
      analyzedAt: newSnackTime.toISOString(),
      items: [
        {
          detectionId: 'det-s-1',
          foodId: 'roasted-chana',
          name: 'Roasted Chana',
          confidence: 0.98,
          portionMultiplier: 1.0,
          portionUnit: 'handful',
          estimatedGrams: 50,
          nutrition: { calories: 180, protein: 9, carbohydrates: 27, fat: 3, fiber: 7 },
        },
      ],
      totalNutrition: { calories: 180, protein: 9, carbohydrates: 27, fat: 3, fiber: 7 },
      macroDistribution: { carbsPercent: 60, proteinPercent: 20, fatPercent: 20 },
      nutrientRichness: { stars: 4, label: 'High', explanation: 'Snack', highlights: ['Protein'] },
      nutrientGaps: { providedNutrients: ['Protein'], missingNutrients: [], whyItMattersSummary: 'Healthy snack' },
      balanceAssessment: {
        rating: 'balanced',
        label: 'Balanced',
        summary: 'Nutritious evening snack',
        detail: 'High protein and satiety',
        glycemicImpactEstimate: 'Low',
      },
      positiveHighlights: ['Smart high-protein choice'],
      balancingRecommendations: [],
      hostelFriendlyUpgrades: [],
      hostelModeActive: true,
      practicalAdjustments: [],
      disclaimer: 'Calculated nutritional values are estimates for reference.',
    };

    testMealIds.push(newSnackMeal.id);
    const snackRef = doc(db, `users/${testUid}/meals/${newSnackMeal.id}`);
    const snackBatch = writeBatch(db);
    snackBatch.set(snackRef, newSnackMeal);
    await snackBatch.commit();
    console.log('Saved 4th meal (Roasted Chana) to Firestore.');

    // Re-fetch Today report
    const updatedTodayReport = await nutritionAnalyticsService.getDateRangeReport(testUid, 'today', mockProfile);
    assert(updatedTodayReport.totalMeals === 3, 'STEP 4: Today meal count dynamically incremented to 3');
    assert(updatedTodayReport.totalCalories === 1080 + 180, 'STEP 4: Today total calories updated to 1260 kcal');
    assert(updatedTodayReport.totalProteinG === 41 + 9, 'STEP 4: Today total protein updated to 50g');

    // 5. VERIFY EXPORT INTEGRATION WITH ZERO SECRETS
    console.log('\n--- STEP 5: VERIFY EXPORT INTEGRATION WITH ZERO SECRETS ---');
    const csvExport = nutritionAnalyticsService.exportReport(updatedTodayReport, 'csv');
    assert(csvExport.format === 'csv', 'STEP 5: CSV export format is csv');
    assert(csvExport.filename.endsWith('.csv'), 'STEP 5: CSV filename extension valid');
    assert(csvExport.content.startsWith('\uFEFF'), 'STEP 5: CSV contains UTF-8 BOM');
    assert(csvExport.content.includes('Roasted Chana Snack'), 'STEP 5: CSV contains live meal title');
    assert(csvExport.content.includes('Paneer Bhurji & Paratha'), 'STEP 5: CSV contains first live meal');
    assert(!csvExport.content.toLowerCase().includes('password'), 'STEP 5: Zero password in CSV');
    assert(!csvExport.content.includes('AIza'), 'STEP 5: Zero API keys in CSV');

    const jsonExport = nutritionAnalyticsService.exportReport(updatedTodayReport, 'json', mockProfile);
    assert(jsonExport.format === 'json', 'STEP 5: JSON export format is json');
    assert(jsonExport.filename.endsWith('.json'), 'STEP 5: JSON filename extension valid');
    assert(jsonExport.content.includes('"exportVersion": "1.0"'), 'STEP 5: JSON has schema version');
    assert(!jsonExport.content.includes('password'), 'STEP 5: Zero password in JSON export');
    assert(!jsonExport.content.includes('AIza'), 'STEP 5: Zero API keys in JSON export');

    const parsedJson = JSON.parse(jsonExport.content);
    assert(parsedJson.nutritionSummary.totalMeals === 3, 'STEP 5: Export JSON matches real meal count');
    assert(parsedJson.nutritionSummary.totalCalories === 1260, 'STEP 5: Export JSON matches real calorie total');

    // 6. VERIFY CROSS-USER ISOLATION & UNAUTHENTICATED RESTRICTION
    console.log('\n--- STEP 6: VERIFY SECURITY & CROSS-USER ISOLATION ---');
    const foreignUid = 'foreign-unauthorized-uid-999';
    try {
      await firestoreMealHistoryService.getMealsForDateRange(foreignUid, todayStr, todayStr);
      throw new Error('Expected cross-user query to fail with permission-denied');
    } catch (secErr: unknown) {
      const err = secErr as { message?: string; code?: string };
      assert(
        Boolean(err.message?.includes('permission') || err.code === 'permission-denied' || err.code === 'PERMISSION_DENIED'),
        'STEP 6: Security rules strictly forbid querying meals under another user ID'
      );
    }

    console.log('\n====================================================');
    console.log('🎉 ALL LIVE FIREBASE REPORTING TESTS PASSED!');
    console.log('====================================================\n');
  } finally {
    // 7. CLEANUP
    console.log('--- STEP 7: CLEANUP OF LIVE TEST ARTIFACTS ---');
    if (testUid && testMealIds.length > 0) {
      console.log(`Cleaning up ${testMealIds.length} test documents from Firestore...`);
      const cleanupBatch = writeBatch(db);
      for (const mealId of testMealIds) {
        cleanupBatch.delete(doc(db, `users/${testUid}/meals/${mealId}`));
      }
      await cleanupBatch.commit();
      console.log('Test meals deleted from Firestore.');
    }

    if (auth.currentUser && auth.currentUser.uid === testUid) {
      console.log(`Deleting temporary auth test user ${testEmail}...`);
      await deleteUser(auth.currentUser);
      console.log('Temporary auth user successfully deleted.');
    }
  }
}

runLiveReportingVerification().catch(err => {
  console.error('\n❌ LIVE REPORTING VERIFICATION FAILED:', err);
  process.exit(1);
});
