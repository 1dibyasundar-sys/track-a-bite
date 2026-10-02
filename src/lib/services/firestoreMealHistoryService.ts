/**
 * Firestore Meal History Service (Phase 8.1)
 *
 * Dedicated, encapsulated cloud persistence service for MealAnalysis records.
 * - Stores scans under partitioned users/{authenticatedUid}/meals/{mealId} documents.
 * - Enforces strict authenticated UID boundaries (zero trust in client-supplied user IDs).
 * - Implements bounded pagination using orderBy('analyzedAt', 'desc') and cursor-based startAfter.
 * - Normalizes Firestore timestamps to domain-standard ISO strings.
 * - Recursively sanitizes payloads to strip undefined properties (preventing Firestore SDK errors).
 * - Provides safe local-to-cloud migration without overwriting existing cloud records or erasing local data prematurely.
 * - Strictly excludes secret credentials, tokens, or private keys.
 * - Uses bounded timeouts for resilient offline / network failure handling.
 */

import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  collection,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  onSnapshot,
  type DocumentSnapshot,
  type QueryConstraint,
  type Unsubscribe,
} from 'firebase/firestore';
import { firebaseDb, isFirebaseConfigured } from '../firebase/client';
import { getLocalISODate } from '../utils';
import { MealAnalysis, DetectedFoodItem, BalancingRecommendation } from '../types/meal';
import {
  NutritionProfile,
  MacroDistribution,
  NutrientRichnessScore,
  NutrientGapAssessment,
  BalanceAssessment,
} from '../types/nutrition';

export type MealHistoryErrorCode =
  | 'unauthenticated'
  | 'validation-failure'
  | 'firestore-unavailable'
  | 'timeout'
  | 'permission-denied'
  | 'not-found'
  | 'unknown';

export class MealHistoryError extends Error {
  constructor(
    public readonly code: MealHistoryErrorCode,
    message: string,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'MealHistoryError';
  }
}

export interface FirestoreMealDocument {
  id: string;
  userId: string;
  mealTitle: string;
  analyzedAt: string;
  imagePreviewUrl?: string | null;
  items: unknown[];
  totalNutrition: NutritionProfile | Record<string, unknown>;
  macroDistribution: MacroDistribution | Record<string, unknown>;
  nutrientRichness: NutrientRichnessScore | Record<string, unknown>;
  nutrientGaps: NutrientGapAssessment | Record<string, unknown>;
  balanceAssessment: BalanceAssessment | Record<string, unknown>;
  positiveHighlights: string[];
  balancingRecommendations: unknown[];
  hostelFriendlyUpgrades: unknown[];
  hostelModeActive: boolean;
  practicalAdjustments: string[];
  disclaimer: string;
  analysis?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PaginatedMealsResult {
  meals: MealAnalysis[];
  lastDoc: DocumentSnapshot | null;
  hasMore: boolean;
}

/**
 * Standard page size for cursor-based analytics retrieval.
 * 50 documents per page provides an optimal balance between Firestore read batching,
 * memory consumption, and network round-trips.
 */
export const ANALYTICS_PAGE_SIZE = 50;

/**
 * Result of cursor-paginated date range meal retrieval.
 */
export interface PaginatedDateRangeResult {
  meals: MealAnalysis[];
  totalRecordsProcessed: number;
  pagesProcessed: number;
  complete: boolean;
}

export interface MealMigrationResult {
  migratedCount: number;
  skippedCount: number;
  errors: string[];
}

const FIRESTORE_TIMEOUT_MS = 6000;

/**
 * Wraps a promise with a safety timeout to prevent hanging on offline / unreachable networks.
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs = FIRESTORE_TIMEOUT_MS): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new MealHistoryError('timeout', `Firestore request timed out after ${timeoutMs}ms (backend offline or unreachable)`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Executes an operation with at most 1 bounded retry for transient network errors.
 * Never retries permanent errors (validation, permission-denied, unauthenticated).
 */
async function withBoundedRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries = 1,
  backoffMs = 300
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (err: unknown) {
      attempt++;
      const isTransient =
        err instanceof Error &&
        (err.message.includes('timed out') ||
         err.message.includes('unavailable') ||
         err.message.includes('network') ||
         err.message.includes('Name resolution failed'));

      if (attempt <= maxRetries && isTransient) {
        console.warn(`[FirestoreMealHistoryService] Transient notice during ${operationName}, retrying attempt ${attempt}/${maxRetries}...`);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Recursively sanitizes any payload for Firestore by omitting any undefined fields.
 * Firestore rejects documents containing undefined values.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return null as unknown as T;
  }
  if (Array.isArray(data)) {
    return data
      .filter(item => item !== undefined)
      .map(item => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object') {
    // Preserve Firestore FieldValue instances (serverTimestamp)
    const proto = Object.getPrototypeOf(data);
    if (proto && proto.constructor && proto.constructor.name === 'FieldValue') {
      return data;
    }
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (value !== undefined) {
        clean[key] = sanitizeForFirestore(value);
      }
    }
    return clean as unknown as T;
  }
  return data;
}

/**
 * Normalizes a raw Firestore date value (Timestamp, ISO string, or number) to ISO 8601 string.
 */
function normalizeDateToIso(rawDate: unknown): string {
  if (!rawDate) return new Date().toISOString();
  if (typeof rawDate === 'string') return rawDate;
  if (typeof rawDate === 'object' && rawDate !== null && 'toDate' in rawDate) {
    const timestamp = rawDate as { toDate: () => Date };
    return timestamp.toDate().toISOString();
  }
  if (typeof rawDate === 'number') {
    return new Date(rawDate).toISOString();
  }
  return new Date().toISOString();
}

/**
 * Maps raw Firestore document data back into the application's clean MealAnalysis domain model.
 */
export function mapDocToMeal(data: Record<string, unknown>, docId: string): MealAnalysis {
  return {
    id: (data.id as string) || docId,
    mealTitle: (data.mealTitle as string) || 'Analyzed Meal',
    analyzedAt: normalizeDateToIso(data.analyzedAt),
    imagePreviewUrl: (data.imagePreviewUrl as string) || undefined,
    items: (Array.isArray(data.items) ? data.items : []) as DetectedFoodItem[],
    totalNutrition: (data.totalNutrition as NutritionProfile) || {
      calories: 0,
      carbohydrates: 0,
      protein: 0,
      fat: 0,
      fiber: 0,
    },
    macroDistribution: (data.macroDistribution as MacroDistribution) || {
      carbsPercent: 0,
      proteinPercent: 0,
      fatPercent: 0,
    },
    nutrientRichness: (data.nutrientRichness as NutrientRichnessScore) || {
      stars: 1,
      score: 20,
      tier: 'needs-improvement',
      reasoning: [],
    },
    nutrientGaps: (data.nutrientGaps as NutrientGapAssessment) || {
      gaps: [],
      severity: 'moderate',
      recommendations: [],
    },
    balanceAssessment: (data.balanceAssessment as BalanceAssessment) || {
      status: 'unbalanced',
      summary: '',
      tips: [],
    },
    positiveHighlights: (Array.isArray(data.positiveHighlights)
      ? data.positiveHighlights
      : []) as string[],
    balancingRecommendations: (Array.isArray(data.balancingRecommendations)
      ? data.balancingRecommendations
      : []) as BalancingRecommendation[],
    hostelFriendlyUpgrades: (Array.isArray(data.hostelFriendlyUpgrades)
      ? data.hostelFriendlyUpgrades
      : []) as BalancingRecommendation[],
    hostelModeActive: Boolean(data.hostelModeActive),
    practicalAdjustments: (Array.isArray(data.practicalAdjustments)
      ? data.practicalAdjustments
      : []) as string[],
    disclaimer:
      (data.disclaimer as string) ||
      'Nutritional values are approximations based on visual estimation and reference databases.',
    analysis: data.analysis
      ? (data.analysis as import('../types/personalizedAnalysis').MealPersonalizedAnalysis)
      : undefined,
    source: (data.source as 'vision' | 'barcode') || 'vision',
    barcode: (data.barcode as string) || undefined,
    brand: (data.brand as string) || undefined,
    manufacturingDate: (data.manufacturingDate as string) || undefined,
    expiryDate: (data.expiryDate as string) || undefined,
    batchNumber: (data.batchNumber as string) || undefined,
    expiryStatus: (data.expiryStatus as import('../types/barcode').ExpiryStatus) || undefined,
    packageDetails: data.packageDetails ? (data.packageDetails as import('../types/barcode').PackageOcrResult) : undefined,
  };
}

/**
 * Validates a MealAnalysis object before writing to Firestore.
 */
export function validateMealForSave(meal: MealAnalysis): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!meal || typeof meal !== 'object') {
    errors.push('Meal object must be defined');
    return { isValid: false, errors };
  }

  if (!meal.id || typeof meal.id !== 'string' || meal.id.trim().length === 0) {
    errors.push('Meal ID must be a non-empty string');
  } else if (meal.id.includes('/') || meal.id.includes('..')) {
    errors.push('Meal ID must not contain slashes or path traversal characters');
  }

  if (!Array.isArray(meal.items)) {
    errors.push('Meal items must be an array');
  }

  if (!meal.totalNutrition || typeof meal.totalNutrition !== 'object') {
    errors.push('Meal totalNutrition must be defined');
  } else {
    if (typeof meal.totalNutrition.calories !== 'number' || isNaN(meal.totalNutrition.calories)) {
      errors.push('Total calories must be a valid number');
    } else if (meal.totalNutrition.calories < 0 || meal.totalNutrition.calories > 25000) {
      errors.push('Total calories must be a realistic non-negative number');
    }
  }

  // Security checks: ensure no secrets are attached to the meal payload
  const jsonStr = JSON.stringify(meal).toLowerCase();
  if (
    jsonStr.includes('api_key') ||
    jsonStr.includes('apikey') ||
    jsonStr.includes('secret') ||
    jsonStr.includes('password')
  ) {
    errors.push('Meal payload must not contain API keys, passwords, or security credentials');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Classifies an unknown error into a typed MealHistoryError.
 */
function classifyFirestoreError(err: unknown): MealHistoryError {
  if (err instanceof MealHistoryError) return err;

  const errMessage = err instanceof Error ? err.message : String(err);

  if (errMessage.includes('timed out')) {
    return new MealHistoryError('timeout', 'The cloud history request timed out. Please check your connection.', err);
  }
  if (errMessage.includes('permission-denied') || errMessage.includes('PERMISSION_DENIED')) {
    return new MealHistoryError('permission-denied', 'You do not have permission to access these meal records.', err);
  }
  if (errMessage.includes('unavailable') || errMessage.includes('offline')) {
    return new MealHistoryError('firestore-unavailable', 'Cloud database is currently offline or unreachable.', err);
  }
  if (errMessage.includes('not-found') || errMessage.includes('NOT_FOUND')) {
    return new MealHistoryError('not-found', 'The requested meal record was not found.', err);
  }
  return new MealHistoryError('unknown', 'An unexpected error occurred while communicating with cloud storage.', err);
}

/**
 * Dedicated Firestore Meal History Service
 */
export class FirestoreMealHistoryService {
  private activeSubscriptions = new Set<() => void>();

  /**
   * Persists a meal analysis to users/{uid}/meals/{mealId}.
   * Enforces the authenticated UID boundary and server timestamps.
   */
  public async saveMeal(uid: string, meal: MealAnalysis): Promise<MealAnalysis> {
    if (!uid || typeof uid !== 'string' || uid.trim().length === 0) {
      throw new MealHistoryError('unauthenticated', 'Authenticated UID is required for saving meal history.');
    }

    if (!isFirebaseConfigured || !firebaseDb) {
      throw new MealHistoryError('firestore-unavailable', 'Firebase Firestore is not configured.');
    }

    const validation = validateMealForSave(meal);
    if (!validation.isValid) {
      throw new MealHistoryError('validation-failure', `Meal validation failed: ${validation.errors.join(', ')}`);
    }

    try {
      const mealDocRef = doc(firebaseDb, 'users', uid, 'meals', meal.id);

      const payload: FirestoreMealDocument = {
        id: meal.id,
        userId: uid,
        mealTitle: meal.mealTitle || 'Analyzed Meal',
        analyzedAt: meal.analyzedAt || new Date().toISOString(),
        imagePreviewUrl: (() => {
          if (!meal.imagePreviewUrl) return null;
          // Ephemeral browser-memory object URLs cannot be accessed across devices or sessions
          if (meal.imagePreviewUrl.startsWith('blob:')) return null;
          // Guard against storing oversized base64 strings in Firestore documents (> 50KB)
          if (meal.imagePreviewUrl.length > 50000) return null;
          return meal.imagePreviewUrl;
        })(),
        items: sanitizeForFirestore(meal.items || []),
        totalNutrition: sanitizeForFirestore(meal.totalNutrition),
        macroDistribution: sanitizeForFirestore(meal.macroDistribution),
        nutrientRichness: sanitizeForFirestore(meal.nutrientRichness),
        nutrientGaps: sanitizeForFirestore(meal.nutrientGaps),
        balanceAssessment: sanitizeForFirestore(meal.balanceAssessment),
        positiveHighlights: sanitizeForFirestore(meal.positiveHighlights || []),
        balancingRecommendations: sanitizeForFirestore(meal.balancingRecommendations || []),
        hostelFriendlyUpgrades: sanitizeForFirestore(meal.hostelFriendlyUpgrades || []),
        hostelModeActive: Boolean(meal.hostelModeActive),
        practicalAdjustments: sanitizeForFirestore(meal.practicalAdjustments || []),
        disclaimer: meal.disclaimer || '',
        analysis: meal.analysis ? sanitizeForFirestore(meal.analysis) : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await withBoundedRetry(
        () => withTimeout(setDoc(mealDocRef, payload, { merge: true })),
        'saveMeal'
      );
      return meal;
    } catch (err) {
      throw classifyFirestoreError(err);
    }
  }

  /**
   * Retrieves a single meal by ID from users/{uid}/meals/{mealId}.
   */
  public async getMeal(uid: string, mealId: string): Promise<MealAnalysis | null> {
    if (!uid || typeof uid !== 'string' || uid.trim().length === 0) {
      throw new MealHistoryError('unauthenticated', 'Authenticated UID is required for reading meal history.');
    }

    if (!mealId || typeof mealId !== 'string' || mealId.trim().length === 0) {
      throw new MealHistoryError('validation-failure', 'Meal ID is required.');
    }

    if (!isFirebaseConfigured || !firebaseDb) {
      return null;
    }

    try {
      const mealDocRef = doc(firebaseDb, 'users', uid, 'meals', mealId);
      const snapshot = await withBoundedRetry(
        () => withTimeout(getDoc(mealDocRef)),
        'getMeal'
      );

      if (!snapshot.exists()) {
        return null;
      }

      return mapDocToMeal(snapshot.data() as Record<string, unknown>, snapshot.id);
    } catch (err) {
      console.warn(`[FirestoreMealHistoryService] getMeal failed for ${uid}/${mealId}:`, err);
      return null;
    }
  }

  /**
   * Retrieves recent meals for an authenticated user using bounded, cursor-based pagination.
   * Uses orderBy('analyzedAt', 'desc') with a configurable limit.
   */
  public async getRecentMeals(
    uid: string,
    limitCount = 20,
    lastVisibleDoc?: DocumentSnapshot
  ): Promise<PaginatedMealsResult> {
    if (!uid || typeof uid !== 'string' || uid.trim().length === 0) {
      throw new MealHistoryError('unauthenticated', 'Authenticated UID is required for reading meal history.');
    }

    if (!isFirebaseConfigured || !firebaseDb) {
      return { meals: [], lastDoc: null, hasMore: false };
    }

    const safeLimit = Math.max(1, Math.min(limitCount, 100));

    try {
      const mealsCollRef = collection(firebaseDb, 'users', uid, 'meals');

      let q = query(mealsCollRef, orderBy('analyzedAt', 'desc'), limit(safeLimit));

      if (lastVisibleDoc) {
        q = query(mealsCollRef, orderBy('analyzedAt', 'desc'), startAfter(lastVisibleDoc), limit(safeLimit));
      }

      const snapshot = await withBoundedRetry(
        () => withTimeout(getDocs(q)),
        'getRecentMeals'
      );

      const meals: MealAnalysis[] = snapshot.docs.map(docSnap =>
        mapDocToMeal(docSnap.data() as Record<string, unknown>, docSnap.id)
      );

      const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
      const hasMore = snapshot.docs.length === safeLimit;

      return {
        meals,
        lastDoc,
        hasMore,
      };
    } catch (err) {
      console.warn(`[FirestoreMealHistoryService] getRecentMeals failed for ${uid}:`, err);
      return { meals: [], lastDoc: null, hasMore: false };
    }
  }

  /**
   * Retrieves all meals for an authenticated user within an optional date range using
   * cursor-based pagination (startAfter) to traverse arbitrary document counts without
   * artificial limits (e.g. 100 meals).
   *
   * Constraints:
   * - Validates authenticated UID.
   * - Constrains query server-side by 'analyzedAt' with timezone-safe calendar padding (48h).
   * - Paginates in pages of ANALYTICS_PAGE_SIZE (50 docs per page).
   * - Traverses cursors sequentially (startAfter(lastVisibleDoc)).
   * - Detects and terminates on cursor repetition or empty pages.
   * - Enforces deduplication using a Set of meal IDs.
   * - Filters each meal against the local calendar date bounds (getLocalISODate).
   * - Returns complete: false if any page fails to prevent treating partial reads as complete.
   */
  public async getMealsForDateRange(
    uid: string,
    startDate?: string,
    endDate?: string,
    options?: {
      pageSize?: number;
      maxMeals?: number;
      maxPages?: number;
    }
  ): Promise<PaginatedDateRangeResult> {
    if (!uid || typeof uid !== 'string' || uid.trim().length === 0) {
      throw new MealHistoryError('unauthenticated', 'Authenticated UID is required for reading meal history.');
    }

    if (!isFirebaseConfigured || !firebaseDb) {
      return { meals: [], totalRecordsProcessed: 0, pagesProcessed: 0, complete: false };
    }

    const pageSize = Math.max(1, Math.min(options?.pageSize || ANALYTICS_PAGE_SIZE, 100));
    const maxPages = options?.maxPages || 200; // Default: up to 10,000 records
    const maxMeals = options?.maxMeals || Infinity;

    // Build base query constraints
    const baseConstraints: QueryConstraint[] = [];

    // Timezone padding: calculate UTC lower and upper bounds to cover any global timezone (UTC-12 to UTC+14)
    if (startDate && /^\d{4}-\d{2}-\d{2}/.test(startDate)) {
      const startPad = new Date(`${startDate.slice(0, 10)}T00:00:00.000Z`);
      if (!isNaN(startPad.getTime())) {
        startPad.setUTCDate(startPad.getUTCDate() - 2); // 48-hour buffer ensures any timezone's local day is captured
        baseConstraints.push(where('analyzedAt', '>=', startPad.toISOString()));
      }
    }

    if (endDate && /^\d{4}-\d{2}-\d{2}/.test(endDate)) {
      const endPad = new Date(`${endDate.slice(0, 10)}T23:59:59.999Z`);
      if (!isNaN(endPad.getTime())) {
        endPad.setUTCDate(endPad.getUTCDate() + 2); // 48-hour buffer ensures any timezone's local day is captured
        baseConstraints.push(where('analyzedAt', '<=', endPad.toISOString()));
      }
    }

    baseConstraints.push(orderBy('analyzedAt', 'desc'));

    const mealsCollRef = collection(firebaseDb, 'users', uid, 'meals');
    let lastVisibleDoc: DocumentSnapshot | undefined = undefined;
    let lastDocId: string | null = null;
    let pagesProcessed = 0;
    let totalRecordsProcessed = 0;
    const seenIds = new Set<string>();
    const collectedMeals: MealAnalysis[] = [];

    try {
      while (pagesProcessed < maxPages && collectedMeals.length < maxMeals) {
        const pageConstraints: QueryConstraint[] = [...baseConstraints];
        if (lastVisibleDoc) {
          pageConstraints.push(startAfter(lastVisibleDoc));
        }
        pageConstraints.push(limit(pageSize));

        const q = query(mealsCollRef, ...pageConstraints);

        const snapshot = await withBoundedRetry(
          () => withTimeout(getDocs(q)),
          'getMealsForDateRange'
        );

        pagesProcessed++;
        const docsCount = snapshot.docs.length;
        totalRecordsProcessed += docsCount;

        if (docsCount === 0) {
          break; // Exhausted all matching records
        }

        for (const docSnap of snapshot.docs) {
          const meal = mapDocToMeal(docSnap.data() as Record<string, unknown>, docSnap.id);
          const mealDate = getLocalISODate(meal.analyzedAt);

          const passesStart = !startDate || mealDate >= startDate;
          const passesEnd = !endDate || mealDate <= endDate;

          if (passesStart && passesEnd) {
            if (!seenIds.has(meal.id)) {
              seenIds.add(meal.id);
              collectedMeals.push(meal);
            }
          }

          if (collectedMeals.length >= maxMeals) {
            break;
          }
        }

        const currentLastDoc = snapshot.docs[docsCount - 1];
        if (!currentLastDoc || currentLastDoc.id === lastDocId) {
          // Safety guard: prevent infinite pagination loops
          break;
        }

        lastDocId = currentLastDoc.id;
        lastVisibleDoc = currentLastDoc;

        if (docsCount < pageSize) {
          // Reached last page of data
          break;
        }
      }
    } catch (err) {
      console.warn(`[FirestoreMealHistoryService] getMealsForDateRange failed for ${uid} on page ${pagesProcessed}:`, err);
      // Never silently present incomplete analytics as complete cloud analytics
      return {
        meals: [],
        totalRecordsProcessed,
        pagesProcessed,
        complete: false,
      };
    }

    return {
      meals: collectedMeals,
      totalRecordsProcessed,
      pagesProcessed,
      complete: true,
    };
  }

  /**
   * Deletes a meal from users/{uid}/meals/{mealId}.
   */
  public async deleteMeal(uid: string, mealId: string): Promise<void> {
    if (!uid || typeof uid !== 'string' || uid.trim().length === 0) {
      throw new MealHistoryError('unauthenticated', 'Authenticated UID is required for deleting meal history.');
    }

    if (!mealId || typeof mealId !== 'string' || mealId.trim().length === 0) {
      throw new MealHistoryError('validation-failure', 'Meal ID is required.');
    }

    if (!isFirebaseConfigured || !firebaseDb) {
      throw new MealHistoryError('firestore-unavailable', 'Firebase Firestore is not configured.');
    }

    try {
      const mealDocRef = doc(firebaseDb, 'users', uid, 'meals', mealId);
      await withBoundedRetry(
        () => withTimeout(deleteDoc(mealDocRef)),
        'deleteMeal'
      );
    } catch (err) {
      throw classifyFirestoreError(err);
    }
  }

  /**
   * Subscribes to real-time changes on recent meals for an authenticated user.
   * Returns a clean teardown function to prevent listener leaks.
   */
  public subscribeToRecentMeals(
    uid: string,
    callback: (meals: MealAnalysis[]) => void,
    limitCount = 20
  ): Unsubscribe {
    if (!uid || !isFirebaseConfigured || !firebaseDb) {
      callback([]);
      return () => {};
    }

    const safeLimit = Math.max(1, Math.min(limitCount, 100));
    const mealsCollRef = collection(firebaseDb, 'users', uid, 'meals');
    const q = query(mealsCollRef, orderBy('analyzedAt', 'desc'), limit(safeLimit));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const meals = snapshot.docs.map(docSnap =>
          mapDocToMeal(docSnap.data() as Record<string, unknown>, docSnap.id)
        );
        callback(meals);
      },
      (error) => {
        console.warn(`[FirestoreMealHistoryService] Snapshot error on ${uid}:`, error);
      }
    );

    const wrappedUnsub = () => {
      this.activeSubscriptions.delete(wrappedUnsub);
      unsubscribe();
    };
    this.activeSubscriptions.add(wrappedUnsub);
    return wrappedUnsub;
  }

  /**
   * Cleans up all active subscriptions registered with this service instance.
   */
  public cleanupSubscriptions(): void {
    for (const unsub of this.activeSubscriptions) {
      try {
        unsub();
      } catch {
        // Safe teardown
      }
    }
    this.activeSubscriptions.clear();
  }

  /**
   * Migrates valid local scans to users/{uid}/meals.
   * Safe migration principles:
   * - Migrates only completed valid local scans.
   * - Enforces authenticated UID.
   * - Checks whether the cloud record already exists: never overwrites existing cloud records.
   * - Does NOT delete local data until confirmed by the caller.
   */
  public async migrateLocalMeals(
    uid: string,
    localMeals: MealAnalysis[]
  ): Promise<MealMigrationResult> {
    if (!uid || typeof uid !== 'string' || uid.trim().length === 0) {
      throw new MealHistoryError('unauthenticated', 'Authenticated UID is required for meal migration.');
    }

    if (!isFirebaseConfigured || !firebaseDb) {
      return {
        migratedCount: 0,
        skippedCount: localMeals.length,
        errors: ['Firebase Firestore is not configured.'],
      };
    }

    let migratedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const meal of localMeals) {
      const validation = validateMealForSave(meal);
      if (!validation.isValid) {
        skippedCount++;
        continue;
      }

      try {
        const mealDocRef = doc(firebaseDb, 'users', uid, 'meals', meal.id);
        const existingSnap = await withTimeout(getDoc(mealDocRef));

        if (existingSnap.exists()) {
          // Cloud record already exists: skip to prevent overwriting with stale local data
          skippedCount++;
          continue;
        }

        // Upload to cloud
        await this.saveMeal(uid, meal);
        migratedCount++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`Failed to migrate meal ${meal.id}: ${message}`);
        skippedCount++;
      }
    }

    return {
      migratedCount,
      skippedCount,
      errors,
    };
  }
}

export const firestoreMealHistoryService = new FirestoreMealHistoryService();
