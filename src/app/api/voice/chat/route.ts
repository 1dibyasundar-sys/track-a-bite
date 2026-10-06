import { NextRequest, NextResponse } from 'next/server';
import { getGeminiApiKey, GEMINI_CONFIG } from '../../../../lib/server/geminiConfig';
import { formatTABContextForPrompt } from '../../../../lib/voice/tabContext';
import { TABContext } from '../../../../lib/voice/types';
import { extractActionFromText } from '../../../../lib/voice/tabTools';

export const dynamic = 'force-dynamic';

const TAB_SYSTEM_PROMPT = `You are TAB (Track-a-Bite AI Food Companion).
You are NOT a narrow nutrition chatbot.
You are a warm, smart, knowledgeable food companion who deeply understands food, cooking, recipes, ingredients, nutrition, macronutrients, micronutrients, food science, food history, regional Indian cuisine (especially Odisha, Bengal, North & South India), street food, canteen food, hostel/mess hacks, budget eating, packaged foods, and food safety.

CONVERSATION & TONE RULES:
1. Speak naturally, warmly, and conversationally — like a knowledgeable foodie friend.
2. Avoid robotic disclaimers like "According to my database...", "As an AI language model...", or "Your query indicates...".
3. Because the user is listening to you speaking out loud via voice, keep your answers concise, direct, and conversational (typically 2-4 sentences unless a detailed recipe or explanation was explicitly requested).
4. Feel free to be enthusiastic about good food, clever cooking tips, and practical student/hostel food adjustments.
5. If the user asks about something slightly outside food (e.g. "I'm going to the gym" or "I'm tired"), answer naturally and connect it to food, hydration, or recovery.

ZERO-HALLUCINATION NUTRITION RULE:
- Ground factual nutrition in verified data when provided in the context.
- If verified nutrition is unavailable for a product, say honestly: "I don't have verified nutrition values for this product yet."
- NEVER invent calories, protein, carbs, fat, sugar, fiber, or sodium.
- NEVER convert null or missing values into zero.

MEDICAL SAFETY:
- You may freely discuss nutritional and dietary context.
- Never diagnose medical conditions or prescribe medical treatments.
- For serious health conditions, suggest consulting a healthcare professional.

APPLICATION ACTIONS:
If the user asks to perform an action, append the tag at the end of your response:
- Open food camera scanner: [ACTION:OPEN_SCANNER]
- Open barcode scanner: [ACTION:OPEN_BARCODE_SCANNER]
- Scan another item: [ACTION:SCAN_ANOTHER_PRODUCT]
- Open tracking history: [ACTION:OPEN_HISTORY]
- Open profile/targets: [ACTION:OPEN_PROFILE]`;

interface ChatRequestPayload {
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; text: string }>;
  context?: TABContext;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key is not configured on the server.' },
        { status: 503 }
      );
    }

    const body = (await req.json()) as ChatRequestPayload;
    const userMessage = body.message?.trim();

    if (!userMessage) {
      return NextResponse.json(
        { error: 'Message cannot be empty.' },
        { status: 400 }
      );
    }

    const contextPrompt = formatTABContextForPrompt(body.context);

    // Build conversation history for Gemini
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    // Prior history (last 6 turns for session continuity)
    if (body.history && Array.isArray(body.history)) {
      const recentHistory = body.history.slice(-6);
      for (const turn of recentHistory) {
        contents.push({
          role: turn.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: turn.text }],
        });
      }
    }

    // Current turn with contextual grounding
    const currentTurnText = contextPrompt
      ? `CURRENT APPLICATION CONTEXT:\n${contextPrompt}\n\nUSER INQUIRY:\n${userMessage}`
      : userMessage;

    contents.push({
      role: 'user',
      parts: [{ text: currentTurnText }],
    });

    const requestPayload = {
      system_instruction: {
        parts: [{ text: TAB_SYSTEM_PROMPT }],
      },
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 350,
      },
    };

    // Candidate models with fast fallback
    const candidateModels = [
      GEMINI_CONFIG.model || 'gemini-3.8-flash',
      'gemini-3.1-flash-lite',
      'gemini-3.8-flash-lite',
      'gemini-3.7-flash',
      'gemini-3.5-flash',
    ];

    let upstreamRes: Response | null = null;
    let selectedModel = candidateModels[0];

    for (const model of candidateModels) {
      const streamUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
      try {
        const res = await fetch(streamUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestPayload),
        });

        if (res.ok) {
          upstreamRes = res;
          selectedModel = model;
          break;
        } else if (res.status === 404 || res.status === 503) {
          console.warn(`[TAB Server] Model ${model} returned HTTP ${res.status}, attempting fallback...`);
          continue;
        } else {
          upstreamRes = res;
          break;
        }
      } catch (fetchErr) {
        console.warn(`[TAB Server] Network error with ${model}:`, fetchErr);
        continue;
      }
    }

    if (!upstreamRes || !upstreamRes.ok || !upstreamRes.body) {
      const errorText = upstreamRes ? await upstreamRes.text().catch(() => '') : 'Upstream unavailable';
      console.error('[TAB Server] Upstream Gemini error:', errorText);
      return NextResponse.json(
        { error: 'TAB is temporarily busy. Please try again in a moment.' },
        { status: upstreamRes ? upstreamRes.status : 503 }
      );
    }

    // Set up streaming response to client
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const upstreamReader = upstreamRes.body.getReader();

    let fullAccumulatedText = '';

    const stream = new ReadableStream({
      async start(controller) {
        let buffer = '';
        try {
          while (true) {
            const { done, value } = await upstreamReader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith('data: ')) {
                const dataJsonStr = trimmed.substring(6);
                try {
                  const parsed = JSON.parse(dataJsonStr);
                  const chunkText = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                  if (chunkText) {
                    fullAccumulatedText += chunkText;
                    // Send chunk event
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ type: 'chunk', text: chunkText })}\n\n`)
                    );
                  }
                } catch {
                  // Ignore JSON parse errors for incomplete chunks
                }
              }
            }
          }

          // Check for actions in full text
          const { cleanText, action } = extractActionFromText(fullAccumulatedText);

          // Send final completion event
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'done',
                fullText: cleanText,
                action: action || null,
                model: selectedModel,
              })}\n\n`
            )
          );
          controller.close();
        } catch (streamErr) {
          console.error('[TAB Server] Streaming error:', streamErr);
          controller.error(streamErr);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('[TAB Server] Uncaught error:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while communicating with TAB.' },
      { status: 500 }
    );
  }
}
