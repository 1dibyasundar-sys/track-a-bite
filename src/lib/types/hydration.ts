/**
 * Hydration Tracking Domain Types (Phase 8.7)
 *
 * Defines strongly typed structures for logging daily water intake,
 * calculating deterministic hydration targets based on body weight,
 * and presenting student/hostel-friendly hydration metrics.
 */

export interface HydrationLogEntry {
  id: string;
  userId: string;
  amountMl: number;
  loggedAt: string; // ISO 8601 string
  date: string;     // YYYY-MM-DD local calendar date
  source?: 'quick_add' | 'custom' | 'manual';
  notes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface HydrationSummary {
  date: string;              // YYYY-MM-DD
  dailyWaterIntakeMl: number;
  hydrationTargetMl: number;
  loggedDrinksCount: number;
  percentageOfTarget: number; // e.g. 75 (%)
  remainingAmountMl: number;
  isPersonalized: boolean;
  guidelineDisclaimer: string;
  entries: HydrationLogEntry[];
  dataSource: 'cloud' | 'local' | 'mixed';
}

export interface HydrationTip {
  id: string;
  title: string;
  tip: string;
  category: 'hostel' | 'campus' | 'routine';
  emoji: string;
}

export const QUICK_ADD_AMOUNTS_ML = [250, 500, 750, 1000] as const;
export type QuickAddAmountMl = typeof QUICK_ADD_AMOUNTS_ML[number];

export const DEFAULT_HYDRATION_TARGET_ML = 2200;
export const ML_PER_KG_WEIGHT = 35;
export const MIN_HYDRATION_TARGET_ML = 1500;
export const MAX_HYDRATION_TARGET_ML = 4500;
