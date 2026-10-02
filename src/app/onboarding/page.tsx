'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Container } from '../../components/layout/container';
import { ProfileForm } from '../../components/profile/profile-form';
import { useHasCompletedOnboarding } from '../../lib/services/userProfileService';

export default function OnboardingPage() {
  const router = useRouter();
  const hasCompleted = useHasCompletedOnboarding();

  useEffect(() => {
    // If returning user has already completed onboarding, bypass directly to dashboard
    if (hasCompleted) {
      router.replace('/dashboard');
    }
  }, [hasCompleted, router]);

  if (hasCompleted) {
    return (
      <div className="py-24 text-center">
        <div className="inline-block w-8 h-8 border-3 border-emerald-700 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm text-stone-600 font-medium">Redirecting to dashboard...</p>
      </div>
    );
  }

  return (
    <div className="py-8 sm:py-12 bg-gradient-to-b from-stone-50 via-emerald-50/20 to-stone-50 min-h-[calc(100vh-4rem)]">
      <Container size="md">
        <ProfileForm mode="onboarding" onComplete={() => router.push('/dashboard')} />
      </Container>
    </div>
  );
}
