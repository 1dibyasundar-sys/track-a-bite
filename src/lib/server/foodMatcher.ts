import { INDIAN_FOOD_DATABASE } from '../../data/foods';
import { FoodItem } from '../types/food';
import { CandidateMatch } from '../types/recognition';

export interface FoodMatchResult {
  foodId: string;
  matchedFood: FoodItem | null;
  canonicalName: string;
  localNameHindi?: string;
  matchConfidence: number; // 0.0 - 1.0 (how closely Gemini's name matched our database)
  needsConfirmation: boolean;
  candidateMatches: CandidateMatch[];
}

// Synonyms and transliterations mapping to database food IDs
const COMMON_SYNONYMS: Record<string, string> = {
  // Rice
  rice: 'steamed-rice',
  'steamed rice': 'steamed-rice',
  chawal: 'steamed-rice',
  'white rice': 'steamed-rice',
  'boiled rice': 'steamed-rice',
  'seasoned rice': 'steamed-rice',
  'jeera rice': 'steamed-rice',
  'cooked rice': 'steamed-rice',
  'plain rice': 'steamed-rice',
  bhat: 'steamed-rice',

  // Dal / Lentils
  dal: 'dal-tadka',
  'yellow dal': 'dal-tadka',
  'dal tadka': 'dal-tadka',
  'toor dal': 'dal-tadka',
  'dal fry': 'dal-tadka',
  'lentil soup': 'dal-tadka',
  'yellow lentil': 'dal-tadka',
  'lentil dal': 'dal-tadka',
  'lentil curry': 'dal-tadka',
  'dal curry': 'dal-tadka',
  'dal curry like preparation': 'dal-tadka',
  'dal curry preparation': 'dal-tadka',
  'dal like preparation': 'dal-tadka',
  'dal preparation': 'dal-tadka',
  'lentil preparation': 'dal-tadka',
  'curry like preparation': 'dal-tadka',
  'dal or curry': 'dal-tadka',
  daal: 'dal-tadka',

  // Roti / Breads
  roti: 'whole-wheat-roti',
  chapati: 'whole-wheat-roti',
  phulka: 'whole-wheat-roti',
  'wheat roti': 'whole-wheat-roti',
  bread: 'whole-wheat-roti',

  // Snacks & Street food
  kachori: 'kachori',
  'moong dal kachori': 'kachori',
  'khasta kachori': 'kachori',
  samosa: 'samosa',
  'aloo samosa': 'samosa',
  'potato samosa': 'samosa',
  'sprouts chaat': 'sprouts-chaat',
  sprouts: 'sprouts-chaat',
  'moong sprouts': 'sprouts-chaat',
  'sprouted moong': 'sprouts-chaat',
  'chana chaat': 'chana-chaat',
  'kala chana': 'chana-chaat',

  // Packaged & Quick Hostel
  chips: 'potato-chips',
  'potato chips': 'potato-chips',
  lays: 'potato-chips',
  wafers: 'potato-chips',
  'packaged chips': 'potato-chips',
  juice: 'packaged-juice',
  'packaged juice': 'packaged-juice',
  'fruit juice': 'packaged-juice',
  'real juice': 'packaged-juice',
  maggi: 'hostel-maggi',
  'instant noodles': 'hostel-maggi',
  noodles: 'hostel-maggi',

  // Protein & Fresh
  egg: 'boiled-eggs',
  'boiled egg': 'boiled-eggs',
  'boiled eggs': 'boiled-eggs',
  anda: 'boiled-eggs',
  'bread omelette': 'bread-omelette',
  omelette: 'bread-omelette',
  banana: 'banana',
  kela: 'banana',
  curd: 'fresh-curd',
  dahi: 'fresh-curd',
  yogurt: 'fresh-curd',
  peanuts: 'roasted-peanuts',
  singdana: 'roasted-peanuts',

  // Curries & Sabzis
  'potato curry': 'aloo-curry',
  'aloo sabzi': 'aloo-curry',
  'aloo rassa': 'aloo-curry',
  'aloo matar': 'aloo-curry',
  aloo: 'aloo-curry',
  'palak paneer': 'palak-paneer',
  paneer: 'palak-paneer',
  'vegetable curry': 'vegetable-curry',
  'veg curry': 'vegetable-curry',
  'mixed vegetable curry': 'vegetable-curry',
  'mixed vegetable preparation': 'vegetable-curry',
  'mixed vegetables': 'vegetable-curry',
  'mixed vegetable': 'vegetable-curry',
  'vegetable preparation': 'vegetable-curry',
  'cooked vegetables': 'vegetable-curry',
  'mixed veg': 'vegetable-curry',
  'mix veg': 'vegetable-curry',
  'mix veg sabzi': 'vegetable-curry',
  sabzi: 'vegetable-curry',
  sabji: 'vegetable-curry',
  'tiffin sabzi': 'vegetable-curry',
  'mess sabzi': 'vegetable-curry',
  'cooked sabzi': 'vegetable-curry',
  'dry sabzi': 'vegetable-curry',
  'tari wali sabzi': 'vegetable-curry',

  // Condiments: Pickle, Chutney & Papad
  pickle: 'mango-pickle',
  achar: 'mango-pickle',
  aachar: 'mango-pickle',
  'mango pickle': 'mango-pickle',
  'mixed pickle': 'mango-pickle',
  'indian pickle': 'mango-pickle',
  'spicy pickle': 'mango-pickle',
  'lemon pickle': 'mango-pickle',
  'lime pickle': 'mango-pickle',
  'nimbu achar': 'mango-pickle',
  lonche: 'mango-pickle',

  chutney: 'mint-chutney',
  'green chutney': 'mint-chutney',
  'hari chutney': 'mint-chutney',
  'mint chutney': 'mint-chutney',
  'coriander chutney': 'mint-chutney',
  'pudina chutney': 'mint-chutney',
  'dhaniya chutney': 'mint-chutney',
  'canteen chutney': 'mint-chutney',
  'spicy green chutney': 'mint-chutney',

  papad: 'roasted-papad',
  'roasted papad': 'roasted-papad',
  papadum: 'roasted-papad',
  papadam: 'roasted-papad',
  'fried papad': 'roasted-papad',
  'urad papad': 'roasted-papad',
  'masala papad': 'roasted-papad',
  'canteen papad': 'roasted-papad',
  appalam: 'roasted-papad',
  'papad disc': 'roasted-papad',

  // True Raw Salads
  kachumber: 'kachumber-salad',
  'kachumber salad': 'kachumber-salad',
  'fresh kachumber salad': 'kachumber-salad',
  'cucumber salad': 'kachumber-salad',
  'cucumber tomato salad': 'kachumber-salad',
  'green salad': 'kachumber-salad',
  'onion tomato salad': 'kachumber-salad',
  'fresh salad': 'kachumber-salad',
  'raw salad': 'kachumber-salad',

  // Other staples
  sambar: 'sambar',
  idli: 'idli-sambar',
  dosa: 'plain-dosa',
  'plain dosa': 'plain-dosa',
  'masala dosa': 'masala-dosa',
  'sada dosa': 'plain-dosa',
  poha: 'poha',
  upma: 'vegetable-upma',
  'vegetable upma': 'vegetable-upma',
  'rava upma': 'vegetable-upma',
  'roasted chana': 'roasted-chana',
  'bhuna chana': 'roasted-chana',
  milk: 'fresh-milk',
  'fresh milk': 'fresh-milk',
  doodh: 'fresh-milk',
  guava: 'fresh-guava',
  amrood: 'fresh-guava',
  papaya: 'fresh-papaya',
  papita: 'fresh-papaya',
};

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Maps a Gemini-identified food name to the internal INDIAN_FOOD_DATABASE.
 * Returns the best match or flags `needsConfirmation` if confidence is low.
 *
 * CRITICAL FALSE-POSITIVE GUARDS:
 * 1. Cooked vegetable preparations MUST NOT map to kachumber-salad.
 * 2. Pickle and chutney MUST NOT map to salad.
 * 3. Chutney MUST NOT map to plain-dosa simply because dosa mentions chutney in its title.
 */
export function mapGeminiFoodToDatabase(rawFoodName: string): FoodMatchResult {
  const normalized = normalizeString(rawFoodName);

  const isDalQuery =
    /\b(dal|daal|toor|lentil|yellow dal|dal fry|dal tadka)\b/i.test(normalized);

  const isCookedVegQuery =
    !isDalQuery &&
    (/\b(cooked|curry|sabzi|sabji|preparation|gravy|tari|stew|sauteed|saut|fried|warm|hot|spiced)\b/i.test(normalized) ||
      normalized.includes('mixed veg') ||
      normalized.includes('mixed vegetable') ||
      normalized.includes('vegetable curry'));

  const isPickleQuery =
    /\b(pickle|achar|aachar|lonche|nimbu achar)\b/i.test(normalized);

  const isChutneyQuery =
    /\b(chutney|chatni|hari chutney|mint chutney|pudina chutney)\b/i.test(normalized);

  // 1. Direct synonym lookup
  if (COMMON_SYNONYMS[normalized]) {
    const foodId = COMMON_SYNONYMS[normalized];

    // Guard: never allow cooked veg or pickle/chutney to map to kachumber-salad
    if (
      (isCookedVegQuery || isPickleQuery || isChutneyQuery) &&
      (foodId === 'kachumber-salad' || foodId === 'sprouted-moong-salad')
    ) {
      // Divert to vegetable curry or pickle
      const correctedId = isPickleQuery ? 'mango-pickle' : isChutneyQuery ? 'mint-chutney' : 'vegetable-curry';
      const correctedFood = INDIAN_FOOD_DATABASE.find(f => f.id === correctedId);
      if (correctedFood) {
        return {
          foodId: correctedFood.id,
          matchedFood: correctedFood,
          canonicalName: correctedFood.name,
          localNameHindi: correctedFood.localNames.hindi,
          matchConfidence: 0.92,
          needsConfirmation: false,
          candidateMatches: findAlternativeCandidates(correctedFood.id),
        };
      }
    }

    const food = INDIAN_FOOD_DATABASE.find(f => f.id === foodId);
    if (food) {
      return {
        foodId: food.id,
        matchedFood: food,
        canonicalName: food.name,
        localNameHindi: food.localNames.hindi,
        matchConfidence: 0.96,
        needsConfirmation: false,
        candidateMatches: findAlternativeCandidates(food.id),
      };
    }
  }

  // 2. Exact or high-precision alias / ID match in database
  for (const food of INDIAN_FOOD_DATABASE) {
    const normName = normalizeString(food.name);
    const normId = normalizeString(food.id);
    const normHindi = food.localNames.hindi || '';

    // Guard against salad false positives
    if (
      (isCookedVegQuery || isPickleQuery || isChutneyQuery) &&
      (food.id === 'kachumber-salad' || food.id === 'sprouted-moong-salad')
    ) {
      continue;
    }

    // Guard: Do NOT match plain-dosa when query is just chutney
    if (isChutneyQuery && food.id === 'plain-dosa') {
      continue;
    }

    const hasAliasMatch = food.aliases && food.aliases.some(a => {
      const normA = normalizeString(a);
      return normA === normalized;
    });

    if (
      normalized === normId ||
      normalized === normName ||
      hasAliasMatch ||
      (normHindi && normalized === normalizeString(normHindi))
    ) {
      return {
        foodId: food.id,
        matchedFood: food,
        canonicalName: food.name,
        localNameHindi: food.localNames.hindi,
        matchConfidence: 0.94,
        needsConfirmation: false,
        candidateMatches: findAlternativeCandidates(food.id),
      };
    }

    // Substring match: require significant character overlap to avoid false substring triggers
    const isSignificantNameMatch =
      (normalized.length >= 4 && normName.startsWith(normalized)) ||
      (normName.length >= 4 && normalized.startsWith(normName));

    if (isSignificantNameMatch) {
      return {
        foodId: food.id,
        matchedFood: food,
        canonicalName: food.name,
        localNameHindi: food.localNames.hindi,
        matchConfidence: 0.88,
        needsConfirmation: false,
        candidateMatches: findAlternativeCandidates(food.id),
      };
    }
  }

  // 3. Partial keyword scoring across database with domain affinity
  const keywords = normalized.split(' ').filter(w => w.length > 2);
  let bestFood: FoodItem | null = null;
  let highestScore = 0;

  for (const food of INDIAN_FOOD_DATABASE) {
    // Guard: never score kachumber-salad for cooked vegetables or pickle/chutney
    if (
      (isCookedVegQuery || isPickleQuery || isChutneyQuery) &&
      (food.id === 'kachumber-salad' || food.id === 'sprouted-moong-salad')
    ) {
      continue;
    }

    // Guard: do not score dosa for standalone chutney
    if (isChutneyQuery && food.id === 'plain-dosa') {
      continue;
    }

    const target = `${food.name} ${food.id} ${food.category} ${food.description}`.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      if (target.includes(kw)) score += 1;
    }

    // Affinity bonus for category alignment
    if (isDalQuery && food.id === 'dal-tadka') {
      score += 3;
    }
    if (isCookedVegQuery && food.id === 'vegetable-curry') {
      score += 2;
    }
    if (isPickleQuery && food.id === 'mango-pickle') {
      score += 3;
    }
    if (isChutneyQuery && food.id === 'mint-chutney') {
      score += 3;
    }

    if (score > highestScore) {
      highestScore = score;
      bestFood = food;
    }
  }

  if (bestFood && highestScore >= 1) {
    const isStrongMatch = highestScore >= 2;
    const matchConfidence = isStrongMatch ? 0.82 : 0.58;
    return {
      foodId: bestFood.id,
      matchedFood: bestFood,
      canonicalName: bestFood.name,
      localNameHindi: bestFood.localNames.hindi,
      matchConfidence,
      needsConfirmation: !isStrongMatch || matchConfidence < 0.60,
      candidateMatches: findAlternativeCandidates(bestFood.id),
    };
  }

  // 4. No reliable match found: fallback to unmapped state
  const defaultAlternatives: CandidateMatch[] = INDIAN_FOOD_DATABASE.slice(0, 3).map(f => ({
    foodId: f.id,
    name: f.name,
    localNameHindi: f.localNames.hindi,
    confidence: 0.5,
  }));

  return {
    foodId: 'unmapped-food',
    matchedFood: null,
    canonicalName: rawFoodName,
    localNameHindi: undefined,
    matchConfidence: 0.4,
    needsConfirmation: true,
    candidateMatches: defaultAlternatives,
  };
}

export function findAlternativeCandidates(currentFoodId: string): CandidateMatch[] {
  // Tailored alternative pairings for realistic fast user correction
  const SPECIFIC_ALTERNATIVES: Record<string, string[]> = {
    'vegetable-curry': ['aloo-curry', 'palak-paneer', 'gajar-methi-sabzi'],
    'dal-tadka': ['sambar', 'chole-masala', 'rajma-masala'],
    'steamed-rice': ['moong-dal-khichdi', 'poha-peanuts', 'ragi-mudde'],
    'kachumber-salad': ['sprouted-moong-salad', 'fresh-curd'],
    'mango-pickle': ['mint-chutney', 'fresh-curd'],
    'mint-chutney': ['mango-pickle', 'fresh-curd'],
    'kachori': ['samosa', 'potato-chips'],
    'hostel-maggi': ['boiled-eggs', 'bread-omelette'],
    'boiled-eggs': ['bread-omelette', 'roasted-peanuts'],
    'potato-chips': ['roasted-peanuts', 'roasted-chana'],
  };

  const specificIds = SPECIFIC_ALTERNATIVES[currentFoodId];
  if (specificIds) {
    return specificIds
      .map(id => INDIAN_FOOD_DATABASE.find(f => f.id === id))
      .filter((f): f is FoodItem => Boolean(f))
      .map(f => ({
        foodId: f.id,
        name: f.name,
        localNameHindi: f.localNames.hindi,
        confidence: 0.65,
      }));
  }

  const current = INDIAN_FOOD_DATABASE.find(f => f.id === currentFoodId);
  if (!current) return [];

  return INDIAN_FOOD_DATABASE.filter(f => f.id !== currentFoodId && f.category === current.category)
    .slice(0, 3)
    .map(f => ({
      foodId: f.id,
      name: f.name,
      localNameHindi: f.localNames.hindi,
      confidence: 0.6,
    }));
}
