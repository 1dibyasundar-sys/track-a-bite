'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Container } from '../components/layout/container';
import { Button } from '../components/ui/button';
import { SectionHeading } from '../components/common/section-heading';
import { NutrientStarRating } from '../components/nutrition/nutrient-star-rating';
import { CampusRealitySection } from '../components/campus/campus-reality-section';
import { ProfileModal } from '../components/profile/profile-modal';
import { useUserProfile, useHasCompletedOnboarding } from '../lib/services/userProfileService';
import { useAuth } from '../components/auth/AuthProvider';
import {
  CameraIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
  CheckIcon,
  SparklesIcon,
  HistoryIcon,
  BarChartIcon,
} from '../components/ui/icons';

export default function HomePage() {
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const profile = useUserProfile();
  const hasCompletedOnboarding = useHasCompletedOnboarding();
  const { isAuthenticated } = useAuth();

  const primaryCta = !isAuthenticated
    ? { href: '/register', label: 'Get Started Free' }
    : !hasCompletedOnboarding
      ? { href: '/onboarding', label: 'Complete Profile' }
      : { href: '/dashboard', label: 'View Dashboard' };

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
    <div className="flex flex-col gap-16 sm:gap-24 pb-24 overflow-x-hidden">
      {/* =====================================================================
          1. HERO SECTION — SPACIOUS 3D COMPOSITION WITH FLOATING METRIC CARDS
          ===================================================================== */}
      <section className="relative pt-8 sm:pt-16 pb-6 overflow-hidden">
        {/* Soft background ambient illumination */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[#E86A33]/5 dark:bg-[#E86A33]/8 rounded-full blur-3xl pointer-events-none" />

        <Container size="lg">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* LEFT COLUMN: Confident Typography, Clear CTAs & Student Value */}
            <div className="lg:col-span-6 space-y-6 text-left">
              {/* Identity Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#F3EDE4] dark:bg-[#25211D] text-[#171717] dark:text-[#F7F3ED] border border-[#E8DED2] dark:border-[#38312A] text-xs font-bold shadow-2xs">
                <span className="text-sm">{profile.isHostelite ? '🏠' : '🍽️'}</span>
                <span>
                  {profile.isHostelite ? 'Hostel Mode Active' : 'AI Food Intelligence'}
                </span>
              </div>

              {/* Main Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-stone-900 dark:text-stone-50 leading-[1.1]">
                Know what&apos;s <span className="text-[#E86A33]">on your plate.</span>
              </h1>

              {/* Supporting Text */}
              <p className="text-base sm:text-lg text-stone-600 dark:text-stone-300 max-w-xl leading-relaxed font-normal">
                Scan your meal, understand its nutrition, and discover smarter food choices for everyday life.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 pt-2">
                <Link href={primaryCta.href} className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto px-8 py-3.5 font-bold shadow-md bg-[#E86A33] hover:bg-[#d65f2c] text-white cursor-pointer"
                    leftIcon={<CameraIcon size={20} className="text-white/90" />}
                  >
                    Scan Your Meal
                  </Button>
                </Link>

                <Link href="/foods" className="w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto px-6 py-3.5 font-semibold bg-white dark:bg-[#1D1A17] border-[#E8DED2] dark:border-[#38312A] text-stone-800 dark:text-stone-200 hover:bg-[#FAF7F2] dark:hover:bg-[#25211D] cursor-pointer"
                  >
                    Explore Foods
                  </Button>
                </Link>
              </div>

              {/* 3 Student Questions Answered */}
              <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-stone-700 dark:text-stone-300">
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-[#1D1A17] border border-[#E8DED2] dark:border-[#38312A] shadow-2xs">
                  <span className="text-[#3F8F68] dark:text-[#5FA77F] font-bold">✓</span>
                  <span className="font-medium">What nutrients are in this?</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-[#1D1A17] border border-[#E8DED2] dark:border-[#38312A] shadow-2xs">
                  <span className="text-[#F4A340] font-bold">⚠</span>
                  <span className="font-medium">What am I missing?</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-[#1D1A17] border border-[#E8DED2] dark:border-[#38312A] shadow-2xs">
                  <span className="text-[#E86A33] font-bold">₹</span>
                  <span className="font-medium">What can I add for ₹15?</span>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: 3D Central Hero Food Visual + Dimensional Floating Cards */}
            <div className="lg:col-span-6 relative mt-4 lg:mt-0 flex items-center justify-center">
              {/* Outer 3D Container with Soft Elevation */}
              <div className="relative w-full max-w-[500px] aspect-4/3 rounded-3xl overflow-visible p-1">
                {/* Background Shadow & Soft Warm Ambient Glow */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-[#E86A33]/15 via-[#F4A340]/10 to-transparent blur-2xl" />

                {/* Central Food Visual Surface */}
                <div className="relative w-full h-full rounded-3xl overflow-hidden border-2 border-[#E8DED2] dark:border-[#38312A] shadow-[0_16px_40px_-8px_rgba(0,0,0,0.14)] dark:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.7)] bg-stone-900 group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/food/hero-meal-platter.jpg"
                    alt="Intelligent Indian campus meal composition"
                    className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-700 ease-out"
                  />
                  {/* Subtle inner gradient shadow for contrast */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

                  {/* Food Label at the base of the image */}
                  <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-white text-xs z-10 pointer-events-none">
                    <span className="font-bold drop-shadow-md">Campus Thali • Dal, Paneer, Rice &amp; Roti</span>
                    <span className="text-3xs px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[#F4A340] border border-[#F4A340]/40">
                      Standard Serving
                    </span>
                  </div>
                </div>

                {/* =========================================================
                    FLOATING 3D METRIC CARDS (PHYSICAL SURFACES WITH DEPTH)
                    Distinct Accent Colors: Health Green, Terracotta, Mango, Violet
                    ========================================================= */}

                {/* Floating Card 1: Top Left — Health Score (Green Accent) */}
                <div className="absolute -top-4 -left-3 sm:-top-6 sm:-left-6 z-20 card-float px-3.5 py-2.5 animate-float-slow shadow-lg">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/80 text-[#3F8F68] dark:text-[#5FA77F] flex items-center justify-center font-black text-xs shrink-0 border border-[#3F8F68]/40">
                      8.8
                    </div>
                    <div>
                      <span className="block text-3xs font-extrabold uppercase tracking-wider text-[#3F8F68] dark:text-[#5FA77F]">
                        Health Score
                      </span>
                      <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                        8.8 / 10
                      </span>
                    </div>
                  </div>
                </div>

                {/* Floating Card 2: Top Right — Protein (Terracotta Accent) */}
                <div className="absolute -top-3 -right-3 sm:-top-5 sm:-right-5 z-20 card-float px-3.5 py-2.5 animate-float-reverse shadow-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-base">💪</span>
                    <div>
                      <span className="block text-3xs font-extrabold uppercase tracking-wider text-[#E86A33]">
                        Protein
                      </span>
                      <span className="text-sm font-black text-stone-900 dark:text-stone-100">
                        24.5 g
                      </span>
                    </div>
                  </div>
                </div>

                {/* Floating Card 3: Bottom Left — Calories (Golden Mango Accent) */}
                <div className="absolute -bottom-4 -left-3 sm:-bottom-5 sm:-left-5 z-20 card-float px-3.5 py-2.5 animate-float-reverse shadow-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🔥</span>
                    <div>
                      <span className="block text-3xs font-extrabold uppercase tracking-wider text-[#F4A340]">
                        Calories
                      </span>
                      <span className="text-sm font-black text-stone-900 dark:text-stone-100">
                        540 kcal
                      </span>
                    </div>
                  </div>
                </div>

                {/* Floating Card 4: Bottom Right — AI Detected (Soft Intelligent Violet Accent) */}
                <div className="absolute -bottom-5 -right-3 sm:-bottom-6 sm:-right-5 z-20 card-float px-4 py-2.5 animate-float-slow shadow-lg">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#7C6CE7] animate-pulse shrink-0 shadow-[0_0_8px_#7C6CE7]" />
                    <div>
                      <span className="block text-3xs font-extrabold uppercase tracking-wider text-[#7C6CE7] dark:text-[#9185E8]">
                        AI Detected
                      </span>
                      <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                        6 foods
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* =====================================================================
          2. WHY TRACK-A-BITE (THE STUDENT REALITY)
          ===================================================================== */}
      <section>
        <Container size="lg">
          <CampusRealitySection />
        </Container>
      </section>

      {/* =====================================================================
          3. SCAN FOOD — THE AI SCANNER EXPERIENCE PREVIEW
          ===================================================================== */}
      <section className="relative">
        <Container size="lg">
          <div className="card-3d p-6 sm:p-10 bg-gradient-to-br from-[#1D1A17] via-[#151311] to-[#25211D] text-white border border-[#38312A] shadow-xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-6 space-y-5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#7C6CE7]/20 text-[#9185E8] border border-[#7C6CE7]/40 text-xs font-bold">
                  <SparklesIcon size={14} />
                  <span>The AI Food Scanner</span>
                </div>
                <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
                  Point. Snap. Understand. In less than 10 seconds.
                </h2>
                <p className="text-sm sm:text-base text-stone-300 leading-relaxed">
                  No manual typing, barcode hunting, or guessing serving grams. Track-a-Bite runs on-device camera vision to segment your plate into distinct dishes, calculate volume portions, and generate instant nutritional scores.
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Link href="/scan">
                    <Button
                      size="lg"
                      className="bg-[#E86A33] text-white hover:bg-[#d65f2c] font-bold px-7 shadow-md cursor-pointer"
                      leftIcon={<CameraIcon size={18} />}
                    >
                      Open Live Scanner
                    </Button>
                  </Link>
                  <Link href="/foods">
                    <Button
                      variant="outline"
                      size="lg"
                      className="text-stone-200 border-[#38312A] hover:bg-white/10 font-semibold cursor-pointer"
                    >
                      Browse Food Database
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Visual Scanner HUD Mockup */}
              <div className="lg:col-span-6">
                <div className="relative rounded-2xl overflow-hidden border border-[#38312A] bg-black aspect-16/10 shadow-2xl flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/food/hostel-mess-thali.jpg"
                    alt="Live food scanning camera HUD"
                    className="w-full h-full object-cover opacity-85"
                  />
                  {/* HUD Elements */}
                  <div className="absolute inset-4 border border-white/20 rounded-xl pointer-events-none flex items-center justify-center">
                    {/* Animated Scanning Beam (Soft Intelligent Violet) */}
                    <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#7C6CE7] to-transparent shadow-[0_0_12px_#9185E8] animate-scan-beam" />
                    
                    {/* Reticle Corner Guides (Terracotta Accent) */}
                    <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-[#E86A33]" />
                    <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-[#E86A33]" />
                    <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-[#E86A33]" />
                    <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-[#E86A33]" />

                    {/* Central Target Tag */}
                    <div className="px-3 py-1 rounded-full bg-black/70 backdrop-blur-md border border-[#F4A340]/60 text-[#F4A340] text-2xs font-mono font-bold flex items-center gap-1.5 shadow-md">
                      <span className="w-2 h-2 rounded-full bg-[#F4A340] animate-ping" />
                      <span>DAL TADKA DETECTED (96%)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* =====================================================================
          4. AI UNDERSTANDS YOUR MEAL — OBJECTIVE MULTI-DISH RECOGNITION
          ===================================================================== */}
      <section>
        <Container size="lg">
          <SectionHeading
            centered
            eyebrow="Vision Pipeline"
            title="AI That Understands Indian Dishes"
            description="Trained specifically on campus mess menus, street carts, and canteen preparations across North, South, East, and West India."
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: Multi-Dish Segmentation */}
            <div className="card-3d-interactive p-6 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#FEF7EE] dark:bg-[#2A1C14] text-[#E86A33] border border-[#E86A33]/20 flex items-center justify-center text-xl shadow-xs">
                🍛
              </div>
              <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                Multi-Item Plate Recognition
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
                Whether you have dal, dry sabzi, two rotis, and a bowl of curd on a single compartment thali, Track-a-Bite isolates and measures each item separately.
              </p>
              <div className="pt-2 text-2xs font-semibold text-[#E86A33] dark:text-[#F4A340] flex items-center gap-1">
                <span>Bounding box localization</span> →
              </div>
            </div>

            {/* Card 2: Portion Multiplier */}
            <div className="card-3d-interactive p-6 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 flex items-center justify-center text-xl shadow-xs">
                ⚖️
              </div>
              <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                Visual Portion Estimation
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
                Calculates relative size compared to standard canteen plates and katoris. Easily adjust portions from 0.5x to 2x with a single tap.
              </p>
              <div className="pt-2 text-2xs font-semibold text-amber-800 dark:text-amber-400 flex items-center gap-1">
                <span>Standardized Indian portions</span> →
              </div>
            </div>

            {/* Card 3: Transparent Gaps */}
            <div className="card-3d-interactive p-6 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 flex items-center justify-center text-xl shadow-xs">
                🔬
              </div>
              <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                Micronutrient Adequacy
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
                Goes beyond basic calories and carbs. Calculates calcium, iron, potassium, and protective dietary fiber against student daily guidelines.
              </p>
              <div className="pt-2 text-2xs font-semibold text-teal-800 dark:text-teal-400 flex items-center gap-1">
                <span>ICMR RDA Reference Values</span> →
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* =====================================================================
          5. 5-STAR NUTRIENT RICHNESS SYSTEM
          ===================================================================== */}
      <section>
        <Container size="lg">
          <SectionHeading
            centered
            eyebrow="Objective Food Intelligence"
            title="5-Star Nutrient Richness"
            description="We never label food as merely 'good' or 'bad'. Our 5-star richness index evaluates protein, fiber, and micronutrient density to give honest educational feedback."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* High richness comparison card */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-stone-600 dark:text-stone-400 px-1">
                <span>Example: Sprouts Chaat (₹25)</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Street / Cart Food</span>
              </div>
              <NutrientStarRating richness={sampleRichnessSprouts} />
            </div>

            {/* Lower richness comparison card */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-stone-600 dark:text-stone-400 px-1">
                <span>Example: Canteen Kachori (₹20)</span>
                <span className="text-amber-700 dark:text-amber-400 font-semibold">Fried Snack</span>
              </div>
              <NutrientStarRating richness={sampleRichnessKachori} />
            </div>
          </div>
        </Container>
      </section>

      {/* =====================================================================
          6. HOSTEL INTELLIGENCE — AFFORDABLE UPGRADES UNDER ₹30
          ===================================================================== */}
      <section className="bg-[#1D1A17] text-white py-16 rounded-3xl mx-4 sm:mx-6 lg:mx-8 shadow-xl border border-[#38312A]">
        <Container size="lg">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 space-y-6">
              <span className="text-xs font-bold uppercase tracking-wider text-[#F4A340] bg-[#F4A340]/15 px-3 py-1 rounded-md border border-[#F4A340]/30">
                The Differentiator
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
                &ldquo;What am I missing, and what can I realistically add?&rdquo;
              </h2>
              <p className="text-sm sm:text-base text-stone-300 leading-relaxed font-normal">
                Hostel students don’t have kitchen blenders, ovens, or organic grocery stores. If your lunch was potato samosas or plain mess rice, Track-a-Bite points out the exact missing element and suggests zero-cooking additions right outside your hostel gate.
              </p>

              <div className="space-y-3 text-xs sm:text-sm text-stone-200">
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-[#3F8F68] text-white flex items-center justify-center shrink-0 mt-0.5">
                    <CheckIcon size={12} />
                  </div>
                  <span><strong>Zero Cooking Required:</strong> Hard boiled eggs, sprouts, dahi, peanuts, banana.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-[#3F8F68] text-white flex items-center justify-center shrink-0 mt-0.5">
                    <CheckIcon size={12} />
                  </div>
                  <span><strong>Campus Budget Friendly:</strong> Additions range from ₹5 to ₹25 max.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-[#3F8F68] text-white flex items-center justify-center shrink-0 mt-0.5">
                    <CheckIcon size={12} />
                  </div>
                  <span><strong>No Stigma or Guilt:</strong> Enjoy your samosa; balance it with curd or sprouts.</span>
                </div>
              </div>

              <div className="pt-2">
                <Link href="/scan">
                  <Button size="md" className="bg-[#E86A33] hover:bg-[#d65f2c] text-white font-bold cursor-pointer" rightIcon={<ArrowRightIcon size={16} />}>
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
                    className="p-3.5 rounded-2xl bg-stone-900 border border-emerald-800/60 flex items-center justify-between gap-3 shadow-2xs hover:border-emerald-600 transition-colors"
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

      {/* =====================================================================
          7. BARCODE & PACKAGE INTELLIGENCE (OCR PRINTED DATES)
          ===================================================================== */}
      <section>
        <Container size="lg">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-6 space-y-4">
              <span className="text-2xs font-extrabold uppercase tracking-widest text-[#7C6CE7] dark:text-[#9185E8] px-3 py-1 rounded-full bg-[#EEECFB] dark:bg-[#211E38] border border-[#7C6CE7]/30">
                Zero Hallucination OCR
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-stone-100 tracking-tight">
                Scan Packaged Foods &amp; Verify Real Expiry Dates
              </h2>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
                Scan any biscuit, juice pack, noodle, or yogurt barcode to instantly load official ingredients and nutritional tables from OpenFoodFacts. Use our camera OCR to read dot-matrix expiry stamps printed on the wrapper so you never eat expired snacks.
              </p>
              <div className="flex items-center gap-2 pt-2">
                <Link href="/scan">
                  <Button size="md" variant="secondary" leftIcon={<SparklesIcon size={16} />}>
                    Try Barcode Mode
                  </Button>
                </Link>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="card-3d p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">📦</span>
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100">Packaged Verification</span>
                  </div>
                  <span className="text-3xs font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                    Safe to Consume
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-stone-50 dark:bg-[#19271e] text-xs space-y-1">
                  <div className="flex justify-between font-semibold text-stone-800 dark:text-stone-200">
                    <span>MFG Date:</span>
                    <span>14 Sep 2026</span>
                  </div>
                  <div className="flex justify-between font-semibold text-stone-800 dark:text-stone-200">
                    <span>EXP Date:</span>
                    <span className="text-emerald-700 dark:text-emerald-400">14 Dec 2026 (68 days remaining)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* =====================================================================
          8. PERSONAL FOOD HISTORY & REPORTS PREVIEW
          ===================================================================== */}
      <section>
        <Container size="lg">
          <SectionHeading
            centered
            eyebrow="Visual Food Journal"
            title="Track Trends, Not Just Single Meals"
            description="Your nutrition history lives with you. See daily averages, weekly protein trends, and monitor your consistency over time."
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="card-3d-interactive p-5 text-center space-y-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 flex items-center justify-center mx-auto">
                <HistoryIcon size={20} />
              </div>
              <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">Visual Food Diary</h4>
              <p className="text-xs text-stone-600 dark:text-stone-400">Every plate photo saved with macro breakdowns and time stamps.</p>
            </div>

            <div className="card-3d-interactive p-5 text-center space-y-2">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 flex items-center justify-center mx-auto">
                <BarChartIcon size={20} />
              </div>
              <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">Weekly Consistency</h4>
              <p className="text-xs text-stone-600 dark:text-stone-400">Identify low-protein days and adjust before finals week fatigue sets in.</p>
            </div>

            <div className="card-3d-interactive p-5 text-center space-y-2">
              <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 flex items-center justify-center mx-auto">
                <ShieldCheckIcon size={20} />
              </div>
              <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">Private Cloud Sync</h4>
              <p className="text-xs text-stone-600 dark:text-stone-400">Protected in your personal account with offline fallback storage.</p>
            </div>
          </div>
        </Container>
      </section>

      {/* =====================================================================
          9. TRANSPARENCY & DISCLAIMER NOTICE
          ===================================================================== */}
      <section>
        <Container size="md">
          <div className="card-3d p-5 sm:p-6 bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-850/50 text-amber-950 dark:text-amber-200 flex flex-col sm:flex-row items-start gap-4">
            <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 shrink-0">
              <ShieldCheckIcon size={22} />
            </div>
            <div className="space-y-1.5 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
              <h4 className="font-bold text-amber-950 dark:text-amber-100 text-sm">
                Educational Estimates Notice
              </h4>
              <p>
                Track-a-Bite calculates approximations based on visual portion estimation and standardized regional Indian food guidelines. Variations in canteen oil, portion size, and recipes naturally occur.
              </p>
              <p className="text-2xs text-amber-800 dark:text-amber-300">
                Track-a-Bite does not provide medical diagnosis or therapeutic treatment.
              </p>
            </div>
          </div>
        </Container>
      </section>

      {/* =====================================================================
          10. FINAL INSPIRING CTA
          ===================================================================== */}
      <section>
        <Container size="lg">
          <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-[#1D1A17] via-[#25211D] to-[#151311] border border-[#38312A] text-white text-center flex flex-col items-center space-y-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-[#E86A33]/5 rounded-full blur-3xl pointer-events-none" />

            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight max-w-xl">
              Ready to see what&apos;s on your plate right now?
            </h2>
            <p className="text-xs sm:text-sm text-stone-300 max-w-md leading-relaxed">
              Try scanning your meal or testing a campus canteen snack. Takes less than 10 seconds.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <Link href="/scan" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto bg-[#E86A33] hover:bg-[#d65f2c] text-white font-bold px-8 shadow-md cursor-pointer" leftIcon={<CameraIcon size={20} className="text-white/90" />}>
                  Scan Food Now
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="lg"
                onClick={() => setProfileModalOpen(true)}
                className="w-full sm:w-auto text-stone-200 hover:text-white hover:bg-white/10 cursor-pointer"
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
