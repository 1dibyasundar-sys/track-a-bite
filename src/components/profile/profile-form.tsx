'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  UserProfile,
  validateUserProfile,
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
  const [otherConditionText, setOtherConditionText] = useState<string>(() => {
    const current = profile.healthCondition || profile.healthConditions?.[0] || 'None';
    if (!['None', 'Diabetes / Pre-diabetes', 'High blood pressure', 'Hypertension'].includes(current)) {
      return current;
    }
    return '';
  });
  const [isSuccessSaved, setIsSuccessSaved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

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

  // Health condition select
  const handleHealthConditionSelect = (condition: string) => {
    if (condition === 'Other') {
      const conditionValue = otherConditionText.trim() || 'Other';
      setProfile(prev => ({
        ...prev,
        healthCondition: conditionValue,
        healthConditions: [conditionValue],
      }));
    } else {
      setProfile(prev => ({
        ...prev,
        healthCondition: condition === 'None' ? undefined : condition,
        healthConditions: [condition],
      }));
    }
    setIsSuccessSaved(false);
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

  // Helper for current selected health category
  const activeCondition = profile.healthCondition || profile.healthConditions?.[0] || 'None';
  const isDiabetes = activeCondition.toLowerCase().includes('diabetes');
  const isHypertension = activeCondition.toLowerCase().includes('pressure') || activeCondition.toLowerCase().includes('hypertension');
  const isNone = activeCondition === 'None' || !activeCondition;
  const isOther = !isNone && !isDiabetes && !isHypertension;

  // ---------------------------------------------------------------------------
  // STEP RENDERERS (REUSABLE IN ONBOARDING & EDIT)
  // ---------------------------------------------------------------------------

  // Welcome Step (Step 1)
  const renderWelcomeStep = () => (
    <div className="space-y-6 text-center py-4 sm:py-8">
      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto shadow-inner text-3xl sm:text-4xl">
        🥗
      </div>

      <div className="space-y-2 max-w-md mx-auto">
        <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
          Let&apos;s understand your plate.
        </h1>
        <p className="text-sm sm:text-base text-stone-600 leading-relaxed font-normal">
          Tell us a little about yourself so Track-a-Bite can make your nutrition insights more useful.
        </p>
      </div>

      {/* Feature Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 max-w-lg mx-auto text-left pt-2">
        <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200/80 flex items-center gap-2.5">
          <span className="text-lg">🎯</span>
          <div>
            <span className="text-xs font-bold text-stone-900 block">Personalized</span>
            <span className="text-3xs text-stone-500">Based on student baselines</span>
          </div>
        </div>
        <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200/80 flex items-center gap-2.5">
          <span className="text-lg">🏠</span>
          <div>
            <span className="text-xs font-bold text-stone-900 block">Hostel Friendly</span>
            <span className="text-3xs text-stone-500">Canteen & room staples</span>
          </div>
        </div>
        <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200/80 flex items-center gap-2.5">
          <span className="text-lg">🛡️</span>
          <div>
            <span className="text-xs font-bold text-stone-900 block">Private & Safe</span>
            <span className="text-3xs text-stone-500">Zero medical diagnoses</span>
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
  );

  // About You (Step 2)
  const renderAboutYouStep = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
          Tell us about you
        </h2>
        <p className="text-xs sm:text-sm text-stone-600 mt-1">
          Activity level helps estimate daily energy needs.
        </p>
      </div>

      {/* Age */}
      <div className="space-y-1.5">
        <label htmlFor="input-age" className="block text-xs font-bold uppercase tracking-wider text-stone-700">
          Age <span className="text-rose-500">*</span>
        </label>
        <input
          id="input-age"
          type="number"
          min="1"
          max="120"
          value={profile.age ?? ''}
          onChange={e => handleFieldChange('age', e.target.value === '' ? undefined : Number(e.target.value))}
          placeholder="e.g. 20"
          className={`w-full rounded-2xl bg-white border text-stone-900 text-sm py-3 px-4 transition-all focus:outline-none focus:ring-2 ${
            errors.age ? 'border-rose-400 focus:ring-rose-200' : 'border-stone-200 focus:border-emerald-700 focus:ring-emerald-100'
          }`}
          aria-invalid={Boolean(errors.age)}
          aria-describedby={errors.age ? 'error-age' : undefined}
        />
        {errors.age && (
          <p id="error-age" className="text-xs text-rose-600 font-medium pt-0.5">
            {errors.age}
          </p>
        )}
      </div>

      {/* Gender (Optional) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
            Gender
          </label>
          <span className="text-2xs text-stone-400 font-medium">Optional</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(['male', 'female', 'other'] as const).map(g => (
            <button
              key={g}
              type="button"
              onClick={() => handleFieldChange('gender', profile.gender === g ? undefined : g)}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer capitalize ${
                profile.gender === g
                  ? 'bg-emerald-800 text-white border-emerald-900 shadow-2xs'
                  : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
              }`}
            >
              {g}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleFieldChange('gender', undefined)}
            className={`py-2.5 px-3 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
              profile.gender === undefined
                ? 'bg-stone-800 text-white border-stone-900 shadow-2xs'
                : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'
            }`}
          >
            Prefer not to say
          </button>
        </div>
      </div>

      {/* Activity Level */}
      <div className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
          How active are you?
        </label>
        <p className="text-2xs text-stone-500">
          This helps calculate your estimated baseline calorie requirements.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {[
            { id: 'sedentary', icon: '🪑', title: 'Sedentary', desc: 'Desk study, lectures, minimal walking' },
            { id: 'lightly_active', icon: '🚶', title: 'Lightly active', desc: 'Walking between campus blocks, light daily movement' },
            { id: 'moderately_active', icon: '🏃', title: 'Moderately active', desc: 'Regular sports, gym, or walking 5k+ steps daily' },
            { id: 'very_active', icon: '⚡', title: 'Very active', desc: 'Daily athletic training, team sports, high physical exertion' },
          ].map(opt => {
            const isSelected = (profile.activityLevel || 'moderately_active') === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleFieldChange('activityLevel', opt.id as UserProfile['activityLevel'])}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                  isSelected
                    ? 'bg-emerald-50/90 border-emerald-500 text-emerald-950 ring-1 ring-emerald-500'
                    : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                }`}
              >
                <span className="text-2xl">{opt.icon}</span>
                <div className="space-y-0.5">
                  <span className="text-xs font-bold block text-stone-900">
                    {opt.title}
                  </span>
                  <span className="text-2xs text-stone-500 block leading-tight">
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

  // Body Details (Step 3)
  const renderBodyDetailsStep = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
          Your body details
        </h2>
        <p className="text-xs sm:text-sm text-stone-600 mt-1">
          Used strictly to calibrate your estimated daily energy requirements.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Height */}
        <div className="space-y-1.5">
          <label htmlFor="input-height" className="block text-xs font-bold uppercase tracking-wider text-stone-700">
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
              className={`w-full rounded-2xl bg-white border text-stone-900 text-sm py-3 px-4 pr-12 transition-all focus:outline-none focus:ring-2 ${
                errors.heightCm ? 'border-rose-400 focus:ring-rose-200' : 'border-stone-200 focus:border-emerald-700 focus:ring-emerald-100'
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
          <label htmlFor="input-weight" className="block text-xs font-bold uppercase tracking-wider text-stone-700">
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
              placeholder="e.g. 65"
              className={`w-full rounded-2xl bg-white border text-stone-900 text-sm py-3 px-4 pr-12 transition-all focus:outline-none focus:ring-2 ${
                errors.weightKg ? 'border-rose-400 focus:ring-rose-200' : 'border-stone-200 focus:border-emerald-700 focus:ring-emerald-100'
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

      <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80 text-xs text-stone-600 flex items-start gap-2.5">
        <InfoIcon size={16} className="text-stone-500 shrink-0 mt-0.5" />
        <p className="leading-relaxed text-2xs">
          <strong>Privacy note:</strong> We use height and weight strictly in mathematical formulas (Mifflin-St Jeor / ICMR standard) to calculate your estimated daily energy needs. We never share or sell this data.
        </p>
      </div>
    </div>
  );

  // Lifestyle & Budget (Step 4)
  const renderLifestyleStep = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
          Your lifestyle
        </h2>
        <p className="text-xs sm:text-sm text-stone-600 mt-1">
          Tailor suggestions to your campus realities and cooking access.
        </p>
      </div>

      {/* Hostel Question */}
      <div className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
          Are you a hostelite?
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => handleFieldChange('isHostelite', true)}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
              profile.isHostelite
                ? 'bg-emerald-800 text-white border-emerald-900 shadow-2xs'
                : 'bg-white text-stone-800 border-stone-200 hover:bg-stone-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏠</span>
              <div>
                <span className="text-sm font-bold block">Yes, I&apos;m a hostelite</span>
                <span className={`text-2xs block ${profile.isHostelite ? 'text-emerald-200' : 'text-stone-500'}`}>
                  Canteens, mess & no personal kitchen
                </span>
              </div>
            </div>
            {profile.isHostelite && <CheckIcon size={18} className="text-white shrink-0" />}
          </button>

          <button
            type="button"
            onClick={() => handleFieldChange('isHostelite', false)}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
              !profile.isHostelite
                ? 'bg-emerald-800 text-white border-emerald-900 shadow-2xs'
                : 'bg-white text-stone-800 border-stone-200 hover:bg-stone-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏡</span>
              <div>
                <span className="text-sm font-bold block">No, I live at home</span>
                <span className={`text-2xs block ${!profile.isHostelite ? 'text-emerald-200' : 'text-stone-500'}`}>
                  Kitchen access and home-cooked meals
                </span>
              </div>
            </div>
            {!profile.isHostelite && <CheckIcon size={18} className="text-white shrink-0" />}
          </button>
        </div>

        {/* Dynamic callout for hostelite */}
        {profile.isHostelite && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
            <span>✨</span>
            <span>Got it. We&apos;ll prioritize practical campus-friendly foods (sprouts, eggs, curd, bananas).</span>
          </div>
        )}
      </div>

      {/* Food Budget */}
      <div className="space-y-2 pt-2 border-t border-stone-100">
        <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
          What&apos;s your usual food budget?
        </label>
        <p className="text-2xs text-stone-500">
          This is only a preference to prioritize affordable food additions, not an income check.
        </p>
        <div className="grid grid-cols-3 gap-2 pt-1">
          {[
            { id: 'budget', icon: '💰', title: 'Budget', desc: '₹10–₹25 staples' },
            { id: 'moderate', icon: '⚖️', title: 'Moderate', desc: 'Balanced campus' },
            { id: 'flexible', icon: '✨', title: 'Flexible', desc: 'Any healthy item' },
          ].map(opt => {
            const isSelected = (profile.budgetPreference || 'budget') === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleFieldChange('budgetPreference', opt.id as UserProfile['budgetPreference'])}
                className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center space-y-1 ${
                  isSelected
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-950 ring-1 ring-emerald-500 font-bold'
                    : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                }`}
              >
                <span className="text-2xl">{opt.icon}</span>
                <span className="text-xs font-bold block">{opt.title}</span>
                <span className="text-3xs text-stone-500 block">{opt.desc}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  // Health Information (Step 5)
  const renderHealthStep = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
          Anything we should be careful about?
        </h2>
        <p className="text-xs sm:text-sm text-stone-600 mt-1">
          Helps us provide more cautious nutritional guidance.
        </p>
      </div>

      <div className="space-y-2">
        {[
          { id: 'None', title: 'No specific condition', desc: 'Standard student nutrition guidance' },
          { id: 'Diabetes / Pre-diabetes', title: 'Diabetes', desc: 'Cautious carb-heavy flagging and glycemic awareness' },
          { id: 'High blood pressure', title: 'Hypertension', desc: 'Cautious sodium & deep-fried snack awareness' },
          { id: 'Other', title: 'Other', desc: 'Specify an allergy or personal digestive consideration' },
        ].map(opt => {
          let isSelected = false;
          if (opt.id === 'None') isSelected = isNone;
          else if (opt.id === 'Diabetes / Pre-diabetes') isSelected = isDiabetes;
          else if (opt.id === 'High blood pressure') isSelected = isHypertension;
          else if (opt.id === 'Other') isSelected = isOther;

          return (
            <div key={opt.id} className="space-y-2">
              <button
                type="button"
                onClick={() => handleHealthConditionSelect(opt.id)}
                className={`w-full p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? 'bg-emerald-800 text-white border-emerald-900 shadow-2xs font-bold'
                    : 'bg-white text-stone-800 border-stone-200 hover:bg-stone-50'
                }`}
              >
                <div>
                  <span className="text-xs font-bold block">{opt.title}</span>
                  <span className={`text-2xs block ${isSelected ? 'text-emerald-200' : 'text-stone-500'}`}>
                    {opt.desc}
                  </span>
                </div>
                {isSelected && <CheckIcon size={18} className="text-white shrink-0" />}
              </button>

              {/* Optional text input for Other */}
              {opt.id === 'Other' && isSelected && (
                <div className="pl-4 pr-1 animate-in fade-in duration-200">
                  <input
                    type="text"
                    value={otherConditionText}
                    onChange={e => {
                      setOtherConditionText(e.target.value);
                      handleFieldChange('healthCondition', e.target.value || 'Other');
                      handleFieldChange('healthConditions', [e.target.value || 'Other']);
                    }}
                    placeholder="e.g. Lactose sensitivity, Gluten sensitivity..."
                    className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-emerald-700"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Safety & Non-Diagnostic Disclaimer */}
      <div className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200 text-blue-950 text-xs flex items-start gap-2.5">
        <ShieldCheckIcon size={16} className="text-blue-700 shrink-0 mt-0.5" />
        <p className="leading-relaxed text-2xs">
          <strong>Important Health Note:</strong> Your health information is used only to make nutrition guidance more cautious. Track-a-Bite does not diagnose, treat, or manage medical conditions. Consider discussing dietary changes with a qualified healthcare professional.
        </p>
      </div>
    </div>
  );

  // Review & Confirmation (Step 6)
  const renderReviewStep = () => {
    const activityLabels: Record<string, string> = {
      sedentary: 'Sedentary',
      lightly_active: 'Lightly active',
      moderately_active: 'Moderately active',
      very_active: 'Very active',
    };

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
            Review your profile
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 mt-1">
            Ensure your details are accurate before finishing setup.
          </p>
        </div>

        <Card className="border-stone-200 shadow-2xs overflow-hidden">
          <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-900 to-stone-900 text-white flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-300">
              YOUR PROFILE
            </span>
            <span className="text-3xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
              {profile.isHostelite ? 'Hostel Mode Active' : 'Home Access'}
            </span>
          </div>

          <CardContent className="p-4 sm:p-6 divide-y divide-stone-100 text-xs">
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-stone-500 font-medium">Age</span>
              <span className="font-bold text-stone-900">{profile.age} years</span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <span className="text-stone-500 font-medium">Height</span>
              <span className="font-bold text-stone-900">{profile.heightCm} cm</span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <span className="text-stone-500 font-medium">Weight</span>
              <span className="font-bold text-stone-900">{profile.weightKg} kg</span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <span className="text-stone-500 font-medium">Activity level</span>
              <span className="font-bold text-stone-900">
                {activityLabels[profile.activityLevel || 'moderately_active'] || 'Moderately active'}
              </span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <span className="text-stone-500 font-medium">Hostelite</span>
              <span className="font-bold text-stone-900">
                {profile.isHostelite ? 'Yes (Campus Staples)' : 'No (Kitchen Access)'}
              </span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <span className="text-stone-500 font-medium">Food budget</span>
              <span className="font-bold text-stone-900 capitalize">
                {profile.budgetPreference || 'Budget'}
              </span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <span className="text-stone-500 font-medium">Health information</span>
              <span className="font-bold text-stone-900">
                {profile.healthCondition ? `You indicated: ${profile.healthCondition}` : 'No specific condition'}
              </span>
            </div>

            {profile.healthGoal && (
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-stone-500 font-medium">Health goal</span>
                <span className="font-bold text-stone-900 capitalize">
                  {profile.healthGoal.replace('_', ' ')}
                </span>
              </div>
            )}

            {profile.targetCalories && (
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-stone-500 font-medium">Daily targets</span>
                <span className="font-bold text-stone-900">
                  {profile.targetCalories} kcal (P: {profile.targetProteinG ?? '--'}g, C: {profile.targetCarbsG ?? '--'}g, F: {profile.targetFatG ?? '--'}g)
                </span>
              </div>
            )}

            {profile.dietaryRestrictions && (
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-stone-500 font-medium">Dietary preference</span>
                <span className="font-bold text-stone-900 capitalize">
                  {profile.dietaryRestrictions.replace('_', ' ')}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-3xs text-center text-stone-400">
          You can update these details anytime from your Profile page.
        </p>
      </div>
    );
  };

  // Celebration Success State (Step 7)
  const renderCelebrationStep = () => (
    <div className="space-y-6 text-center py-6 sm:py-10 animate-in fade-in duration-300">
      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto text-3xl sm:text-4xl shadow-inner">
        🎉
      </div>

      <div className="space-y-2 max-w-sm mx-auto">
        <h2 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
          You&apos;re all set!
        </h2>
        <p className="text-sm text-stone-600 font-normal">
          Your nutrition insights and 5-star richness scoring are now personalized to your campus lifestyle.
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
          className="w-full text-xs font-semibold text-stone-500 hover:text-stone-800 py-1.5 transition-colors cursor-pointer"
        >
          Or jump straight to food scanner →
        </button>
      </div>
    </div>
  );

  // Nutrition Goals & Macro Tuning (Phase 8.6)
  const renderNutritionGoalsSection = () => {
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
      { id: 'general_health', title: 'General Health', icon: '🥗', desc: 'Balanced everyday energy & vitality' },
      { id: 'fat_loss', title: 'Weight Loss', icon: '🏃', desc: 'Caloric deficit with high-protein satiety' },
      { id: 'maintenance', title: 'Maintenance', icon: '⚖️', desc: 'Caloric equilibrium & bodyweight stability' },
      { id: 'muscle_gain', title: 'Muscle Gain', icon: '💪', desc: 'Caloric surplus with targeted protein' },
    ] as const;

    return (
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xs font-extrabold uppercase tracking-widest text-emerald-800 px-2.5 py-0.5 rounded-full bg-emerald-100 border border-emerald-200">
              Personalized Targets
            </span>
            <span className="text-2xs font-bold text-stone-500">
              {isCustomActive ? 'Custom Targets Active' : 'Recommended Targets Active'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
            Nutrition Goals & Macro Tuning
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 mt-1">
            Set your target daily calories and macronutrient proportions. Changes immediately update your dashboard, recommendations, and reports.
          </p>
        </div>

        {/* Goal Selector */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
            Health & Body Goal
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-emerald-800 text-white border-emerald-900 shadow-2xs font-bold'
                      : 'bg-white text-stone-800 border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{opt.icon}</span>
                    <div>
                      <span className="text-xs font-bold block">{opt.title}</span>
                      <span className={`text-2xs block ${isSelected ? 'text-emerald-200' : 'text-stone-500'}`}>
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

        {/* Auto-Calculate vs Custom Targets Action Toggle (Section 7) */}
        <div className="p-1 rounded-2xl bg-stone-100 border border-stone-200/80 flex gap-1">
          <button
            type="button"
            onClick={handleUseRecommendedTargets}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              !isCustomActive
                ? 'bg-white text-emerald-900 shadow-xs border border-stone-200/60'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <span>⚡</span>
            <span>Use Recommended Targets</span>
          </button>
          <button
            type="button"
            onClick={handleEnableCustomTargets}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              isCustomActive
                ? 'bg-white text-emerald-900 shadow-xs border border-stone-200/60'
                : 'text-stone-600 hover:text-stone-900'
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
              <label htmlFor="input-target-calories" className="block text-2xs font-bold uppercase tracking-wider text-stone-700">
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
                  placeholder="e.g. 2000"
                  className={`w-full rounded-xl bg-white border text-stone-900 text-sm py-2.5 px-3 pr-12 transition-all focus:outline-none focus:ring-2 ${
                    errors.targetCalories ? 'border-rose-400 focus:ring-rose-200' : 'border-stone-200 focus:border-emerald-700 focus:ring-emerald-100'
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
              <label htmlFor="input-target-protein" className="block text-2xs font-bold uppercase tracking-wider text-emerald-800">
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
                  placeholder="e.g. 80"
                  className={`w-full rounded-xl bg-white border text-stone-900 text-sm py-2.5 px-3 pr-10 transition-all focus:outline-none focus:ring-2 ${
                    errors.targetProteinG ? 'border-rose-400 focus:ring-rose-200' : 'border-emerald-200 focus:border-emerald-700 focus:ring-emerald-100'
                  }`}
                />
                <span className="absolute right-3 text-2xs font-bold text-emerald-700 pointer-events-none">
                  g
                </span>
              </div>
              {errors.targetProteinG && (
                <p className="text-3xs text-rose-600 font-medium">{errors.targetProteinG}</p>
              )}
            </div>

            {/* Carbs */}
            <div className="space-y-1.5">
              <label htmlFor="input-target-carbs" className="block text-2xs font-bold uppercase tracking-wider text-amber-800">
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
                  placeholder="e.g. 250"
                  className={`w-full rounded-xl bg-white border text-stone-900 text-sm py-2.5 px-3 pr-10 transition-all focus:outline-none focus:ring-2 ${
                    errors.targetCarbsG ? 'border-rose-400 focus:ring-rose-200' : 'border-amber-200 focus:border-amber-700 focus:ring-amber-100'
                  }`}
                />
                <span className="absolute right-3 text-2xs font-bold text-amber-700 pointer-events-none">
                  g
                </span>
              </div>
              {errors.targetCarbsG && (
                <p className="text-3xs text-rose-600 font-medium">{errors.targetCarbsG}</p>
              )}
            </div>

            {/* Fat */}
            <div className="space-y-1.5">
              <label htmlFor="input-target-fat" className="block text-2xs font-bold uppercase tracking-wider text-teal-800">
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
                  className={`w-full rounded-xl bg-white border text-stone-900 text-sm py-2.5 px-3 pr-10 transition-all focus:outline-none focus:ring-2 ${
                    errors.targetFatG ? 'border-rose-400 focus:ring-rose-200' : 'border-teal-200 focus:border-teal-700 focus:ring-teal-100'
                  }`}
                />
                <span className="absolute right-3 text-2xs font-bold text-teal-700 pointer-events-none">
                  g
                </span>
              </div>
              {errors.targetFatG && (
                <p className="text-3xs text-rose-600 font-medium">{errors.targetFatG}</p>
              )}
            </div>
          </div>

          {/* Macro Consistency Breakdown & Live Calculation (Section 5) */}
          <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/90 text-xs space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-2xs">
              <span className="font-bold text-stone-700 uppercase tracking-wider">
                Macro Energy Breakdown:
              </span>
              <div className="flex flex-wrap items-center gap-3 font-semibold">
                <span className="text-emerald-800">Protein: {macroStats.proteinCalories} kcal (×4)</span>
                <span className="text-amber-800">Carbs: {macroStats.carbsCalories} kcal (×4)</span>
                <span className="text-teal-800">Fat: {macroStats.fatCalories} kcal (×9)</span>
                <span className="text-stone-900 font-black">Sum: {macroStats.totalMacroCalories} kcal</span>
              </div>
            </div>

            {/* Non-medical warning banner if variance is significant */}
            {macroStats.hasSignificantVariance && profile.targetCalories && profile.targetCalories > 0 && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/90 text-amber-900 flex items-start gap-2 text-2xs leading-relaxed animate-in fade-in duration-200">
                <InfoIcon size={16} className="text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">
                    Your macro targets currently add up to approximately {macroStats.totalMacroCalories} kcal, while your calorie target is {profile.targetCalories} kcal.
                  </p>
                  <p className="text-3xs text-amber-800 mt-0.5">
                    This is an informational calculation. You can fine-tune protein, carbs, and fat to align with your overall energy target, or leave them as configured.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Informational Guidance Note */}
        <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 text-2xs text-stone-500 flex items-start gap-2">
          <InfoIcon size={14} className="text-stone-400 shrink-0 mt-0.5" />
          <span>
            Track-a-Bite calculates recommended targets using the Mifflin-St Jeor formula adjusted for student physical activity. These numbers are non-medical planning estimates.
          </span>
        </div>
      </div>
    );
  };

  // Dietary Preferences & Allergies Section
  const renderDietarySection = () => {
    const dietaryOptions = [
      { id: 'vegetarian', title: 'Vegetarian', desc: 'Plant foods & dairy, no meat or egg' },
      { id: 'eggetarian', title: 'Eggetarian', desc: 'Vegetarian plus eggs' },
      { id: 'non_vegetarian', title: 'Non-Vegetarian', desc: 'All campus food options' },
      { id: 'vegan', title: 'Vegan', desc: 'Strictly plant-based, no dairy or honey' },
      { id: 'jain', title: 'Jain', desc: 'Vegetarian without root vegetables' },
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
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
            Dietary Preferences & Allergies
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 mt-1">
            Ensure next-meal suggestions and nutrient gaps respect your food choices and safety limits.
          </p>
        </div>

        {/* Dietary Restriction */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
            Dietary Preference
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {dietaryOptions.map(opt => {
              const isSelected = (profile.dietaryRestrictions || 'vegetarian') === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleFieldChange('dietaryRestrictions', opt.id)}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-emerald-800 text-white border-emerald-900 shadow-2xs font-bold'
                      : 'bg-white text-stone-800 border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <div>
                    <span className="text-xs font-bold block">{opt.title}</span>
                    <span className={`text-2xs block ${isSelected ? 'text-emerald-200' : 'text-stone-500'}`}>
                      {opt.desc}
                    </span>
                  </div>
                  {isSelected && <CheckIcon size={16} className="text-white shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Allergies Chips */}
        <div className="space-y-2 pt-2 border-t border-stone-100">
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
            Food Allergies & Sensitivities
          </label>
          <p className="text-2xs text-stone-500">
            Selected allergens are strictly filtered out from next-meal recommendations.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {commonAllergies.map(allergy => {
              const isSelected = currentAllergies.some(a => a.toLowerCase() === allergy.toLowerCase());
              return (
                <button
                  key={allergy}
                  type="button"
                  onClick={() => toggleAllergy(allergy)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-rose-100 text-rose-900 border-rose-300 ring-1 ring-rose-300'
                      : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  {isSelected ? `✓ ${allergy}` : `+ ${allergy}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Hostel / Mess & Kitchen Amenities */}
        <div className="space-y-2 pt-2 border-t border-stone-100">
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
            Campus Food Facilities
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            {[
              { key: 'hasMessFood' as const, label: 'Mess / Tiffin Service', icon: '🍲' },
              { key: 'hasCookingAccess' as const, label: 'Induction / Kettle Access', icon: '🍳' },
              { key: 'hasFridge' as const, label: 'Refrigerator Access', icon: '❄️' },
            ].map(facility => {
              const isActive = Boolean(profile[facility.key]);
              return (
                <button
                  key={facility.key}
                  type="button"
                  onClick={() => handleFieldChange(facility.key, !isActive)}
                  className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                    isActive
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-950 ring-1 ring-emerald-500 font-bold'
                      : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  <span className="text-xl">{facility.icon}</span>
                  <span className="text-2xs font-bold block">{facility.label}</span>
                  <span className="text-3xs text-stone-400 block">{isActive ? 'Available' : 'No access'}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // MAIN RENDER SWITCH
  // ---------------------------------------------------------------------------

  // If in edit mode, render a unified multi-section form with Save Profile action
  if (mode === 'edit') {
    return (
      <div className={`space-y-8 ${className}`}>
        {isSuccessSaved && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs font-bold flex items-center justify-between animate-in fade-in duration-200">
            <span className="flex items-center gap-2">
              <CheckIcon size={18} className="text-emerald-700" />
              <span>
                {syncNotice
                  ? `Profile updated! ${syncNotice}`
                  : 'Profile updated & synced to cloud! ✨'}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setIsSuccessSaved(false)}
              className="text-stone-400 hover:text-stone-700 text-xs font-normal cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        <div className="space-y-8">
          {/* Section 1: About You */}
          <Card className="border-stone-200/90 shadow-2xs">
            <CardContent className="p-5 sm:p-6">
              {renderAboutYouStep()}
            </CardContent>
          </Card>

          {/* Section 2: Body Details */}
          <Card className="border-stone-200/90 shadow-2xs">
            <CardContent className="p-5 sm:p-6">
              {renderBodyDetailsStep()}
            </CardContent>
          </Card>

          {/* Section 3: Nutrition Goals & Macro Tuning (Phase 8.6) */}
          <Card className="border-stone-200/90 shadow-2xs">
            <CardContent className="p-5 sm:p-6">
              {renderNutritionGoalsSection()}
            </CardContent>
          </Card>

          {/* Section 4: Dietary Preferences & Allergies */}
          <Card className="border-stone-200/90 shadow-2xs">
            <CardContent className="p-5 sm:p-6">
              {renderDietarySection()}
            </CardContent>
          </Card>

          {/* Section 5: Lifestyle & Budget */}
          <Card className="border-stone-200/90 shadow-2xs">
            <CardContent className="p-5 sm:p-6">
              {renderLifestyleStep()}
            </CardContent>
          </Card>

          {/* Section 6: Health Considerations */}
          <Card className="border-stone-200/90 shadow-2xs">
            <CardContent className="p-5 sm:p-6">
              {renderHealthStep()}
            </CardContent>
          </Card>

          {/* Save Action */}
          <div className="flex items-center justify-between pt-2">
            {onCancel ? (
              <Button variant="outline" size="md" onClick={onCancel}>
                Cancel
              </Button>
            ) : (
              <span className="text-2xs text-stone-500">
                Changes take effect across all food scans immediately.
              </span>
            )}

            <Button
              variant="primary"
              size="lg"
              onClick={handleComplete}
              disabled={isSubmitting}
              leftIcon={<SparklesIcon size={16} />}
              className="px-6 font-bold"
            >
              {isSubmitting ? 'Saving...' : 'Save Profile'}
            </Button>
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
      <Card className="border-stone-200 shadow-sm overflow-hidden bg-white">
        {/* Header with Step Indicator (Steps 2 to 6) */}
        {step >= 2 && step <= 6 && (
          <div className="px-6 pt-6 pb-2 space-y-2 border-b border-stone-100">
            <div className="flex items-center justify-between text-2xs font-extrabold uppercase tracking-widest text-stone-500">
              <span>TRACK-A-BITE ONBOARDING</span>
              <span>
                STEP {currentStepNumber} OF {stepTotal}
              </span>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full bg-stone-100 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-700 h-full rounded-full transition-all duration-300"
                style={{ width: `${(currentStepNumber / stepTotal) * 100}%` }}
              />
            </div>
          </div>
        )}

        <CardContent className="p-6 sm:p-8">
          {step === 1 && renderWelcomeStep()}
          {step === 2 && renderAboutYouStep()}
          {step === 3 && renderBodyDetailsStep()}
          {step === 4 && renderLifestyleStep()}
          {step === 5 && renderHealthStep()}
          {step === 6 && renderReviewStep()}
          {step === 7 && renderCelebrationStep()}

          {/* Navigation Controls (Steps 2 to 6) */}
          {step >= 2 && step <= 6 && (
            <div className="flex items-center justify-between pt-8 border-t border-stone-100 mt-8">
              <Button
                variant="ghost"
                size="md"
                onClick={() => setStep((prev) => (prev - 1) as OnboardingStep)}
                className="text-stone-600 font-semibold"
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
                    setStep((prev) => (prev + 1) as OnboardingStep);
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
                  className="font-bold px-7 bg-emerald-800 hover:bg-emerald-900"
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
