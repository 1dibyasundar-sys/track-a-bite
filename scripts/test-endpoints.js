async function checkEndpoints() {
  const urls = [
    'http://localhost:3000/',
    'http://localhost:3000/scan',
    'http://localhost:3000/foods',
    'http://localhost:3000/history',
    'http://localhost:3000/about',
  ];

  console.log('--- CHECKING LOCALHOST HEALTH ---');
  for (const url of urls) {
    try {
      const res = await fetch(url);
      console.log(`[${res.status}] ${url}`);
    } catch (e) {
      console.error(`[ERROR] ${url}:`, e.message);
    }
  }
}

checkEndpoints();
