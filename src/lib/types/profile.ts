/**
 * User Profile & Validation Model (Phase 6.4)
 */

export interface UserProfile {
  age?: number;
  heightCm?: number;
  weightKg?: number;
  gender?: 'male' | 'female' | 'other';
  activityLevel?: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active';
  healthCondition?: string; // Singular convenient accessor
  healthConditions: string[]; // e.g. ['None'], ['Diabetes'], etc.
  healthGoal?: 'muscle_gain' | 'fat_loss' | 'maintenance' | 'general_health';
  dietaryRestrictions?: 'vegetarian' | 'vegan' | 'non_vegetarian' | 'eggetarian' | 'jain';
  allergies?: string[];
  isHostelite: boolean;
  hasMessFood?: boolean;
  hasCookingAccess?: boolean;
  hasFridge?: boolean;
  budgetPreference?: 'budget' | 'moderate' | 'flexible';
  onboardingCompleted: boolean;
  targetCalories?: number;
  targetProteinG?: number;
  targetCarbsG?: number;
  targetFatG?: number;
  targetHydrationMl?: number;
  customTargetsActive?: boolean;
}

export const PREDEFINED_HEALTH_CONDITIONS = [
  'None',
  'Diabetes / Pre-diabetes',
  'High blood pressure',
  'High cholesterol',
  'Lactose sensitivity',
  'Acid reflux / Gastric sensitivity',
  'Prefer not to say',
] as const;

export type PredefinedHealthCondition = typeof PREDEFINED_HEALTH_CONDITIONS[number];

export const DEFAULT_USER_PROFILE: UserProfile = {
  age: undefined,
  heightCm: undefined,
  weightKg: undefined,
  isHostelite: true,
  healthConditions: ['None'],
  onboardingCompleted: false,
};

export interface ProfileValidationResult {
  isValid: boolean;
  errors: string[];
  hasSufficientData: boolean;
  validatedProfile?: UserProfile;
}

/**
 * Validates a user profile object strictly.
 * Disallows negative values, zero, NaN, Infinity, or out-of-range values.
 */
export function validateUserProfile(profile?: Partial<UserProfile> | null): ProfileValidationResult {
  if (!profile || typeof profile !== 'object') {
    return {
      isValid: false,
      errors: ['Profile is missing or null'],
      hasSufficientData: false,
    };
  }

  const errors: string[] = [];

  // Age validation
  if (profile.age !== undefined) {
    if (typeof profile.age !== 'number' || isNaN(profile.age) || !isFinite(profile.age)) {
      errors.push('Age must be a valid number');
    } else if (profile.age <= 0 || profile.age > 120) {
      errors.push('Age must be a realistic positive number between 1 and 120');
    }
  }

  // Height validation
  if (profile.heightCm !== undefined) {
    if (typeof profile.heightCm !== 'number' || isNaN(profile.heightCm) || !isFinite(profile.heightCm)) {
      errors.push('Height must be a valid number');
    } else if (profile.heightCm < 40 || profile.heightCm > 260) {
      errors.push('Height must be between 40 and 260 cm');
    }
  }

  // Weight validation
  if (profile.weightKg !== undefined) {
    if (typeof profile.weightKg !== 'number' || isNaN(profile.weightKg) || !isFinite(profile.weightKg)) {
      errors.push('Weight must be a valid number');
    } else if (profile.weightKg < 10 || profile.weightKg > 350) {
      errors.push('Weight must be between 10 and 350 kg');
    }
  }

  // Dietary target validations
  if (profile.targetCalories !== undefined) {
    if (typeof profile.targetCalories !== 'number' || isNaN(profile.targetCalories) || !isFinite(profile.targetCalories)) {
      errors.push('Calorie target must be a valid finite number');
    } else if (profile.targetCalories <= 0) {
      errors.push('Calorie target must be greater than 0');
    } else if (profile.targetCalories > 15000) {
      errors.push('Calorie target cannot exceed 15,000 kcal');
    }
  }

  if (profile.targetProteinG !== undefined) {
    if (typeof profile.targetProteinG !== 'number' || isNaN(profile.targetProteinG) || !isFinite(profile.targetProteinG)) {
      errors.push('Protein target must be a valid finite number');
    } else if (profile.targetProteinG < 0) {
      errors.push('Protein target cannot be negative');
    } else if (profile.targetProteinG > 1000) {
      errors.push('Protein target cannot exceed 1,000g');
    }
  }

  if (profile.targetCarbsG !== undefined) {
    if (typeof profile.targetCarbsG !== 'number' || isNaN(profile.targetCarbsG) || !isFinite(profile.targetCarbsG)) {
      errors.push('Carbohydrate target must be a valid finite number');
    } else if (profile.targetCarbsG < 0) {
      errors.push('Carbohydrate target cannot be negative');
    } else if (profile.targetCarbsG > 1500) {
      errors.push('Carbohydrate target cannot exceed 1,500g');
    }
  }

  if (profile.targetFatG !== undefined) {
    if (typeof profile.targetFatG !== 'number' || isNaN(profile.targetFatG) || !isFinite(profile.targetFatG)) {
      errors.push('Fat target must be a valid finite number');
    } else if (profile.targetFatG < 0) {
      errors.push('Fat target cannot be negative');
    } else if (profile.targetFatG > 1000) {
      errors.push('Fat target cannot exceed 1,000g');
    }
  }

  if (profile.targetHydrationMl !== undefined) {
    if (
      typeof profile.targetHydrationMl !== 'number' ||
      isNaN(profile.targetHydrationMl) ||
      !isFinite(profile.targetHydrationMl)
    ) {
      errors.push('Hydration target must be a valid number');
    } else if (profile.targetHydrationMl <= 0) {
      errors.push('Hydration target must be greater than 0 ml');
    } else if (profile.targetHydrationMl > 10000) {
      errors.push('Hydration target cannot exceed 10,000 ml');
    }
  }

  // Health condition normalization
  const healthConditions: string[] = Array.isArray(profile.healthConditions)
    ? profile.healthConditions
    : profile.healthCondition && profile.healthCondition !== 'none'
      ? [profile.healthCondition]
      : ['None'];

  const hasSufficientData = Boolean(
    profile.age &&
    profile.age >= 1 &&
    profile.age <= 120 &&
    profile.heightCm &&
    profile.heightCm >= 40 &&
    profile.heightCm <= 260 &&
    profile.weightKg &&
    profile.weightKg >= 10 &&
    profile.weightKg <= 350 &&
    errors.length === 0
  );

  const validatedProfile: UserProfile = {
    age: profile.age,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    gender: profile.gender,
    activityLevel: profile.activityLevel,
    healthCondition: profile.healthCondition || (healthConditions[0] !== 'None' ? healthConditions[0] : undefined),
    healthConditions,
    healthGoal: profile.healthGoal,
    dietaryRestrictions: profile.dietaryRestrictions,
    allergies: Array.isArray(profile.allergies) ? profile.allergies : undefined,
    isHostelite: Boolean(profile.isHostelite),
    hasMessFood: profile.hasMessFood !== undefined ? Boolean(profile.hasMessFood) : undefined,
    hasCookingAccess: profile.hasCookingAccess !== undefined ? Boolean(profile.hasCookingAccess) : undefined,
    hasFridge: profile.hasFridge !== undefined ? Boolean(profile.hasFridge) : undefined,
    budgetPreference: profile.budgetPreference,
    onboardingCompleted: Boolean(profile.onboardingCompleted),
    targetCalories:
      typeof profile.targetCalories === 'number' && profile.targetCalories > 0 && isFinite(profile.targetCalories)
        ? Math.round(profile.targetCalories)
        : undefined,
    targetProteinG:
      typeof profile.targetProteinG === 'number' && profile.targetProteinG >= 0 && isFinite(profile.targetProteinG)
        ? Math.round(profile.targetProteinG * 10) / 10
        : undefined,
    targetCarbsG:
      typeof profile.targetCarbsG === 'number' && profile.targetCarbsG >= 0 && isFinite(profile.targetCarbsG)
        ? Math.round(profile.targetCarbsG * 10) / 10
        : undefined,
    targetFatG:
      typeof profile.targetFatG === 'number' && profile.targetFatG >= 0 && isFinite(profile.targetFatG)
        ? Math.round(profile.targetFatG * 10) / 10
        : undefined,
    targetHydrationMl:
      typeof profile.targetHydrationMl === 'number' && profile.targetHydrationMl > 0 && isFinite(profile.targetHydrationMl)
        ? Math.round(profile.targetHydrationMl)
        : undefined,
    customTargetsActive:
      profile.customTargetsActive !== undefined ? Boolean(profile.customTargetsActive) : undefined,
  };

  return {
    isValid: errors.length === 0,
    errors,
    hasSufficientData,
    validatedProfile: errors.length === 0 ? validatedProfile : undefined,
  };
}
