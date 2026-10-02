/**
 * Authentication Service (Phase 7.4)
 *
 * Unified facade delegating to firebaseAuthService.
 * Maintains complete backward compatibility for existing consumers.
 */

import {
  firebaseAuthService,
  FirebaseAuthService,
  mapFirebaseUserToAuthUser,
  signUp,
  signIn,
  signOut,
  getCurrentUser,
  subscribeToAuthState,
  sendPasswordReset,
  createUserDocument,
} from './firebaseAuthService';

export {
  firebaseAuthService,
  FirebaseAuthService,
  mapFirebaseUserToAuthUser,
  signUp,
  signIn,
  signOut,
  getCurrentUser,
  subscribeToAuthState,
  sendPasswordReset,
  createUserDocument,
};

// Aliased service singleton for existing callers
export const authService = firebaseAuthService;
export type AuthService = FirebaseAuthService;
