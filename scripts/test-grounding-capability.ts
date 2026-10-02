import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        process.env[key] = val;
      }
    }
  }
}

async function testGrounding() {
  loadEnv();
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  console.log('Testing with model:', model, 'API Key present:', Boolean(apiKey));

  if (!apiKey) {
    console.log('No API key found in .env.local');
    return;
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: 'Visual observation: Fermented water rice with curd, mustard seeds, and fried vegetables, traditional Odia summer dish. Research using Google Search and identify the exact dish name, origin, candidate dishes, and ingredients.',
          },
        ],
      },
    ],
    tools: [
      {
        google_search: {},
      },
    ],
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    console.log('Response status:', res.status);
    if (!res.ok) {
      const errText = await res.text();
      console.log('Error text:', errText);
      return;
    }

    const data = await res.json();
    console.log('Candidate content text:', data.candidates?.[0]?.content?.parts?.[0]?.text?.slice(0, 300));
    console.log('Grounding metadata:', JSON.stringify(data.candidates?.[0]?.groundingMetadata, null, 2)?.slice(0, 500));
  } catch (err) {
    console.error('Test error:', err);
  }
}

testGrounding();
