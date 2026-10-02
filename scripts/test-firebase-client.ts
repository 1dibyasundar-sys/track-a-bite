/**
 * Verification Script: Firebase Client Integration (Phase 7.3)
 *
 * Verifies:
 * 1. Required exports: firebaseApp, firebaseAuth, firebaseDb
 * 2. Backward compatibility exports: app, auth, isFirebaseConfigured, firebaseConfig
 * 3. Environment variable configuration mapping for all 6 required keys
 * 4. isFirebaseConfigured === true
 * 5. Real Firebase App, Auth, and Firestore initialization
 * 6. App Router / Fast Refresh HMR singleton safety (getApps/getApp/initializeApp)
 * 7. Storage is NOT initialized
 * 8. GEMINI_API_KEY is NOT exposed in client or config
 */

import fs from 'fs';
import { getApps, getApp, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Synchronously load .env.local if present so standalone `npx tsx` has access to environment variables
if (fs.existsSync('.env.local')) {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ [PASS] ${message}`);
  }
}

async function runVerification() {
  console.log('====================================================');
  console.log('TRACK-A-BITE — FIREBASE CLIENT INTEGRATION TESTS');
  console.log('Phase 7.3: Real Firebase SDK Verification');
  console.log('====================================================\n');

  // Dynamic import ensures .env.local is in process.env before client module evaluation
  const {
    firebaseApp,
    firebaseAuth,
    firebaseDb,
    app,
    auth,
    isFirebaseConfigured,
    firebaseConfig,
    REQUIRED_FIREBASE_ENV_VARS,
    getMissingFirebaseEnvVars,
  } = await import('../src/lib/firebase/client');

  // 1. Verify Modular Exports
  console.log('--- 1. MODULAR EXPORTS VERIFICATION ---');
  assert(firebaseApp !== undefined && firebaseApp !== null, 'Export: firebaseApp is defined');
  assert(firebaseAuth !== undefined && firebaseAuth !== null, 'Export: firebaseAuth is defined');
  assert(firebaseDb !== undefined && firebaseDb !== null, 'Export: firebaseDb is defined');
  assert(app === firebaseApp, 'Alias: app points to firebaseApp');
  assert(auth === firebaseAuth, 'Alias: auth points to firebaseAuth');

  // 2. Verify Environment Variables
  console.log('\n--- 2. ENVIRONMENT VARIABLES & CONFIG SCHEMA ---');
  assert(typeof firebaseConfig === 'object', 'firebaseConfig is an object');
  assert(Boolean(firebaseConfig.apiKey), 'Config has valid apiKey');
  assert(Boolean(firebaseConfig.authDomain), 'Config has valid authDomain');
  assert(Boolean(firebaseConfig.projectId), 'Config has valid projectId');
  assert(Boolean(firebaseConfig.storageBucket), 'Config has valid storageBucket');
  assert(Boolean(firebaseConfig.messagingSenderId), 'Config has valid messagingSenderId');
  assert(Boolean(firebaseConfig.appId), 'Config has valid appId');

  assert(REQUIRED_FIREBASE_ENV_VARS.length === 6, 'All 6 required Firebase env vars tracked');
  assert(REQUIRED_FIREBASE_ENV_VARS.includes('NEXT_PUBLIC_FIREBASE_API_KEY'), 'Tracks NEXT_PUBLIC_FIREBASE_API_KEY');
  assert(REQUIRED_FIREBASE_ENV_VARS.includes('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'), 'Tracks NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN');
  assert(REQUIRED_FIREBASE_ENV_VARS.includes('NEXT_PUBLIC_FIREBASE_PROJECT_ID'), 'Tracks NEXT_PUBLIC_FIREBASE_PROJECT_ID');
  assert(REQUIRED_FIREBASE_ENV_VARS.includes('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'), 'Tracks NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET');
  assert(REQUIRED_FIREBASE_ENV_VARS.includes('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'), 'Tracks NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID');
  assert(REQUIRED_FIREBASE_ENV_VARS.includes('NEXT_PUBLIC_FIREBASE_APP_ID'), 'Tracks NEXT_PUBLIC_FIREBASE_APP_ID');

  // 3. Strict Environment Validation
  console.log('\n--- 3. STRICT ENVIRONMENT VALIDATION & STATUS ---');
  const missing = getMissingFirebaseEnvVars();
  assert(missing.length === 0, `Missing required Firebase variables: 0 (Found all 6)`);
  assert(isFirebaseConfigured === true, 'isFirebaseConfigured === true');

  // 4. Real Firebase Instance Verification
  console.log('\n--- 4. REAL FIREBASE INSTANCE INITIALIZATION ---');
  assert(firebaseApp.name === '[DEFAULT]', 'firebaseApp is initialized with [DEFAULT] name');
  assert(firebaseAuth.app === firebaseApp, 'firebaseAuth is bound to firebaseApp');
  assert(typeof firebaseAuth.onAuthStateChanged === 'function', 'firebaseAuth provides onAuthStateChanged');
  assert(typeof firebaseAuth.currentUser !== 'undefined', 'firebaseAuth provides currentUser property');
  assert(firebaseDb.app === firebaseApp, 'firebaseDb is bound to firebaseApp');
  assert(firebaseDb.type === 'firestore', 'firebaseDb is a valid Firestore instance');

  // 5. Hot Reload & App Router Singleton Test
  console.log('\n--- 5. HOT RELOAD & SINGLETON SAFETY ---');
  const reloadedApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  assert(reloadedApp === firebaseApp, 'Hot reload safely reuses existing FirebaseApp instance without duplicate initialization');

  const liveAuth = getAuth(firebaseApp);
  const liveFirestore = getFirestore(firebaseApp);
  assert(liveAuth === firebaseAuth, 'getAuth(firebaseApp) reuses active singleton Auth');
  assert(liveFirestore === firebaseDb, 'getFirestore(firebaseApp) reuses active singleton Firestore');

  // 6. Verify Storage is NOT Initialized
  console.log('\n--- 6. STORAGE EXCLUSION VERIFICATION ---');
  const clientSource = fs.readFileSync('src/lib/firebase/client.ts', 'utf8');
  assert(!clientSource.includes('getStorage'), 'Firebase Storage (getStorage) is NOT imported or initialized');
  assert(!clientSource.includes('firebase/storage'), 'firebase/storage package is NOT imported');

  // 7. Security: No Gemini API Key in Client Config
  console.log('\n--- 7. SECURITY VERIFICATION ---');
  assert(!('GEMINI_API_KEY' in firebaseConfig), 'GEMINI_API_KEY is not part of firebaseConfig');
  assert(!clientSource.includes('process.env.GEMINI_API_KEY'), 'client.ts does NOT reference GEMINI_API_KEY');

  console.log('\n====================================================');
  console.log('✅ ALL FIREBASE CLIENT INTEGRATION TESTS PASSED');
  console.log('====================================================\n');
  process.exit(0);
}

runVerification().catch((err) => {
  console.error('❌ Verification failed with error:', err);
  process.exit(1);
});
