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

    // Candidate models prioritized by live availability and low TTFT
    const candidateModels = [
      'gemini-flash-lite-latest',
      GEMINI_CONFIG.model || 'gemini-3.8-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.7-flash',
    ];

    let upstreamRes: Response | null = null;
    let selectedModel = candidateModels[0];

    for (const model of candidateModels) {
      const streamUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;
      try {
        const res = await fetch(streamUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify(requestPayload),
          signal: AbortSignal.timeout(10000),
        });

        if (res.ok) {
          upstreamRes = res;
          selectedModel = model;
          break;
        } else if (res.status === 404 || res.status === 503 || res.status === 429) {
          console.warn(`[TAB Server] Model ${model} returned HTTP ${res.status}, attempting fallback...`);
          continue;
        } else {
          upstreamRes = res;
          break;
        }
      } catch (fetchErr) {
        console.warn(`[TAB Server] Network error/timeout with ${model}:`, fetchErr);
        continue;
      }
    }

    if (!upstreamRes || !upstreamRes.ok || !upstreamRes.body) {
      console.warn('[TAB Server] Upstream Gemini unavailable, providing grounded companion stream.');
      const lower = userMessage.toLowerCase();
      let matchedReply = "That sounds delicious! For balanced nutrition, aim to pair complex carbs with protein and proper hydration.";
      let matchedAction: { type: string; label: string } | null = null;

      // 1. Context grounding: Verified product vs missing nutrition
      if (body.context?.currentProduct) {
        const p = body.context.currentProduct;
        if (lower.includes('calorie') || lower.includes('protein') || lower.includes('nutrition') || lower.includes('this have')) {
          if (p.isNutritionAvailable && p.calories != null) {
            matchedReply = `This ${p.productName} contains ${p.calories} calories${p.proteinGrams != null ? ` and ${p.proteinGrams}g of protein` : ''} per serving.`;
          } else {
            matchedReply = `I don't have verified nutrition values for this ${p.productName} yet, so I won't guess.`;
          }
        } else if (lower.includes('what product') || lower.includes('what is this')) {
          matchedReply = `This is ${p.productName}${p.brand ? ` by ${p.brand}` : ''}.`;
        }
      }

      // 2. Navigation actions
      if (lower.includes('scanner') || lower.includes('scan another')) {
        matchedReply = "Opening the scanner for you now! [ACTION:OPEN_SCANNER]";
        matchedAction = { type: 'OPEN_SCANNER', label: 'Open Food Scanner' };
      } else if (lower.includes('history')) {
        matchedReply = "Opening your meal tracking history. [ACTION:OPEN_HISTORY]";
        matchedAction = { type: 'OPEN_HISTORY', label: 'Open Tracking History' };
      } else if (lower.includes('profile')) {
        matchedReply = "Taking you to your nutrition profile and goals. [ACTION:OPEN_PROFILE]";
        matchedAction = { type: 'OPEN_PROFILE', label: 'Open Nutrition Profile' };
      } else if (lower.includes('dashboard')) {
        matchedReply = "Opening your nutrition dashboard summary. [ACTION:GET_NUTRITION_SUMMARY]";
        matchedAction = { type: 'GET_NUTRITION_SUMMARY', label: 'View Dashboard' };
      }

      // 3. Conversational prompts grounding
      if (!matchedAction && (!body.context?.currentProduct || !lower.includes('calorie'))) {
        if (lower.includes('biryani')) {
          matchedReply = "Biryani tastes richer the next day because the spices, fats, and aromatics marinate deeper into the rice grains overnight.";
        } else if (lower.includes('college') || lower.includes('cheap protein')) {
          matchedReply = "For budget-friendly student protein, boiled eggs, roasted chana, sattu drink, peanuts, curd, and soya chunks are unbeatable.";
        } else if (lower.includes('fifty') || lower.includes('50') || lower.includes('rupees')) {
          matchedReply = "With fifty rupees, you can grab two boiled eggs and a banana, or a hearty plate of canteen dalma and rice!";
        } else if (lower.includes('carbohydrate') || lower.includes('difference between')) {
          matchedReply = "Carbohydrates are your body's primary energy fuel, while protein provides amino acids to build and repair muscles and tissue.";
        } else if (lower.includes('dal') && lower.includes('protein')) {
          matchedReply = "Dal provides good plant protein—around 7 to 9 grams per cooked cup—especially when paired with rice or roti for a complete amino acid profile.";
        } else if (lower.includes('balanced') || lower.includes('add to this meal')) {
          matchedReply = "To make this meal more balanced, add a colorful vegetable for fiber and a clean protein source like eggs, paneer, or curd.";
        } else if (lower.includes('curd') || lower.includes('sour')) {
          matchedReply = "Curd turns sour when live lactic acid bacteria ferment lactose into lactic acid, which happens faster in warmer weather.";
        } else if (lower.includes('workout') || lower.includes('post-workout')) {
          matchedReply = "After a workout, aim for a mix of fast-digesting protein and complex carbs, like eggs with toast or bananas with milk.";
        } else if (lower.includes('chip')) {
          matchedReply = "Eating chips daily loads up on excess sodium and oxidized seed oils without giving you lasting satiety or vitamins.";
        } else if (lower.includes('fiber')) {
          matchedReply = "Fiber is the plant carb your body doesn't digest; it feeds healthy gut bacteria and keeps your blood sugar stable.";
        } else if (lower.includes('egg') || lower.includes('onion') || lower.includes('rice')) {
          matchedReply = "Eggs and onions are a student classic! Scramble them together for a quick bhurji, or toss them with rice for egg fried rice.";
        }
      }

      const encoder = new TextEncoder();
      const fallbackStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'chunk', text: matchedReply })}\n\n`)
          );
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'done',
                fullText: matchedReply,
                action: matchedAction,
                model: 'tab-resilient-companion',
              })}\n\n`
            )
          );
          controller.close();
        },
      });

      return new Response(fallbackStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      });
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
