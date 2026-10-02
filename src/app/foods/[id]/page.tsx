import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Container } from '../../../components/layout/container';
import { NutritionSummaryCard } from '../../../components/nutrition/nutrition-summary-card';
import { MacroDistributionBar } from '../../../components/nutrition/macro-distribution-bar';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { INDIAN_FOOD_DATABASE } from '../../../data/foods';
import {
  ChevronRightIcon,
  ShieldCheckIcon,
  SparklesIcon,
  CameraIcon,
  ArrowRightIcon,
} from '../../../components/ui/icons';

export function generateStaticParams() {
  return INDIAN_FOOD_DATABASE.map(food => ({
    id: food.id,
  }));
}

export default async function FoodDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const food = INDIAN_FOOD_DATABASE.find(f => f.id === id);

  if (!food) {
    notFound();
  }

  const { protein, carbohydrates, fat } = food.nutritionPerServing;
  const carbKcal = carbohydrates * 4;
  const proteinKcal = protein * 4;
  const fatKcal = fat * 9;
  const totalKcal = carbKcal + proteinKcal + fatKcal;

  const carbsPercent = totalKcal > 0 ? Math.round((carbKcal / totalKcal) * 100) : 50;
  const proteinPercent = totalKcal > 0 ? Math.round((proteinKcal / totalKcal) * 100) : 20;
  const fatPercent = 100 - carbsPercent - proteinPercent;

  // Find complementary food objects
  const complementaryItems = INDIAN_FOOD_DATABASE.filter(f =>
    food.pairingRecommendations.includes(f.id)
  );

  return (
    <div className="py-8 sm:py-12 space-y-8">
      <Container size="lg">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-stone-500 mb-4">
          <Link href="/" className="hover:text-stone-900 transition-colors">
            Home
          </Link>
          <ChevronRightIcon size={12} />
          <Link href="/foods" className="hover:text-stone-900 transition-colors">
            Food Database
          </Link>
          <ChevronRightIcon size={12} />
          <span className="text-stone-900 font-semibold">{food.name}</span>
        </nav>

        {/* Hero Header */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-stone-200/90 shadow-2xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-2xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200">
                  {food.region}
                </span>
                <span className="text-2xs font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
                  {food.category}
                </span>
                <Badge
                  variant={
                    food.affordability === 'Budget-Friendly'
                      ? 'emerald'
                      : food.affordability === 'Moderate'
                      ? 'amber'
                      : 'stone'
                  }
                  size="sm"
                >
                  {food.affordability}
                </Badge>
              </div>

              <h1 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
                {food.name}
              </h1>

              {/* Local Names in Native Scripts */}
              <div className="flex flex-wrap items-center gap-3 pt-1 text-sm text-stone-600 font-medium">
                {Object.entries(food.localNames).map(([lang, val]) => (
                  <span key={lang} className="bg-stone-50 px-2.5 py-1 rounded-lg border border-stone-200 text-xs">
                    <span className="text-stone-400 capitalize mr-1">{lang}:</span>
                    <span className="text-stone-900 font-semibold">{val}</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-3">
              <Link href="/scan">
                <Button size="md" leftIcon={<CameraIcon size={16} />}>
                  Scan in a Meal
                </Button>
              </Link>
            </div>
          </div>

          <p className="text-sm sm:text-base text-stone-700 leading-relaxed max-w-3xl">
            {food.description}
          </p>

          {/* Cultural & Nutritional Context */}
          <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/60 text-xs text-emerald-950 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800 shrink-0 mt-0.5">
              <SparklesIcon size={18} />
            </div>
            <div className="space-y-1">
              <span className="font-bold text-emerald-900 text-xs block">
                Regional &amp; Traditional Context:
              </span>
              <p className="leading-relaxed">{food.culturalContext}</p>
            </div>
          </div>
        </div>

        {/* Nutrition Profile & Macro Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Quantitative Nutrition (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            <NutritionSummaryCard
              nutrition={food.nutritionPerServing}
              title={`Nutrition per Serving (${food.standardServingSize})`}
              showMicronutrients={true}
            />

            {/* Macro Distribution */}
            <Card className="border-stone-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Caloric Balance from Macronutrients</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <MacroDistributionBar
                  distribution={{ carbsPercent, proteinPercent, fatPercent }}
                  showLabels={true}
                />
                <p className="text-2xs text-stone-500 leading-relaxed pt-1">
                  Estimated based on standard Indian preparation using {food.weightGramsPerUnit}g cooked weight.
                </p>
              </CardContent>
            </Card>

            {/* Common Ingredients */}
            <Card className="border-stone-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Common Traditional Ingredients</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {food.commonIngredients.map((ing, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 rounded-xl bg-stone-100 text-stone-800 text-xs font-medium border border-stone-200"
                    >
                      {ing}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Balancing Suggestions & Complementary Pairings (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Dietary Tags */}
            <Card className="border-stone-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-stone-900">Dietary Profile</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {food.dietaryTags.map((tag, idx) => (
                    <Badge key={idx} variant="emerald" size="sm">
                      {tag}
                    </Badge>
                  ))}
                  {food.seasonalAvailability && (
                    <Badge variant="stone" size="sm">
                      {food.seasonalAvailability}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Complementary Food Pairings */}
            <Card className="border-stone-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-stone-900 flex items-center justify-between">
                  <span>How to Balance This Dish</span>
                  <span className="text-2xs font-normal text-stone-500">Pairings</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-stone-600 leading-relaxed">
                  Traditional Indian culinary wisdom often pairs this dish with complementary staples to create a complete protein or buffer the glycemic load:
                </p>

                <div className="space-y-2">
                  {complementaryItems.map(item => (
                    <Link
                      key={item.id}
                      href={`/foods/${item.id}`}
                      className="p-3 rounded-xl bg-stone-50 border border-stone-200 hover:border-emerald-400 hover:bg-emerald-50/40 transition-all flex items-center justify-between group"
                    >
                      <div>
                        <h4 className="text-xs font-bold text-stone-900 group-hover:text-emerald-950">
                          {item.name}
                        </h4>
                        <span className="text-3xs text-stone-500 font-medium">
                          {item.category} • {item.nutritionPerServing.calories} kcal
                        </span>
                      </div>
                      <ArrowRightIcon size={14} className="text-stone-400 group-hover:text-emerald-700" />
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Variations */}
            {food.preparationVariations && food.preparationVariations.length > 0 && (
              <Card className="border-stone-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold text-stone-900">
                    Regional Variations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-xs text-stone-600 space-y-1.5">
                    {food.preparationVariations.map((v, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-700" />
                        <span>{v}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Disclaimer Callout */}
            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-2xs text-amber-950 leading-relaxed flex items-start gap-2">
              <ShieldCheckIcon size={16} className="text-amber-700 shrink-0 mt-0.5" />
              <div>
                Values shown are standard estimates per portion. Variations in ghee, oil, and salt used in home preparation can adjust these metrics.
              </div>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
