/**
 * Food Identity Normalization Service (Phase 6.2)
 *
 * Provides principled normalization of food names into standardized identities
 * while strictly safeguarding cultural distinctions (e.g. Sambar != Dal).
 */

export interface NormalizedFoodIdentity {
  rawName: string;
  normalizedName: string;
  canonicalId: string;
  category: 'grains' | 'lentils' | 'curry' | 'bread' | 'snack' | 'condiment' | 'beverage' | 'other';
  familyGroup: string;
  isCulturallyDistinct: boolean;
}

interface NormalizationCluster {
  normalizedName: string;
  canonicalId: string;
  category: 'grains' | 'lentils' | 'curry' | 'bread' | 'snack' | 'condiment' | 'beverage' | 'other';
  familyGroup: string;
  patterns: RegExp[];
  prohibitions?: RegExp[]; // Patterns that MUST NOT be merged into this cluster
}

const NORMALIZATION_CLUSTERS: NormalizationCluster[] = [
  // 1. Whole Wheat Flatbreads (Roti / Chapati / Phulka)
  {
    normalizedName: 'Whole Wheat Roti',
    canonicalId: 'whole-wheat-roti',
    category: 'bread',
    familyGroup: 'flatbread_roti',
    patterns: [
      /^(whole\s*wheat\s*)?roti(\s*\/.*)?$/i,
      /^(whole\s*wheat\s*)?chapati(\s*\/.*)?$/i,
      /^phulka(\s*\/.*)?$/i,
      /^tawa\s*roti$/i,
      /^plain\s*roti$/i,
    ],
    prohibitions: [/paratha/i, /naan/i, /kulcha/i, /puri/i, /bhatura/i],
  },

  // 2. Steamed Plain Rice
  {
    normalizedName: 'Steamed Rice',
    canonicalId: 'steamed-rice',
    category: 'grains',
    familyGroup: 'rice_plain',
    patterns: [
      /^(steamed|boiled|plain|white)\s*(basmati\s*)?rice$/i,
      /^steamed\s*basmati\s*rice$/i,
      /^chawal$/i,
      /^bhat$/i,
    ],
    prohibitions: [/jeera\s*rice/i, /fried\s*rice/i, /biryani/i, /pulao/i, /curd\s*rice/i, /pakhala/i],
  },

  // 3. Dal Tadka (Yellow Lentil Preparation)
  {
    normalizedName: 'Dal Tadka',
    canonicalId: 'dal-tadka',
    category: 'lentils',
    familyGroup: 'dal_yellow',
    patterns: [
      /^(yellow\s*)?dal\s*tadka(\s*\(.*\))?$/i,
      /^tadka\s*dal$/i,
      /^dal\s*fry$/i,
      /^yellow\s*lentil\s*(curry|soup|stew)$/i,
      /^toor\s*dal$/i,
      /^moong\s*dal$/i,
    ],
    prohibitions: [/sambar/i, /dal\s*makhani/i, /dalma/i, /chole/i, /rajma/i],
  },

  // 4. Mixed Vegetable Curry / Sabzi
  {
    normalizedName: 'Mixed Vegetable Curry',
    canonicalId: 'vegetable-curry',
    category: 'curry',
    familyGroup: 'curry_vegetable',
    patterns: [
      /^(homestyle\s*)?mixed\s*vegetable\s*(curry|sabzi)(\s*\/.*)?$/i,
      /^veg(etable)?\s*(curry|sabzi)$/i,
      /^mix(ed)?\s*veg$/i,
      /^tiffin\s*sabzi$/i,
      /^canteen\s*vegetable\s*curry$/i,
    ],
    prohibitions: [/paneer/i, /kofta/i, /dal/i, /aloo\s*gobi/i, /chole/i, /rajma/i, /sambar/i],
  },

  // 5. Roasted Papadum
  {
    normalizedName: 'Roasted Papad',
    canonicalId: 'roasted-papad',
    category: 'snack',
    familyGroup: 'papad',
    patterns: [
      /^(roasted\s*)?papad(um)?$/i,
      /^urad\s*papad$/i,
      /^dry\s*roasted\s*papad$/i,
    ],
    prohibitions: [/chips/i, /fryum/i],
  },

  // 6. Mango Pickle (Achar)
  {
    normalizedName: 'Mango Pickle',
    canonicalId: 'mango-pickle',
    category: 'condiment',
    familyGroup: 'pickle_mango',
    patterns: [
      /^(traditional\s*indian\s*)?mango\s*pickle(\s*\(.*\))?$/i,
      /^aam\s*(ka\s*)?achar$/i,
      /^pickle$/i,
    ],
    prohibitions: [/chutney/i, /lemon\s*pickle/i, /chilli\s*pickle/i],
  },

  // 7. Buttermilk (Chaas)
  {
    normalizedName: 'Buttermilk',
    canonicalId: 'buttermilk',
    category: 'beverage',
    familyGroup: 'dairy_beverage',
    patterns: [
      /^buttermilk$/i,
      /^chaas$/i,
      /^mattha$/i,
      /^spiced\s*buttermilk$/i,
    ],
    prohibitions: [/lassi/i, /curd/i, /milk/i],
  },

  // 8. Sambar (Distinct from generic Dal)
  {
    normalizedName: 'Sambar',
    canonicalId: 'sambar',
    category: 'lentils',
    familyGroup: 'sambar',
    patterns: [
      /^(south\s*indian\s*)?sambar$/i,
      /^sambhar$/i,
    ],
    prohibitions: [/dal\s*tadka/i, /dal\s*fry/i],
  },

  // 9. Pakhala Bhata (Odia Fermented Water Rice)
  {
    normalizedName: 'Pakhala Bhata',
    canonicalId: 'pakhala-bhata',
    category: 'grains',
    familyGroup: 'pakhala_fermented',
    patterns: [
      /^pakhala(\s*bhata)?(\s*\(.*\))?$/i,
      /^fermented\s*water\s*rice$/i,
      /^dahi\s*pakhala$/i,
    ],
    prohibitions: [/curd\s*rice/i, /plain\s*rice/i, /steamed\s*rice/i],
  },

  // 10. Kanda Poha
  {
    normalizedName: 'Kanda Poha',
    canonicalId: 'poha',
    category: 'grains',
    familyGroup: 'poha',
    patterns: [
      /^(kanda\s*)?poha(\s*\(.*\))?$/i,
      /^flattened\s*rice$/i,
      /^batata\s*poha$/i,
    ],
  },

  // 11. Khasta Kachori
  {
    normalizedName: 'Khasta Kachori',
    canonicalId: 'kachori',
    category: 'snack',
    familyGroup: 'kachori',
    patterns: [
      /^(khasta\s*|moong\s*dal\s*)?kachori(\s*\(.*\))?$/i,
      /^pyaaz\s*kachori$/i,
    ],
    prohibitions: [/samosa/i, /puri/i],
  },

  // 12. Sprouted Moong Chaat
  {
    normalizedName: 'Sprouts Chaat',
    canonicalId: 'sprouts-chaat',
    category: 'snack',
    familyGroup: 'sprouts',
    patterns: [
      /^(fresh\s*sprouted\s*moong\s*|sprouts\s*)chaat$/i,
      /^boiled\s*sprouts$/i,
    ],
  },

  // 13. Packaged Potato Chips
  {
    normalizedName: 'Packaged Potato Chips',
    canonicalId: 'potato-chips',
    category: 'snack',
    familyGroup: 'chips',
    patterns: [
      /^packaged\s*potato\s*chips.*$/i,
      /^potato\s*chips$/i,
      /^potato\s*wafers$/i,
      /^chips$/i,
    ],
  },
];

export class FoodNormalizationService {
  /**
   * Normalizes a raw food name and foodId into a standard identity.
   * Preserves cultural distinctiveness and avoids false-positive merges.
   */
  public normalize(rawName: string, existingFoodId?: string): NormalizedFoodIdentity {
    const trimmed = (rawName || '').trim();
    if (!trimmed) {
      return {
        rawName: 'Unknown Item',
        normalizedName: 'Unknown Item',
        canonicalId: existingFoodId || 'unmapped-food',
        category: 'other',
        familyGroup: 'unknown',
        isCulturallyDistinct: false,
      };
    }

    // Check cluster matching
    for (const cluster of NORMALIZATION_CLUSTERS) {
      // First ensure it doesn't violate any prohibitions (e.g. Sambar must not match Dal)
      if (cluster.prohibitions && cluster.prohibitions.some(p => p.test(trimmed))) {
        continue;
      }

      // Check if foodId matches canonical ID directly
      if (existingFoodId && existingFoodId === cluster.canonicalId) {
        return {
          rawName: trimmed,
          normalizedName: cluster.normalizedName,
          canonicalId: cluster.canonicalId,
          category: cluster.category,
          familyGroup: cluster.familyGroup,
          isCulturallyDistinct: true,
        };
      }

      // Check pattern matches
      if (cluster.patterns.some(p => p.test(trimmed))) {
        return {
          rawName: trimmed,
          normalizedName: cluster.normalizedName,
          canonicalId: existingFoodId || cluster.canonicalId,
          category: cluster.category,
          familyGroup: cluster.familyGroup,
          isCulturallyDistinct: true,
        };
      }
    }

    // Deduce category heuristically for unclustered foods
    const lower = trimmed.toLowerCase();
    let category: NormalizedFoodIdentity['category'] = 'other';
    if (lower.includes('curry') || lower.includes('gravy') || lower.includes('masala') || lower.includes('sabzi') || lower.includes('korma')) {
      category = 'curry';
    } else if (lower.includes('rice') || lower.includes('pulao') || lower.includes('biryani') || lower.includes('khichdi') || lower.includes('grain')) {
      category = 'grains';
    } else if (lower.includes('dal') || lower.includes('lentil') || lower.includes('sambar') || lower.includes('rasam')) {
      category = 'lentils';
    } else if (lower.includes('roti') || lower.includes('bread') || lower.includes('naan') || lower.includes('paratha') || lower.includes('dosa') || lower.includes('idli')) {
      category = 'bread';
    } else if (lower.includes('chutney') || lower.includes('pickle') || lower.includes('sauce') || lower.includes('raita')) {
      category = 'condiment';
    } else if (lower.includes('tea') || lower.includes('chai') || lower.includes('coffee') || lower.includes('juice') || lower.includes('water') || lower.includes('milk') || lower.includes('shake')) {
      category = 'beverage';
    } else if (lower.includes('chaat') || lower.includes('samosa') || lower.includes('snack') || lower.includes('bhajji') || lower.includes('pakora')) {
      category = 'snack';
    }

    // Clean up title casing for unclustered names
    const cleaned = trimmed
      .replace(/\s+/g, ' ')
      .replace(/\([A-Z\s]+\)/gi, match => match.trim());

    return {
      rawName: trimmed,
      normalizedName: cleaned,
      canonicalId: existingFoodId || cleaned.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'),
      category,
      familyGroup: `custom_${cleaned.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      isCulturallyDistinct: true,
    };
  }

  /**
   * Evaluates whether two detected food items represent the exact SAME physical food identity.
   * Strictly enforces cultural boundaries (Requirement 2 & 4).
   */
  public areSameFoodIdentity(
    foodA: { name: string; foodId: string; visualObservation?: import('../types/recognition').VisualObservation },
    foodB: { name: string; foodId: string; visualObservation?: import('../types/recognition').VisualObservation }
  ): boolean {
    const normA = this.normalize(foodA.name, foodA.foodId);
    const normB = this.normalize(foodB.name, foodB.foodId);

    // If both belong to the exact same canonical ID and cluster
    if (normA.canonicalId === normB.canonicalId && normA.canonicalId !== 'unmapped-food') {
      return true;
    }

    // If family groups match and are specific
    if (normA.familyGroup === normB.familyGroup && !normA.familyGroup.startsWith('custom_')) {
      return true;
    }

    // Generic unmapped/ambiguous items must NOT be merged unless their names match closely
    if (normA.canonicalId === 'unmapped-food' || normB.canonicalId === 'unmapped-food') {
      return normA.normalizedName.toLowerCase().trim() === normB.normalizedName.toLowerCase().trim();
    }

    return false;
  }
}

export const foodNormalizationService = new FoodNormalizationService();
