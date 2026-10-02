'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Container } from '../components/layout/container';
import { Button } from '../components/ui/button';
import { SectionHeading } from '../components/common/section-heading';
import { NutrientStarRating } from '../components/nutrition/nutrient-star-rating';
import { CampusRealitySection } from '../components/campus/campus-reality-section';
import { ProfileModal } from '../components/profile/profile-modal';
import { userProfileService, useUserProfile, useHasCompletedOnboarding } from '../lib/services/userProfileService';
import { useAuth } from '../components/auth/AuthProvider';
import {
  CameraIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
  CheckIcon,
} from '../components/ui/icons';

export default function HomePage() {
  const router = useRouter();
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const profile = useUserProfile();
  const hasCompletedOnboarding = useHasCompletedOnboarding();
  const { isAuthenticated } = useAuth();

  const primaryCta = !isAuthenticated
    ? { href: '/register', label: 'Get Started' }
    : !hasCompletedOnboarding
      ? { href: '/onboarding', label: 'Complete Profile' }
      : { href: '/dashboard', label: 'View Dashboard' };

  const handleHosteliteClick = () => {
    userProfileService.saveProfile({ isHostelite: true });
    if (!isAuthenticated) {
      router.push('/register');
    } else if (!hasCompletedOnboarding) {
      router.push('/onboarding');
    } else {
      router.push('/profile');
    }
  };

  const sampleRichnessSprouts = {
    stars: 4.5,
    label: 'Nutrient Rich Powerhouse',
    explanation: 'Good source of live plant protein and dietary fiber, but relatively low in calcium.',
    highlights: ['13.5g Plant Protein', '8.2g Fiber', 'Zero Cooking Needed'],
  };

  const sampleRichnessKachori = {
    stars: 2.0,
    label: 'Energy-Dense / Low Micronutrient',
    explanation: 'High in quick energy from refined carbs and fats, but lacking protein and protective fiber.',
    highlights: ['Rapid Energy', 'High Fat Ratio', 'Low Fiber (< 4g)'],
  };

  return (
    <div className="flex flex-col gap-14 sm:gap-20 pb-20">
      {/* 1. HERO SECTION */}
      <section className="relative pt-12 sm:pt-20 pb-6 overflow-hidden bg-gradient-to-b from-emerald-50/50 via-transparent to-transparent">
        <Container size="lg">
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto space-y-6">
            {/* Campus Hostelite Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100/80 text-emerald-950 border border-emerald-300/80 text-xs font-bold">
              <span className="text-sm">{profile.isHostelite ? '🏠' : '🎓'}</span>
              <span>
                {profile.isHostelite ? 'Hostel Mode Active' : 'Student Food Companion'}
              </span>
              <span className="text-3xs px-1.5 py-0.2 rounded-full bg-emerald-700 text-white font-extrabold">
                Campus Edition
              </span>
            </div>

            {/* Hero Heading */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-stone-900 leading-[1.12]">
              Know what you&apos;re actually getting from your food.
            </h1>

            {/* Supporting Message */}
            <p className="text-base sm:text-xl text-stone-600 max-w-2xl leading-relaxed font-normal">
              Scan your meal. Understand the nutrients. Find simple, affordable ways to fill the gaps without needing an expensive diet.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 w-full sm:w-auto">
              <Link href={primaryCta.href} className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto px-8 font-bold" leftIcon={!isAuthenticated ? <CameraIcon size={20} /> : undefined}>
                  {primaryCta.label}
                </Button>
              </Link>
              {isAuthenticated ? (
                <Link href="/scan" className="w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto px-8 font-semibold bg-white border-emerald-300 text-emerald-950 hover:bg-emerald-50"
                    leftIcon={<CameraIcon size={20} />}
                  >
                    Scan Food
                  </Button>
                </Link>
              ) : (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleHosteliteClick}
                  className="w-full sm:w-auto px-8 font-semibold bg-white border-amber-300 text-amber-950 hover:bg-amber-50"
                >
                  I&apos;m a Hostelite
                </Button>
              )}
            </div>

            {/* Key Student Questions Answered */}
            <div className="pt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left sm:text-center text-xs text-stone-700 border-t border-stone-200/80 max-w-2xl w-full">
              <div className="flex items-center gap-2 justify-center p-2 rounded-xl bg-white/60 border border-stone-200/60">
                <span className="text-emerald-700 font-bold">✓</span>
                <span>What nutrients are in this?</span>
              </div>
              <div className="flex items-center gap-2 justify-center p-2 rounded-xl bg-white/60 border border-stone-200/60">
                <span className="text-amber-700 font-bold">⚠</span>
                <span>What am I missing?</span>
              </div>
              <div className="flex items-center gap-2 justify-center p-2 rounded-xl bg-white/60 border border-stone-200/60">
                <span className="text-emerald-700 font-bold">₹</span>
                <span>What can I realistically add?</span>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* 2. CAMPUS REALITY SECTION */}
      <section>
        <Container size="lg">
          <CampusRealitySection />
        </Container>
      </section>

      {/* 3. 5-STAR NUTRIENT RICHNESS SYSTEM */}
      <section>
        <Container size="lg">
          <SectionHeading
            centered
            eyebrow="Objective Food Intelligence"
            title="5-Star Nutrient Richness"
            description="We never label your food as simply 'healthy' or 'unhealthy'. Our 5-star richness score evaluates protein, fiber, and micronutrient density to give honest educational feedback."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* High richness comparison card */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-stone-600 px-1">
                <span>Example: Sprouts Chaat (₹25)</span>
                <span className="text-emerald-700 font-semibold">Street / Cart Food</span>
              </div>
              <NutrientStarRating richness={sampleRichnessSprouts} />
            </div>

            {/* Lower richness comparison card */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-stone-600 px-1">
                <span>Example: Canteen Kachori (₹20)</span>
                <span className="text-amber-700 font-semibold">Fried Snack</span>
              </div>
              <NutrientStarRating richness={sampleRichnessKachori} />
            </div>
          </div>
        </Container>
      </section>

      {/* 4. WHAT AM I MISSING & EASY HOSTEL UPGRADES PREVIEW */}
      <section className="bg-emerald-950 text-white py-16 rounded-3xl mx-4 sm:mx-6 lg:mx-8">
        <Container size="lg">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 space-y-6">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-900/80 px-3 py-1 rounded-md border border-emerald-700/60">
                The Core Feature
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
                &ldquo;What am I missing, and what can I realistically add?&rdquo;
              </h2>
              <p className="text-sm sm:text-base text-stone-300 leading-relaxed font-normal">
                Hostel students don’t have kitchen blenders, ovens, or organic grocery stores. If your lunch was potato samosas or plain mess rice, Track-a-Bite points out the exact missing element and suggests zero-cooking additions right outside your hostel gate.
              </p>

              <div className="space-y-3 text-xs sm:text-sm text-stone-200">
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-emerald-800 text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckIcon size={12} />
                  </div>
                  <span><strong>Zero Cooking Required:</strong> Hard boiled eggs, sprouts, dahi, peanuts, banana.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-emerald-800 text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckIcon size={12} />
                  </div>
                  <span><strong>Campus Budget Friendly:</strong> Additions range from ₹5 to ₹25 max.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-emerald-800 text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckIcon size={12} />
                  </div>
                  <span><strong>No Stigma or Guilt:</strong> Enjoy your samosa; balance it with curd or sprouts.</span>
                </div>
              </div>

              <div className="pt-2">
                <Link href="/scan">
                  <Button size="md" className="bg-white text-emerald-950 hover:bg-emerald-50 font-bold" rightIcon={<ArrowRightIcon size={16} />}>
                    Test a Food Scan
                  </Button>
                </Link>
              </div>
            </div>

            {/* Visual Upgrades Showcase */}
            <div className="lg:col-span-6 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-300 block">
                Top Student Food Upgrades (Under ₹30):
              </span>

              <div className="space-y-2.5">
                {[
                  {
                    emoji: '🥚',
                    title: '2 Boiled Eggs',
                    price: '₹15–25',
                    why: '+12.6g complete protein & choline for study focus. Available at every tea stall.',
                  },
                  {
                    emoji: '🌱',
                    title: 'Sprouts Chaat',
                    price: '₹20–30',
                    why: '+13.5g plant protein, 8g fiber, and active digestive enzymes. Zero room cooking.',
                  },
                  {
                    emoji: '🥛',
                    title: 'Fresh Dahi / Curd',
                    price: '₹15–25',
                    why: 'Probiotic shield for spicy mess food; supplies 5g protein and 180mg calcium.',
                  },
                  {
                    emoji: '🥜',
                    title: 'Roasted Chana / Peanuts',
                    price: '₹10–20',
                    why: 'Keep a packet in your study desk. Slow-burning fuel for late night study.',
                  },
                  {
                    emoji: '🍌',
                    title: 'Desi Banana',
                    price: '₹5–10',
                    why: 'Natural potassium to counter canteen sodium and prevent cramps.',
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-stone-900 border border-emerald-800/60 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{item.emoji}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{item.title}</span>
                          <span className="text-3xs font-extrabold text-emerald-300 bg-emerald-900 px-1.5 py-0.5 rounded">
                            {item.price}
                          </span>
                        </div>
                        <p className="text-3xs text-stone-400 mt-0.5">{item.why}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* 5. HOW IT WORKS */}
      <section>
        <Container size="lg">
          <SectionHeading
            centered
            eyebrow="Mobile-First Camera Flow"
            title="Scan, Identify, Upgrade in 10 Seconds"
            description="Built to be effortlessly fast on mobile before you sit down to eat."
          />

          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            {[
              {
                step: '01',
                title: 'Snap Food',
                desc: 'Point phone camera at your plate, bowl, dona, or canteen snack.',
                badge: '1-Tap Mobile Camera',
              },
              {
                step: '02',
                title: 'Instant Match',
                desc: 'Identifies samosa, sprouts chaat, mess dal, kachori, or thali.',
                badge: 'Indian Campus Foods',
              },
              {
                step: '03',
                title: '5-Star Score',
                desc: 'See estimated calories, protein, carbs, fat, fiber, and richness.',
                badge: 'Objective Richness',
              },
              {
                step: '04',
                title: 'Hostel Upgrade',
                desc: 'Get a realistic ₹10–₹25 local add-on to fill the missing nutrients.',
                badge: 'Zero Cooking Needed',
              },
            ].map((s, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-white border border-stone-200/90 shadow-2xs flex flex-col justify-between"
              >
                <div>
                  <span className="text-2xl font-mono font-black text-emerald-800/25 block mb-2">
                    {s.step}
                  </span>
                  <h3 className="text-base font-bold text-stone-900 mb-1">{s.title}</h3>
                  <p className="text-xs text-stone-600 leading-relaxed">{s.desc}</p>
                </div>
                <div className="pt-3 mt-3 border-t border-stone-100">
                  <span className="text-3xs font-semibold px-2 py-0.5 rounded bg-stone-100 text-stone-700">
                    {s.badge}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* 6. TRANSPARENCY & DISCLAIMER NOTICE */}
      <section>
        <Container size="md">
          <div className="p-6 rounded-2xl bg-amber-50/70 border border-amber-200 text-amber-950 flex flex-col sm:flex-row items-start gap-4">
            <div className="p-2.5 rounded-xl bg-amber-100 text-amber-800 shrink-0">
              <ShieldCheckIcon size={22} />
            </div>
            <div className="space-y-1.5 text-xs text-amber-900 leading-relaxed">
              <h4 className="font-bold text-amber-950 text-sm">
                Educational Estimates Notice
              </h4>
              <p>
                Track-a-Bite calculates approximations based on visual portion estimation and standardized regional Indian food guidelines. Variations in canteen oil, portion size, and recipes naturally occur.
              </p>
              <p className="text-2xs text-amber-800">
                Track-a-Bite does not provide medical diagnosis or therapeutic treatment.
              </p>
            </div>
          </div>
        </Container>
      </section>

      {/* 7. BOTTOM CTA */}
      <section>
        <Container size="lg">
          <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white text-center flex flex-col items-center space-y-6 shadow-md">
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight max-w-xl">
              Ready to see what&apos;s on your plate right now?
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100 max-w-md">
              Try scanning your meal or testing a campus canteen snack. Takes less than 10 seconds.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <Link href="/scan" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto bg-white text-emerald-950 hover:bg-emerald-50 font-bold px-8" leftIcon={<CameraIcon size={20} />}>
                  Scan Food Now
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="lg"
                onClick={() => setProfileModalOpen(true)}
                className="w-full sm:w-auto text-white hover:bg-emerald-800/80"
              >
                Set Personal Profile
              </Button>
            </div>
          </div>
        </Container>
      </section>

      {/* Profile Modal */}
      <ProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
      />
    </div>
  );
}
