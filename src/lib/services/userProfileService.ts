'use client';

import { useSyncExternalStore } from 'react';
import { UserProfile, DEFAULT_USER_PROFILE, validateUserProfile } from '../types/profile';
import { AuthUser } from '../types/auth';
import { profileStorageService } from './profileStorageService';
import { firestoreProfileService } from './firestoreProfileService';
import { firebaseAuth, isFirebaseConfigured } from '../firebase/client';

export interface ProfileSaveResult {
  success: boolean;
  cloudSaved: boolean;
  profile: UserProfile;
  error?: string;
}

export class UserProfileService {
  private activeProfileUnsubscribe: (() => void) | null = null;
  private currentSyncedUid: string | null = null;

  public getProfile = (): UserProfile => {
    return profileStorageService.getProfile();
  };

  /**
   * Synchronous local save (backward compatibility).
   */
  public saveProfile = (profile: Partial<UserProfile>): UserProfile => {
    return profileStorageService.saveProfile(profile);
  };

  /**
   * Asynchronous profile save with Firestore cloud synchronization.
   * - Enforces authentication boundary: UID derived from authoritative session.
   * - Saves to Cloud Firestore first if authenticated.
   * - Updates local profile cache on success.
   * - Provides graceful local fallback with clear error feedback if cloud write fails.
   */
  public saveProfileWithCloud = async (
    profileUpdate: Partial<UserProfile>,
    authUser?: AuthUser | null
  ): Promise<ProfileSaveResult> => {
    // 1. Enforce strict authentication boundary
    const effectiveUid =
      authUser?.uid ||
      (isFirebaseConfigured && firebaseAuth ? firebaseAuth.currentUser?.uid : null) ||
      null;

    // 2. Validate update
    const current = this.getProfile();
    const merged: UserProfile = {
      ...current,
      ...profileUpdate,
      onboardingCompleted:
        profileUpdate.onboardingCompleted !== undefined
          ? profileUpdate.onboardingCompleted
          : current.onboardingCompleted,
    };

    const validation = validateUserProfile(merged);
    if (!validation.isValid || !validation.validatedProfile) {
      return {
        success: false,
        cloudSaved: false,
        profile: current,
        error: validation.errors.join(', '),
      };
    }

    const validated = validation.validatedProfile;

    // 3. If authenticated, persist to Cloud Firestore first
    if (effectiveUid) {
      try {
        const cloudSaved = await firestoreProfileService.upsertProfile(effectiveUid, validated, {
          email:
            authUser?.email ||
            (isFirebaseConfigured && firebaseAuth ? firebaseAuth.currentUser?.email : undefined),
          displayName:
            authUser?.displayName ||
            (isFirebaseConfigured && firebaseAuth ? firebaseAuth.currentUser?.displayName : undefined),
        });

        // Update local cache after successful Firestore write
        const localCached = profileStorageService.saveProfile(cloudSaved);
        return {
          success: true,
          cloudSaved: true,
          profile: localCached,
        };
      } catch (err: unknown) {
        const errorMessage = (err as Error)?.message || 'Cloud synchronization failed.';
        console.warn('[UserProfileService] Firestore write failed, using local cache fallback:', err);

        // Resilient local fallback
        const localCached = profileStorageService.saveProfile(validated);
        return {
          success: true,
          cloudSaved: false,
          profile: localCached,
          error: errorMessage,
        };
      }
    }

    // 4. Unauthenticated (Guest / Local-only)
    const localSaved = profileStorageService.saveProfile(validated);
    return {
      success: true,
      cloudSaved: false,
      profile: localSaved,
    };
  };

  /**
   * Synchronizes an authenticated user's profile between Cloud Firestore and local cache.
   * - Loads authoritative cloud profile if it exists.
   * - Migrates existing local completed profile if no cloud profile exists yet.
   * - Subscribes to real-time profile changes with clean teardown.
   */
  public syncAuthenticatedProfile = async (authUser: AuthUser): Promise<void> => {
    if (!authUser || !authUser.uid) return;

    // Avoid duplicate subscriptions for the same user
    if (this.currentSyncedUid === authUser.uid && this.activeProfileUnsubscribe) {
      return;
    }

    this.cleanupSubscription();
    this.currentSyncedUid = authUser.uid;

    try {
      // Step A: Load authoritative Firestore profile
      const cloudProfile = await firestoreProfileService.getProfile(authUser.uid);

      if (cloudProfile && cloudProfile.onboardingCompleted) {
        // Cloud profile is authoritative; update local cache
        profileStorageService.saveProfile(cloudProfile);
      } else {
        // Step B: Check for existing completed local profile from Phase 7.1 to migrate once
        const localProfile = profileStorageService.getProfile();
        if (localProfile && profileStorageService.hasCompletedOnboarding()) {
          try {
            await firestoreProfileService.upsertProfile(authUser.uid, localProfile, {
              email: authUser.email,
              displayName: authUser.displayName,
            });
            console.log('[UserProfileService] Successfully migrated local profile to Firestore for UID:', authUser.uid);
          } catch (migrateErr) {
            console.warn('[UserProfileService] Profile migration notice:', migrateErr);
          }
        } else if (cloudProfile) {
          // Cloud has partial profile; update local cache
          profileStorageService.saveProfile(cloudProfile);
        }
      }

      // Step C: Establish real-time subscription with proper teardown
      this.activeProfileUnsubscribe = firestoreProfileService.subscribeToProfile(
        authUser.uid,
        (updatedCloudProfile) => {
          if (updatedCloudProfile) {
            profileStorageService.saveProfile(updatedCloudProfile);
          }
        }
      );
    } catch (err) {
      console.warn('[UserProfileService] Error during profile synchronization:', err);
    }
  };

  /**
   * Cleans up any active real-time profile listeners.
   */
  public cleanupSubscription = (): void => {
    if (this.activeProfileUnsubscribe) {
      this.activeProfileUnsubscribe();
      this.activeProfileUnsubscribe = null;
    }
    this.currentSyncedUid = null;
  };

  public clearProfile = (): void => {
    this.cleanupSubscription();
    profileStorageService.clearProfile();
  };

  public hasCompletedOnboarding = (): boolean => {
    return profileStorageService.hasCompletedOnboarding();
  };

  public toggleHostelMode = (isHostelite?: boolean): UserProfile => {
    const current = this.getProfile();
    const nextVal = isHostelite !== undefined ? isHostelite : !current.isHostelite;
    return this.saveProfile({ isHostelite: nextVal });
  };

  public subscribe = (listener: (profile?: UserProfile) => void): (() => void) => {
    return profileStorageService.subscribe(listener);
  };
}

export const userProfileService = new UserProfileService();

// Stable snapshot references for SSR to ensure zero object allocations per call
const getServerProfileSnapshot = (): UserProfile => DEFAULT_USER_PROFILE;
const getServerOnboardingSnapshot = (): boolean => false;

/**
 * React hook to synchronize user profile state safely across components
 * without triggering cascading render or unstable snapshot warnings.
 */
export function useUserProfile(): UserProfile {
  return useSyncExternalStore(
    userProfileService.subscribe,
    userProfileService.getProfile,
    getServerProfileSnapshot
  );
}

/**
 * React hook to check whether onboarding has been completed.
 */
export function useHasCompletedOnboarding(): boolean {
  return useSyncExternalStore(
    userProfileService.subscribe,
    userProfileService.hasCompletedOnboarding,
    getServerOnboardingSnapshot
  );
}
