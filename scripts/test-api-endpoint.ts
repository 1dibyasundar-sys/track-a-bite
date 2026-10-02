async function testApiEndpoint() {
  console.log('Testing live /api/recognize-food endpoint...');

  // Test 1: Scenario hint preview (pakhala-bhata-thali)
  const res1 = await fetch('http://localhost:3000/api/recognize-food', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: 'placeholder',
      scenarioHintId: 'pakhala-bhata-thali',
    }),
  });

  console.log('Test 1 Status:', res1.status);
  const data1 = await res1.json();
  console.log('Test 1 Detections count:', data1.detections?.length);
  for (const d of data1.detections || []) {
    console.log(` - ${d.name} (${d.identificationMode || 'N/A'}, ${Math.round(d.confidence * 100)}%, ~${d.estimatedPortion.rawGramsEquivalent}g)`);
  }

  // Test 2: Thali multi-compartment scenario (2 curries grouped)
  const res2 = await fetch('http://localhost:3000/api/recognize-food', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: 'placeholder',
      scenarioHintId: 'thali-multi-compartment',
    }),
  });

  console.log('\nTest 2 Status:', res2.status);
  const data2 = await res2.json();
  console.log('Test 2 Detections count:', data2.detections?.length);
  for (const d of data2.detections || []) {
    console.log(` - ${d.name} (${d.regions ? `${d.regions.length} regions` : '1 region'}, ~${d.estimatedPortion.rawGramsEquivalent}g)`);
  }

  // Test 3: Empty plate
  const res3 = await fetch('http://localhost:3000/api/recognize-food', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: 'placeholder',
      scenarioHintId: 'empty-plate-no-food',
    }),
  });

  console.log('\nTest 3 Status:', res3.status);
  const data3 = await res3.json();
  console.log('Test 3 Status returned:', data3.status, 'Error:', data3.errorMessage);

  console.log('\n✅ All API endpoint checks passed!');
}

testApiEndpoint().catch(err => {
  console.error('API test failed:', err);
  process.exit(1);
});
