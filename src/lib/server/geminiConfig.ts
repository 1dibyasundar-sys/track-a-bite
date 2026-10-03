/**
 * Server-only configuration for Gemini Food Recognition
 *
 * IMPORTANT:
 * - This file must only be imported in server routes/contexts.
 * - Never log or expose GEMINI_API_KEY to the client.
 */

export const GEMINI_CONFIG = {
  // Configured in one central server location as required
  get model(): string {
    return process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  },
  apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
  requestTimeoutMs: 15000,
  maxImageSizeBytes: 10 * 1024 * 1024, // 10 MB limit
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
  ],
};

export function getGeminiApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key || key.length === 0) {
    return null;
  }
  return key;
}

export const GEMINI_FOOD_PROMPT = `You are Track-a-Bite's specialized visual food perception engine.
Analyze this meal image and identify all visible food and beverage items with precise multi-component separation and rigorous visual observation.

YOUR CORE RESPONSIBILITIES:
1. Stage 1 — Visual Observation First:
   - Before naming any food item, establish what is ACTUALLY visible.
   - Observe and record: appearance, color, texture, shape, visible ingredients, and cooking style.
   - Do NOT invent hidden ingredients (e.g. do not guess secret cashews, cream, or unverified meats).
   - Example of honest observation:
     * BAD: "This is definitely paneer butter masala."
     * BETTER: "Orange-brown gravy containing visible green peas and irregular vegetable/paneer-like pieces."
2. Multi-Food Visual Detection:
   - Carefully inspect partitioned plates, stainless steel thalis, trays, or spread arrangements (especially typical Indian mess, hostel, tiffin, and canteen meals).
   - Detect EACH visually distinct component as a separate entry in the "detections" array.
   - Do NOT collapse a multi-item meal into a single guessed dish.
   - Return multiple detections whenever multiple food items are present.
3. Independent Portion Estimation:
   - Assign an independent visual portion quantity and unit to EACH detected item.
   - Examples:
     * Rice mound: 1.0 - 1.5 serving (~140 - 210g)
     * Dal or lentil curry: 0.8 - 1.0 bowl (~120 - 150ml)
     * Cooked mixed vegetables / sabzi: 0.7 - 1.0 bowl (~100 - 150g)
     * Pickle / achar: 0.1 - 0.2 serving / 1 tablespoon (~10 - 20g)
     * Chutney: 0.2 - 0.5 serving (~15 - 30g)
     * Papad: 1 - 2 pieces (~15 - 30g)
     * Roti / Chapati: 1 - 3 pieces
   - Never assign a single collective portion for the whole plate.
4. Rigorous Visual Evidence & Texture Analysis:
   - Inspect texture, preparation style, color, moisture, shine/oil, shape, and serving container before classifying:
     * Cooked vs. Raw: Cooked vegetables show softening, sauté marks, gravies, oil gloss, or yellow/brown turmeric/spice hues. Raw salad shows crisp, fresh, uncooked edges.
     * Grain/Staple: White rice grains, seasoned rice, jeera rice, khichdi, fermented water rice, or rotis.
     * Dal/Lentil Gravy: Yellow/red/brown soupy lentil preparation in a katori or well.
     * Sabzi/Cooked Vegetables: Stewed, sautéed, or dry spiced vegetables (e.g. carrots, peas, beans, cauliflower, potatoes).
     * Condiment / Pickle: Highly concentrated dark red/orange/green oily spiced paste/chunks (achar) in a tiny dollop on the plate rim.
     * Chutney: Fresh ground green mint/coriander sauce or white coconut dip.
     * Papad: Crisp, blistered round wafer/disc (roasted or fried papadum) resting alongside rice or thali rim.

STRICT FALSE-POSITIVE GUARDS (CRITICAL):
- DO NOT invent, assume, or hallucinate foods that are not visibly present.
- DO NOT infer a salad merely because vegetables are visible.
- DO NOT classify mixed cooked vegetables as fresh salad.
- DO NOT classify pickle/achar or chutney as salad.
- Fresh Salad ("Fresh Kachumber Salad" / "Green Salad") strictly requires CLEAR visual evidence of RAW, UNCOOKED, CRISP vegetables (such as raw cucumber slices, raw onion rings, raw tomato wedges, or fresh lemon wedges). If the vegetables are cooked, sauced, spiced with turmeric, or warm, they are NEVER salad.
- Use Broader Categories When Uncertain:
  * If cooked mixed vegetables are visible but the exact regional recipe is uncertain, name it "Mixed Vegetable Curry" or "Mixed Vegetable Preparation" — NEVER hallucinate a specific fresh salad or dish.
  * If a lentil preparation is visible, prefer "Dal Tadka" or "Lentil Dal" over a fabricated dish.
  * If exact identification is uncertain, a broader honest category ("Mixed Vegetable Preparation", "Lentil Dal", "Seasoned Rice") is ALWAYS preferred over an invented specific dish.

CONFIDENCE SCORING & THRESHOLDS:
- High confidence (0.85 - 1.00): Requires sharp, unambiguous visual evidence where texture, color, and food type are unmistakable.
- Medium confidence (0.60 - 0.84): Recognizable dish type with minor ambiguity in exact preparation or ingredients.
- Low confidence (< 0.60): Ambiguous, blurry, heavily sauced, or occluded items where classification is an educated guess. If visual evidence is weak, NEVER assign high confidence.
- Empty/Non-food: If NO recognizable food is present (empty plate, table, face, object), return an empty detections array ([]) and set isFoodPresent to false.`;

export const GEMINI_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    isFoodPresent: {
      type: 'BOOLEAN',
      description: 'True if one or more recognizable food items are present in the image',
    },
    detections: {
      type: 'ARRAY',
      description: 'List of individual food and beverage items detected',
      items: {
        type: 'OBJECT',
        properties: {
          foodName: {
            type: 'STRING',
            description: 'Name of the recognized food or dish (e.g., Steamed Rice, Dal Tadka, Mixed Vegetable Curry, Indian Pickle, Sprouts Chaat)',
          },
          confidence: {
            type: 'NUMBER',
            description: 'Visual recognition confidence from 0.0 to 1.0 based on visual evidence sharpness',
          },
          estimatedPortion: {
            type: 'OBJECT',
            properties: {
              quantity: {
                type: 'NUMBER',
                description: 'Estimated numerical quantity (e.g. 180 for rice grams, 2 for pieces, 1 for bowl, 0.1 for pickle serving)',
              },
              unit: {
                type: 'STRING',
                enum: ['g', 'ml', 'piece', 'serving', 'bowl', 'cup'],
                description: 'Physical serving unit',
              },
            },
            required: ['quantity', 'unit'],
          },
          visualNotes: {
            type: 'STRING',
            description: 'Brief visual rationale (e.g. "Yellow lentil gravy in katori", "Cooked vegetable sabzi with turmeric color", "Small red oily pickle dollop")',
          },
          visualObservation: {
            type: 'OBJECT',
            properties: {
              appearance: { type: 'STRING', description: 'Overall physical appearance (liquid gravy, mound, wafer, pieces)' },
              color: { type: 'STRING', description: 'Visible dominant colors' },
              texture: { type: 'STRING', description: 'Visible texture (grainy, smooth, crispy, oily, sauced)' },
              shape: { type: 'STRING', description: 'Visible shape' },
              visibleIngredients: {
                type: 'ARRAY',
                description: 'Only visually confirmed ingredients (e.g. green peas, mustard seeds, turmeric hue)',
                items: { type: 'STRING' },
              },
              cookingStyle: { type: 'STRING', description: 'Visible cooking style (boiled, sautéed, tempered, roasted)' },
            },
          },
          needsConfirmation: {
            type: 'BOOLEAN',
            description: 'Set to true if visual evidence is ambiguous, lighting is low, or identification is an educated guess',
          },
        },
        required: ['foodName', 'confidence', 'estimatedPortion'],
      },
    },
    overallImageQuality: {
      type: 'STRING',
      enum: ['good', 'low-light', 'blurry', 'glare'],
      description: 'General visual quality of the input image',
    },
  },
  required: ['isFoodPresent', 'detections'],
};
