'use client';

import React from 'react';
import Link from 'next/link';
import { Container } from '../../components/layout/container';
import { ProfileForm } from '../../components/profile/profile-form';
import { userProfileService } from '../../lib/services/userProfileService';
import { Button } from '../../components/ui/button';
import { CameraIcon, ShieldCheckIcon } from '../../components/ui/icons';
import { AuthGuard } from '../../components/auth/AuthGuard';

export default function ProfilePage() {
  const handleResetProfile = () => {
    if (typeof window !== 'undefined' && window.confirm('Reset your profile back to default values?')) {
      userProfileService.clearProfile();
      window.location.reload();
    }
  };

  return (
    <AuthGuard>
      <div className="py-8 sm:py-12 bg-gradient-to-b from-stone-50 via-emerald-50/10 to-stone-50 dark:from-[#0c130e] dark:via-[#131d16] dark:to-[#0c130e] min-h-[calc(100vh-4rem)]">
        <Container size="md">
        <div className="space-y-6">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200 dark:border-[#23382b]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xs font-extrabold uppercase tracking-widest text-emerald-800 dark:text-emerald-300 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60">
                  Settings &amp; Preferences
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-stone-900 dark:text-stone-100 tracking-tight">
                Your Nutrition Profile
              </h1>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-1">
                Fine-tune your personal metrics, hostel lifestyle, and dietary preferences.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Link href="/scan">
                <Button variant="primary" size="md" leftIcon={<CameraIcon size={16} />} className="font-semibold">
                  Go to Scanner
                </Button>
              </Link>
            </div>
          </div>

          {/* Reusable Profile Form in Edit Mode */}
          <ProfileForm mode="edit" />

          {/* Reset & Privacy Footer */}
          <div className="pt-6 border-t border-stone-200 dark:border-[#23382b] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-2xs text-stone-500 dark:text-stone-400">
            <div className="flex items-center gap-2">
              <ShieldCheckIcon size={16} className="text-stone-400 dark:text-stone-500 shrink-0" />
              <span>
                Your metrics remain stored privately on this device and are never shared.
              </span>
            </div>

            <button
              type="button"
              onClick={handleResetProfile}
              className="text-stone-500 dark:text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 underline font-medium cursor-pointer self-start sm:self-auto"
            >
              Reset to Defaults &amp; Re-run Onboarding
            </button>
          </div>
        </div>
      </Container>
    </div>
    </AuthGuard>
  );
}
