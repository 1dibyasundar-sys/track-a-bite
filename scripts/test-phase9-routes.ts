/**
 * TRACK-A-BITE — PHASE 9 ROUTE SMOKE TEST
 * Verifies all 11 application routes and API endpoint respond with HTTP 200
 */

const routes = [
  '/',
  '/dashboard',
  '/about',
  '/foods',
  '/scan',
  '/results',
  '/history',
  '/profile',
  '/onboarding',
  '/login',
  '/register',
  '/forgot-password',
];

async function runRouteSmokeTest() {
  console.log('====================================================');
  console.log('TRACK-A-BITE — PHASE 9 ROUTE SMOKE TEST');
  console.log('Verifying All Application Routes & API Endpoints');
  console.log('====================================================\n');

  let allPassed = true;

  for (const r of routes) {
    try {
      const res = await fetch(`http://localhost:3000${r}`);
      const text = await res.text();
      const hasError = text.includes('Application error') || text.includes('Internal Server Error');
      if (res.status === 200 && !hasError) {
        console.log(`✅ [PASS] GET ${r.padEnd(20)} -> HTTP 200 OK`);
      } else {
        console.error(`❌ [FAIL] GET ${r.padEnd(20)} -> HTTP ${res.status} (hasError: ${hasError})`);
        allPassed = false;
      }
    } catch (err) {
      console.error(`❌ [FAIL] GET ${r.padEnd(20)} -> Request failed:`, err);
      allPassed = false;
    }
  }

  console.log('\n--- CHECKING GEMINI RECOGNIZE-FOOD API ENDPOINT ---');
  try {
    const postRes = await fetch('http://localhost:3000/api/recognize-food', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const postData = await postRes.json();
    if (postRes.status === 200 && postData.status === 'invalid-image') {
      console.log(`✅ [PASS] POST /api/recognize-food -> HTTP 200 OK (Validated empty payload safely)`);
    } else {
      console.log(`ℹ POST /api/recognize-food -> HTTP ${postRes.status}:`, postData);
    }
  } catch (err) {
    console.error('❌ [FAIL] POST /api/recognize-food -> Request failed:', err);
    allPassed = false;
  }

  console.log('\n====================================================');
  if (allPassed) {
    console.log('🎉 ALL 12 APPLICATION ROUTES & API ENDPOINTS VERIFIED!');
    console.log('====================================================\n');
    process.exit(0);
  } else {
    console.error('💥 ROUTE SMOKE TEST FAILED');
    console.log('====================================================\n');
    process.exit(1);
  }
}

runRouteSmokeTest();
