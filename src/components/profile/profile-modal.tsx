'use client';

import React, { useState } from 'react';
import { UserProfile, PREDEFINED_HEALTH_CONDITIONS } from '../../lib/types/profile';
import { userProfileService } from '../../lib/services/userProfileService';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import { CheckIcon, ShieldCheckIcon } from '../ui/icons';

export interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileSaved?: (profile: UserProfile) => void;
}

export function ProfileModal({ isOpen, onClose, onProfileSaved }: ProfileModalProps) {
  if (!isOpen) return null;

  return (
    <ProfileModalDialogContent
      isOpen={isOpen}
      onClose={onClose}
      onProfileSaved={onProfileSaved}
    />
  );
}

function ProfileModalDialogContent({
  isOpen,
  onClose,
  onProfileSaved,
}: ProfileModalProps) {
  const [profile, setProfile] = useState<UserProfile>(() => userProfileService.getProfile());

  const handleConditionToggle = (condition: string) => {
    setProfile(prev => {
      let current = Array.isArray(prev.healthConditions) ? [...prev.healthConditions] : [];
      if (condition === 'None') {
        return { ...prev, healthConditions: ['None'] };
      }
      current = current.filter(c => c !== 'None' && c !== 'Prefer not to say');
      if (current.includes(condition)) {
        current = current.filter(c => c !== condition);
        if (current.length === 0) current = ['None'];
      } else {
        current.push(condition);
      }
      return { ...prev, healthConditions: current };
    });
  };

  const handleSave = () => {
    const updated = userProfileService.saveProfile(profile);
    onProfileSaved?.(updated);
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Personalize Food Suggestions"
      description="Help us tailor realistic recommendations to your college and food lifestyle."
      maxWidth="md"
    >
      <div className="space-y-5 text-stone-900 dark:text-stone-100 pt-1">
        {/* Hostel Status - The Primary Pivot */}
        <div className="p-4 rounded-2xl bg-[#FEF7EE] dark:bg-[#2A1C14] border border-[#E8DED2] dark:border-[#38312A] space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-900 dark:text-stone-100">
            Living &amp; Cooking Status
          </label>
          <p className="text-2xs text-stone-600 dark:text-stone-400 leading-relaxed">
            Hostel mode prioritizes inexpensive, zero-cooking foods available around campus canteens and tea stalls.
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => setProfile(prev => ({ ...prev, isHostelite: true }))}
              className={`p-3 rounded-xl text-xs font-bold border transition-all text-left flex items-center justify-between cursor-pointer ${
                profile.isHostelite
                  ? 'bg-[#E86A33] text-white border-[#E86A33] shadow-2xs'
                  : 'bg-white dark:bg-[#1D1A17] text-stone-700 dark:text-stone-300 border-[#E8DED2] dark:border-[#38312A] hover:bg-[#FAF7F2] dark:hover:bg-[#25211D]'
              }`}
            >
              <div>
                <span className="block">YES</span>
                <span className="text-3xs font-medium opacity-90">Hostelite / Dorm</span>
              </div>
              {profile.isHostelite && <CheckIcon size={16} />}
            </button>

            <button
              type="button"
              onClick={() => setProfile(prev => ({ ...prev, isHostelite: false }))}
              className={`p-3 rounded-xl text-xs font-bold border transition-all text-left flex items-center justify-between cursor-pointer ${
                !profile.isHostelite
                  ? 'bg-[#E86A33] text-white border-[#E86A33] shadow-2xs'
                  : 'bg-white dark:bg-[#1D1A17] text-stone-700 dark:text-stone-300 border-[#E8DED2] dark:border-[#38312A] hover:bg-[#FAF7F2] dark:hover:bg-[#25211D]'
              }`}
            >
              <div>
                <span className="block">NO</span>
                <span className="text-3xs font-medium opacity-90">Kitchen access / Home</span>
              </div>
              {!profile.isHostelite && <CheckIcon size={16} />}
            </button>
          </div>
        </div>

        {/* Basic Metrics (Age, Height, Weight) */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 mb-2">
            Basic Metrics
          </label>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <span className="block text-2xs text-stone-500 dark:text-stone-400 font-medium mb-1">Age</span>
              <input
                type="number"
                min="1"
                max="120"
                value={profile.age || ''}
                onChange={e => setProfile(prev => ({ ...prev, age: Number(e.target.value) || undefined }))}
                placeholder="20"
                className="w-full px-3 py-2 bg-white dark:bg-[#1D1A17] border border-[#E8DED2] dark:border-[#38312A] text-stone-900 dark:text-stone-100 rounded-xl text-sm focus:outline-none focus:border-[#E86A33]"
              />
            </div>
            <div>
              <span className="block text-2xs text-stone-500 dark:text-stone-400 font-medium mb-1">Height (cm)</span>
              <input
                type="number"
                min="40"
                max="260"
                value={profile.heightCm || ''}
                onChange={e => setProfile(prev => ({ ...prev, heightCm: Number(e.target.value) || undefined }))}
                placeholder="170"
                className="w-full px-3 py-2 bg-white dark:bg-[#1D1A17] border border-[#E8DED2] dark:border-[#38312A] text-stone-900 dark:text-stone-100 rounded-xl text-sm focus:outline-none focus:border-[#E86A33]"
              />
            </div>
            <div>
              <span className="block text-2xs text-stone-500 dark:text-stone-400 font-medium mb-1">Weight (kg)</span>
              <input
                type="number"
                min="10"
                max="350"
                value={profile.weightKg || ''}
                onChange={e => setProfile(prev => ({ ...prev, weightKg: Number(e.target.value) || undefined }))}
                placeholder="65"
                className="w-full px-3 py-2 bg-white dark:bg-[#1D1A17] border border-[#E8DED2] dark:border-[#38312A] text-stone-900 dark:text-stone-100 rounded-xl text-sm focus:outline-none focus:border-[#E86A33]"
              />
            </div>
          </div>
        </div>

        {/* Health Conditions Multi-Select */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
              Health conditions (optional)
            </label>
            <span className="text-2xs text-stone-400">Dietary context</span>
          </div>
          <p className="text-2xs text-stone-500 dark:text-stone-400 mb-2 leading-relaxed">
            Helps fine-tune suggestions (e.g. lowering refined carbs or sodium awareness).
          </p>

          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Health conditions">
            {PREDEFINED_HEALTH_CONDITIONS.map(condition => {
              const isSelected = profile.healthConditions.includes(condition);
              return (
                <button
                  key={condition}
                  type="button"
                  role="checkbox"
                  aria-checked={isSelected}
                  onClick={() => handleConditionToggle(condition)}
                  className={`text-2xs px-3 py-2 rounded-xl border font-medium transition-all cursor-pointer min-h-[38px] ${
                    isSelected
                      ? 'bg-[#E86A33] text-white border-[#E86A33] font-bold shadow-2xs'
                      : 'bg-white dark:bg-[#1D1A17] text-stone-700 dark:text-stone-300 border-[#E8DED2] dark:border-[#38312A] hover:bg-[#FAF7F2] dark:hover:bg-[#25211D]'
                  }`}
                >
                  {isSelected ? `✓ ${condition}` : condition}
                </button>
              );
            })}
          </div>
        </div>

        {/* Privacy Note */}
        <div className="p-3 rounded-xl bg-[#FAF7F2] dark:bg-[#1D1A17] border border-[#E8DED2] dark:border-[#38312A] text-stone-600 dark:text-stone-400 text-2xs leading-relaxed flex items-start gap-2">
          <ShieldCheckIcon size={16} className="text-stone-500 shrink-0 mt-0.5" />
          <p>
            <strong>Privacy Note:</strong> Your profile helps personalize food suggestions. Track-a-Bite does not provide medical diagnosis or treatment.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E8DED2] dark:border-[#38312A]">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="md" onClick={handleSave}>
            Save Preferences
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
