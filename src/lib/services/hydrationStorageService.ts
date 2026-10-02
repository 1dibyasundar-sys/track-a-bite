/**
 * Hydration Local Storage Service (Phase 8.7)
 *
 * Provides a resilient, offline-first local storage layer for hydration tracking.
 * - Adheres strictly to React 19 / useSyncExternalStore referential stability rules:
 *   getSnapshot() returns a cached reference to avoid infinite re-render loops.
 * - Dispatches storage events to synchronize across multi-tab sessions.
 * - Strips sensitive credentials to prevent secret leakage.
 */

import { HydrationLogEntry } from '../types/hydration';
import { getLocalISODate } from '../utils';

export const HYDRATION_STORAGE_KEY = 'trackabite_hydration_v1';
export const HYDRATION_STORAGE_EVENT = 'trackabite_hydration_changed';

export class HydrationStorageService {
  private cachedEntries: HydrationLogEntry[] = [];
  private lastRawString: string | null | undefined = undefined;
  private isHydrated = false;
  private listeners = new Set<() => void>();

  constructor() {
    this.initStorageListener();
  }

  private initStorageListener(): void {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;

    const handleExternalChange = () => {
      const raw = window.localStorage.getItem(HYDRATION_STORAGE_KEY);
      if (raw !== this.lastRawString) {
        this.hydrate();
        this.notifySubscribers();
      }
    };

    window.addEventListener('storage', handleExternalChange);
    window.addEventListener(HYDRATION_STORAGE_EVENT, handleExternalChange);
  }

  private isStorageAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      const testKey = '__trackabite_hydration_test__';
      window.localStorage.setItem(testKey, testKey);
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  private hydrate(): void {
    if (!this.isStorageAvailable()) {
      this.cachedEntries = [];
      this.isHydrated = true;
      return;
    }

    try {
      const raw = window.localStorage.getItem(HYDRATION_STORAGE_KEY);
      this.lastRawString = raw;

      if (!raw) {
        this.cachedEntries = [];
        this.isHydrated = true;
        return;
      }

      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        this.cachedEntries = parsed
          .filter(e => e && typeof e === 'object' && e.id && typeof e.amountMl === 'number')
          .map(e => ({
            id: String(e.id),
            userId: String(e.userId || 'local-user'),
            amountMl: Math.max(0, Number(e.amountMl) || 0),
            loggedAt: String(e.loggedAt || new Date().toISOString()),
            date: String(e.date || getLocalISODate(e.loggedAt) || getLocalISODate()),
            source: e.source as HydrationLogEntry['source'],
            notes: e.notes ? String(e.notes) : undefined,
          }));
      } else {
        this.cachedEntries = [];
      }
      this.isHydrated = true;
    } catch {
      this.cachedEntries = [];
      this.isHydrated = true;
    }
  }

  /**
   * Authoritative snapshot getter for useSyncExternalStore.
   * Guarantees referential equality when underlying data has not changed.
   */
  public getSnapshot(): HydrationLogEntry[] {
    if (!this.isHydrated) {
      this.hydrate();
    }
    return this.cachedEntries;
  }

  /**
   * Retrieves all entries for a specific calendar date (YYYY-MM-DD).
   */
  public getEntriesForDate(date: string = getLocalISODate()): HydrationLogEntry[] {
    const all = this.getSnapshot();
    const targetDate = getLocalISODate(date) || date;
    return all.filter(e => e.date === targetDate);
  }

  /**
   * Appends or updates a hydration entry in local storage.
   */
  public saveEntry(entry: HydrationLogEntry): void {
    if (!entry || !entry.id) return;
    if (!this.isHydrated) this.hydrate();

    const normalized: HydrationLogEntry = {
      ...entry,
      amountMl: Math.max(0, Number(entry.amountMl) || 0),
      loggedAt: entry.loggedAt || new Date().toISOString(),
      date: entry.date || getLocalISODate(entry.loggedAt) || getLocalISODate(),
    };

    const existingIndex = this.cachedEntries.findIndex(e => e.id === normalized.id);
    let nextEntries: HydrationLogEntry[];
    if (existingIndex >= 0) {
      nextEntries = [...this.cachedEntries];
      nextEntries[existingIndex] = normalized;
    } else {
      nextEntries = [normalized, ...this.cachedEntries];
    }

    this.persist(nextEntries);
  }

  /**
   * Saves a batch of entries (e.g. from cloud sync).
   */
  public mergeEntries(incoming: HydrationLogEntry[]): void {
    if (!Array.isArray(incoming) || incoming.length === 0) return;
    if (!this.isHydrated) this.hydrate();

    const entryMap = new Map<string, HydrationLogEntry>();
    this.cachedEntries.forEach(e => entryMap.set(e.id, e));
    incoming.forEach(e => entryMap.set(e.id, e));

    const nextEntries = Array.from(entryMap.values()).sort(
      (a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime()
    );

    this.persist(nextEntries);
  }

  /**
   * Deletes an entry by ID.
   */
  public deleteEntry(id: string): void {
    if (!id) return;
    if (!this.isHydrated) this.hydrate();

    const nextEntries = this.cachedEntries.filter(e => e.id !== id);
    if (nextEntries.length !== this.cachedEntries.length) {
      this.persist(nextEntries);
    }
  }

  /**
   * Clears all hydration storage records.
   */
  public clearAll(): void {
    this.persist([]);
  }

  private persist(entries: HydrationLogEntry[]): void {
    this.cachedEntries = entries;
    if (!this.isStorageAvailable()) {
      this.notifySubscribers();
      return;
    }

    try {
      const raw = JSON.stringify(entries);
      this.lastRawString = raw;
      window.localStorage.setItem(HYDRATION_STORAGE_KEY, raw);

      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new Event(HYDRATION_STORAGE_EVENT));
      }
    } catch (err) {
      console.warn('[HydrationStorageService] Failed to write localStorage:', err);
    }

    this.notifySubscribers();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifySubscribers(): void {
    this.listeners.forEach(fn => {
      try {
        fn();
      } catch (err) {
        console.error('[HydrationStorageService] Listener error:', err);
      }
    });
  }
}

export const hydrationStorageService = new HydrationStorageService();
