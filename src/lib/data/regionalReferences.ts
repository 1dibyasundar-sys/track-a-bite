import { FoodItem } from '../types/food';

/**
 * Standard reference composition profiles for regional and unfamiliar Indian foods.
 * Derived from ICMR-NIN (National Institute of Nutrition) regional food composition data.
 * Used when food is identified through web research/grounding but is not in the primary local catalog.
 */
export const REGIONAL_NUTRITION_REFERENCES: Record<string, FoodItem> = {
  'pakhala-bhata': {
    id: 'pakhala-bhata',
    name: 'Pakhala Bhata (Odia Fermented Water Rice)',
    aliases: ['pakhala', 'fermented water rice', 'dahi pakhala', 'saja pakhala', 'basi pakhala', 'water rice'],
    category: 'Fermented & Traditional',
    serving: {
      size: 1,
      unit: 'bowl',
      weightGrams: 250,
      description: '1 bowl fermented water rice with tempered curd (250g)',
    },
    nutrition: {
      calories: 145,
      carbohydrates: 31.0,
      protein: 3.2,
      fat: 0.8,
      fiber: 1.8,
      sodium: 180,
      isApproximate: true,
    },
    localNames: {
      hindi: 'पखाळ भात',
      odia: 'ପଖାଳ ଭାତ',
    },
    region: 'East Indian',
    description: 'Cooked rice soaked in water and lightly fermented overnight, tempered with curd, mustard seeds, curry leaves, and green chillies.',
    culturalContext: 'A traditional summer staple across Odisha, celebrated for its probiotic cooling properties and easy digestibility.',
    commonIngredients: ['Cooked rice', 'Water', 'Curd', 'Mustard seeds', 'Curry leaves', 'Green chillies', 'Salt'],
    standardServingSize: '1 bowl (250g)',
    servingUnit: 'bowl',
    weightGramsPerUnit: 250,
    nutritionPerServing: {
      calories: 145,
      carbohydrates: 31.0,
      protein: 3.2,
      fat: 0.8,
      fiber: 1.8,
      sodium: 180,
    },
    affordability: 'Budget-Friendly',
    dietaryTags: ['Vegetarian', 'Probiotic', 'Low-GI'],
    pairingRecommendations: ['dalma', 'roasted-papad', 'mango-pickle'],
  },
  dalma: {
    id: 'dalma',
    name: 'Dalma (Odia Lentil & Vegetable Stew)',
    aliases: ['dalma', 'oriya dalma', 'odia dalma', 'lentil vegetable stew'],
    category: 'Lentils & Pulses (Dal)',
    serving: {
      size: 1,
      unit: 'bowl',
      weightGrams: 160,
      description: '1 bowl lentil and vegetable stew (160g)',
    },
    nutrition: {
      calories: 135,
      carbohydrates: 18.5,
      protein: 7.2,
      fat: 3.5,
      fiber: 4.8,
      iron: 2.4,
      calcium: 45,
      vitaminA: 85,
      potassium: 310,
      isApproximate: true,
    },
    localNames: {
      hindi: 'डालमा',
      odia: 'ଡାଲମା',
    },
    region: 'East Indian',
    description: 'Toor or chana dal cooked with seasonal chunky vegetables (raw papaya, pumpkin, brinjal) tempered with panch phoron and roasted cumin-chilli powder.',
    culturalContext: 'Sacred dish offered in the Jagannath Temple Mahaprasad, balancing plant protein with micronutrient-dense vegetables.',
    commonIngredients: ['Toor dal', 'Raw papaya', 'Pumpkin', 'Brinjal', 'Panch phoron', 'Roasted cumin-chilli powder', 'Ghee'],
    standardServingSize: '1 bowl (160g)',
    servingUnit: 'bowl',
    weightGramsPerUnit: 160,
    nutritionPerServing: {
      calories: 135,
      carbohydrates: 18.5,
      protein: 7.2,
      fat: 3.5,
      fiber: 4.8,
    },
    affordability: 'Budget-Friendly',
    dietaryTags: ['Vegetarian', 'High-Protein', 'High-Fiber'],
    pairingRecommendations: ['pakhala-bhata', 'steamed-rice', 'chakuli-pitha'],
  },
  'chakuli-pitha': {
    id: 'chakuli-pitha',
    name: 'Chakuli Pitha (Rice & Urad Dal Crepe)',
    aliases: ['chakuli', 'chakuli pitha', 'odia crepe', 'rice urad pitha'],
    category: 'Fermented & Traditional',
    serving: {
      size: 2,
      unit: 'piece',
      weightGrams: 100,
      description: '2 medium soft crepes (100g total)',
    },
    nutrition: {
      calories: 165,
      carbohydrates: 29.0,
      protein: 5.1,
      fat: 3.2,
      fiber: 2.2,
      sodium: 120,
      isApproximate: true,
    },
    localNames: {
      hindi: 'चाकुली पीठा',
      odia: 'ଚକୁଳି ପିଠା',
    },
    region: 'East Indian',
    description: 'Soft, white flat round crepe prepared from a fermented batter of rice and black gram (urad dal), cooked on a cast iron tawa.',
    culturalContext: 'A quintessential Odia breakfast and festive dish, traditionally served with Dalma or jaggery.',
    commonIngredients: ['Parboiled rice', 'Skinless urad dal', 'Salt', 'Mustard oil / Ghee'],
    standardServingSize: '2 pieces (100g)',
    servingUnit: 'piece',
    weightGramsPerUnit: 50,
    nutritionPerServing: {
      calories: 165,
      carbohydrates: 29.0,
      protein: 5.1,
      fat: 3.2,
      fiber: 2.2,
    },
    affordability: 'Budget-Friendly',
    dietaryTags: ['Vegetarian', 'Probiotic'],
    pairingRecommendations: ['dalma', 'mint-chutney'],
  },
  'dahi-bara': {
    id: 'dahi-bara',
    name: 'Dahi Bara (Soaked Lentil Vada in Spiced Curd)',
    aliases: ['dahi bara', 'dahi vada', 'cuttack dahi bara', 'dahi bara aloo dum'],
    category: 'Snacks & Street Food',
    serving: {
      size: 2,
      unit: 'piece',
      weightGrams: 140,
      description: '2 soaked vadas with seasoned curd liquid (140g)',
    },
    nutrition: {
      calories: 185,
      carbohydrates: 22.0,
      protein: 6.8,
      fat: 7.5,
      fiber: 2.8,
      calcium: 110,
      sodium: 240,
      isApproximate: true,
    },
    localNames: {
      hindi: 'दही बड़ा',
      odia: 'ଦହି ବରା',
    },
    region: 'East Indian',
    description: 'Golden-fried fluffy urad dal fritters soaked in seasoned buttermilk or curd water, spiced with roasted cumin and black salt.',
    culturalContext: 'Iconic street food of Cuttack and prominent across North India, often paired with aloo dum and ghuguni.',
    commonIngredients: ['Urad dal', 'Curd', 'Mustard seeds', 'Curry leaves', 'Roasted cumin', 'Black salt'],
    standardServingSize: '2 pieces (140g)',
    servingUnit: 'piece',
    weightGramsPerUnit: 70,
    nutritionPerServing: {
      calories: 185,
      carbohydrates: 22.0,
      protein: 6.8,
      fat: 7.5,
      fiber: 2.8,
    },
    affordability: 'Budget-Friendly',
    dietaryTags: ['Vegetarian', 'Probiotic'],
    pairingRecommendations: ['aloo-curry'],
  },
};

export function getRegionalFoodReference(foodIdOrQuery: string): FoodItem | null {
  const norm = foodIdOrQuery.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();

  // Direct ID check
  if (REGIONAL_NUTRITION_REFERENCES[foodIdOrQuery]) {
    return REGIONAL_NUTRITION_REFERENCES[foodIdOrQuery];
  }

  // Search by aliases and names
  for (const item of Object.values(REGIONAL_NUTRITION_REFERENCES)) {
    if (item.id === norm || item.name.toLowerCase().includes(norm) || norm.includes(item.id)) {
      return item;
    }
    if (item.aliases.some(a => norm.includes(a) || a.includes(norm))) {
      return item;
    }
  }

  return null;
}
