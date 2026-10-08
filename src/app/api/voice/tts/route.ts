import { NextRequest, NextResponse } from 'next/server';
import { getGeminiApiKey } from '../../../../lib/server/geminiConfig';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key is not configured on the server.' },
        { status: 503 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const textToSpeak = body.text?.trim();

    if (!textToSpeak) {
      return NextResponse.json({ error: 'Text cannot be empty.' }, { status: 400 });
    }

    const candidateTtsModels = [
      'gemini-3.8-flash-lite-tts',
      'gemini-3.1-flash-tts-preview',
      'gemini-2.5-flash-preview-tts',
      'gemini-3.8-flash-tts',
    ];

    let res: Response | null = null;
    for (const model of candidateTtsModels) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: textToSpeak }] }],
          }),
        });

        if (response.ok) {
          res = response;
          break;
        } else if (response.status === 503 || response.status === 404) {
          console.warn(`[TAB TTS] Model ${model} returned ${response.status}, attempting fallback...`);
          continue;
        } else {
          res = response;
          break;
        }
      } catch (err) {
        console.warn(`[TAB TTS] Error with ${model}:`, err);
        continue;
      }
    }

    if (!res || !res.ok) {
      const status = res ? res.status : 503;
      return NextResponse.json(
        { error: `TTS synthesis unavailable (${status}).` },
        { status }
      );
    }

    const data = await res.json();
    const candidatePart = data.candidates?.[0]?.content?.parts?.[0];

    if (!candidatePart?.inlineData?.data) {
      return NextResponse.json(
        { error: 'TTS did not produce audio output.' },
        { status: 502 }
      );
    }

    const base64Audio = candidatePart.inlineData.data;
    const mimeType = candidatePart.inlineData.mimeType || 'audio/wav';
    const audioBuffer = Buffer.from(base64Audio, 'base64');

    return new Response(audioBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Length': audioBuffer.length.toString(),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('[TAB TTS] Uncaught TTS error:', error);
    return NextResponse.json(
      { error: error.message || 'TTS generation failed.' },
      { status: 500 }
    );
  }
}
