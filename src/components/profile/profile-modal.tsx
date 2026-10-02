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
      let current = [...prev.healthConditions];
      if (condition === 'None' || condition === 'Prefer not to say') {
        return { ...prev, healthConditions: [condition] };
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
      description="Help us tailor realistic recommendations to your college lifestyle."
      maxWidth="md"
    >
      <div className="space-y-5 text-stone-900 pt-1">
        {/* Hostel Status - The Primary Pivot */}
        <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/90 space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-emerald-950">
            Are you a hostel student?
          </label>
          <p className="text-2xs text-emerald-800 leading-relaxed">
            Hostel mode prioritizes inexpensive, zero-cooking foods available around college canteens and tea stalls.
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => setProfile(prev => ({ ...prev, isHostelite: true }))}
              className={`p-3 rounded-xl text-xs font-bold border transition-all text-left flex items-center justify-between cursor-pointer ${
                profile.isHostelite
                  ? 'bg-emerald-800 text-white border-emerald-900 shadow-2xs'
                  : 'bg-white text-stone-700 border-stone-200 hover:bg-emerald-50/50'
              }`}
            >
              <div>
                <span className="block">YES</span>
                <span className="text-3xs font-medium opacity-90">I&apos;m a hostelite</span>
              </div>
              {profile.isHostelite && <CheckIcon size={16} />}
            </button>

            <button
              type="button"
              onClick={() => setProfile(prev => ({ ...prev, isHostelite: false }))}
              className={`p-3 rounded-xl text-xs font-bold border transition-all text-left flex items-center justify-between cursor-pointer ${
                !profile.isHostelite
                  ? 'bg-emerald-800 text-white border-emerald-900 shadow-2xs'
                  : 'bg-white text-stone-700 border-stone-200 hover:bg-emerald-50/50'
              }`}
            >
              <div>
                <span className="block">NO</span>
                <span className="text-3xs font-medium opacity-90">I have kitchen access</span>
              </div>
              {!profile.isHostelite && <CheckIcon size={16} />}
            </button>
          </div>
        </div>

        {/* Basic Metrics (Age, Height, Weight) */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-2">
            Basic Details
          </label>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <span className="block text-2xs text-stone-500 font-medium mb-1">Age</span>
              <input
                type="number"
                min="14"
                max="100"
                value={profile.age || ''}
                onChange={e => setProfile(prev => ({ ...prev, age: Number(e.target.value) || undefined }))}
                placeholder="20"
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-emerald-700"
              />
            </div>
            <div>
              <span className="block text-2xs text-stone-500 font-medium mb-1">Height (cm)</span>
              <input
                type="number"
                min="100"
                max="250"
                value={profile.heightCm || ''}
                onChange={e => setProfile(prev => ({ ...prev, heightCm: Number(e.target.value) || undefined }))}
                placeholder="170"
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-emerald-700"
              />
            </div>
            <div>
              <span className="block text-2xs text-stone-500 font-medium mb-1">Weight (kg)</span>
              <input
                type="number"
                min="30"
                max="200"
                value={profile.weightKg || ''}
                onChange={e => setProfile(prev => ({ ...prev, weightKg: Number(e.target.value) || undefined }))}
                placeholder="65"
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-emerald-700"
              />
            </div>
          </div>
        </div>

        {/* Optional Health Preferences */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-600">
              Health conditions (optional)
            </label>
            <span className="text-2xs text-stone-400">Predefined options</span>
          </div>
          <p className="text-2xs text-stone-500 mb-2 leading-relaxed">
            Helps fine-tune suggestions (e.g. lowering sugar spikes or avoiding heavy lactose).
          </p>

          <div className="flex flex-wrap gap-1.5">
            {PREDEFINED_HEALTH_CONDITIONS.map(condition => {
              const isSelected = profile.healthConditions.includes(condition);
              return (
                <button
                  key={condition}
                  type="button"
                  onClick={() => handleConditionToggle(condition)}
                  className={`text-2xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-800 text-white border-emerald-900 font-semibold shadow-2xs'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {condition}
                </button>
              );
            })}
          </div>
        </div>

        {/* Privacy Note */}
        <div className="p-3 rounded-xl bg-stone-100 text-stone-600 text-2xs leading-relaxed flex items-start gap-2">
          <ShieldCheckIcon size={16} className="text-stone-500 shrink-0 mt-0.5" />
          <p>
            <strong>Privacy Note:</strong> Your profile helps personalize food suggestions. Track-a-Bite does not provide medical diagnosis or treatment.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
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
