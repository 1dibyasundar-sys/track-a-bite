/**
 * Track-a-Bite — Firebase Client Integration (Phase 7.2)
 *
 * Centralized, singleton client initialization for Firebase Web SDK modular APIs:
 * - Firebase App (initializeApp, getApps, getApp)
 * - Firebase Authentication (getAuth)
 * - Cloud Firestore (getFirestore)
 *
 * Strict Environment Validation:
 * - Validates NEXT_PUBLIC_FIREBASE_* environment variables.
 * - Prevents silent creation of broken Firebase instances.
 * - Produces clear development-time diagnostic errors.
 * - Safe for Next.js App Router & Fast Refresh (HMR).
 * - Firebase Storage is intentionally NOT initialized yet.
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

/**
 * Firebase Client Configuration mapped to public environment variables.
 */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * Required Firebase configuration keys.
 */
export const REQUIRED_FIREBASE_ENV_VARS = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
] as const;

/**
 * Static mapping of public environment variables.
 * In Next.js client bundles, `process.env.NEXT_PUBLIC_*` must be referenced statically
 * so that Turbopack/Webpack can inline the values at build/compile time.
 * Dynamic access like `process.env[key]` is not inlined by bundlers and evaluates to undefined in the browser.
 */
const ENV_STATIC_MAP: Record<string, string | undefined> = {
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * Returns any missing or empty required Firebase environment variables.
 */
export function getMissingFirebaseEnvVars(): string[] {
  return REQUIRED_FIREBASE_ENV_VARS.filter((key) => {
    const val = ENV_STATIC_MAP[key];
    return !val || val.trim() === '';
  });
}

const missingFirebaseEnvVars = getMissingFirebaseEnvVars();

/**
 * Indicates whether all required Firebase Web SDK environment variables are provided.
 */
export const isFirebaseConfigured = missingFirebaseEnvVars.length === 0;

/**
 * Produces a clear development-time error if required Firebase variables are missing,
 * alerting developers directly rather than silently creating a broken Firebase instance.
 */
if (!isFirebaseConfigured) {
  const missingList = missingFirebaseEnvVars.map((v) => `  - ${v}`).join('\n');
  const devNotice =
    `[Firebase Client] Missing required Firebase environment variables:\n` +
    `${missingList}\n` +
    `Please set these in .env.local to enable live Firebase Authentication & Firestore.`;

  if (process.env.NODE_ENV === 'development') {
    console.error(`\x1b[33m${devNotice}\x1b[0m`);
  }
}

/**
 * Helper to build an explicit diagnostic proxy when Firebase is unconfigured.
 * Prevents silent failures or obscure internal Firebase errors by throwing
 * an informative error whenever an uninitialized service is accessed.
 */
function createUnconfiguredServiceProxy<T extends object>(serviceName: string): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      if (prop === 'then' || prop === Symbol.toStringTag || prop === 'toJSON') {
        return undefined;
      }
      throw new Error(
        `[Firebase ${serviceName}] Cannot access '${String(prop)}': Firebase is not configured in this environment. ` +
        `Missing required environment variables: ${missingFirebaseEnvVars.join(', ')}. ` +
        `Please configure them in .env.local.`
      );
    },
    apply() {
      throw new Error(
        `[Firebase ${serviceName}] Cannot execute operation: Firebase is not configured in this environment. ` +
        `Missing required environment variables: ${missingFirebaseEnvVars.join(', ')}. ` +
        `Please configure them in .env.local.`
      );
    },
  });
}

// ---------------------------------------------------------------------------
// Singleton Initialization with App Router & Hot-Reload (HMR) Safety
// ---------------------------------------------------------------------------
let firebaseApp: FirebaseApp;
let firebaseAuth: Auth;
let firebaseDb: Firestore;

if (isFirebaseConfigured) {
  // Safe initialization: Reuse existing default app on hot reload, or initialize fresh
  firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  firebaseAuth = getAuth(firebaseApp);
  firebaseDb = getFirestore(firebaseApp);
} else {
  // Do NOT silently create a broken Firebase instance with empty options.
  // Provide diagnostic proxies that fail loudly and clearly if invoked.
  firebaseApp = createUnconfiguredServiceProxy<FirebaseApp>('App');
  firebaseAuth = createUnconfiguredServiceProxy<Auth>('Auth');
  firebaseDb = createUnconfiguredServiceProxy<Firestore>('Firestore');
}

// Modular exports as required by specifications
export { firebaseApp, firebaseAuth, firebaseDb };

// Backward compatibility aliases for existing auth service & test suites
export { firebaseApp as app, firebaseAuth as auth };
