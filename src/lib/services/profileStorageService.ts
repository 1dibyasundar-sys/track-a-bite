/**
 * Profile Storage Service (Phase 7.1)
 *
 * Encapsulated, typed, versioned client-side storage for UserProfile.
 * - Schema versioned for safe future migrations
 * - SSR-safe (guards against 'localStorage is not defined')
 * - Corrupted payload recovery (clears bad JSON, reverts to safe fallback)
 * - Zero raw localStorage scattered in UI components
 */

import { UserProfile, DEFAULT_USER_PROFILE, validateUserProfile, ProfileValidationResult } from '../types/profile';

export const CURRENT_PROFILE_SCHEMA_VERSION = 1;
export const PROFILE_STORAGE_KEY = 'track_a_bite_user_profile_v1';
export const LEGACY_PROFILE_STORAGE_KEY = 'track_a_bite_user_profile';
export const PROFILE_STORAGE_EVENT = 'track_a_bite_profile_storage_change';

export interface StoredProfileEnvelope {
  version: number;
  profile: UserProfile;
  updatedAt: string;
}

export class ProfileStorageService {
  private schemaVersion = CURRENT_PROFILE_SCHEMA_VERSION;
  private currentProfile: UserProfile = { ...DEFAULT_USER_PROFILE };
  private isHydrated = false;
  private lastRawString: string | null | undefined = undefined;
  private listeners = new Set<(profile?: UserProfile) => void>();

  constructor() {
    this.initStorageListener();
  }

  /**
   * Initializes window storage event listeners to sync multi-tab or external changes.
   */
  private initStorageListener(): void {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;

    const handleExternalChange = () => {
      const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
      if (raw !== this.lastRawString) {
        this.hydrate();
        this.notifySubscribers();
      }
    };

    window.addEventListener('storage', handleExternalChange);
    window.addEventListener(PROFILE_STORAGE_EVENT, handleExternalChange);
  }

  /**
   * Checks if window/localStorage is safely accessible in the current execution environment.
   */
  private isStorageAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      const testKey = '__trackabite_storage_test__';
      window.localStorage.setItem(testKey, testKey);
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Hydrates the in-memory profile from localStorage exactly once or when raw data changes.
   */
  private hydrate(): void {
    if (!this.isStorageAvailable()) {
      this.currentProfile = DEFAULT_USER_PROFILE;
      this.isHydrated = true;
      return;
    }

    try {
      // 1. Check primary versioned key
      const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
      this.lastRawString = raw;

      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.version && parsed.profile) {
          const validation = validateUserProfile(parsed.profile);
          if (validation.isValid && validation.validatedProfile) {
            this.currentProfile = validation.validatedProfile;
          } else {
            this.currentProfile = {
              ...DEFAULT_USER_PROFILE,
              ...parsed.profile,
            };
          }
          this.isHydrated = true;
          return;
        }
      }

      // 2. Check legacy unversioned key for seamless migration
      const legacyRaw = window.localStorage.getItem(LEGACY_PROFILE_STORAGE_KEY);
      if (legacyRaw) {
        const legacyParsed = JSON.parse(legacyRaw);
        if (legacyParsed && typeof legacyParsed === 'object') {
          const migratedProfile: UserProfile = {
            ...DEFAULT_USER_PROFILE,
            ...legacyParsed,
          };
          this.currentProfile = migratedProfile;
          const envelope: StoredProfileEnvelope = {
            version: this.schemaVersion,
            profile: migratedProfile,
            updatedAt: new Date().toISOString(),
          };
          const serialized = JSON.stringify(envelope);
          this.lastRawString = serialized;
          window.localStorage.setItem(PROFILE_STORAGE_KEY, serialized);
          window.localStorage.removeItem(LEGACY_PROFILE_STORAGE_KEY);
          this.isHydrated = true;
          return;
        }
      }

      // 3. Fallback if no storage data found
      this.currentProfile = { ...DEFAULT_USER_PROFILE, onboardingCompleted: false };
      this.isHydrated = true;
    } catch (err) {
      console.warn('[ProfileStorage] Corrupted profile JSON detected, clearing invalid storage entry:', err);
      this.currentProfile = { ...DEFAULT_USER_PROFILE, onboardingCompleted: false };
      this.lastRawString = null;
      this.isHydrated = true;
      try {
        window.localStorage.removeItem(PROFILE_STORAGE_KEY);
        window.localStorage.removeItem(LEGACY_PROFILE_STORAGE_KEY);
      } catch {
        // Ignore removal failure
      }
    }
  }

  /**
   * Retrieves the raw stored envelope with versioning metadata.
   */
  public getStoredEnvelope(): StoredProfileEnvelope | null {
    if (!this.isStorageAvailable()) {
      return null;
    }

    try {
      const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.version && parsed.profile) {
          return parsed as StoredProfileEnvelope;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Retrieves the validated, cached UserProfile.
   * Returns the exact same cached object reference until the profile actually changes.
   */
  public getProfile = (): UserProfile => {
    if (!this.isHydrated) {
      this.hydrate();
    } else if (this.isStorageAvailable()) {
      // In case localStorage was modified externally without saveProfile
      const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
      if (raw !== this.lastRawString) {
        this.hydrate();
      }
    }
    return this.currentProfile;
  };

  /**
   * Persists profile changes into versioned storage, updates the cached reference,
   * and notifies subscribers exactly once.
   */
  public saveProfile = (profileUpdate: Partial<UserProfile>): UserProfile => {
    const current = this.getProfile();
    const updated: UserProfile = {
      ...current,
      ...profileUpdate,
      onboardingCompleted:
        profileUpdate.onboardingCompleted !== undefined
          ? profileUpdate.onboardingCompleted
          : current.onboardingCompleted,
    };

    const validation = validateUserProfile(updated);
    const finalProfile: UserProfile = validation.isValid && validation.validatedProfile
      ? validation.validatedProfile
      : updated;

    this.currentProfile = finalProfile;
    this.isHydrated = true;

    if (this.isStorageAvailable()) {
      try {
        const envelope: StoredProfileEnvelope = {
          version: this.schemaVersion,
          profile: finalProfile,
          updatedAt: new Date().toISOString(),
        };
        const serialized = JSON.stringify(envelope);
        this.lastRawString = serialized;
        window.localStorage.setItem(PROFILE_STORAGE_KEY, serialized);
        window.dispatchEvent(
          new CustomEvent(PROFILE_STORAGE_EVENT, { detail: finalProfile })
        );
      } catch (err) {
        console.warn('[ProfileStorage] Failed to write profile to localStorage:', err);
      }
    }

    this.notifySubscribers();
    return finalProfile;
  };

  /**
   * Resets stored profile back to defaults, updates the cached reference,
   * and notifies subscribers.
   */
  public clearProfile = (): void => {
    this.currentProfile = { ...DEFAULT_USER_PROFILE, onboardingCompleted: false };
    this.lastRawString = null;
    this.isHydrated = true;

    if (this.isStorageAvailable()) {
      try {
        window.localStorage.removeItem(PROFILE_STORAGE_KEY);
        window.localStorage.removeItem(LEGACY_PROFILE_STORAGE_KEY);
        window.dispatchEvent(
          new CustomEvent(PROFILE_STORAGE_EVENT, { detail: this.currentProfile })
        );
      } catch {
        // Ignore
      }
    }

    this.notifySubscribers();
  };

  /**
   * Subscribes a listener to profile store updates.
   * Returns a cleanup function that removes the listener.
   */
  public subscribe = (listener: (profile?: UserProfile) => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /**
   * Notifies all registered subscribers of a profile state change.
   */
  private notifySubscribers(): void {
    const profile = this.currentProfile;
    this.listeners.forEach((listener) => {
      try {
        listener(profile);
      } catch (err) {
        console.error('[ProfileStorage] Subscriber notification failed:', err);
      }
    });
  }

  /**
   * Checks whether the user has completed onboarding with valid baseline data.
   */
  public hasCompletedOnboarding = (): boolean => {
    const profile = this.getProfile();
    if (!profile.onboardingCompleted) return false;
    const validation = validateUserProfile(profile);
    return validation.isValid && validation.hasSufficientData;
  };

  /**
   * Validates a profile object using existing domain rules.
   */
  public validate(profile?: Partial<UserProfile> | null): ProfileValidationResult {
    return validateUserProfile(profile);
  }
}

export const profileStorageService = new ProfileStorageService();
