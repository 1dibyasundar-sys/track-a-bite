import React from 'react';
import Link from 'next/link';
import { Container } from '../../components/layout/container';
import { Button } from '../../components/ui/button';
import {
  LeafIcon,
  ShieldCheckIcon,
  CheckIcon,
  CameraIcon,
} from '../../components/ui/icons';

export default function AboutPage() {
  return (
    <div className="py-8 sm:py-16 space-y-16">
      <Container size="lg">
        {/* Hero Section */}
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 text-xs font-semibold">
            <LeafIcon size={14} className="text-emerald-700" />
            <span>Product Mission</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-stone-900 tracking-tight leading-tight">
            Demystifying nutrition for the real Indian plate.
          </h1>
          <p className="text-base sm:text-lg text-stone-600 leading-relaxed font-normal">
            Track-a-Bite was born from a fundamental frustration: modern nutrition technology was built for Western individual plates of grilled proteins and salad bowls, leaving the rich, complex diversity of Indian home cooking completely misunderstood.
          </p>
        </div>

        {/* 3 Core Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8">
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-stone-200/90 shadow-2xs space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              🌾
            </div>
            <h3 className="text-lg font-bold text-stone-900">Regional Breadth</h3>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              From Karnataka’s ragi mudde and Bihar’s roasted sattu to Bengal’s freshwater fish curries and Maharashtra’s jowar bhakri, we recognize traditional indigenous foods, not just Western diet trends.
            </p>
          </div>

          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-stone-200/90 shadow-2xs space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
              ⚖️
            </div>
            <h3 className="text-lg font-bold text-stone-900">No Guilt or Labels</h3>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              We never categorize whole foods simply as &ldquo;healthy&rdquo; or &ldquo;unhealthy&rdquo;. We assess macronutrient balance, explain carbohydrate-protein synergies, and suggest practical additions like curd or sprouts.
            </p>
          </div>

          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-stone-200/90 shadow-2xs space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold">
              💰
            </div>
            <h3 className="text-lg font-bold text-stone-900">Affordable &amp; Accessible</h3>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              Nutrition should not require expensive whey isolates or imported berries. We highlight cost-effective local powerhouses: roasted chana, sprouted legumes, homemade dahi, and seasonal greens.
            </p>
          </div>
        </div>

        {/* Detailed Narrative Section */}
        <div className="bg-stone-900 text-white rounded-3xl p-8 sm:p-12 space-y-8">
          <div className="max-w-2xl space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              The Problem We Address
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Why Indian plates need tailored computer vision
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs sm:text-sm text-stone-300 leading-relaxed">
            <p>
              Traditional Indian cooking is synergistic. Rice and lentils together create complete proteins with all essential amino acids (methionine from grains, lysine from legumes). Fermented batters like idli and dosa unlock active B-vitamins and gut-friendly lactic cultures.
            </p>
            <p>
              However, traditional plates can often become carbohydrate-heavy without awareness—especially for students in hostels or families reliant on staple grains. Track-a-Bite’s camera estimation helps visualize these ratios and empowers users with gentle, culturally resonant suggestions.
            </p>
          </div>

          <div className="pt-4 border-t border-stone-800 flex flex-wrap items-center gap-6 text-xs text-stone-400">
            <div className="flex items-center gap-2">
              <CheckIcon size={16} className="text-emerald-400" />
              <span>Built for Students &amp; Hostels</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckIcon size={16} className="text-emerald-400" />
              <span>Families in Tier 2/3 Towns</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckIcon size={16} className="text-emerald-400" />
              <span>Budget-Conscious Individuals</span>
            </div>
          </div>
        </div>

        {/* Estimation Methodology & Medical Disclaimer */}
        <div className="p-8 sm:p-10 rounded-3xl bg-amber-50/70 border border-amber-200 text-amber-950 space-y-4">
          <div className="flex items-center gap-2.5 text-amber-900">
            <ShieldCheckIcon size={24} className="text-amber-700" />
            <h3 className="text-lg font-bold">
              Scientific Estimation Methodology &amp; Clinical Notice
            </h3>
          </div>

          <div className="space-y-3 text-xs text-amber-900 leading-relaxed">
            <p>
              <strong>Computational Approximations:</strong> Food recognition from mobile imagery calculates approximate metrics using volumetric surface models and standardized recipe nutritional databases (including ICMR - National Institute of Nutrition guidelines).
            </p>
            <p>
              Because household preparations vary in oil quantity, tadka intensity, and raw ingredient moisture, all figures displayed in Track-a-Bite are <strong>educational estimates</strong> rather than laboratory calorimetry.
            </p>
            <p className="text-amber-800 font-semibold">
              Medical Disclaimer: Track-a-Bite does not diagnose, treat, or manage clinical conditions (such as diabetes, renal disorders, or cardiovascular disease). Consult certified nutritionists or medical doctors for personalized dietary prescriptions.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center space-y-4 pt-4">
          <h3 className="text-xl font-bold text-stone-900">
            Experience the foundation in action
          </h3>
          <div className="flex justify-center gap-3">
            <Link href="/scan">
              <Button size="md" leftIcon={<CameraIcon size={18} />}>
                Scan a Meal
              </Button>
            </Link>
            <Link href="/foods">
              <Button variant="outline" size="md">
                Browse Food Database
              </Button>
            </Link>
          </div>
        </div>
      </Container>
    </div>
  );
}
