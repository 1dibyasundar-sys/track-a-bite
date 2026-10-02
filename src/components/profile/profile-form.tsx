'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  UserProfile,
  validateUserProfile,
  NotificationPreferences,
} from '../../lib/types/profile';
import { userProfileService } from '../../lib/services/userProfileService';
import { nutritionAnalyticsService } from '../../lib/services/nutritionAnalyticsService';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import {
  CheckIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
  InfoIcon,
  SparklesIcon,
  XIcon,
} from '../ui/icons';
import { useAuth } from '../auth/AuthProvider';

export interface ProfileFormProps {
  mode: 'onboarding' | 'edit';
  initialProfile?: UserProfile;
  onComplete?: (profile: UserProfile) => void;
  onCancel?: () => void;
  className?: string;
}

type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

interface HealthConditionItem {
  id: string;
  label: string;
  desc: string;
  icon: string;
}

const HEALTH_CONDITIONS_LIST: HealthConditionItem[] = [
  { id: 'Diabetes', label: 'Diabetes', desc: 'Cautious glycemic & carb-density awareness', icon: '🩸' },
  { id: 'Hypertension', label: 'Hypertension', desc: 'Cautious sodium & deep-fried snack balance', icon: '🫀' },
  { id: 'High Cholesterol', label: 'High Cholesterol', desc: 'Saturated fat & trans fat moderation', icon: '🩺' },
  { id: 'Thyroid', label: 'Thyroid', desc: 'Iodine & micronutrient density context', icon: '🦋' },
  { id: 'Anemia', label: 'Anemia', desc: 'Iron & vitamin C bioavailability context', icon: '🔬' },
  { id: 'Lactose Sensitivity', label: 'Lactose Sensitivity', desc: 'Milk & heavy dairy awareness', icon: '🥛' },
  { id: 'Acid Reflux / Gastric Sensitivity', label: 'Acid Reflux / Gastric', desc: 'High spice & extreme acidity caution', icon: '🍵' },
  { id: 'None', label: 'None', desc: 'No specific medical or dietary conditions', icon: '✨' },
];

export function ProfileForm({
  mode,
  initialProfile,
  onComplete,
  onCancel,
  className = '',
}: ProfileFormProps) {
  const router = useRouter();
  const { user } = useAuth();

  // Load existing profile from storage or passed initialProfile
  const [profile, setProfile] = useState<UserProfile>(() => {
    if (initialProfile) return { ...initialProfile };
    return userProfileService.getProfile();
  });

  const [step, setStep] = useState<OnboardingStep>(mode === 'onboarding' ? 1 : 2);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSuccessSaved, setIsSuccessSaved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // "Other" condition custom text input state
  const [otherInputText, setOtherInputText] = useState<string>('');
  const [showOtherInput, setShowOtherInput] = useState<boolean>(() => {
    // If the profile contains conditions not in the predefined list, show other input open
    const current = profile.healthConditions || [];
    return current.some(
      c => c !== 'None' && !HEALTH_CONDITIONS_LIST.some(item => item.id.toLowerCase() === c.toLowerCase())
    );
  });

  // Safe accessor for conditions array
  const currentConditions: string[] = Array.isArray(profile.healthConditions)
    ? profile.healthConditions
    : profile.healthCondition
      ? [profile.healthCondition]
      : ['None'];

  // Field change handler
  const handleFieldChange = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => {
    setProfile(prev => ({ ...prev, [key]: value }));
    // Clear inline error on change
    if (errors[key as string]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[key as string];
        return next;
      });
    }
    setIsSuccessSaved(false);
  };

  // Notification change handler
  const handleNotificationToggle = (key: keyof NotificationPreferences) => {
    setProfile(prev => {
      const current = prev.notifications ?? {
        mealReminders: true,
        waterReminders: true,
        weeklyReports: false,
      };
      return {
        ...prev,
        notifications: {
          ...current,
          [key]: !current[key],
        },
      };
    });
    setIsSuccessSaved(false);
  };

  // Condition toggle handler (multi-select + 'None' mutual exclusivity)
  const toggleCondition = (conditionId: string) => {
    setProfile(prev => {
      let current = Array.isArray(prev.healthConditions) ? [...prev.healthConditions] : [];

      if (conditionId === 'None') {
        // Mutual exclusivity: selecting "None" clears all other conditions
        return {
          ...prev,
          healthConditions: ['None'],
          healthCondition: undefined,
          disease: undefined,
        };
      }

      // If selecting a specific condition, remove "None" and "Prefer not to say"
      current = current.filter(c => c !== 'None' && c !== 'Prefer not to say');

      // Check if this condition is already selected
      const existsIndex = current.findIndex(c => c.toLowerCase() === conditionId.toLowerCase());
      if (existsIndex >= 0) {
        current.splice(existsIndex, 1);
        // If all conditions are unselected, revert to 'None'
        if (current.length === 0) {
          current = ['None'];
        }
      } else {
        current.push(conditionId);
      }

      const activeConditions = current.filter(c => c !== 'None');
      const joined = activeConditions.length > 0 ? activeConditions.join(', ') : undefined;

      return {
        ...prev,
        healthConditions: current,
        healthCondition: joined,
        disease: joined,
      };
    });
    setIsSuccessSaved(false);
  };

  // Add custom condition from "Other" input
  const addCustomCondition = () => {
    const trimmed = otherInputText.trim();
    if (!trimmed) return;

    setProfile(prev => {
      let current = Array.isArray(prev.healthConditions) ? [...prev.healthConditions] : [];
      current = current.filter(c => c !== 'None' && c !== 'Prefer not to say');

      if (!current.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
        current.push(trimmed);
      }

      const activeConditions = current.filter(c => c !== 'None');
      const joined = activeConditions.length > 0 ? activeConditions.join(', ') : undefined;

      return {
        ...prev,
        healthConditions: current,
        healthCondition: joined,
        disease: joined,
      };
    });

    setOtherInputText('');
    setIsSuccessSaved(false);
  };

  // Remove a specific condition
  const removeCondition = (conditionToRemove: string) => {
    toggleCondition(conditionToRemove);
  };

  // Step-by-step validations
  const validateStep2 = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!profile.age) {
      newErrors.age = 'Please enter your age.';
    } else if (profile.age <= 0 || profile.age > 120 || isNaN(profile.age)) {
      newErrors.age = 'Age must be a realistic number between 1 and 120.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!profile.heightCm) {
      newErrors.heightCm = 'Please enter your height in cm.';
    } else if (profile.heightCm < 40 || profile.heightCm > 260 || isNaN(profile.heightCm)) {
      newErrors.heightCm = 'Height must be between 40 and 260 cm.';
    }

    if (!profile.weightKg) {
      newErrors.weightKg = 'Please enter your weight in kg.';
    } else if (profile.weightKg < 10 || profile.weightKg > 350 || isNaN(profile.weightKg)) {
      newErrors.weightKg = 'Weight must be between 10 and 350 kg.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Complete profile submission
  const handleComplete = async () => {
    const validation = validateUserProfile(profile);
    if (!validation.isValid) {
      const errMap: Record<string, string> = {};
      validation.errors.forEach(err => {
        if (err.toLowerCase().includes('age')) errMap.age = err;
        if (err.toLowerCase().includes('height')) errMap.heightCm = err;
        if (err.toLowerCase().includes('weight')) errMap.weightKg = err;
        if (err.toLowerCase().includes('calorie')) errMap.targetCalories = err;
        if (err.toLowerCase().includes('protein')) errMap.targetProteinG = err;
        if (err.toLowerCase().includes('carb')) errMap.targetCarbsG = err;
        if (err.toLowerCase().includes('fat')) errMap.targetFatG = err;
      });
      setErrors(errMap);
      return;
    }

    setIsSubmitting(true);
    setSyncNotice(null);

    try {
      const res = await userProfileService.saveProfileWithCloud(
        {
          ...profile,
          onboardingCompleted: true,
        },
        user
      );

      if (!res.cloudSaved && res.error) {
        setSyncNotice('Saved locally (cloud sync offline or setup pending).');
      }

      setIsSubmitting(false);

      if (mode === 'onboarding') {
        setStep(7); // Show celebration step
      } else {
        setIsSuccessSaved(true);
        onComplete?.(res.profile);
      }
    } catch {
      setIsSubmitting(false);
      const fallback = userProfileService.saveProfile({
        ...profile,
        onboardingCompleted: true,
      });
      if (mode === 'onboarding') {
        setStep(7);
      } else {
        setIsSuccessSaved(true);
        onComplete?.(fallback);
      }
    }
  };

  // ---------------------------------------------------------------------------
  // 1. PERSONAL INFORMATION SECTION
  // ---------------------------------------------------------------------------
  const renderPersonalInfoSection = () => (
    <div className="space-y-6">
      <div className="border-b border-[#E8DED2] dark:border-[#38312A] pb-4">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-2xs font-extrabold uppercase tracking-wider text-[#E86A33] px-2.5 py-0.5 rounded-full bg-[#FEF7EE] dark:bg-[#2A1C14] border border-[#E86A33]/20">
            Section 1
          </span>
          <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">Baseline Metrics</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
          Personal Information
        </h2>
        <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-1">
          Age, gender, and daily movement baseline for calibrating your estimated metabolic burn.
        </p>
      </div>

      {/* Age */}
      <div className="space-y-1.5">
        <label htmlFor="input-age" className="block text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
          Age (Years) <span className="text-rose-500">*</span>
        </label>
        <div className="max-w-xs">
          <input
            id="input-age"
            type="number"
            min="1"
            max="120"
            value={profile.age ?? ''}
            onChange={e => handleFieldChange('age', e.target.value === '' ? undefined : Number(e.target.value))}
            placeholder="e.g. 21"
            className={`w-full min-h-[46px] rounded-xl bg-white dark:bg-[#1D1A17] border text-stone-900 dark:text-stone-100 text-sm py-3 px-4 transition-all focus:outline-none focus:ring-2 ${
              errors.age
                ? 'border-rose-400 focus:ring-rose-200'
                : 'border-[#E8DED2] dark:border-[#38312A] focus:border-[#E86A33] focus:ring-[#E86A33]/20'
            }`}
            aria-invalid={Boolean(errors.age)}
            aria-describedby={errors.age ? 'error-age' : undefined}
          />
        </div>
        {errors.age ? (
          <p id="error-age" className="text-xs text-rose-600 font-medium pt-0.5">
            {errors.age}
          </p>
        ) : (
          <p className="text-2xs text-stone-400">Realistic age between 1 and 120.</p>
        )}
      </div>

      {/* Gender */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
            Gender
          </label>
          <span className="text-2xs text-stone-400 font-medium">Used for ICMR baseline formula</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(['male', 'female', 'other'] as const).map(g => {
            const isSelected = profile.gender === g;
            return (
              <button
                key={g}
                type="button"
                onClick={() => handleFieldChange('gender', isSelected ? undefined : g)}
                className={`min-h-[46px] py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer capitalize flex items-center justify-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#E86A33] text-white border-[#E86A33] shadow-xs'
                    : 'bg-white dark:bg-[#1D1A17] text-stone-700 dark:text-stone-300 border-[#E8DED2] dark:border-[#38312A] hover:bg-[#FAF7F2] dark:hover:bg-[#25211D]'
                }`}
              >
                {isSelected && <CheckIcon size={14} />}
                <span>{g}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => handleFieldChange('gender', undefined)}
            className={`min-h-[46px] py-2.5 px-3 rounded-xl text-xs font-medium border transition-all cursor-pointer flex items-center justify-center ${
              profile.gender === undefined
                ? 'bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 border-stone-800 shadow-xs font-bold'
                : 'bg-white dark:bg-[#1D1A17] text-stone-500 dark:text-stone-400 border-[#E8DED2] dark:border-[#38312A] hover:bg-[#FAF7F2] dark:hover:bg-[#25211D]'
            }`}
          >
            Prefer not to say
          </button>
        </div>
      </div>

      {/* Activity Level */}
      <div className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
          Daily Physical Activity
        </label>
        <p className="text-2xs text-stone-500 dark:text-stone-400">
          Multiplies your Basal Metabolic Rate (BMR) to estimate daily maintenance calories.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {[
            { id: 'sedentary', icon: '🪑', title: 'Sedentary', desc: 'Desk study, lectures, minimal walking (< 3k steps)' },
            { id: 'lightly_active', icon: '🚶', title: 'Lightly Active', desc: 'Walking between campus blocks, light daily movement (3k–6k steps)' },
            { id: 'moderately_active', icon: '🏃', title: 'Moderately Active', desc: 'Regular sports, gym, or walking 7k+ steps daily' },
            { id: 'very_active', icon: '⚡', title: 'Very Active', desc: 'Daily athletic training, team sports, high physical exertion' },
          ].map(opt => {
            const isSelected = (profile.activityLevel || 'moderately_active') === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleFieldChange('activityLevel', opt.id as UserProfile['activityLevel'])}
                className={`min-h-[68px] p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                  isSelected
                    ? 'bg-[#FEF7EE] dark:bg-[#2A1C14] border-[#E86A33] text-stone-900 dark:text-stone-100 ring-2 ring-[#E86A33]/30 shadow-xs'
                    : 'bg-white dark:bg-[#1D1A17] border-[#E8DED2] dark:border-[#38312A] text-stone-700 dark:text-stone-300 hover:bg-[#FAF7F2] dark:hover:bg-[#25211D]'
                }`}
              >
                <span className="text-2xl shrink-0 mt-0.5">{opt.icon}</span>
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                      {opt.title}
                    </span>
                    {isSelected && <span className="w-2 h-2 rounded-full bg-[#E86A33]" />}
                  </div>
                  <span className="text-2xs text-stone-500 dark:text-stone-400 block leading-tight">
                    {opt.desc}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // 2. BODY INFORMATION SECTION
  // ---------------------------------------------------------------------------
  const renderBodyInfoSection = () => {
    // Dynamic BMI calculation if both values provided
    let calculatedBmi: string | null = null;
    let bmiLabel: string | null = null;
    if (profile.heightCm && profile.weightKg && profile.heightCm > 0) {
      const heightM = profile.heightCm / 100;
      const bmiVal = profile.weightKg / (heightM * heightM);
      if (bmiVal >= 10 && bmiVal <= 60) {
        calculatedBmi = bmiVal.toFixed(1);
        if (bmiVal < 18.5) bmiLabel = 'Lower baseline weight';
        else if (bmiVal < 25) bmiLabel = 'Healthy reference range';
        else if (bmiVal < 30) bmiLabel = 'Higher baseline weight';
        else bmiLabel = 'Substantial reserve';
      }
    }

    return (
      <div className="space-y-6">
        <div className="border-b border-[#E8DED2] dark:border-[#38312A] pb-4">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-2xs font-extrabold uppercase tracking-wider text-[#E86A33] px-2.5 py-0.5 rounded-full bg-[#FEF7EE] dark:bg-[#2A1C14] border border-[#E86A33]/20">
              Section 2
            </span>
            <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">Anthropometric Data</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
            Body Information
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-1">
            Height and weight are strictly used to compute baseline caloric and macronutrient reference ranges.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Height */}
          <div className="space-y-1.5">
            <label htmlFor="input-height" className="block text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
              Height (cm) <span className="text-rose-500">*</span>
            </label>
            <div className="relative flex items-center">
              <input
                id="input-height"
                type="number"
                min="40"
                max="260"
                value={profile.heightCm ?? ''}
                onChange={e => handleFieldChange('heightCm', e.target.value === '' ? undefined : Number(e.target.value))}
                placeholder="e.g. 172"
                className={`w-full min-h-[46px] rounded-xl bg-white dark:bg-[#1D1A17] border text-stone-900 dark:text-stone-100 text-sm py-3 px-4 pr-12 transition-all focus:outline-none focus:ring-2 ${
                  errors.heightCm
                    ? 'border-rose-400 focus:ring-rose-200'
                    : 'border-[#E8DED2] dark:border-[#38312A] focus:border-[#E86A33] focus:ring-[#E86A33]/20'
                }`}
                aria-invalid={Boolean(errors.heightCm)}
                aria-describedby={errors.heightCm ? 'error-height' : undefined}
              />
              <span className="absolute right-4 text-xs font-bold text-stone-400 pointer-events-none">
                cm
              </span>
            </div>
            {errors.heightCm ? (
              <p id="error-height" className="text-xs text-rose-600 font-medium pt-0.5">
                {errors.heightCm}
              </p>
            ) : (
              <p className="text-2xs text-stone-400">Between 40 and 260 cm</p>
            )}
          </div>

          {/* Weight */}
          <div className="space-y-1.5">
            <label htmlFor="input-weight" className="block text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
              Weight (kg) <span className="text-rose-500">*</span>
            </label>
            <div className="relative flex items-center">
              <input
                id="input-weight"
                type="number"
                min="10"
                max="350"
                value={profile.weightKg ?? ''}
                onChange={e => handleFieldChange('weightKg', e.target.value === '' ? undefined : Number(e.target.value))}
                placeholder="e.g. 68"
                className={`w-full min-h-[46px] rounded-xl bg-white dark:bg-[#1D1A17] border text-stone-900 dark:text-stone-100 text-sm py-3 px-4 pr-12 transition-all focus:outline-none focus:ring-2 ${
                  errors.weightKg
                    ? 'border-rose-400 focus:ring-rose-200'
                    : 'border-[#E8DED2] dark:border-[#38312A] focus:border-[#E86A33] focus:ring-[#E86A33]/20'
                }`}
                aria-invalid={Boolean(errors.weightKg)}
                aria-describedby={errors.weightKg ? 'error-weight' : undefined}
              />
              <span className="absolute right-4 text-xs font-bold text-stone-400 pointer-events-none">
                kg
              </span>
            </div>
            {errors.weightKg ? (
              <p id="error-weight" className="text-xs text-rose-600 font-medium pt-0.5">
                {errors.weightKg}
              </p>
            ) : (
              <p className="text-2xs text-stone-400">Between 10 and 350 kg</p>
            )}
          </div>
        </div>

        {/* Dynamic Anthropometric Baseline Card */}
        {calculatedBmi && (
          <div className="p-4 rounded-2xl bg-[#FEF7EE] dark:bg-[#2A1C14] border border-[#E8DED2] dark:border-[#38312A] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#1D1A17] border border-[#E8DED2] dark:border-[#38312A] flex items-center justify-center text-lg font-black text-[#E86A33]">
                ⚖️
              </div>
              <div>
                <span className="font-bold text-stone-900 dark:text-stone-100 block">
                  Calculated BMI: {calculatedBmi}
                </span>
                <span className="text-2xs text-stone-500 dark:text-stone-400 block">
                  {bmiLabel} (General educational indicator)
                </span>
              </div>
            </div>
            <span className="text-3xs text-stone-400 dark:text-stone-500 max-w-xs">
              Mifflin-St Jeor formula calibrates your daily baseline energy against this metric.
            </span>
          </div>
        )}

        <div className="p-3.5 rounded-2xl bg-[#FAF7F2] dark:bg-[#1D1A17] border border-[#E8DED2] dark:border-[#38312A] text-xs text-stone-600 dark:text-stone-400 flex items-start gap-2.5">
          <InfoIcon size={16} className="text-stone-500 shrink-0 mt-0.5" />
          <p className="leading-relaxed text-2xs">
            <strong>Privacy Guarantee:</strong> Height and weight are processed mathematically on your device and never sold or shared. This application provides educational nutrition planning estimates and does not provide clinical diagnosis.
          </p>
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // 3. HEALTH CONDITIONS SECTION (MULTI-SELECT SUPPORT)
  // ---------------------------------------------------------------------------
  const renderHealthConditionsSection = () => {
    const selectedActiveCount = currentConditions.filter(c => c !== 'None').length;

    return (
      <div className="space-y-6">
        <div className="border-b border-[#E8DED2] dark:border-[#38312A] pb-4">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-2xs font-extrabold uppercase tracking-wider text-[#E86A33] px-2.5 py-0.5 rounded-full bg-[#FEF7EE] dark:bg-[#2A1C14] border border-[#E86A33]/20">
              Section 3
            </span>
            <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">Dietary Context</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
            Health Conditions &amp; Sensitivities
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-1">
            Select any conditions that apply. You can select multiple conditions. These act strictly as dietary-context information for personalizing alerts and recommendations.
          </p>
        </div>

        {/* Selected Conditions Active Chips Bar */}
        {selectedActiveCount > 0 && (
          <div className="p-3.5 rounded-2xl bg-[#FEF7EE] dark:bg-[#2A1C14] border border-[#E8DED2] dark:border-[#38312A] space-y-2">
            <div className="flex items-center justify-between text-2xs">
              <span className="font-bold text-[#E86A33] uppercase tracking-wider">
                Active Dietary Context ({selectedActiveCount})
              </span>
              <button
                type="button"
                onClick={() => toggleCondition('None')}
                className="text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 underline cursor-pointer"
              >
                Clear all to None
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {currentConditions
                .filter(c => c !== 'None')
                .map(cond => (
                  <span
                    key={cond}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#1D1A17] border border-[#E86A33]/40 text-stone-900 dark:text-stone-100 text-xs font-semibold shadow-2xs"
                  >
                    <span>{cond}</span>
                    <button
                      type="button"
                      onClick={() => removeCondition(cond)}
                      className="w-4 h-4 rounded-full hover:bg-stone-200 dark:hover:bg-stone-800 flex items-center justify-center text-stone-500 hover:text-rose-600 transition-colors cursor-pointer"
                      aria-label={`Remove ${cond}`}
                    >
                      <XIcon size={12} />
                    </button>
                  </span>
                ))}
            </div>
          </div>
        )}

        {/* Multi-Condition Grid */}
        <div className="space-y-2.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
            Select All That Apply
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="group" aria-label="Health Conditions Multi-Select">
            {HEALTH_CONDITIONS_LIST.map(opt => {
              const isSelected = currentConditions.some(
                c => c.toLowerCase() === opt.id.toLowerCase()
              );

              return (
                <button
                  key={opt.id}
                  type="button"
                  role="checkbox"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onClick={() => toggleCondition(opt.id)}
                  onKeyDown={e => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      toggleCondition(opt.id);
                    }
                  }}
                  className={`min-h-[58px] p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E86A33] ${
                    isSelected
                      ? opt.id === 'None'
                        ? 'bg-stone-100 dark:bg-stone-800 border-stone-400 dark:border-stone-600 text-stone-900 dark:text-stone-100 font-bold shadow-xs'
                        : 'bg-[#FEF7EE] dark:bg-[#2A1C14] border-[#E86A33] text-stone-900 dark:text-stone-100 ring-2 ring-[#E86A33]/30 font-bold shadow-xs'
                      : 'bg-white dark:bg-[#1D1A17] text-stone-700 dark:text-stone-300 border-[#E8DED2] dark:border-[#38312A] hover:bg-[#FAF7F2] dark:hover:bg-[#25211D]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Visual Checkbox Indicator */}
                    <div
                      className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-[#E86A33] border-[#E86A33] text-white shadow-2xs'
                          : 'border-stone-300 dark:border-stone-600 bg-stone-50 dark:bg-[#25211D]'
                      }`}
                    >
                      {isSelected && <CheckIcon size={13} className="stroke-[3]" />}
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm shrink-0">{opt.icon}</span>
                        <span className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                          {opt.label}
                        </span>
                      </div>
                      <span className="text-3xs text-stone-500 dark:text-stone-400 block truncate">
                        {opt.desc}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* "Other" Condition Custom Input */}
        <div className="space-y-3 pt-2 border-t border-[#E8DED2] dark:border-[#38312A]">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
              Have another condition or dietary sensitivity?
            </label>
            {!showOtherInput && (
              <button
                type="button"
                onClick={() => setShowOtherInput(true)}
                className="text-xs font-semibold text-[#E86A33] dark:text-[#F4A340] hover:underline cursor-pointer"
              >
                + Add Custom Condition
              </button>
            )}
          </div>

          {showOtherInput && (
            <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1D1A17] border border-[#E8DED2] dark:border-[#38312A] space-y-3 animate-in fade-in duration-200">
              <p className="text-2xs text-stone-500 dark:text-stone-400">
                Specify any custom dietary requirement (e.g. Celiac / Gluten Sensitivity, Gout, PCOS, Migraine Trigger).
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={otherInputText}
                  onChange={e => setOtherInputText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomCondition();
                    }
                  }}
                  placeholder="e.g. Celiac, Gout, PCOS..."
                  className="flex-1 min-h-[44px] px-3.5 py-2 bg-[#FAF7F2] dark:bg-[#151311] border border-[#E8DED2] dark:border-[#38312A] rounded-xl text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:border-[#E86A33]"
                />
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={addCustomCondition}
                  disabled={!otherInputText.trim()}
                  className="min-h-[44px] px-4 font-bold"
                >
                  Add
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Ethical Non-Diagnostic Medical Notice */}
        <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 text-amber-950 dark:text-amber-200 text-xs flex items-start gap-2.5 leading-relaxed">
          <ShieldCheckIcon size={18} className="text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-2xs">
            <strong>Dietary Context Notice:</strong> Selected conditions serve only as heuristic dietary context to assist with food personalization. Track-a-Bite does not diagnose, treat, prevent, or medically manage clinical diseases. Consult a certified medical doctor or clinical nutritionist for medical therapy.
          </p>
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // 4. NUTRITION PREFERENCES SECTION
  // ---------------------------------------------------------------------------
  const renderNutritionPreferencesSection = () => {
    const curCal = profile.targetCalories ?? 0;
    const curProt = profile.targetProteinG ?? 0;
    const curCarbs = profile.targetCarbsG ?? 0;
    const curFat = profile.targetFatG ?? 0;

    const macroStats = nutritionAnalyticsService.calculateMacroCalories(
      curProt,
      curCarbs,
      curFat,
      curCal
    );

    const isCustomActive = Boolean(profile.customTargetsActive);

    const handleUseRecommendedTargets = () => {
      const rec = nutritionAnalyticsService.calculateRecommendedTargets(profile);
      setProfile(prev => ({
        ...prev,
        targetCalories: rec.targetCalories,
        targetProteinG: rec.targetProteinG,
        targetCarbsG: rec.targetCarbsG,
        targetFatG: rec.targetFatG,
        customTargetsActive: false,
      }));
      setErrors(prev => {
        const next = { ...prev };
        delete next.targetCalories;
        delete next.targetProteinG;
        delete next.targetCarbsG;
        delete next.targetFatG;
        return next;
      });
      setIsSuccessSaved(false);
    };

    const handleEnableCustomTargets = () => {
      if (!profile.targetCalories) {
        const rec = nutritionAnalyticsService.calculateRecommendedTargets(profile);
        setProfile(prev => ({
          ...prev,
          targetCalories: rec.targetCalories,
          targetProteinG: rec.targetProteinG,
          targetCarbsG: rec.targetCarbsG,
          targetFatG: rec.targetFatG,
          customTargetsActive: true,
        }));
      } else {
        setProfile(prev => ({ ...prev, customTargetsActive: true }));
      }
      setIsSuccessSaved(false);
    };

    const healthGoalOptions = [
      { id: 'general_health', title: 'General Vitality', icon: '🥗', desc: 'Balanced everyday energy & micronutrient adequacy' },
      { id: 'fat_loss', title: 'Fat Loss', icon: '🏃', desc: 'Caloric deficit with high-protein satiety' },
      { id: 'maintenance', title: 'Maintenance', icon: '⚖️', desc: 'Caloric equilibrium & bodyweight stability' },
      { id: 'muscle_gain', title: 'Muscle Gain', icon: '💪', desc: 'Caloric surplus with targeted muscle protein synthesis' },
    ] as const;

    return (
      <div className="space-y-6">
        <div className="border-b border-[#E8DED2] dark:border-[#38312A] pb-4">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-2xs font-extrabold uppercase tracking-wider text-[#E86A33] px-2.5 py-0.5 rounded-full bg-[#FEF7EE] dark:bg-[#2A1C14] border border-[#E86A33]/20">
              Section 4
            </span>
            <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">Macronutrient Tuning</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
            Nutrition Preferences
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-1">
            Configure your overall health goals, daily caloric target, and macronutrient proportions.
          </p>
        </div>

        {/* Goal Selector */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
            Primary Health Goal
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {healthGoalOptions.map(opt => {
              const isSelected = (profile.healthGoal || 'general_health') === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    handleFieldChange('healthGoal', opt.id);
                    if (!profile.customTargetsActive) {
                      const updated = { ...profile, healthGoal: opt.id };
                      const rec = nutritionAnalyticsService.calculateRecommendedTargets(updated);
                      setProfile(prev => ({
                        ...prev,
                        healthGoal: opt.id,
                        targetCalories: rec.targetCalories,
                        targetProteinG: rec.targetProteinG,
                        targetCarbsG: rec.targetCarbsG,
                        targetFatG: rec.targetFatG,
                      }));
                    }
                  }}
                  className={`min-h-[64px] p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-[#E86A33] text-white border-[#E86A33] shadow-xs font-bold'
                      : 'bg-white dark:bg-[#1D1A17] text-stone-800 dark:text-stone-200 border-[#E8DED2] dark:border-[#38312A] hover:bg-[#FAF7F2] dark:hover:bg-[#25211D]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl shrink-0">{opt.icon}</span>
                    <div className="min-w-0">
                      <span className="text-xs font-bold block truncate">{opt.title}</span>
                      <span className={`text-3xs block leading-tight truncate ${isSelected ? 'text-white/80' : 'text-stone-500 dark:text-stone-400'}`}>
                        {opt.desc}
                      </span>
                    </div>
                  </div>
                  {isSelected && <CheckIcon size={18} className="text-white shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Auto vs Custom Toggle */}
        <div className="p-1 rounded-2xl bg-stone-100 dark:bg-[#151311] border border-[#E8DED2] dark:border-[#38312A] flex gap-1">
          <button
            type="button"
            onClick={handleUseRecommendedTargets}
            className={`min-h-[44px] flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              !isCustomActive
                ? 'bg-white dark:bg-[#25211D] text-[#E86A33] dark:text-[#F4A340] shadow-xs border border-stone-200/60 dark:border-[#38312A]'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
            }`}
          >
            <span>⚡</span>
            <span>Recommended Targets</span>
          </button>
          <button
            type="button"
            onClick={handleEnableCustomTargets}
            className={`min-h-[44px] flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              isCustomActive
                ? 'bg-white dark:bg-[#25211D] text-[#E86A33] dark:text-[#F4A340] shadow-xs border border-stone-200/60 dark:border-[#38312A]'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
            }`}
          >
            <span>✏️</span>
            <span>Custom Targets</span>
          </button>
        </div>

        {/* Target Inputs Grid */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Calories */}
            <div className="space-y-1.5">
              <label htmlFor="input-target-calories" className="block text-2xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                Daily Calories (kcal)
              </label>
              <div className="relative flex items-center">
                <input
                  id="input-target-calories"
                  type="number"
                  min="500"
                  max="15000"
                  value={profile.targetCalories ?? ''}
                  onChange={e => {
                    const val = e.target.value === '' ? undefined : Number(e.target.value);
                    setProfile(prev => ({ ...prev, targetCalories: val, customTargetsActive: true }));
                    setIsSuccessSaved(false);
                  }}
                  placeholder="e.g. 2100"
                  className={`w-full min-h-[44px] rounded-xl bg-white dark:bg-[#1D1A17] border text-stone-900 dark:text-stone-100 text-sm py-2.5 px-3 pr-12 transition-all focus:outline-none focus:ring-2 ${
                    errors.targetCalories
                      ? 'border-rose-400 focus:ring-rose-200'
                      : 'border-[#E8DED2] dark:border-[#38312A] focus:border-[#E86A33] focus:ring-[#E86A33]/20'
                  }`}
                />
                <span className="absolute right-3 text-2xs font-bold text-stone-400 pointer-events-none">
                  kcal
                </span>
              </div>
              {errors.targetCalories && (
                <p className="text-3xs text-rose-600 font-medium">{errors.targetCalories}</p>
              )}
            </div>

            {/* Protein */}
            <div className="space-y-1.5">
              <label htmlFor="input-target-protein" className="block text-2xs font-bold uppercase tracking-wider text-[#E86A33]">
                Protein Target (g)
              </label>
              <div className="relative flex items-center">
                <input
                  id="input-target-protein"
                  type="number"
                  min="0"
                  max="1000"
                  value={profile.targetProteinG ?? ''}
                  onChange={e => {
                    const val = e.target.value === '' ? undefined : Number(e.target.value);
                    setProfile(prev => ({ ...prev, targetProteinG: val, customTargetsActive: true }));
                    setIsSuccessSaved(false);
                  }}
                  placeholder="e.g. 75"
                  className={`w-full min-h-[44px] rounded-xl bg-white dark:bg-[#1D1A17] border text-stone-900 dark:text-stone-100 text-sm py-2.5 px-3 pr-10 transition-all focus:outline-none focus:ring-2 ${
                    errors.targetProteinG
                      ? 'border-rose-400 focus:ring-rose-200'
                      : 'border-[#E8DED2] dark:border-[#38312A] focus:border-[#E86A33] focus:ring-[#E86A33]/20'
                  }`}
                />
                <span className="absolute right-3 text-2xs font-bold text-[#E86A33] pointer-events-none">
                  g
                </span>
              </div>
              {errors.targetProteinG && (
                <p className="text-3xs text-rose-600 font-medium">{errors.targetProteinG}</p>
              )}
            </div>

            {/* Carbs */}
            <div className="space-y-1.5">
              <label htmlFor="input-target-carbs" className="block text-2xs font-bold uppercase tracking-wider text-[#F4A340]">
                Carbohydrates (g)
              </label>
              <div className="relative flex items-center">
                <input
                  id="input-target-carbs"
                  type="number"
                  min="0"
                  max="1500"
                  value={profile.targetCarbsG ?? ''}
                  onChange={e => {
                    const val = e.target.value === '' ? undefined : Number(e.target.value);
                    setProfile(prev => ({ ...prev, targetCarbsG: val, customTargetsActive: true }));
                    setIsSuccessSaved(false);
                  }}
                  placeholder="e.g. 260"
                  className={`w-full min-h-[44px] rounded-xl bg-white dark:bg-[#1D1A17] border text-stone-900 dark:text-stone-100 text-sm py-2.5 px-3 pr-10 transition-all focus:outline-none focus:ring-2 ${
                    errors.targetCarbsG
                      ? 'border-rose-400 focus:ring-rose-200'
                      : 'border-[#E8DED2] dark:border-[#38312A] focus:border-[#F4A340] focus:ring-[#F4A340]/20'
                  }`}
                />
                <span className="absolute right-3 text-2xs font-bold text-[#F4A340] pointer-events-none">
                  g
                </span>
              </div>
              {errors.targetCarbsG && (
                <p className="text-3xs text-rose-600 font-medium">{errors.targetCarbsG}</p>
              )}
            </div>

            {/* Fat */}
            <div className="space-y-1.5">
              <label htmlFor="input-target-fat" className="block text-2xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Fat Target (g)
              </label>
              <div className="relative flex items-center">
                <input
                  id="input-target-fat"
                  type="number"
                  min="0"
                  max="1000"
                  value={profile.targetFatG ?? ''}
                  onChange={e => {
                    const val = e.target.value === '' ? undefined : Number(e.target.value);
                    setProfile(prev => ({ ...prev, targetFatG: val, customTargetsActive: true }));
                    setIsSuccessSaved(false);
                  }}
                  placeholder="e.g. 55"
                  className={`w-full min-h-[44px] rounded-xl bg-white dark:bg-[#1D1A17] border text-stone-900 dark:text-stone-100 text-sm py-2.5 px-3 pr-10 transition-all focus:outline-none focus:ring-2 ${
                    errors.targetFatG
                      ? 'border-rose-400 focus:ring-rose-200'
                      : 'border-[#E8DED2] dark:border-[#38312A] focus:border-amber-600 focus:ring-amber-500/20'
                  }`}
                />
                <span className="absolute right-3 text-2xs font-bold text-amber-700 dark:text-amber-400 pointer-events-none">
                  g
                </span>
              </div>
              {errors.targetFatG && (
                <p className="text-3xs text-rose-600 font-medium">{errors.targetFatG}</p>
              )}
            </div>
          </div>

          {/* Macro Calorie Breakdown */}
          <div className="p-3.5 rounded-2xl bg-[#FAF7F2] dark:bg-[#1D1A17] border border-[#E8DED2] dark:border-[#38312A] text-xs space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-2xs">
              <span className="font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
                Macro Energy Breakdown:
              </span>
              <div className="flex flex-wrap items-center gap-3 font-semibold">
                <span className="text-[#E86A33]">Protein: {macroStats.proteinCalories} kcal (×4)</span>
                <span className="text-[#F4A340]">Carbs: {macroStats.carbsCalories} kcal (×4)</span>
                <span className="text-amber-700 dark:text-amber-400">Fat: {macroStats.fatCalories} kcal (×9)</span>
                <span className="text-stone-900 dark:text-stone-100 font-black">Sum: {macroStats.totalMacroCalories} kcal</span>
              </div>
            </div>

            {macroStats.hasSignificantVariance && profile.targetCalories && profile.targetCalories > 0 && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/90 dark:border-amber-800/50 text-amber-900 dark:text-amber-200 flex items-start gap-2 text-2xs leading-relaxed animate-in fade-in duration-200">
                <InfoIcon size={16} className="text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">
                    Macro targets total {macroStats.totalMacroCalories} kcal, while calorie goal is {profile.targetCalories} kcal.
                  </p>
                  <p className="text-3xs text-amber-800 dark:text-amber-300 mt-0.5">
                    This is informational. You can adjust your macro grams to match your total energy or leave them as configured.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // 5. FOOD PREFERENCES SECTION
  // ---------------------------------------------------------------------------
  const renderFoodPreferencesSection = () => {
    const dietaryOptions = [
      { id: 'vegetarian', title: 'Vegetarian', desc: 'Plant foods & dairy, no meat or egg', icon: '🥦' },
      { id: 'eggetarian', title: 'Eggetarian', desc: 'Vegetarian plus whole eggs', icon: '🥚' },
      { id: 'non_vegetarian', title: 'Non-Vegetarian', desc: 'Full dietary freedom across regional dishes', icon: '🍗' },
      { id: 'vegan', title: 'Vegan', desc: 'Strictly plant-based, no dairy or animal products', icon: '🌱' },
      { id: 'jain', title: 'Jain', desc: 'Vegetarian without onion, garlic, or root tubers', icon: '🪷' },
    ] as const;

    const commonAllergies = ['Dairy', 'Peanuts', 'Gluten', 'Egg', 'Soy', 'Shellfish'];
    const currentAllergies = profile.allergies || [];

    const toggleAllergy = (allergy: string) => {
      const lower = allergy.toLowerCase();
      const exists = currentAllergies.some(a => a.toLowerCase() === lower);
      let updated: string[];
      if (exists) {
        updated = currentAllergies.filter(a => a.toLowerCase() !== lower);
      } else {
        updated = [...currentAllergies, allergy];
      }
      handleFieldChange('allergies', updated);
    };

    return (
      <div className="space-y-6">
        <div className="border-b border-[#E8DED2] dark:border-[#38312A] pb-4">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-2xs font-extrabold uppercase tracking-wider text-[#E86A33] px-2.5 py-0.5 rounded-full bg-[#FEF7EE] dark:bg-[#2A1C14] border border-[#E86A33]/20">
              Section 5
            </span>
            <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">Dietary Style &amp; Cooking Access</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
            Food Preferences &amp; Living Realities
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-1">
            Ensure next-meal suggestions and nutrient gaps respect your food choices, budget, and kitchen access.
          </p>
        </div>

        {/* Dietary Style */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
            Dietary Style
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {dietaryOptions.map(opt => {
              const isSelected = (profile.dietaryRestrictions || 'vegetarian') === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleFieldChange('dietaryRestrictions', opt.id)}
                  className={`min-h-[56px] p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                    isSelected
                      ? 'bg-[#E86A33] text-white border-[#E86A33] shadow-xs font-bold'
                      : 'bg-white dark:bg-[#1D1A17] text-stone-800 dark:text-stone-200 border-[#E8DED2] dark:border-[#38312A] hover:bg-[#FAF7F2] dark:hover:bg-[#25211D]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xl shrink-0">{opt.icon}</span>
                    <div className="min-w-0">
                      <span className="text-xs font-bold block truncate">{opt.title}</span>
                      <span className={`text-3xs block leading-tight truncate ${isSelected ? 'text-white/80' : 'text-stone-500 dark:text-stone-400'}`}>
                        {opt.desc}
                      </span>
                    </div>
                  </div>
                  {isSelected && <CheckIcon size={16} className="text-white shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Allergies Chips */}
        <div className="space-y-2 pt-2 border-t border-[#E8DED2] dark:border-[#38312A]">
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
            Food Allergies &amp; Sensitivities
          </label>
          <p className="text-2xs text-stone-500 dark:text-stone-400">
            Selected allergens are strictly filtered out from next-meal upgrade suggestions.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {commonAllergies.map(allergy => {
              const isSelected = currentAllergies.some(a => a.toLowerCase() === allergy.toLowerCase());
              return (
                <button
                  key={allergy}
                  type="button"
                  onClick={() => toggleAllergy(allergy)}
                  className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 ring-2 ring-rose-500/20 font-bold'
                      : 'bg-white dark:bg-[#1D1A17] text-stone-600 dark:text-stone-300 border-[#E8DED2] dark:border-[#38312A] hover:bg-[#FAF7F2] dark:hover:bg-[#25211D]'
                  }`}
                >
                  {isSelected ? `✓ ${allergy}` : `+ ${allergy}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Living Situation & Hostel Mode */}
        <div className="space-y-3 pt-2 border-t border-[#E8DED2] dark:border-[#38312A]">
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
            Living Environment
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleFieldChange('isHostelite', true)}
              className={`min-h-[58px] p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                profile.isHostelite
                  ? 'bg-[#E86A33] text-white border-[#E86A33] shadow-xs font-bold'
                  : 'bg-white dark:bg-[#1D1A17] text-stone-800 dark:text-stone-200 border-[#E8DED2] dark:border-[#38312A] hover:bg-[#FAF7F2] dark:hover:bg-[#25211D]'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">🏠</span>
                <div>
                  <span className="text-xs font-bold block">Hostelite / Dorm Living</span>
                  <span className={`text-3xs block ${profile.isHostelite ? 'text-white/80' : 'text-stone-500 dark:text-stone-400'}`}>
                    Canteen, mess, zero-cooking staples
                  </span>
                </div>
              </div>
              {profile.isHostelite && <CheckIcon size={18} className="text-white shrink-0" />}
            </button>

            <button
              type="button"
              onClick={() => handleFieldChange('isHostelite', false)}
              className={`min-h-[58px] p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                !profile.isHostelite
                  ? 'bg-[#E86A33] text-white border-[#E86A33] shadow-xs font-bold'
                  : 'bg-white dark:bg-[#1D1A17] text-stone-800 dark:text-stone-200 border-[#E8DED2] dark:border-[#38312A] hover:bg-[#FAF7F2] dark:hover:bg-[#25211D]'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">🏡</span>
                <div>
                  <span className="text-xs font-bold block">Home / Kitchen Access</span>
                  <span className={`text-3xs block ${!profile.isHostelite ? 'text-white/80' : 'text-stone-500 dark:text-stone-400'}`}>
                    Home-cooked thalis &amp; fresh cooking
                  </span>
                </div>
              </div>
              {!profile.isHostelite && <CheckIcon size={18} className="text-white shrink-0" />}
            </button>
          </div>
        </div>

        {/* Food Budget Preference */}
        <div className="space-y-2 pt-2 border-t border-[#E8DED2] dark:border-[#38312A]">
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
            Food Budget Preference
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { id: 'budget', icon: '💰', title: 'Budget', desc: '₹10–₹25 additions' },
              { id: 'moderate', icon: '⚖️', title: 'Moderate', desc: 'Standard campus' },
              { id: 'flexible', icon: '✨', title: 'Flexible', desc: 'Any healthy item' },
            ].map(opt => {
              const isSelected = (profile.budgetPreference || 'budget') === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleFieldChange('budgetPreference', opt.id as UserProfile['budgetPreference'])}
                  className={`min-h-[64px] p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                    isSelected
                      ? 'bg-[#FEF7EE] dark:bg-[#2A1C14] border-[#E86A33] text-stone-900 dark:text-stone-100 ring-2 ring-[#E86A33]/30 font-bold shadow-xs'
                      : 'bg-white dark:bg-[#1D1A17] border-[#E8DED2] dark:border-[#38312A] text-stone-700 dark:text-stone-300 hover:bg-[#FAF7F2] dark:hover:bg-[#25211D]'
                  }`}
                >
                  <span className="text-xl">{opt.icon}</span>
                  <span className="text-xs font-bold block">{opt.title}</span>
                  <span className="text-3xs text-stone-500 dark:text-stone-400 block">{opt.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Cooking & Storage Amenities */}
        <div className="space-y-2 pt-2 border-t border-[#E8DED2] dark:border-[#38312A]">
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
            Food &amp; Storage Facilities
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {[
              { key: 'hasMessFood' as const, label: 'Mess / Tiffin Subscription', icon: '🍲' },
              { key: 'hasCookingAccess' as const, label: 'Induction / Kettle Access', icon: '🍳' },
              { key: 'hasFridge' as const, label: 'Refrigerator Storage', icon: '❄️' },
            ].map(facility => {
              const isActive = Boolean(profile[facility.key]);
              return (
                <button
                  key={facility.key}
                  type="button"
                  onClick={() => handleFieldChange(facility.key, !isActive)}
                  className={`min-h-[58px] p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                    isActive
                      ? 'bg-[#FEF7EE] dark:bg-[#2A1C14] border-[#E86A33] text-stone-900 dark:text-stone-100 ring-2 ring-[#E86A33]/30 font-bold'
                      : 'bg-white dark:bg-[#1D1A17] border-[#E8DED2] dark:border-[#38312A] text-stone-600 dark:text-stone-400 hover:bg-[#FAF7F2] dark:hover:bg-[#25211D]'
                  }`}
                >
                  <span className="text-xl">{facility.icon}</span>
                  <span className="text-2xs font-bold block">{facility.label}</span>
                  <span className="text-3xs text-stone-400 block">{isActive ? '✓ Available' : 'No access'}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // 6. NOTIFICATION PREFERENCES SECTION
  // ---------------------------------------------------------------------------
  const renderNotificationPreferencesSection = () => {
    const notifications = profile.notifications ?? {
      mealReminders: true,
      waterReminders: true,
      weeklyReports: false,
    };

    const notificationOptions = [
      {
        key: 'mealReminders' as const,
        icon: '🍽️',
        title: 'Meal Logging Reminders',
        desc: 'Receive gentle prompts around breakfast, lunch, and dinner to scan your plate.',
        enabled: Boolean(notifications.mealReminders),
      },
      {
        key: 'waterReminders' as const,
        icon: '💧',
        title: 'Hydration Reminders',
        desc: 'Helpful water tracking nudges throughout study, work, and commute hours.',
        enabled: Boolean(notifications.waterReminders),
      },
      {
        key: 'weeklyReports' as const,
        icon: '📊',
        title: 'Weekly Nutrition Digest',
        desc: 'A weekly summary of your macronutrient consistency, protein hits, and nutrient balance.',
        enabled: Boolean(notifications.weeklyReports),
      },
    ];

    return (
      <div className="space-y-6">
        <div className="border-b border-[#E8DED2] dark:border-[#38312A] pb-4">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-2xs font-extrabold uppercase tracking-wider text-[#E86A33] px-2.5 py-0.5 rounded-full bg-[#FEF7EE] dark:bg-[#2A1C14] border border-[#E86A33]/20">
              Section 6
            </span>
            <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">Timely Nudges</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
            Notification Preferences
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-1">
            Configure how and when Track-a-Bite reminds you to log meals, drink water, and review your weekly trends.
          </p>
        </div>

        <div className="space-y-3">
          {notificationOptions.map(item => (
            <div
              key={item.key}
              className="p-4 rounded-2xl bg-white dark:bg-[#1D1A17] border border-[#E8DED2] dark:border-[#38312A] flex items-center justify-between gap-4 transition-colors"
            >
              <div className="flex items-start gap-3 min-w-0">
                <span className="text-2xl shrink-0 mt-0.5">{item.icon}</span>
                <div className="min-w-0 space-y-0.5">
                  <span className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 block">
                    {item.title}
                  </span>
                  <span className="text-2xs text-stone-500 dark:text-stone-400 block leading-relaxed">
                    {item.desc}
                  </span>
                </div>
              </div>

              {/* Accessible Toggle Switch */}
              <button
                type="button"
                role="switch"
                aria-checked={item.enabled}
                onClick={() => handleNotificationToggle(item.key)}
                className={`w-12 h-7 rounded-full p-1 transition-colors cursor-pointer shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E86A33] ${
                  item.enabled ? 'bg-[#E86A33]' : 'bg-stone-300 dark:bg-stone-700'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform ${
                    item.enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // ONBOARDING REVIEW & CELEBRATION STEPS
  // ---------------------------------------------------------------------------
  const renderOnboardingReviewStep = () => {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100 tracking-tight">
            Review your profile
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-1">
            Ensure your details are accurate before finishing setup.
          </p>
        </div>

        <Card className="border-[#E8DED2] dark:border-[#38312A] shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 bg-gradient-to-r from-stone-900 to-[#1D1A17] text-white flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-[#F4A340]">
              YOUR PROFILE SUMMARY
            </span>
            <span className="text-3xs font-semibold px-2 py-0.5 rounded-full bg-[#E86A33]/30 text-[#F4A340] border border-[#E86A33]/40">
              {profile.isHostelite ? 'Hostel Mode Active' : 'Home Access'}
            </span>
          </div>

          <CardContent className="p-4 sm:p-6 divide-y divide-stone-100 dark:divide-stone-800 text-xs">
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-stone-500 dark:text-stone-400 font-medium">Age</span>
              <span className="font-bold text-stone-900 dark:text-stone-100">{profile.age} years</span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <span className="text-stone-500 dark:text-stone-400 font-medium">Height &amp; Weight</span>
              <span className="font-bold text-stone-900 dark:text-stone-100">{profile.heightCm} cm • {profile.weightKg} kg</span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <span className="text-stone-500 dark:text-stone-400 font-medium">Health conditions</span>
              <span className="font-bold text-stone-900 dark:text-stone-100 text-right max-w-xs truncate">
                {currentConditions.filter(c => c !== 'None').length > 0
                  ? currentConditions.filter(c => c !== 'None').join(', ')
                  : 'None reported'}
              </span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <span className="text-stone-500 dark:text-stone-400 font-medium">Dietary preference</span>
              <span className="font-bold text-stone-900 dark:text-stone-100 capitalize">
                {profile.dietaryRestrictions || 'Vegetarian'}
              </span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <span className="text-stone-500 dark:text-stone-400 font-medium">Living setup</span>
              <span className="font-bold text-stone-900 dark:text-stone-100">
                {profile.isHostelite ? 'Hostelite' : 'Home access'}
              </span>
            </div>

            {profile.targetCalories && (
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-stone-500 dark:text-stone-400 font-medium">Target calories</span>
                <span className="font-bold text-stone-900 dark:text-stone-100">
                  {profile.targetCalories} kcal (P: {profile.targetProteinG ?? '--'}g)
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderOnboardingCelebrationStep = () => (
    <div className="space-y-6 text-center py-6 sm:py-10 animate-in fade-in duration-300">
      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#FEF7EE] dark:bg-[#2A1C14] text-[#E86A33] border border-[#E86A33]/30 flex items-center justify-center mx-auto text-3xl sm:text-4xl shadow-inner">
        🎉
      </div>

      <div className="space-y-2 max-w-sm mx-auto">
        <h2 className="text-2xl sm:text-3xl font-black text-stone-900 dark:text-stone-100 tracking-tight">
          You&apos;re all set!
        </h2>
        <p className="text-sm text-stone-600 dark:text-stone-400 font-normal leading-relaxed">
          Your nutrition insights and 5-star richness scoring are now personalized to your lifestyle.
        </p>
      </div>

      <div className="pt-4 max-w-xs mx-auto space-y-2">
        <Button
          fullWidth
          size="lg"
          onClick={() => {
            if (onComplete) {
              onComplete(profile);
            } else {
              router.push('/dashboard');
            }
          }}
          rightIcon={<ArrowRightIcon size={18} />}
          className="font-bold py-3.5 text-base"
        >
          Go to My Dashboard
        </Button>
        <button
          type="button"
          onClick={() => router.push('/scan')}
          className="w-full text-xs font-semibold text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 py-1.5 transition-colors cursor-pointer"
        >
          Or jump straight to food scanner →
        </button>
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // MAIN RENDER SWITCH
  // ---------------------------------------------------------------------------

  // If in EDIT MODE, render all 6 clear, spacious sections
  if (mode === 'edit') {
    return (
      <div className={`space-y-8 ${className}`}>
        {isSuccessSaved && (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200 text-xs font-bold flex items-center justify-between animate-in fade-in duration-200">
            <span className="flex items-center gap-2">
              <CheckIcon size={18} className="text-emerald-700 dark:text-emerald-400" />
              <span>
                {syncNotice
                  ? `Profile updated! ${syncNotice}`
                  : 'Profile successfully updated & synced! ✨'}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setIsSuccessSaved(false)}
              className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 text-xs font-normal cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        <div className="space-y-6 sm:space-y-8">
          {/* Section 1: Personal Information */}
          <Card className="border-[#E8DED2] dark:border-[#38312A] shadow-xs">
            <CardContent className="p-6 sm:p-8">
              {renderPersonalInfoSection()}
            </CardContent>
          </Card>

          {/* Section 2: Body Information */}
          <Card className="border-[#E8DED2] dark:border-[#38312A] shadow-xs">
            <CardContent className="p-6 sm:p-8">
              {renderBodyInfoSection()}
            </CardContent>
          </Card>

          {/* Section 3: Health Conditions (Multi-select) */}
          <Card className="border-[#E8DED2] dark:border-[#38312A] shadow-xs">
            <CardContent className="p-6 sm:p-8">
              {renderHealthConditionsSection()}
            </CardContent>
          </Card>

          {/* Section 4: Nutrition Preferences */}
          <Card className="border-[#E8DED2] dark:border-[#38312A] shadow-xs">
            <CardContent className="p-6 sm:p-8">
              {renderNutritionPreferencesSection()}
            </CardContent>
          </Card>

          {/* Section 5: Food Preferences */}
          <Card className="border-[#E8DED2] dark:border-[#38312A] shadow-xs">
            <CardContent className="p-6 sm:p-8">
              {renderFoodPreferencesSection()}
            </CardContent>
          </Card>

          {/* Section 6: Notification Preferences */}
          <Card className="border-[#E8DED2] dark:border-[#38312A] shadow-xs">
            <CardContent className="p-6 sm:p-8">
              {renderNotificationPreferencesSection()}
            </CardContent>
          </Card>

          {/* Bottom Save Action Bar */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1D1A17] border border-[#E8DED2] dark:border-[#38312A] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
            <div className="text-center sm:text-left">
              <span className="text-xs font-semibold text-stone-900 dark:text-stone-100 block">
                Ready to apply your updates?
              </span>
              <span className="text-2xs text-stone-500 dark:text-stone-400">
                Changes calibrate recommendations across all future food scans instantly.
              </span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {onCancel && (
                <Button variant="outline" size="md" onClick={onCancel} className="flex-1 sm:flex-none">
                  Cancel
                </Button>
              )}
              <Button
                variant="primary"
                size="lg"
                onClick={handleComplete}
                disabled={isSubmitting}
                leftIcon={<SparklesIcon size={16} />}
                className="w-full sm:w-auto px-8 font-bold min-h-[48px]"
              >
                {isSubmitting ? 'Saving Profile...' : 'Save Profile'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // ONBOARDING MODE WIZARD
  // ---------------------------------------------------------------------------
  const stepTotal = 5;
  const currentStepNumber = step === 1 ? 0 : step === 6 ? 5 : step === 7 ? 5 : step - 1;

  return (
    <div className={`max-w-xl mx-auto ${className}`}>
      <Card className="border-[#E8DED2] dark:border-[#38312A] shadow-md overflow-hidden bg-white dark:bg-[#1D1A17]">
        {/* Onboarding Header with Progress Bar */}
        {step >= 2 && step <= 6 && (
          <div className="px-6 pt-6 pb-2 space-y-2 border-b border-[#E8DED2] dark:border-[#38312A]">
            <div className="flex items-center justify-between text-2xs font-extrabold uppercase tracking-widest text-stone-500 dark:text-stone-400">
              <span>TRACK-A-BITE ONBOARDING</span>
              <span>
                STEP {currentStepNumber} OF {stepTotal}
              </span>
            </div>

            <div className="w-full bg-stone-100 dark:bg-[#25211D] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-[#E86A33] h-full rounded-full transition-all duration-300"
                style={{ width: `${(currentStepNumber / stepTotal) * 100}%` }}
              />
            </div>
          </div>
        )}

        <CardContent className="p-6 sm:p-8">
          {step === 1 && (
            <div className="space-y-6 text-center py-4 sm:py-8">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-[#FEF7EE] dark:bg-[#2A1C14] text-[#E86A33] border border-[#E86A33]/20 flex items-center justify-center mx-auto shadow-inner text-3xl sm:text-4xl">
                🥗
              </div>

              <div className="space-y-2 max-w-md mx-auto">
                <h1 className="text-2xl sm:text-3xl font-black text-stone-900 dark:text-stone-100 tracking-tight">
                  Let&apos;s personalize your nutrition.
                </h1>
                <p className="text-sm sm:text-base text-stone-600 dark:text-stone-400 leading-relaxed font-normal">
                  Tell us a little about your body and food lifestyle so Track-a-Bite can generate realistic nutritional scores.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 max-w-lg mx-auto text-left pt-2">
                <div className="p-3 rounded-2xl bg-[#FAF7F2] dark:bg-[#25211D] border border-[#E8DED2] dark:border-[#38312A] flex items-center gap-2.5">
                  <span className="text-lg">🎯</span>
                  <div>
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100 block">Personalized</span>
                    <span className="text-3xs text-stone-500 dark:text-stone-400">Baseline formulas</span>
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-[#FAF7F2] dark:bg-[#25211D] border border-[#E8DED2] dark:border-[#38312A] flex items-center gap-2.5">
                  <span className="text-lg">🍽️</span>
                  <div>
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100 block">Practical</span>
                    <span className="text-3xs text-stone-500 dark:text-stone-400">Real affordable foods</span>
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-[#FAF7F2] dark:bg-[#25211D] border border-[#E8DED2] dark:border-[#38312A] flex items-center gap-2.5">
                  <span className="text-lg">🛡️</span>
                  <div>
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100 block">Private</span>
                    <span className="text-3xs text-stone-500 dark:text-stone-400">Never shared</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 max-w-xs mx-auto">
                <Button
                  fullWidth
                  size="lg"
                  onClick={() => setStep(2)}
                  rightIcon={<ArrowRightIcon size={18} />}
                  className="font-bold py-3.5 text-base"
                >
                  Let&apos;s start
                </Button>
              </div>
            </div>
          )}

          {step === 2 && renderPersonalInfoSection()}
          {step === 3 && renderBodyInfoSection()}
          {step === 4 && renderHealthConditionsSection()}
          {step === 5 && renderFoodPreferencesSection()}
          {step === 6 && renderOnboardingReviewStep()}
          {step === 7 && renderOnboardingCelebrationStep()}

          {/* Navigation Controls (Steps 2 to 6) */}
          {step >= 2 && step <= 6 && (
            <div className="flex items-center justify-between pt-6 border-t border-[#E8DED2] dark:border-[#38312A] mt-8">
              <Button
                variant="ghost"
                size="md"
                onClick={() => setStep(prev => (prev - 1) as OnboardingStep)}
                className="text-stone-600 dark:text-stone-400 font-semibold"
              >
                ← Back
              </Button>

              {step < 6 ? (
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    if (step === 2 && !validateStep2()) return;
                    if (step === 3 && !validateStep3()) return;
                    setStep(prev => (prev + 1) as OnboardingStep);
                  }}
                  rightIcon={<ArrowRightIcon size={16} />}
                  className="font-bold px-6"
                >
                  Continue →
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleComplete}
                  disabled={isSubmitting}
                  rightIcon={<CheckIcon size={16} />}
                  className="font-bold px-7"
                >
                  {isSubmitting ? 'Saving...' : 'Complete Profile'}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
