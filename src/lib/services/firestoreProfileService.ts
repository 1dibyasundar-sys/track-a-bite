/**
 * Firestore Profile Service (Phase 7.5)
 *
 * Dedicated, encapsulated cloud persistence service for UserProfile.
 * - Manages canonical users/{uid} documents in Cloud Firestore.
 * - Normalizes Firestore documents to the application's clean UserProfile model.
 * - Strict authentication boundary: enforces operations on authoritative UID only.
 * - Validates all profiles prior to write using canonical validateUserProfile.
 * - Uses serverTimestamp() for createdAt / updatedAt.
 * - Zero storage of secret credentials, tokens, or private keys.
 * - Bounded timeouts for resilient offline / network failure handling.
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { firebaseDb, isFirebaseConfigured } from '../firebase/client';
import {
  UserProfile,
  DEFAULT_USER_PROFILE,
  validateUserProfile,
} from '../types/profile';

export interface FirestoreUserProfileEnvelope {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  profile: Record<string, unknown>;
  createdAt?: unknown;
  updatedAt?: unknown;
}

const FIRESTORE_TIMEOUT_MS = 6000;

/**
 * Wraps a promise with a safety timeout to prevent hanging on offline / unreachable networks.
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs = FIRESTORE_TIMEOUT_MS): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Firestore request timed out after ${timeoutMs}ms (backend offline or API not initialized)`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Sanitizes a UserProfile object for Firestore by omitting any undefined fields.
 * Firestore rejects documents containing undefined values.
 */
function sanitizeProfileForFirestore(profile: UserProfile): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(profile)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Extracts and validates a UserProfile from raw Firestore document data.
 */
function extractProfileFromDoc(data: Record<string, unknown> | undefined): UserProfile | null {
  if (!data || typeof data !== 'object') return null;

  // Canonical nested format: { uid, profile: { ...UserProfile } }
  if (data.profile && typeof data.profile === 'object') {
    const validation = validateUserProfile(data.profile as Partial<UserProfile>);
    return validation.isValid && validation.validatedProfile
      ? validation.validatedProfile
      : (data.profile as UserProfile);
  }

  // Fallback legacy flat format
  const flatValidation = validateUserProfile(data as Partial<UserProfile>);
  if (flatValidation.isValid && flatValidation.validatedProfile) {
    return flatValidation.validatedProfile;
  }

  return null;
}

/**
 * Dedicated Firestore Profile Service
 */
export class FirestoreProfileService {
  /**
   * Retrieves the authoritative UserProfile for the given UID from Firestore.
   */
  public async getProfile(uid: string): Promise<UserProfile | null> {
    if (!uid || !isFirebaseConfigured || !firebaseDb) {
      return null;
    }

    try {
      const userDocRef = doc(firebaseDb, 'users', uid);
      const snapshot = await withTimeout(getDoc(userDocRef));

      if (!snapshot.exists()) {
        return null;
      }

      return extractProfileFromDoc(snapshot.data());
    } catch (err) {
      console.warn(`[FirestoreProfileService] getProfile failed for ${uid}:`, err);
      return null;
    }
  }

  /**
   * Creates a new profile document at users/{uid}.
   */
  public async createProfile(
    uid: string,
    profile: UserProfile,
    meta?: { email?: string | null; displayName?: string | null }
  ): Promise<UserProfile> {
    if (!uid) throw new Error('Cannot create profile: Authenticated UID is required.');
    if (!isFirebaseConfigured || !firebaseDb) {
      throw new Error('Firebase Firestore is not configured.');
    }

    const validation = validateUserProfile(profile);
    if (!validation.isValid || !validation.validatedProfile) {
      throw new Error(`Profile validation failed: ${validation.errors.join(', ')}`);
    }

    const validProfile = validation.validatedProfile;
    const userDocRef = doc(firebaseDb, 'users', uid);

    const docPayload: FirestoreUserProfileEnvelope = {
      uid,
      email: meta?.email || null,
      displayName: meta?.displayName || null,
      profile: sanitizeProfileForFirestore(validProfile),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await withTimeout(setDoc(userDocRef, docPayload));
    return validProfile;
  }

  /**
   * Updates existing profile fields at users/{uid}.
   */
  public async updateProfile(
    uid: string,
    profileUpdate: Partial<UserProfile>
  ): Promise<UserProfile> {
    if (!uid) throw new Error('Cannot update profile: Authenticated UID is required.');
    if (!isFirebaseConfigured || !firebaseDb) {
      throw new Error('Firebase Firestore is not configured.');
    }

    // Merge with current profile to ensure total validity
    const current = await this.getProfile(uid);
    const merged = { ...(current || DEFAULT_USER_PROFILE), ...profileUpdate };

    const validation = validateUserProfile(merged);
    if (!validation.isValid || !validation.validatedProfile) {
      throw new Error(`Profile validation failed: ${validation.errors.join(', ')}`);
    }

    const validProfile = validation.validatedProfile;
    const userDocRef = doc(firebaseDb, 'users', uid);

    await withTimeout(
      updateDoc(userDocRef, {
        profile: sanitizeProfileForFirestore(validProfile),
        updatedAt: serverTimestamp(),
      })
    );

    return validProfile;
  }

  /**
   * Upserts the profile at users/{uid} (creates or merges if exists).
   * Safe for onboarding completion, profile edits, and local-to-cloud migrations.
   */
  public async upsertProfile(
    uid: string,
    profile: Partial<UserProfile>,
    meta?: { email?: string | null; displayName?: string | null }
  ): Promise<UserProfile> {
    if (!uid) throw new Error('Cannot upsert profile: Authenticated UID is required.');
    if (!isFirebaseConfigured || !firebaseDb) {
      throw new Error('Firebase Firestore is not configured.');
    }

    const current = (await this.getProfile(uid)) || DEFAULT_USER_PROFILE;
    const merged: UserProfile = {
      ...current,
      ...profile,
      onboardingCompleted:
        profile.onboardingCompleted !== undefined
          ? profile.onboardingCompleted
          : current.onboardingCompleted,
    };

    const validation = validateUserProfile(merged);
    if (!validation.isValid || !validation.validatedProfile) {
      throw new Error(`Profile validation failed: ${validation.errors.join(', ')}`);
    }

    const validProfile = validation.validatedProfile;
    const userDocRef = doc(firebaseDb, 'users', uid);

    const docPayload: Record<string, unknown> = {
      uid,
      profile: sanitizeProfileForFirestore(validProfile),
      updatedAt: serverTimestamp(),
    };

    if (meta?.email !== undefined) docPayload.email = meta.email;
    if (meta?.displayName !== undefined) docPayload.displayName = meta.displayName;

    // Use setDoc with merge: true
    await withTimeout(setDoc(userDocRef, docPayload, { merge: true }));
    return validProfile;
  }

  /**
   * Subscribes to real-time changes on the user's Firestore profile.
   * Returns a clean teardown function to prevent listener leaks.
   */
  public subscribeToProfile(
    uid: string,
    callback: (profile: UserProfile | null) => void
  ): Unsubscribe {
    if (!uid || !isFirebaseConfigured || !firebaseDb) {
      callback(null);
      return () => {};
    }

    const userDocRef = doc(firebaseDb, 'users', uid);

    const unsubscribe = onSnapshot(
      userDocRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          callback(null);
          return;
        }
        const profile = extractProfileFromDoc(snapshot.data());
        callback(profile);
      },
      (error) => {
        console.warn(`[FirestoreProfileService] Snapshot error on ${uid}:`, error);
      }
    );

    return unsubscribe;
  }
}

export const firestoreProfileService = new FirestoreProfileService();
