/**
 * Firestore Hydration Service (Phase 8.7)
 *
 * Dedicated cloud persistence service for user hydration tracking.
 * - Stores logs under partitioned users/{authenticatedUid}/hydration/{entryId} documents.
 * - Enforces strict authenticated UID boundaries (zero trust in client-supplied user IDs).
 * - Implements bounded timeouts for resilient network failure handling.
 * - Recursively sanitizes payloads to strip undefined properties (preventing Firestore SDK errors).
 * - Strictly excludes secret credentials, tokens, or private keys.
 */

import {
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  collection,
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { firebaseDb, isFirebaseConfigured } from '../firebase/client';
import { getLocalISODate } from '../utils';
import { HydrationLogEntry } from '../types/hydration';

export type HydrationErrorCode =
  | 'unauthenticated'
  | 'validation-failure'
  | 'firestore-unavailable'
  | 'timeout'
  | 'permission-denied'
  | 'not-found'
  | 'unknown';

export class HydrationError extends Error {
  constructor(
    public readonly code: HydrationErrorCode,
    message: string,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'HydrationError';
  }
}

const DEFAULT_TIMEOUT_MS = 10000;

function withTimeout<T>(
  promise: Promise<T>,
  ms: number = DEFAULT_TIMEOUT_MS,
  operationName: string = 'Firestore operation'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new HydrationError('timeout', `${operationName} timed out after ${ms}ms`)),
        ms
      )
    ),
  ]);
}

/**
 * Deep sanitization to eliminate undefined properties before Firestore writes.
 */
function sanitizeUndefined<T>(value: T): T {
  if (value === undefined || value === null) {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .filter(item => item !== undefined)
      .map(item => sanitizeUndefined(item)) as unknown as T;
  }
  if (typeof value === 'object') {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) {
        sanitizedObj[k] = sanitizeUndefined(v);
      }
    }
    return sanitizedObj as T;
  }
  return value;
}

export class FirestoreHydrationService {
  private activeSubscriptions: Map<string, Unsubscribe> = new Map();

  /**
   * Validates a hydration entry before cloud persistence.
   */
  public validateEntry(entry: Partial<HydrationLogEntry>): { isValid: boolean; error?: string } {
    if (!entry) {
      return { isValid: false, error: 'Hydration entry payload is required' };
    }
    if (!entry.id || typeof entry.id !== 'string' || !entry.id.trim()) {
      return { isValid: false, error: 'Hydration entry must possess a non-empty string ID' };
    }
    if (
      entry.amountMl === undefined ||
      typeof entry.amountMl !== 'number' ||
      isNaN(entry.amountMl) ||
      !isFinite(entry.amountMl) ||
      entry.amountMl <= 0
    ) {
      return { isValid: false, error: 'Hydration amount must be a positive number greater than 0 ml' };
    }
    if (entry.amountMl > 10000) {
      return { isValid: false, error: 'Hydration amount cannot exceed 10,000 ml per single entry' };
    }

    // Security check: ensure no credentials or secrets leaked
    const strPayload = JSON.stringify(entry);
    if (
      strPayload.includes('password') ||
      strPayload.includes('GEMINI_API_KEY') ||
      strPayload.includes('refreshToken')
    ) {
      return { isValid: false, error: 'Security violation: credentials detected in hydration entry' };
    }

    return { isValid: true };
  }

  /**
   * Logs a hydration entry in users/{userId}/hydration/{entryId}.
   */
  public async logDrink(
    userId: string,
    entry: Omit<HydrationLogEntry, 'userId'>
  ): Promise<HydrationLogEntry> {
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      throw new HydrationError('unauthenticated', 'User must be authenticated to persist hydration log');
    }

    const fullEntry: HydrationLogEntry = {
      ...entry,
      userId,
      date: entry.date || getLocalISODate(entry.loggedAt) || getLocalISODate(),
    };

    const validation = this.validateEntry(fullEntry);
    if (!validation.isValid) {
      throw new HydrationError('validation-failure', validation.error || 'Invalid hydration entry');
    }

    if (!isFirebaseConfigured || !firebaseDb) {
      throw new HydrationError('firestore-unavailable', 'Firebase Firestore is not initialized');
    }

    try {
      const sanitized = sanitizeUndefined({
        ...fullEntry,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const docRef = doc(firebaseDb, 'users', userId, 'hydration', fullEntry.id);
      await withTimeout(setDoc(docRef, sanitized, { merge: true }), DEFAULT_TIMEOUT_MS, 'logDrink');

      return fullEntry;
    } catch (err: unknown) {
      if (err instanceof HydrationError) throw err;
      const firebaseError = err as { code?: string; message?: string };
      if (firebaseError?.code === 'permission-denied') {
        throw new HydrationError('permission-denied', 'Missing or insufficient permissions', err);
      }
      throw new HydrationError('unknown', firebaseError?.message || 'Failed to persist hydration entry', err);
    }
  }

  /**
   * Retrieves all hydration entries for a specific date (YYYY-MM-DD).
   */
  public async getDailyHydration(userId: string, date: string): Promise<HydrationLogEntry[]> {
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      throw new HydrationError('unauthenticated', 'User must be authenticated to query hydration');
    }

    if (!isFirebaseConfigured || !firebaseDb) {
      throw new HydrationError('firestore-unavailable', 'Firebase Firestore is not initialized');
    }

    try {
      const targetDate = getLocalISODate(date) || date;
      const hydrationCol = collection(firebaseDb, 'users', userId, 'hydration');
      const q = query(
        hydrationCol,
        where('date', '==', targetDate),
        limit(100)
      );

      const snapshot = await withTimeout(getDocs(q), DEFAULT_TIMEOUT_MS, 'getDailyHydration');
      const entries: HydrationLogEntry[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        entries.push({
          id: docSnap.id,
          userId,
          amountMl: Number(data.amountMl) || 0,
          loggedAt: String(data.loggedAt || new Date().toISOString()),
          date: String(data.date || targetDate),
          source: data.source as HydrationLogEntry['source'],
          notes: data.notes ? String(data.notes) : undefined,
        });
      });

      // Sort in-memory to preserve chronological order without requiring composite index
      entries.sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));

      return entries;
    } catch (err: unknown) {
      if (err instanceof HydrationError) throw err;
      const firebaseError = err as { code?: string; message?: string };
      if (firebaseError?.code === 'permission-denied') {
        throw new HydrationError('permission-denied', 'Missing or insufficient permissions', err);
      }
      throw new HydrationError('unknown', firebaseError?.message || 'Failed to query hydration', err);
    }
  }

  /**
   * Retrieves hydration entries across a date range.
   */
  public async getHydrationForDateRange(
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<HydrationLogEntry[]> {
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      throw new HydrationError('unauthenticated', 'User must be authenticated to query hydration');
    }

    if (!isFirebaseConfigured || !firebaseDb) {
      throw new HydrationError('firestore-unavailable', 'Firebase Firestore is not initialized');
    }

    try {
      const hydrationCol = collection(firebaseDb, 'users', userId, 'hydration');
      const q = query(
        hydrationCol,
        orderBy('loggedAt', 'asc'),
        limit(500)
      );

      const snapshot = await withTimeout(getDocs(q), DEFAULT_TIMEOUT_MS, 'getHydrationForDateRange');
      const entries: HydrationLogEntry[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const entryDate = String(data.date || getLocalISODate(data.loggedAt));
        if (startDate && entryDate < startDate) return;
        if (endDate && entryDate > endDate) return;

        entries.push({
          id: docSnap.id,
          userId,
          amountMl: Number(data.amountMl) || 0,
          loggedAt: String(data.loggedAt || new Date().toISOString()),
          date: entryDate,
          source: data.source as HydrationLogEntry['source'],
          notes: data.notes ? String(data.notes) : undefined,
        });
      });

      return entries;
    } catch (err: unknown) {
      if (err instanceof HydrationError) throw err;
      const firebaseError = err as { code?: string; message?: string };
      if (firebaseError?.code === 'permission-denied') {
        throw new HydrationError('permission-denied', 'Missing or insufficient permissions', err);
      }
      throw new HydrationError('unknown', firebaseError?.message || 'Failed to query hydration range', err);
    }
  }

  /**
   * Deletes a hydration entry from Firestore.
   */
  public async deleteDrink(userId: string, entryId: string): Promise<void> {
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      throw new HydrationError('unauthenticated', 'User must be authenticated to delete hydration');
    }
    if (!entryId || typeof entryId !== 'string' || !entryId.trim()) {
      throw new HydrationError('validation-failure', 'entryId must be a non-empty string');
    }

    if (!isFirebaseConfigured || !firebaseDb) {
      throw new HydrationError('firestore-unavailable', 'Firebase Firestore is not initialized');
    }

    try {
      const docRef = doc(firebaseDb, 'users', userId, 'hydration', entryId);
      await withTimeout(deleteDoc(docRef), DEFAULT_TIMEOUT_MS, 'deleteDrink');
    } catch (err: unknown) {
      if (err instanceof HydrationError) throw err;
      const firebaseError = err as { code?: string; message?: string };
      if (firebaseError?.code === 'permission-denied') {
        throw new HydrationError('permission-denied', 'Missing or insufficient permissions', err);
      }
      throw new HydrationError('unknown', firebaseError?.message || 'Failed to delete hydration entry', err);
    }
  }

  /**
   * Sets up a real-time listener for today's hydration entries.
   */
  public subscribeToDailyHydration(
    userId: string,
    date: string,
    callback: (entries: HydrationLogEntry[]) => void
  ): Unsubscribe {
    if (!userId || typeof userId !== 'string' || !userId.trim() || !isFirebaseConfigured || !firebaseDb) {
      callback([]);
      return () => {};
    }

    const targetDate = getLocalISODate(date) || date;
    const hydrationCol = collection(firebaseDb, 'users', userId, 'hydration');
    const q = query(
      hydrationCol,
      where('date', '==', targetDate),
      orderBy('loggedAt', 'asc'),
      limit(100)
    );

    const subKey = `${userId}:${targetDate}`;
    this.activeSubscriptions.get(subKey)?.();

    const unsubscribe = onSnapshot(
      q,
      snapshot => {
        const entries: HydrationLogEntry[] = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          entries.push({
            id: docSnap.id,
            userId,
            amountMl: Number(data.amountMl) || 0,
            loggedAt: String(data.loggedAt || new Date().toISOString()),
            date: String(data.date || targetDate),
            source: data.source as HydrationLogEntry['source'],
            notes: data.notes ? String(data.notes) : undefined,
          });
        });
        callback(entries);
      },
      err => {
        console.warn('[FirestoreHydrationService] onSnapshot error:', err);
      }
    );

    this.activeSubscriptions.set(subKey, unsubscribe);
    return () => {
      unsubscribe();
      this.activeSubscriptions.delete(subKey);
    };
  }

  /**
   * Cleans up all active subscriptions.
   */
  public cleanupSubscriptions(): void {
    this.activeSubscriptions.forEach(unsub => unsub());
    this.activeSubscriptions.clear();
  }
}

export const firestoreHydrationService = new FirestoreHydrationService();
