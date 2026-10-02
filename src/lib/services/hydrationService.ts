/**
 * Hydration Facade Service (Phase 8.7)
 *
 * Coordinates hydration tracking between Cloud Firestore and local storage.
 * - Implements deterministic hydration target heuristics based on body weight.
 * - Provides quick-add actions and custom volume logging.
 * - Adheres strictly to offline-first resilience: local state updates immediately.
 * - Offers student- and hostel-tailored hydration reminders without spammy notifications.
 */

import {
  HydrationLogEntry,
  HydrationSummary,
  HydrationTip,
  DEFAULT_HYDRATION_TARGET_ML,
  ML_PER_KG_WEIGHT,
  MIN_HYDRATION_TARGET_ML,
  MAX_HYDRATION_TARGET_ML,
} from '../types/hydration';
import { UserProfile, validateUserProfile } from '../types/profile';
import { getLocalISODate } from '../utils';
import { firestoreHydrationService } from './firestoreHydrationService';
import { hydrationStorageService } from './hydrationStorageService';
import { isFirebaseConfigured, firebaseAuth } from '../firebase/client';

export class HydrationService {
  /**
   * Deterministically calculates daily hydration target in ml.
   * Priority:
   * 1. Explicit user target from profile if configured
   * 2. Body-weight heuristic: 35 ml per kg, clamped [1500, 4500] ml
   * 3. Safe application baseline: 2200 ml
   */
  public calculateHydrationTarget(profile?: Partial<UserProfile> | null): {
    targetMl: number;
    isPersonalized: boolean;
    calculationMethod: 'custom' | 'body_weight' | 'standard_heuristic';
    disclaimer: string;
  } {
    const valid = validateUserProfile(profile).validatedProfile;

    // 1. Explicit user-configured target
    if (valid?.targetHydrationMl && valid.targetHydrationMl > 0) {
      return {
        targetMl: Math.round(valid.targetHydrationMl),
        isPersonalized: true,
        calculationMethod: 'custom',
        disclaimer: 'Personalized user-defined hydration target. Not medical advice.',
      };
    }

    // 2. Weight-based heuristic (35 ml / kg)
    if (valid?.weightKg && valid.weightKg > 0) {
      const calculated = Math.round(valid.weightKg * ML_PER_KG_WEIGHT);
      const clamped = Math.max(MIN_HYDRATION_TARGET_ML, Math.min(MAX_HYDRATION_TARGET_ML, calculated));
      return {
        targetMl: clamped,
        isPersonalized: true,
        calculationMethod: 'body_weight',
        disclaimer: 'General hydration guideline calculated from body weight. Not medical advice.',
      };
    }

    // 3. Baseline heuristic fallback
    return {
      targetMl: DEFAULT_HYDRATION_TARGET_ML,
      isPersonalized: false,
      calculationMethod: 'standard_heuristic',
      disclaimer: 'General daily hydration reference for active adults. Not medical advice.',
    };
  }

  /**
   * Logs a hydration entry.
   * Saves synchronously to local storage cache and asynchronously syncs to Firestore if authenticated.
   */
  public async logDrink(
    amountMl: number,
    source: HydrationLogEntry['source'] = 'quick_add',
    dateInput?: string,
    explicitUserId?: string
  ): Promise<HydrationLogEntry> {
    const cleanAmount = Number(amountMl);
    if (isNaN(cleanAmount) || !isFinite(cleanAmount) || cleanAmount <= 0) {
      throw new Error('Hydration amount must be a positive number greater than 0 ml');
    }
    if (cleanAmount > 10000) {
      throw new Error('Hydration amount cannot exceed 10,000 ml per log');
    }

    const now = new Date();
    const date = getLocalISODate(dateInput) || getLocalISODate(now);
    const id = `hyd_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`;

    let userId = explicitUserId;
    if (!userId && typeof window !== 'undefined' && isFirebaseConfigured && firebaseAuth?.currentUser) {
      userId = firebaseAuth.currentUser.uid;
    }

    const entry: HydrationLogEntry = {
      id,
      userId: userId || 'local-user',
      amountMl: Math.round(cleanAmount),
      loggedAt: now.toISOString(),
      date,
      source,
    };

    // 1. Immediately save to local storage cache for instant UI feedback
    hydrationStorageService.saveEntry(entry);

    // 2. If authenticated, synchronize with Firestore
    if (userId && userId.trim()) {
      try {
        await firestoreHydrationService.logDrink(userId, entry);
      } catch (err) {
        console.warn('[HydrationService] Cloud sync failed, entry retained in local storage:', err);
      }
    }

    return entry;
  }

  /**
   * Deletes a hydration entry from local storage and Cloud Firestore.
   */
  public async deleteDrink(entryId: string, explicitUserId?: string): Promise<void> {
    if (!entryId) return;

    // 1. Remove from local storage
    hydrationStorageService.deleteEntry(entryId);

    // 2. If authenticated, remove from Firestore
    let userId = explicitUserId;
    if (!userId && typeof window !== 'undefined' && isFirebaseConfigured && firebaseAuth?.currentUser) {
      userId = firebaseAuth.currentUser.uid;
    }

    if (userId && userId.trim()) {
      try {
        await firestoreHydrationService.deleteDrink(userId, entryId);
      } catch (err) {
        console.warn('[HydrationService] Cloud delete failed:', err);
      }
    }
  }

  /**
   * Retrieves daily hydration summary for a specific calendar date.
   */
  public async getDailySummary(
    userId?: string,
    dateInput: string = getLocalISODate(),
    profile?: Partial<UserProfile> | null
  ): Promise<HydrationSummary> {
    const targetDate = getLocalISODate(dateInput) || dateInput;
    let entries: HydrationLogEntry[] = [];
    let dataSource: 'cloud' | 'local' | 'mixed' = 'local';

    if (userId && userId.trim()) {
      try {
        const cloudEntries = await firestoreHydrationService.getDailyHydration(userId, targetDate);
        if (cloudEntries && cloudEntries.length > 0) {
          entries = cloudEntries;
          dataSource = 'cloud';
          // Merge to local storage cache for offline availability
          hydrationStorageService.mergeEntries(cloudEntries);
        } else {
          // If cloud has 0 entries, check local storage
          entries = hydrationStorageService.getEntriesForDate(targetDate);
          dataSource = entries.length > 0 ? 'local' : 'cloud';
        }
      } catch (err) {
        console.warn('[HydrationService] Cloud retrieval failed, using local storage fallback:', err);
        entries = hydrationStorageService.getEntriesForDate(targetDate);
        dataSource = 'local';
      }
    } else {
      // Unauthenticated / offline
      entries = hydrationStorageService.getEntriesForDate(targetDate);
      dataSource = 'local';
    }

    const dailyWaterIntakeMl = entries.reduce((acc, e) => acc + (Number(e.amountMl) || 0), 0);
    const targetInfo = this.calculateHydrationTarget(profile);
    const hydrationTargetMl = targetInfo.targetMl;

    const loggedDrinksCount = entries.length;
    const percentageOfTarget =
      hydrationTargetMl > 0 ? Math.round((dailyWaterIntakeMl / hydrationTargetMl) * 100) : 0;
    const remainingAmountMl = Math.max(0, hydrationTargetMl - dailyWaterIntakeMl);

    return {
      date: targetDate,
      dailyWaterIntakeMl,
      hydrationTargetMl,
      loggedDrinksCount,
      percentageOfTarget,
      remainingAmountMl,
      isPersonalized: targetInfo.isPersonalized,
      guidelineDisclaimer: targetInfo.disclaimer,
      entries,
      dataSource,
    };
  }

  /**
   * Returns student- and hostel-tailored hydration tips and reminders.
   */
  public getHostelHydrationTips(): HydrationTip[] {
    return [
      {
        id: 'tip-campus-bottle',
        title: 'Carry a 1L Campus Bottle',
        tip: 'Keeping a refillable 1L water bottle in your lecture backpack makes meeting daily hydration effortless between classes.',
        category: 'campus',
        emoji: '🎒',
      },
      {
        id: 'tip-between-meals',
        title: 'Hydrate Between Meals',
        tip: 'Drinking water 30 minutes before or after meals supports digestion without diluting digestive enzymes.',
        category: 'routine',
        emoji: '💧',
      },
      {
        id: 'tip-hostel-room',
        title: 'Room Water Jug',
        tip: 'Fill a clean bottle or jug at your hostel cooler before evening study sessions to avoid late-night dehydration.',
        category: 'hostel',
        emoji: '🚰',
      },
      {
        id: 'tip-summer-chaas',
        title: 'Electrolytes & Chaas',
        tip: 'During hot campus days, coconut water or canteen buttermilk (chaas) provides natural electrolytes alongside water.',
        category: 'hostel',
        emoji: '🥤',
      },
    ];
  }
}

export const hydrationService = new HydrationService();
