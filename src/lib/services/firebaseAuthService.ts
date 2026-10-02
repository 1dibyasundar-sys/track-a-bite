/**
 * Firebase Authentication Service (Phase 7.4)
 *
 * Encapsulated service for Firebase Authentication modular APIs:
 * - signUp (createUserWithEmailAndPassword + updateProfile + user doc preparation)
 * - signIn (signInWithEmailAndPassword)
 * - signOut (signOut)
 * - getCurrentUser
 * - subscribeToAuthState (onAuthStateChanged)
 * - sendPasswordReset (sendPasswordResetEmail)
 * - createUserDocument (Firestore users/{uid} document initialization)
 *
 * Security & Data Integrity:
 * - Normalizes Firebase User objects to clean application AuthUser models.
 * - Centralizes friendly error mapping.
 * - Zero local storage of passwords or auth tokens.
 * - Derives user document UID strictly from authenticated credential (never client-provided).
 * - Prepares users/{uid} in Firestore with serverTimestamp().
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { firebaseAuth, firebaseDb, isFirebaseConfigured } from '../firebase/client';
import {
  AuthUser,
  AuthActionResult,
  mapAuthErrorCode,
  FirestoreUserDocument,
} from '../types/auth';

/**
 * Maps a raw Firebase User instance to the clean application AuthUser domain model.
 */
export function mapFirebaseUserToAuthUser(user: User): AuthUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };
}

/**
 * Initializes or updates the application user profile document at users/{uid} in Firestore.
 * - Architecture prepared for Phase 7 (Firestore User Document)
 * - Security (Phase 9): Derives UID strictly from authoritative authenticated credential
 * - Uses server timestamps for createdAt / updatedAt
 * - Zero password or sensitive key storage
 */
export async function createUserDocument(
  uid: string,
  data: {
    email: string | null;
    displayName?: string | null;
    onboardingCompleted?: boolean;
  }
): Promise<void> {
  if (!isFirebaseConfigured || !firebaseDb) return;

  try {
    const userDocRef = doc(firebaseDb, 'users', uid);
    const docData: Partial<FirestoreUserDocument> = {
      uid,
      email: data.email,
      displayName: data.displayName || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      onboardingCompleted: data.onboardingCompleted ?? false,
    };

    await setDoc(userDocRef, docData, { merge: true });
  } catch (err) {
    // Non-fatal warning if Firestore write fails (e.g. offline during dev or rules pending)
    console.warn('[FirebaseAuthService] Firestore user document preparation notice:', err);
  }
}

/**
 * Registers a new user with email and password using Firebase Authentication.
 * - Generates authoritative Firebase UID
 * - Updates display name if provided
 * - Prepares users/{uid} document in Firestore
 */
export async function signUp(
  email: string,
  password: string,
  displayName?: string
): Promise<AuthActionResult> {
  if (!isFirebaseConfigured || !firebaseAuth) {
    return {
      success: false,
      error: 'Firebase authentication is not configured in this environment.',
    };
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(
      firebaseAuth,
      email.trim(),
      password
    );

    if (displayName && displayName.trim()) {
      try {
        await updateProfile(userCredential.user, { displayName: displayName.trim() });
      } catch {
        // Non-fatal if profile update fails right after account creation
      }
    }

    const appUser = mapFirebaseUserToAuthUser(userCredential.user);

    // Prepare Firestore user profile document (Phase 7)
    await createUserDocument(userCredential.user.uid, {
      email: appUser.email,
      displayName: appUser.displayName,
      onboardingCompleted: false,
    });

    return {
      success: true,
      user: appUser,
    };
  } catch (err: unknown) {
    const firebaseError = err as { code?: string; message?: string };
    return {
      success: false,
      error: mapAuthErrorCode(firebaseError.code || firebaseError.message),
    };
  }
}

/**
 * Signs in an existing user with email and password using Firebase Authentication.
 */
export async function signIn(
  email: string,
  password: string
): Promise<AuthActionResult> {
  if (!isFirebaseConfigured || !firebaseAuth) {
    return {
      success: false,
      error: 'Firebase authentication is not configured in this environment.',
    };
  }

  try {
    const userCredential = await signInWithEmailAndPassword(
      firebaseAuth,
      email.trim(),
      password
    );

    return {
      success: true,
      user: mapFirebaseUserToAuthUser(userCredential.user),
    };
  } catch (err: unknown) {
    const firebaseError = err as { code?: string; message?: string };
    return {
      success: false,
      error: mapAuthErrorCode(firebaseError.code || firebaseError.message),
    };
  }
}

/**
 * Signs out the currently authenticated Firebase user.
 */
export async function signOut(): Promise<void> {
  if (!isFirebaseConfigured || !firebaseAuth) return;

  try {
    await firebaseSignOut(firebaseAuth);
  } catch (err) {
    console.warn('[FirebaseAuthService] Error during sign out:', err);
  }
}

/**
 * Returns the currently active AuthUser synchronously if available.
 */
export function getCurrentUser(): AuthUser | null {
  if (!isFirebaseConfigured || !firebaseAuth || !firebaseAuth.currentUser) {
    return null;
  }
  return mapFirebaseUserToAuthUser(firebaseAuth.currentUser);
}

/**
 * Subscribes to Firebase Authentication state changes.
 * Invokes the callback with an AuthUser or null when the session state updates.
 */
export function subscribeToAuthState(
  callback: (user: AuthUser | null) => void
): () => void {
  if (!isFirebaseConfigured || !firebaseAuth) {
    callback(null);
    return () => {};
  }

  return onAuthStateChanged(
    firebaseAuth,
    (user: User | null) => {
      if (user) {
        callback(mapFirebaseUserToAuthUser(user));
      } else {
        callback(null);
      }
    },
    (error) => {
      console.warn('[FirebaseAuthService] Auth state change error:', error);
      callback(null);
    }
  );
}

/**
 * Dispatches a password reset email via Firebase Authentication.
 */
export async function sendPasswordReset(email: string): Promise<AuthActionResult> {
  if (!isFirebaseConfigured || !firebaseAuth) {
    return {
      success: false,
      error: 'Firebase authentication is not configured in this environment.',
    };
  }

  try {
    await sendPasswordResetEmail(firebaseAuth, email.trim());
    return { success: true };
  } catch (err: unknown) {
    const firebaseError = err as { code?: string; message?: string };
    return {
      success: false,
      error: mapAuthErrorCode(firebaseError.code || firebaseError.message),
    };
  }
}

/**
 * Service class for object-oriented consumers and backward compatibility.
 */
export class FirebaseAuthService {
  public isConfigured(): boolean {
    return isFirebaseConfigured && firebaseAuth !== null;
  }

  public signUp = signUp;
  public signIn = signIn;
  public signOut = signOut;
  public getCurrentUser = getCurrentUser;
  public subscribeToAuthState = subscribeToAuthState;
  public sendPasswordReset = sendPasswordReset;
  public createUserDocument = createUserDocument;

  // Compatibility aliases
  public registerUser = signUp;
  public loginUser = signIn;
  public logoutUser = signOut;
  public resetPassword = sendPasswordReset;
}

export const firebaseAuthService = new FirebaseAuthService();
