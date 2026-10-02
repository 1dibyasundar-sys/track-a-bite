/**
 * Test to verify referential stability of UserProfileService & ProfileStorageService
 * for React useSyncExternalStore requirements.
 */

import { userProfileService } from '../src/lib/services/userProfileService';
import { profileStorageService, PROFILE_STORAGE_KEY } from '../src/lib/services/profileStorageService';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ [PASS] ${message}`);
  }
}

// Setup mock window for test
class MockLocalStorage {
  private store: Record<string, string> = {};
  getItem(key: string): string | null { return this.store[key] || null; }
  setItem(key: string, value: string): void { this.store[key] = value; }
  removeItem(key: string): void { delete this.store[key]; }
  clear(): void { this.store = {}; }
}

const mockStorage = new MockLocalStorage();
(global as unknown as { window: unknown }).window = {
  localStorage: mockStorage,
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true,
};

console.log('--- TEST 1: REFERENTIAL STABILITY OF GETPROFILE() ---');
const p1 = userProfileService.getProfile();
const p2 = userProfileService.getProfile();
const p3 = profileStorageService.getProfile();

assert(p1 === p2, 'p1 and p2 must be referentially identical (===)');
assert(p1 === p3, 'p1 and p3 must be referentially identical (===)');
assert(Object.is(p1, p2), 'Object.is(p1, p2) must be true');

console.log('\n--- TEST 2: SUBSCRIBER NOTIFICATION & REFERENCE UPDATE ON SAVE ---');
let notifyCount = 0;
let notifiedProfile: unknown = null;
const unsubscribe = userProfileService.subscribe((profile) => {
  notifyCount++;
  notifiedProfile = profile;
});

const updatedProfile = userProfileService.saveProfile({
  age: 21,
  heightCm: 175,
  weightKg: 68,
  isHostelite: true,
  onboardingCompleted: true,
});

assert(notifyCount === 1, 'Subscriber notified exactly once on save');
assert(notifiedProfile === updatedProfile, 'Notified profile matches returned profile');

const p4 = userProfileService.getProfile();
const p5 = userProfileService.getProfile();
assert(p4 === updatedProfile, 'getProfile() returns the new updated reference');
assert(p4 === p5, 'subsequent getProfile() calls return the identical new reference');
assert(p4 !== p1, 'new profile has different reference from old profile');

console.log('\n--- TEST 3: UNSUBSCRIBE CLEANUP ---');
unsubscribe();
userProfileService.saveProfile({ weightKg: 70 });
assert(notifyCount === 1, 'Subscriber NOT notified after unsubscribe() cleanup');

console.log('\n--- TEST 4: CLEAR PROFILE STABILITY ---');
let clearNotifyCount = 0;
const unsub2 = userProfileService.subscribe(() => {
  clearNotifyCount++;
});

userProfileService.clearProfile();
assert(clearNotifyCount === 1, 'Subscriber notified on clear');
const cleared1 = userProfileService.getProfile();
const cleared2 = userProfileService.getProfile();
assert(cleared1 === cleared2, 'Cleared profile is referentially stable across reads');
assert(cleared1.onboardingCompleted === false, 'Cleared profile onboardingCompleted is false');
unsub2();

console.log('\n--- TEST 5: CORRUPTED JSON RECOVERY STABILITY ---');
mockStorage.setItem(PROFILE_STORAGE_KEY, '{ broken-json');
const recovered1 = profileStorageService.getProfile();
const recovered2 = profileStorageService.getProfile();
assert(recovered1 === recovered2, 'Recovered profile is referentially stable');
assert(recovered1.onboardingCompleted === false, 'Recovered profile resets onboarding');

console.log('\n======================================================');
console.log('✅ ALL USE_SYNC_EXTERNAL_STORE STABILITY TESTS PASSED');
console.log('======================================================');
