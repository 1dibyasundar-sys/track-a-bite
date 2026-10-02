/**
 * TRACK-A-BITE — PHASE 10 PRODUCTION SMOKE TEST SUITE
 *
 * Verifies application routes and API endpoints:
 * 1. GET /
 * 2. GET /login
 * 3. GET /register
 * 4. GET /dashboard
 * 5. GET /scan
 * 6. GET /results
 * 7. GET /history
 * 8. GET /profile
 * 9. GET /onboarding
 * 10. GET /foods
 * 11. GET /about
 * 12. GET /robots.txt
 * 13. GET /manifest.webmanifest
 * 14. POST /api/recognize-food (empty payload validation -> status 'invalid-image' / HTTP 200 or 400)
 * 15. POST /api/recognize-food (corrupt image payload -> status 'invalid-image' / graceful handling)
 */

interface RouteCheck {
  path: string;
  name: string;
  expectedStatus: number;
}

const GET_ROUTES: RouteCheck[] = [
  { path: '/', name: 'Landing Page', expectedStatus: 200 },
  { path: '/login', name: 'Authentication Login', expectedStatus: 200 },
  { path: '/register', name: 'Authentication Registration', expectedStatus: 200 },
  { path: '/dashboard', name: 'Nutrition Dashboard', expectedStatus: 200 },
  { path: '/scan', name: 'Food Scanner & Camera', expectedStatus: 200 },
  { path: '/results', name: 'Nutrition Results', expectedStatus: 200 },
  { path: '/history', name: 'Meal History & Analytics', expectedStatus: 200 },
  { path: '/profile', name: 'User Profile & Hostel Settings', expectedStatus: 200 },
  { path: '/onboarding', name: 'User Onboarding', expectedStatus: 200 },
  { path: '/foods', name: 'Regional Indian Food Database', expectedStatus: 200 },
  { path: '/about', name: 'About & Nutritional Methodology', expectedStatus: 200 },
  { path: '/robots.txt', name: 'SEO Robots Configuration', expectedStatus: 200 },
  { path: '/manifest.webmanifest', name: 'Web App Manifest', expectedStatus: 200 },
];

async function runProductionSmokeTest() {
  const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
  console.log('====================================================');
  console.log('TRACK-A-BITE — PHASE 10 PRODUCTION SMOKE TEST');
  console.log(`Target Host: ${baseUrl}`);
  console.log('====================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  console.log('--- 1. HTTP GET APPLICATION ROUTES ---');
  for (const route of GET_ROUTES) {
    try {
      const url = `${baseUrl}${route.path}`;
      const res = await fetch(url, { redirect: 'manual' });
      const text = await res.text();
      const hasCrash = text.includes('Application error:') || text.includes('Internal Server Error');

      if (res.status === route.expectedStatus && !hasCrash) {
        console.log(`✅ [PASS] GET ${route.path.padEnd(24)} -> HTTP ${res.status} (${route.name})`);
        passedCount++;
      } else {
        console.error(
          `❌ [FAIL] GET ${route.path.padEnd(24)} -> HTTP ${res.status} (expected ${route.expectedStatus}, hasCrash: ${hasCrash})`
        );
        failedCount++;
      }
    } catch (err) {
      console.error(`❌ [FAIL] GET ${route.path.padEnd(24)} -> Request error:`, err);
      failedCount++;
    }
  }

  console.log('\n--- 2. POST /api/recognize-food API ENDPOINTS ---');

  // Test 2.1: Empty payload validation
  try {
    const res = await fetch(`${baseUrl}/api/recognize-food`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json();

    if (res.status === 200 && data.status === 'invalid-image') {
      console.log(`✅ [PASS] POST /api/recognize-food (empty body) -> Graceful invalid-image status response`);
      passedCount++;
    } else {
      console.error(`❌ [FAIL] POST /api/recognize-food (empty body) -> HTTP ${res.status}:`, data);
      failedCount++;
    }
  } catch (err) {
    console.error('❌ [FAIL] POST /api/recognize-food (empty body) -> Request error:', err);
    failedCount++;
  }

  // Test 2.2: Malformed image string validation
  try {
    const res = await fetch(`${baseUrl}/api/recognize-food`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'not-a-valid-base64-or-url' }),
    });
    const data = await res.json();

    if (res.status === 200 && (data.status === 'invalid-image' || data.status === 'error')) {
      console.log(`✅ [PASS] POST /api/recognize-food (malformed image) -> Meaningful failure response`);
      passedCount++;
    } else {
      console.error(`❌ [FAIL] POST /api/recognize-food (malformed image) -> HTTP ${res.status}:`, data);
      failedCount++;
    }
  } catch (err) {
    console.error('❌ [FAIL] POST /api/recognize-food (malformed image) -> Request error:', err);
    failedCount++;
  }

  console.log('\n====================================================');
  console.log(`PRODUCTION SMOKE TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('====================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runProductionSmokeTest();
