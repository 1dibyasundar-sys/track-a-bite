'use client';

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  DailyNutritionSummary,
  NutritionInsight,
  NextMealRecommendation,
} from '../../lib/types/analytics';
import {
  NutritionDateRangePreset,
  NutritionReport,
  MonthlyNutritionReport,
} from '../../lib/types/reporting';
import { nutritionAnalyticsService } from '../../lib/services/nutritionAnalyticsService';
import { nutritionExportService } from '../../lib/services/nutritionExportService';
import { useUserProfile } from '../../lib/services/userProfileService';
import { hydrationService } from '../../lib/services/hydrationService';
import { QUICK_ADD_AMOUNTS_ML } from '../../lib/types/hydration';

interface NutritionAnalyticsDashboardProps {
  userId?: string;
  initialMeals?: import('../../lib/types/meal').MealAnalysis[];
}

export function NutritionAnalyticsDashboard({ userId, initialMeals }: NutritionAnalyticsDashboardProps) {
  const profile = useUserProfile();
  const [, startTransition] = useTransition();

  const [todaySummary, setTodaySummary] = useState<DailyNutritionSummary | null>(null);
  const [rangeReport, setRangeReport] = useState<NutritionReport | null>(null);
  const [monthlyReport, setMonthlyReport] = useState<MonthlyNutritionReport | null>(null);
  const [insights, setInsights] = useState<NutritionInsight[]>([]);
  const [recommendations, setRecommendations] = useState<NextMealRecommendation[]>([]);

  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'report' | 'today' | 'monthly'>('report');
  const [rangePreset, setRangePreset] = useState<NutritionDateRangePreset>('last_7_days');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [customMl, setCustomMl] = useState<string>('');
  const [isLoggingDrink, setIsLoggingDrink] = useState<boolean>(false);

  useEffect(() => {
    let isCancelled = false;

    async function loadAnalytics() {
      setLoading(true);
      try {
        const today = await nutritionAnalyticsService.getTodaySummary(userId);
        const range = await nutritionAnalyticsService.getDateRangeReport(userId, rangePreset);
        const monthly = await nutritionAnalyticsService.getMonthlySummary(userId);

        if (!isCancelled) {
          setTodaySummary(today);
          setRangeReport(range);
          setMonthlyReport(monthly);

          const ins = nutritionAnalyticsService.getNutritionInsights(today, profile);
          const recs = nutritionAnalyticsService.getNextMealRecommendations(today, profile);

          setInsights(ins);
          setRecommendations(recs);
          setLoading(false);
        }
      } catch (err) {
        console.warn('[NutritionAnalyticsDashboard] Failed to calculate analytics:', err);
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadAnalytics();

    return () => {
      isCancelled = true;
    };
  }, [userId, profile, initialMeals, rangePreset]);

  const handlePresetChange = (preset: NutritionDateRangePreset) => {
    setRangePreset(preset);
    startTransition(async () => {
      const rep = await nutritionAnalyticsService.getDateRangeReport(userId, preset);
      setRangeReport(rep);
    });
  };

  const handleCustomRangeApply = () => {
    if (!customStart || !customEnd) return;
    setRangePreset('custom');
    startTransition(async () => {
      const rep = await nutritionAnalyticsService.getDateRangeReport(userId, {
        startDate: customStart,
        endDate: customEnd,
        preset: 'custom',
      });
      setRangeReport(rep);
    });
  };

  const handleDownloadExport = (format: 'json' | 'csv') => {
    if (!rangeReport) return;
    const filenameDate = `${rangeReport.dateRange.startDate}_to_${rangeReport.dateRange.endDate}`;
    if (format === 'csv') {
      const csv = nutritionExportService.exportNutritionCSV(rangeReport);
      nutritionExportService.downloadCSV(`track-a-bite-journal-${filenameDate}.csv`, csv);
    } else {
      const json = nutritionExportService.exportNutritionJSON(rangeReport, profile);
      nutritionExportService.downloadJSON(`track-a-bite-report-${filenameDate}.json`, json);
    }
    setShowExportMenu(false);
  };

  const handlePrintReport = () => {
    setShowExportMenu(false);
    nutritionExportService.triggerPrintReport();
  };

  const handleQuickAddDrink = async (amountMl: number) => {
    try {
      setIsLoggingDrink(true);
      await hydrationService.logDrink(amountMl, 'quick_add', todaySummary?.date, userId);
      const updated = await nutritionAnalyticsService.getTodaySummary(userId);
      setTodaySummary(updated);
    } catch (err) {
      console.warn('[NutritionAnalyticsDashboard] Drink logging failed:', err);
    } finally {
      setIsLoggingDrink(false);
    }
  };

  const handleCustomDrink = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(customMl, 10);
    if (!val || val <= 0) return;
    try {
      setIsLoggingDrink(true);
      await hydrationService.logDrink(val, 'custom', todaySummary?.date, userId);
      setCustomMl('');
      const updated = await nutritionAnalyticsService.getTodaySummary(userId);
      setTodaySummary(updated);
    } catch (err) {
      console.warn('[NutritionAnalyticsDashboard] Custom drink logging failed:', err);
    } finally {
      setIsLoggingDrink(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center">
        <div className="inline-block w-8 h-8 border-3 border-emerald-700 dark:border-emerald-400 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">Calculating personalized nutrition report...</p>
      </div>
    );
  }

  if (!todaySummary || !rangeReport || !monthlyReport) {
    return null;
  }

  const reportRating = rangeReport.nutritionRating || 'good';
  const scoreRatingColor = {
    excellent: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
    good: 'bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-800',
    fair: 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800',
    needs_attention: 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800',
  }[reportRating];

  const todayScoreColor = {
    excellent: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
    good: 'bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-800',
    fair: 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800',
    needs_attention: 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800',
  }[todaySummary.nutritionRating];

  const targets = rangeReport.targets || {
    targetCalories: 2200,
    targetProteinG: 65,
    targetCarbsG: 275,
    targetFatG: 70,
    targetFiberG: 30,
    isPersonalized: false,
    calculationMethod: 'standard_heuristic',
    targetTypeLabel: 'Recommended target',
  };

  const targetTypeLabel =
    targets.targetTypeLabel ||
    (targets.calculationMethod === 'user_defined' ? 'Custom target' : 'Recommended target');

  const calProgress = rangeReport.calorieProgressPercent ??
    (targets.targetCalories > 0 ? Math.round((rangeReport.averageCalories / targets.targetCalories) * 100) : 0);
  const protProgress = rangeReport.proteinProgressPercent ??
    (targets.targetProteinG > 0 ? Math.round((rangeReport.averageProteinG / targets.targetProteinG) * 100) : 0);
  const carbsProgress = rangeReport.carbsProgressPercent ??
    (targets.targetCarbsG > 0 ? Math.round((rangeReport.averageCarbsG / targets.targetCarbsG) * 100) : 0);
  const fatProgress = rangeReport.fatProgressPercent ??
    (targets.targetFatG > 0 ? Math.round((rangeReport.averageFatG / targets.targetFatG) * 100) : 0);
  const fiberProgress = rangeReport.fiberProgressPercent ??
    (targets.targetFiberG > 0 ? Math.round((rangeReport.averageFiberG / targets.targetFiberG) * 100) : 0);

  return (
    <div className="space-y-6">
      {/* 1. TOP TOOLBAR & VIEW CONTROLS (Hidden during print) */}
      <div className="print:hidden space-y-4">
        {/* Navigation Selector & Export Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-200 dark:border-[#23382b]">
          {/* Segmented Mode Selector */}
          <div className="inline-flex p-1 rounded-xl bg-stone-100 dark:bg-[#131d16] border border-stone-200 dark:border-[#23382b] text-xs font-semibold overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => setViewMode('report')}
              className={`px-3 sm:px-4 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                viewMode === 'report'
                  ? 'bg-white dark:bg-[#1e3024] text-emerald-950 dark:text-emerald-300 shadow-2xs font-bold'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              📄 Nutrition Report
            </button>
            <button
              type="button"
              onClick={() => setViewMode('today')}
              className={`px-3 sm:px-4 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                viewMode === 'today'
                  ? 'bg-white dark:bg-[#1e3024] text-emerald-950 dark:text-emerald-300 shadow-2xs font-bold'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              🥗 Today&apos;s Intake
            </button>
            <button
              type="button"
              onClick={() => setViewMode('monthly')}
              className={`px-3 sm:px-4 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                viewMode === 'monthly'
                  ? 'bg-white dark:bg-[#1e3024] text-emerald-950 dark:text-emerald-300 shadow-2xs font-bold'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              📅 Monthly Review
            </button>
          </div>

          {/* Export & Print Toolbar */}
          <div className="flex items-center gap-2 relative self-start sm:self-auto">
            {rangeReport.dataSource === 'local' && (
              <span className="text-3xs px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 font-mono">
                Offline Cache
              </span>
            )}

            <div className="relative">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowExportMenu(prev => !prev)}
                className="text-xs font-semibold"
                aria-expanded={showExportMenu}
                aria-haspopup="true"
              >
                📥 Export Report ▾
              </Button>

              {showExportMenu && (
                <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-[#131d16] border border-stone-200 dark:border-[#23382b] rounded-xl shadow-lg z-20 py-1 text-xs text-stone-800 dark:text-stone-200">
                  <button
                    type="button"
                    onClick={() => handleDownloadExport('csv')}
                    className="w-full text-left px-3 py-2 hover:bg-stone-50 dark:hover:bg-[#19271e] flex items-center justify-between cursor-pointer"
                  >
                    <span>Download CSV (Excel)</span>
                    <span className="text-3xs text-stone-400 dark:text-stone-500 font-mono">.csv</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadExport('json')}
                    className="w-full text-left px-3 py-2 hover:bg-stone-50 dark:hover:bg-[#19271e] flex items-center justify-between cursor-pointer"
                  >
                    <span>Download JSON</span>
                    <span className="text-3xs text-stone-400 dark:text-stone-500 font-mono">.json</span>
                  </button>
                  <div className="border-t border-stone-100 dark:border-[#23382b] my-1" />
                  <button
                    type="button"
                    onClick={handlePrintReport}
                    className="w-full text-left px-3 py-2 hover:bg-stone-50 dark:hover:bg-[#19271e] text-emerald-800 dark:text-emerald-400 font-semibold flex items-center justify-between cursor-pointer"
                  >
                    <span>Print / Save PDF</span>
                    <span className="text-3xs">🖨️</span>
                  </button>
                </div>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrintReport}
              className="text-xs font-semibold hidden sm:inline-flex"
            >
              🖨️ Print View
            </Button>
          </div>
        </div>

        {/* Date Range Selector Toolbar (Active on Report View) */}
        {viewMode === 'report' && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-stone-50 dark:bg-[#131d16]/80 border border-stone-200/90 dark:border-[#23382b] text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-2xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 mr-1">Period:</span>
              {[
                { key: 'today', label: 'Today' },
                { key: 'last_7_days', label: '7 Days' },
                { key: 'last_30_days', label: '30 Days' },
                { key: 'this_month', label: 'This Month' },
                { key: 'last_month', label: 'Last Month' },
              ].map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handlePresetChange(opt.key as NutritionDateRangePreset)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    rangePreset === opt.key
                      ? 'bg-emerald-800 dark:bg-emerald-700 text-white font-semibold'
                      : 'bg-white dark:bg-[#19271e] border border-stone-200 dark:border-[#23382b] text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-[#203327]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Custom Range Picker */}
            <div className="flex items-center gap-1.5 text-2xs flex-wrap">
              <input
                type="date"
                aria-label="Start Date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="px-2 py-1 bg-white dark:bg-[#19271e] border border-stone-200 dark:border-[#23382b] rounded text-xs text-stone-700 dark:text-stone-200"
              />
              <span className="text-stone-400">to</span>
              <input
                type="date"
                aria-label="End Date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="px-2 py-1 bg-white dark:bg-[#19271e] border border-stone-200 dark:border-[#23382b] rounded text-xs text-stone-700 dark:text-stone-200"
              />
              <button
                type="button"
                onClick={handleCustomRangeApply}
                disabled={!customStart || !customEnd}
                className="px-2.5 py-1 rounded bg-stone-800 dark:bg-emerald-800 text-white hover:bg-stone-900 dark:hover:bg-emerald-700 disabled:opacity-40 cursor-pointer font-semibold text-xs"
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. PRINT-ONLY FORMAL REPORT HEADER */}
      <div className="hidden print:block border-b-2 border-stone-900 pb-4 mb-6">
        <div className="flex justify-between items-baseline mb-3">
          <div>
            <div className="text-xs font-black tracking-widest text-emerald-800 uppercase">TRACK-A-BITE</div>
            <h1 className="text-2xl font-black text-stone-900">Nutrition Report</h1>
            <p className="text-xs text-stone-600">
              Personalized Dietary Analytics &amp; Longitudinal Meal Journal Observation
            </p>
          </div>
          <div className="text-right text-2xs text-stone-500 font-mono">
            <div><strong>Period:</strong> {rangeReport.dateRange.startDate} to {rangeReport.dateRange.endDate}</div>
            <div><strong>Generated:</strong> {new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC</div>
          </div>
        </div>

        {/* User Summary */}
        {profile && (
          <div className="bg-stone-50 p-2.5 rounded border border-stone-200 text-xs grid grid-cols-2 sm:grid-cols-4 gap-2 text-stone-700">
            {profile.age && <div><strong>Age:</strong> {profile.age} yrs</div>}
            {profile.gender && <div><strong>Biological Sex:</strong> {profile.gender}</div>}
            {profile.heightCm && profile.weightKg && (
              <div><strong>Metrics:</strong> {profile.heightCm} cm / {profile.weightKg} kg</div>
            )}
            {profile.healthGoal && <div><strong>Goal:</strong> {profile.healthGoal.replace(/_/g, ' ')}</div>}
            {profile.dietaryRestrictions && (
              <div><strong>Diet:</strong> {profile.dietaryRestrictions}</div>
            )}
            <div><strong>Mess/Hostel:</strong> {profile.isHostelite ? 'Yes' : 'No'}</div>
            <div><strong>Data Source:</strong> {rangeReport.dataSource === 'cloud' ? 'Cloud Firestore Verified' : 'Local Cache'}</div>
          </div>
        )}
      </div>

      {/* 3. PRIMARY VIEW: NUTRITION REPORT */}
      {viewMode === 'report' && (
        <div className="space-y-6">
          {/* Empty History State */}
          {rangeReport.totalMeals === 0 ? (
            <div className="py-12 px-4 text-center rounded-2xl bg-white dark:bg-[#131d16] border border-stone-200 dark:border-[#23382b] shadow-2xs space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 flex items-center justify-center mx-auto text-xl font-bold">
                🍽️
              </div>
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">No Meals Analyzed Yet</h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 max-w-md mx-auto leading-relaxed">
                No recorded meal history found between {rangeReport.dateRange.startDate} and {rangeReport.dateRange.endDate}.
                Scan your first meal to generate your personalized nutrition report and daily targets.
              </p>
              <div className="pt-2">
                <Link href="/scan">
                  <Button size="sm" className="bg-emerald-800 dark:bg-emerald-700 hover:bg-emerald-900 dark:hover:bg-emerald-600 text-white font-semibold text-xs cursor-pointer">
                    Scan a Meal
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Partial History Notice (< 3 days logged in multi-day range) */}
              {rangeReport.activeDaysCount <= 2 && rangeReport.dateRange.preset !== 'today' && (
                <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
                  <span className="text-base">ℹ️</span>
                  <span>
                    <strong>Preliminary Report:</strong> {rangeReport.totalMeals} meal(s) logged across {rangeReport.activeDaysCount} day(s). Log meals over 7+ consecutive days to reveal high-confidence longitudinal nutritional trends.
                  </span>
                </div>
              )}

              {/* OVERALL SCORE */}
              <Card className="bg-gradient-to-br from-emerald-50/70 via-white to-stone-50 dark:from-[#132219] dark:via-[#131d16] dark:to-[#0f1812] border-emerald-200/80 dark:border-emerald-900/50">
                <CardContent className="p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-2xs font-bold tracking-wider text-emerald-800 dark:text-emerald-400 uppercase">
                      Overall Nutrition Score
                    </span>
                    <div className="flex items-baseline gap-3">
                      <span className="text-3xl sm:text-4xl font-black text-stone-900 dark:text-stone-100">
                        {rangeReport.averageNutritionScore}
                        <span className="text-base sm:text-lg text-stone-400 dark:text-stone-500 font-semibold">/100</span>
                      </span>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border capitalize ${scoreRatingColor}`}>
                        {reportRating.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-stone-600 dark:text-stone-300 max-w-xl leading-relaxed">
                      Derived from {rangeReport.totalMeals} recorded plate scan(s) across {rangeReport.activeDaysCount} active logging day(s) against your personalized calorie and macro targets.
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="text-2xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">
                      Target Consistency
                    </div>
                    <div className="text-lg font-black text-emerald-800 dark:text-emerald-400 mt-0.5">
                      {rangeReport.consistencyPercentage}% of Days Met
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* KEY NUMBERS */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider">
                  Key Nutritional Metrics
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-2xl bg-white dark:bg-[#131d16] border border-stone-200/90 dark:border-[#23382b] shadow-2xs">
                  <div>
                    <span className="block text-2xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                      Avg. Calories / Day
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100 mt-1 block">
                      {rangeReport.averageCalories} <span className="text-xs font-normal text-stone-500 dark:text-stone-400">kcal</span>
                    </span>
                    {rangeReport.totalCalories !== undefined && rangeReport.totalCalories > 0 && (
                      <span className="text-3xs text-stone-400 dark:text-stone-500 font-mono">Total: {rangeReport.totalCalories} kcal</span>
                    )}
                  </div>

                  <div>
                    <span className="block text-2xs font-semibold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">
                      Avg. Protein / Day
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-emerald-800 dark:text-emerald-400 mt-1 block">
                      {rangeReport.averageProteinG} <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400">g</span>
                    </span>
                    {rangeReport.totalProteinG !== undefined && rangeReport.totalProteinG > 0 && (
                      <span className="text-3xs text-stone-400 dark:text-stone-500 font-mono">Total: {rangeReport.totalProteinG}g</span>
                    )}
                  </div>

                  <div>
                    <span className="block text-2xs font-semibold text-amber-800 dark:text-amber-400 uppercase tracking-wider">
                      Avg. Carbs / Day
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-amber-800 dark:text-amber-400 mt-1 block">
                      {rangeReport.averageCarbsG} <span className="text-xs font-normal text-amber-600 dark:text-amber-400">g</span>
                    </span>
                    {rangeReport.totalCarbsG !== undefined && rangeReport.totalCarbsG > 0 && (
                      <span className="text-3xs text-stone-400 dark:text-stone-500 font-mono">Total: {rangeReport.totalCarbsG}g</span>
                    )}
                  </div>

                  <div>
                    <span className="block text-2xs font-semibold text-teal-800 dark:text-teal-400 uppercase tracking-wider">
                      Avg. Fats / Day
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-teal-800 dark:text-teal-400 mt-1 block">
                      {rangeReport.averageFatG} <span className="text-xs font-normal text-teal-600 dark:text-teal-400">g</span>
                    </span>
                    {rangeReport.totalFatG !== undefined && rangeReport.totalFatG > 0 && (
                      <span className="text-3xs text-stone-400 dark:text-stone-500 font-mono">Total: {rangeReport.totalFatG}g</span>
                    )}
                  </div>
                </div>
              </div>

              {/* TARGET PROGRESS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider">
                    Target Progress vs Personalized Goals
                  </h3>
                  <span className={`text-3xs font-semibold px-2 py-0.5 rounded-full border ${
                    targets.calculationMethod === 'user_defined'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800/50'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                  }`}>
                    {targetTypeLabel}
                  </span>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-[#131d16] border border-stone-200/90 dark:border-[#23382b] shadow-2xs space-y-4">
                  {/* Calories Progress */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-baseline text-xs">
                      <span className="font-semibold text-stone-800 dark:text-stone-200">Calories</span>
                      <span className="text-stone-600 dark:text-stone-400 font-mono">
                        {rangeReport.averageCalories} / {targets.targetCalories} kcal{' '}
                        <strong className="text-stone-900 dark:text-stone-100 font-sans">({calProgress}%)</strong>
                      </span>
                    </div>
                    <div className="w-full bg-stone-100 dark:bg-stone-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-stone-800 dark:bg-stone-300 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, calProgress)}%` }}
                      />
                    </div>
                  </div>

                  {/* Protein Progress */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-baseline text-xs">
                      <span className="font-semibold text-emerald-900 dark:text-emerald-300">Protein</span>
                      <span className="text-emerald-800 dark:text-emerald-400 font-mono">
                        {rangeReport.averageProteinG}g / {targets.targetProteinG}g{' '}
                        <strong className="text-emerald-950 dark:text-emerald-200 font-sans">({protProgress}%)</strong>
                      </span>
                    </div>
                    <div className="w-full bg-stone-100 dark:bg-stone-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-emerald-600 dark:bg-emerald-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, protProgress)}%` }}
                      />
                    </div>
                  </div>

                  {/* Carbs Progress */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-baseline text-xs">
                      <span className="font-semibold text-amber-900 dark:text-amber-300">Carbohydrates</span>
                      <span className="text-amber-800 dark:text-amber-400 font-mono">
                        {rangeReport.averageCarbsG}g / {targets.targetCarbsG}g{' '}
                        <strong className="text-amber-950 dark:text-amber-200 font-sans">({carbsProgress}%)</strong>
                      </span>
                    </div>
                    <div className="w-full bg-stone-100 dark:bg-stone-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-amber-500 dark:bg-amber-400 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, carbsProgress)}%` }}
                      />
                    </div>
                  </div>

                  {/* Fat Progress */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-baseline text-xs">
                      <span className="font-semibold text-teal-900 dark:text-teal-300">Fats</span>
                      <span className="text-teal-800 dark:text-teal-400 font-mono">
                        {rangeReport.averageFatG}g / {targets.targetFatG}g{' '}
                        <strong className="text-teal-950 dark:text-teal-200 font-sans">({fatProgress}%)</strong>
                      </span>
                    </div>
                    <div className="w-full bg-stone-100 dark:bg-stone-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-teal-600 dark:bg-teal-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, fatProgress)}%` }}
                      />
                    </div>
                  </div>

                  {/* Fiber Progress */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-baseline text-xs">
                      <span className="font-semibold text-stone-700 dark:text-stone-300">Dietary Fiber</span>
                      <span className="text-stone-600 dark:text-stone-400 font-mono">
                        {rangeReport.averageFiberG}g / {targets.targetFiberG}g{' '}
                        <strong className="text-stone-900 dark:text-stone-100 font-sans">({fiberProgress}%)</strong>
                      </span>
                    </div>
                    <div className="w-full bg-stone-100 dark:bg-stone-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-stone-500 dark:bg-stone-400 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, fiberProgress)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* NUTRITION INSIGHTS */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider">
                  Nutrition Insights
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {rangeReport.insights.length > 0 ? (
                    rangeReport.insights.map(item => (
                      <div
                        key={item.id}
                        className="p-4 rounded-xl bg-white dark:bg-[#131d16] border border-stone-200/90 dark:border-[#23382b] shadow-2xs space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-sm text-stone-900 dark:text-stone-100">{item.title}</span>
                          <Badge
                            variant={
                              item.trendDirection === 'improving'
                                ? 'emerald'
                                : item.trendDirection === 'declining'
                                  ? 'amber'
                                  : 'stone'
                            }
                            className="text-3xs font-semibold capitalize"
                          >
                            {item.trendDirection === 'improving' && '↗ '}
                            {item.trendDirection === 'declining' && '↘ '}
                            {item.trendDirection}
                          </Badge>
                        </div>
                        <p className="text-stone-700 dark:text-stone-300 leading-relaxed">{item.observation}</p>
                        <div className="text-3xs text-stone-500 dark:text-stone-400 font-mono bg-stone-50 dark:bg-[#19271e] p-2 rounded">
                          <strong>Evidence:</strong> {item.evidence}
                        </div>
                        {item.recommendation && (
                          <p className="text-2xs font-semibold text-emerald-800 dark:text-emerald-400">
                            💡 {item.recommendation}
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 p-4 rounded-xl bg-stone-50 dark:bg-[#131d16] border border-stone-200 dark:border-[#23382b] text-xs text-stone-600 dark:text-stone-400">
                      No critical nutritional variances detected for this date range. Maintain regular scanning to track ongoing consistency.
                    </div>
                  )}
                </div>
              </div>

              {/* TREND VISUALIZER */}
              <div className="space-y-2">
                <div className="flex justify-between items-baseline flex-wrap gap-2">
                  <h3 className="text-xs font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider">
                    Nutrition Trend Trajectory
                  </h3>
                  <div className="flex items-center gap-3 text-2xs font-semibold">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded bg-emerald-600 inline-block" /> Protein (g)
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded bg-stone-300 dark:bg-stone-600 inline-block" /> Daily Calories
                    </span>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-[#131d16] border border-stone-200/90 dark:border-[#23382b] shadow-2xs">
                  <div className="overflow-x-auto pb-2">
                    <div className="min-w-[450px] flex items-end gap-2 h-44 border-b border-stone-200 dark:border-stone-800 px-2">
                      {rangeReport.trends.map(t => {
                        const maxProt = 100;
                        const protHeight = Math.min(100, Math.round((t.proteinG / maxProt) * 100));
                        return (
                          <div key={t.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                            {/* Hover Tooltip */}
                            <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-stone-900 text-white text-3xs px-2 py-1 rounded whitespace-nowrap z-10 pointer-events-none">
                              {t.date}: {t.calories} kcal • {t.proteinG}g protein
                            </div>
                            <div className="w-full flex items-end justify-center gap-1 h-36">
                              <div
                                className="w-full bg-emerald-600 rounded-t transition-all"
                                style={{ height: `${protHeight}%` }}
                              />
                            </div>
                            <span className="text-3xs font-mono text-stone-500 dark:text-stone-400 mt-1 block truncate w-full text-center">
                              {t.date.slice(5)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* NEXT STEPS (PERSONALIZED SUGGESTIONS) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider">
                    Next Steps: Personalized Food Suggestions
                  </h3>
                  <span className="text-2xs text-stone-500 dark:text-stone-400 font-medium">Hostel &amp; Budget Aware</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {recommendations.map(rec => (
                    <div
                      key={rec.id}
                      className="p-4 rounded-xl bg-white dark:bg-[#131d16] border border-stone-200 dark:border-[#23382b] hover:border-emerald-300 dark:hover:border-emerald-700 transition-all space-y-2 flex flex-col justify-between"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-2xl">{rec.emoji}</span>
                          <span className="text-3xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 capitalize">
                            {rec.affordabilityCategory}
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-stone-900 dark:text-stone-100">{rec.title}</h4>
                        <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">{rec.reason}</p>
                      </div>

                      <div className="pt-2 border-t border-stone-100 dark:border-[#23382b] space-y-1.5">
                        <div className="flex items-center justify-between text-2xs text-stone-500 dark:text-stone-400">
                          <span>Est. Protein</span>
                          <strong className="text-emerald-800 dark:text-emerald-400">{rec.estimatedNutrition.protein}g</strong>
                        </div>
                        <div className="flex items-center justify-between text-2xs text-stone-500 dark:text-stone-400">
                          <span>Est. Calories</span>
                          <strong className="text-stone-800 dark:text-stone-200">{rec.estimatedNutrition.calories} kcal</strong>
                        </div>
                        {rec.noCookRequired && (
                          <span className="inline-block text-3xs font-semibold px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300">
                            ⚡ Zero Cooking Needed
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* EXPORT & REPORT ACTION SECTION */}
              <div className="p-5 rounded-2xl bg-white dark:bg-[#131d16] border border-stone-200/90 dark:border-[#23382b] shadow-2xs space-y-4 print:hidden">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                      <span>📥</span> Export &amp; Report
                    </h3>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      Download your verified nutrition records or generate a formal PDF report.
                    </p>
                  </div>
                  <Badge variant="outline" className="text-2xs font-mono">
                    {rangeReport.dataSource === 'cloud' ? '☁ Cloud Verified' : '💾 Local Cached'}
                  </Badge>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadExport('json')}
                    disabled={rangeReport.totalMeals === 0}
                    className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold cursor-pointer hover:bg-stone-50 dark:hover:bg-[#19271e] text-stone-700 dark:text-stone-300"
                  >
                    <span>📄</span> Export JSON
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadExport('csv')}
                    disabled={rangeReport.totalMeals === 0}
                    className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold cursor-pointer hover:bg-stone-50 dark:hover:bg-[#19271e] text-stone-700 dark:text-stone-300"
                  >
                    <span>📊</span> Export CSV
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handlePrintReport}
                    disabled={rangeReport.totalMeals === 0}
                    className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold cursor-pointer bg-emerald-800 dark:bg-emerald-700 hover:bg-emerald-900 dark:hover:bg-emerald-600 text-white"
                  >
                    <span>🖨️</span> Print Report (PDF)
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 4. VIEW MODE: TODAY'S INTAKE */}
      {viewMode === 'today' && (
        <div className="space-y-6">
          <Card className="bg-gradient-to-br from-emerald-50/60 via-white to-stone-50 dark:from-[#132219] dark:via-[#131d16] dark:to-[#0f1812] border-emerald-200/80 dark:border-emerald-900/50">
            <CardContent className="p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-2xs font-bold tracking-wider text-emerald-800 dark:text-emerald-400 uppercase">
                  Today&apos;s Nutrition Score
                </span>
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl sm:text-4xl font-black text-stone-900 dark:text-stone-100">
                    {todaySummary.nutritionScore}
                    <span className="text-base sm:text-lg text-stone-400 dark:text-stone-500 font-semibold">/100</span>
                  </span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border capitalize ${todayScoreColor}`}>
                    {todaySummary.nutritionRating.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-xs text-stone-600 dark:text-stone-300 max-w-xl">
                  {todaySummary.mealCount > 0
                    ? `Calculated from ${todaySummary.mealCount} logged meal(s) today against your personalized calorie and macro targets.`
                    : 'Log your first meal today to generate your personalized nutrition score.'}
                </p>
              </div>

              <div className="shrink-0 text-right space-y-1">
                <div className="flex items-center justify-end">
                  <span className={`text-3xs font-semibold px-2 py-0.5 rounded-full border ${
                    targets.calculationMethod === 'user_defined'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800/50'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                  }`}>
                    {targetTypeLabel}
                  </span>
                </div>
                <div className="text-2xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">
                  Target Calorie Alignment
                </div>
                <div className="text-lg font-black text-emerald-800 dark:text-emerald-400 mt-0.5">
                  {todaySummary.calorieProgressPercent}% of Goal
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Today Macros Progress Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-[#131d16] border border-stone-200/90 dark:border-[#23382b] shadow-2xs space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-2xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Calories</span>
                <span className="text-2xs font-bold text-stone-700 dark:text-stone-300">{todaySummary.calorieProgressPercent}%</span>
              </div>
              <div className="text-lg sm:text-xl font-black text-stone-900 dark:text-stone-100">
                {todaySummary.totalCalories} <span className="text-xs font-normal text-stone-500 dark:text-stone-400">/ {todaySummary.targetCalories} kcal</span>
              </div>
              <div className="w-full bg-stone-100 dark:bg-stone-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-stone-800 dark:bg-stone-300 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, todaySummary.calorieProgressPercent)}%` }}
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-[#131d16] border border-stone-200/90 dark:border-[#23382b] shadow-2xs space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-2xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">Protein</span>
                <span className="text-2xs font-bold text-emerald-800 dark:text-emerald-400">{todaySummary.proteinProgressPercent}%</span>
              </div>
              <div className="text-lg sm:text-xl font-black text-emerald-800 dark:text-emerald-400">
                {todaySummary.totalProteinG}g <span className="text-xs font-normal text-stone-500 dark:text-stone-400">/ {todaySummary.targetProteinG}g</span>
              </div>
              <div className="w-full bg-stone-100 dark:bg-stone-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-emerald-600 dark:bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, todaySummary.proteinProgressPercent)}%` }}
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-[#131d16] border border-stone-200/90 dark:border-[#23382b] shadow-2xs space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-2xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">Carbs</span>
                <span className="text-2xs font-bold text-amber-800 dark:text-amber-400">{todaySummary.carbsProgressPercent}%</span>
              </div>
              <div className="text-lg sm:text-xl font-black text-amber-800 dark:text-amber-400">
                {todaySummary.totalCarbsG}g <span className="text-xs font-normal text-stone-500 dark:text-stone-400">/ {todaySummary.targetCarbsG}g</span>
              </div>
              <div className="w-full bg-stone-100 dark:bg-stone-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-amber-500 dark:bg-amber-400 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, todaySummary.carbsProgressPercent)}%` }}
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-[#131d16] border border-stone-200/90 dark:border-[#23382b] shadow-2xs space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-2xs font-bold text-teal-800 dark:text-teal-400 uppercase tracking-wider">Fats</span>
                <span className="text-2xs font-bold text-teal-800 dark:text-teal-400">{todaySummary.fatProgressPercent}%</span>
              </div>
              <div className="text-lg sm:text-xl font-black text-teal-800 dark:text-teal-400">
                {todaySummary.totalFatG}g <span className="text-xs font-normal text-stone-500 dark:text-stone-400">/ {todaySummary.targetFatG}g</span>
              </div>
              <div className="w-full bg-stone-100 dark:bg-stone-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-teal-600 dark:bg-teal-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, todaySummary.fatProgressPercent)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Daily Hydration Tracking (Phase 8.7) */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-sky-50/70 via-white to-stone-50 dark:from-[#0d1e28] dark:via-[#131d16] dark:to-[#0f1812] border border-sky-200/80 dark:border-sky-900/50 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xl">💧</span>
                  <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wider">
                    Daily Hydration
                  </h3>
                  <Badge variant="outline" className="text-3xs font-mono bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800/50">
                    Hostel &amp; Student Routine
                  </Badge>
                </div>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {todaySummary.hydration?.guidelineDisclaimer || 'General hydration guideline based on estimated daily requirements. Not medical advice.'}
                </p>
              </div>

              <div className="text-right shrink-0">
                <span className="text-2xl font-black text-sky-900 dark:text-sky-200">
                  {((todaySummary.hydration?.dailyWaterIntakeMl || 0) / 1000).toFixed(2)}L
                  <span className="text-xs text-stone-500 dark:text-stone-400 font-semibold"> / {((todaySummary.hydration?.hydrationTargetMl || 2200) / 1000).toFixed(2)}L</span>
                </span>
                <span className="block text-2xs font-bold text-sky-700 dark:text-sky-400">
                  {todaySummary.hydration?.percentageOfTarget || 0}% of daily guideline
                </span>
              </div>
            </div>

            {/* Hydration progress bar */}
            <div className="space-y-1">
              <div className="w-full bg-stone-100 dark:bg-stone-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-sky-500 dark:bg-sky-400 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, todaySummary.hydration?.percentageOfTarget || 0)}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-2xs text-stone-500 dark:text-stone-400">
                <span>
                  {todaySummary.hydration?.remainingAmountMl && todaySummary.hydration.remainingAmountMl > 0
                    ? `${todaySummary.hydration.remainingAmountMl} ml remaining`
                    : 'Daily target reached! 🎉'}
                </span>
                <span>{todaySummary.hydration?.loggedDrinksCount || 0} drink(s) logged</span>
              </div>
            </div>

            {/* Quick-add buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-sky-100 dark:border-sky-950/60">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-2xs font-bold text-stone-600 dark:text-stone-400 mr-1">Quick Add:</span>
                {QUICK_ADD_AMOUNTS_ML.map(amount => (
                  <button
                    key={amount}
                    type="button"
                    disabled={isLoggingDrink}
                    onClick={() => handleQuickAddDrink(amount)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-[#19271e] border border-sky-200 dark:border-sky-800/60 text-sky-900 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-[#203327] transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                  >
                    +{amount} ml
                  </button>
                ))}
              </div>

              {/* Custom amount form */}
              <form onSubmit={handleCustomDrink} className="flex items-center gap-1.5 text-xs">
                <input
                  type="number"
                  placeholder="Custom ml"
                  value={customMl}
                  min={50}
                  max={2500}
                  onChange={e => setCustomMl(e.target.value)}
                  className="w-24 px-2.5 py-1 rounded-lg bg-white dark:bg-[#19271e] border border-stone-200 dark:border-[#23382b] text-xs text-stone-800 dark:text-stone-200 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-hidden focus:border-sky-400"
                />
                <button
                  type="submit"
                  disabled={!customMl || isLoggingDrink}
                  className="px-2.5 py-1 rounded-lg bg-sky-700 dark:bg-sky-600 text-white font-semibold hover:bg-sky-800 dark:hover:bg-sky-500 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  Log
                </button>
              </form>
            </div>

            {/* Hostel friendly reminder tip */}
            <div className="p-3 rounded-xl bg-sky-50/50 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/40 text-2xs text-sky-900 dark:text-sky-200 flex items-center gap-2">
              <span className="text-base">🎒</span>
              <span>
                <strong>Campus Hydration Tip:</strong> Keep a 1L refillable bottle in your bag during lectures and drink water between meals to maintain steady hydration.
              </span>
            </div>
          </div>

          {/* Micronutrient Summary (Phase 8.7) */}
          {todaySummary.micronutrients && (
            <div className="p-5 rounded-2xl bg-white dark:bg-[#131d16] border border-stone-200/90 dark:border-[#23382b] shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🌿</span>
                    <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wider">
                      Micronutrients &amp; Essential Minerals
                    </h3>
                  </div>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    General reference targets derived from analyzed plates • Not medical diagnosis
                  </p>
                </div>
                <span className={`text-3xs px-2.5 py-0.5 rounded-full font-bold border capitalize ${
                  todaySummary.micronutrients.dataAvailability === 'sufficient'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50'
                    : todaySummary.micronutrients.dataAvailability === 'limited'
                      ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/50'
                      : 'bg-stone-50 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                }`}>
                  {todaySummary.micronutrients.dataAvailability === 'sufficient'
                    ? '✓ Good Data Coverage'
                    : todaySummary.micronutrients.dataAvailability === 'limited'
                      ? '⚠️ Limited Estimates'
                      : 'ℹ No Scanned Data'}
                </span>
              </div>

              {/* Grid of Micronutrients */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {Object.values(todaySummary.micronutrients.nutrients).map(item => (
                  <div
                    key={item.key}
                    className="p-3.5 rounded-xl border border-stone-100 dark:border-[#23382b] bg-stone-50/60 dark:bg-[#19271e]/60 hover:bg-white dark:hover:bg-[#19271e] hover:border-stone-200 dark:hover:border-stone-700 transition-all space-y-2"
                  >
                    <div className="flex justify-between items-baseline">
                      <span className="font-bold text-xs text-stone-800 dark:text-stone-200">{item.name}</span>
                      <span className="text-3xs font-semibold text-stone-400 dark:text-stone-500 font-mono">
                        {item.unit}
                      </span>
                    </div>

                    <div className="flex justify-between items-baseline">
                      <span className="text-base font-black text-stone-900 dark:text-stone-100">
                        {item.consumed}
                        <span className="text-3xs font-normal text-stone-500 dark:text-stone-400"> / {item.referenceTarget}{item.unit}</span>
                      </span>
                      <span className={`text-3xs font-bold px-1.5 py-0.5 rounded ${
                        item.dataAvailability === 'none'
                          ? 'bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400'
                          : item.status === 'on_track'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                            : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
                      }`}>
                        {item.dataAvailability === 'none' ? 'No data' : `${item.percentage}%`}
                      </span>
                    </div>

                    <div className="w-full bg-stone-200 dark:bg-stone-800 rounded-full h-1 overflow-hidden">
                      <div
                        className={`h-1 rounded-full ${
                          item.dataAvailability === 'none'
                            ? 'bg-stone-300 dark:bg-stone-700'
                            : item.status === 'on_track'
                              ? 'bg-emerald-500'
                              : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.min(100, item.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-3xs text-stone-400 dark:text-stone-500 italic">
                * Reference values follow general adult nutritional guidelines. Scanned food recognition estimates available nutrients; whole foods without itemized micronutrient data appear as limited.
              </p>
            </div>
          )}

          {/* Today Insights */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wider">
              Today&apos;s Personalized Insights
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {insights.map(item => (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border text-xs space-y-1.5 ${
                    item.severity === 'attention'
                      ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 text-amber-950 dark:text-amber-200'
                      : item.severity === 'positive'
                        ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-950 dark:text-emerald-200'
                        : 'bg-stone-50 dark:bg-[#19271e] border-stone-200 dark:border-[#23382b] text-stone-900 dark:text-stone-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm">{item.title}</span>
                    <span className="text-3xs font-semibold px-2 py-0.5 rounded-full bg-white/80 dark:bg-stone-900/80 border border-current capitalize">
                      {item.severity}
                    </span>
                  </div>
                  <p className="text-stone-700 dark:text-stone-300 leading-relaxed">{item.description}</p>
                  <p className="text-3xs text-stone-500 dark:text-stone-400 font-mono">
                    <strong className="text-stone-700 dark:text-stone-300">Evidence:</strong> {item.evidence}
                  </p>
                  {item.recommendation && (
                    <p className="text-xs font-medium text-emerald-900 dark:text-emerald-300 pt-1">
                      💡 {item.recommendation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. VIEW MODE: MONTHLY SUMMARY REPORT */}
      {viewMode === 'monthly' && (
        <div className="space-y-6">
          {/* Month Banner */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-900 to-stone-900 dark:from-[#0a1810] dark:to-[#121c15] text-white border border-transparent dark:border-[#23382b] flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <span className="text-2xs font-bold text-emerald-400 uppercase tracking-widest">
                Comprehensive Monthly Evaluation
              </span>
              <h2 className="text-2xl font-black mt-0.5">{monthlyReport.monthName}</h2>
              <p className="text-xs text-stone-300 dark:text-stone-400 mt-1">
                Derived from {monthlyReport.totalMeals} recorded plate scan(s) across {monthlyReport.activeDaysCount} active days.
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xs text-stone-400 uppercase font-semibold">Average Nutrition Score</span>
              <div className="text-3xl font-black text-emerald-300">{monthlyReport.averageNutritionScore}/100</div>
            </div>
          </div>

          {/* Month Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-[#131d16] border border-stone-200 dark:border-[#23382b]">
              <span className="text-2xs text-stone-500 dark:text-stone-400 uppercase font-semibold">Avg. Calories</span>
              <div className="text-xl font-black text-stone-900 dark:text-stone-100 mt-1">{monthlyReport.averageCalories} kcal</div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-[#131d16] border border-stone-200 dark:border-[#23382b]">
              <span className="text-2xs text-emerald-800 dark:text-emerald-400 uppercase font-semibold">Avg. Protein</span>
              <div className="text-xl font-black text-emerald-800 dark:text-emerald-400 mt-1">{monthlyReport.averageProteinG}g</div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-[#131d16] border border-stone-200 dark:border-[#23382b]">
              <span className="text-2xs text-amber-800 dark:text-amber-400 uppercase font-semibold">Avg. Carbs</span>
              <div className="text-xl font-black text-amber-800 dark:text-amber-400 mt-1">{monthlyReport.averageCarbsG}g</div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-[#131d16] border border-stone-200 dark:border-[#23382b]">
              <span className="text-2xs text-teal-800 dark:text-teal-400 uppercase font-semibold">Avg. Fiber</span>
              <div className="text-xl font-black text-teal-800 dark:text-teal-400 mt-1">{monthlyReport.averageFiberG}g</div>
            </div>
          </div>

          {/* Strongest & Weakest Days */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-[#131d16] border border-emerald-200/90 dark:border-emerald-900/40 space-y-2">
              <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>🌟</span> Highest Scoring Days
              </h4>
              {monthlyReport.strongestDays.length > 0 ? (
                <div className="space-y-1.5">
                  {monthlyReport.strongestDays.map(d => (
                    <div key={d.date} className="flex justify-between items-center text-xs p-2 rounded bg-emerald-50/50 dark:bg-emerald-950/30">
                      <span className="font-semibold text-stone-800 dark:text-stone-200">{d.date}</span>
                      <span className="text-emerald-800 dark:text-emerald-400 font-bold">{d.score} pts ({d.proteinG}g protein)</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-stone-500 dark:text-stone-400">No active days recorded yet.</p>
              )}
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-[#131d16] border border-stone-200 dark:border-[#23382b] space-y-2">
              <h4 className="text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>🎯</span> Focus &amp; Growth Days
              </h4>
              {monthlyReport.weakestDays.length > 0 ? (
                <div className="space-y-1.5">
                  {monthlyReport.weakestDays.map(d => (
                    <div key={d.date} className="flex justify-between items-center text-xs p-2 rounded bg-stone-50 dark:bg-[#19271e]">
                      <span className="font-semibold text-stone-800 dark:text-stone-200">{d.date}</span>
                      <span className="text-stone-600 dark:text-stone-400 font-bold">{d.score} pts ({d.calories} kcal)</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-stone-500 dark:text-stone-400">No active days recorded yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. PRINT-ONLY JOURNAL TABLE */}
      <div className="hidden print:block pt-4 space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-stone-900 border-b border-stone-300 pb-1">
          Detailed Dietary Journal
        </h3>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-stone-400 text-stone-700 font-bold">
              <th className="py-2">Date</th>
              <th className="py-2">Meal</th>
              <th className="py-2">Calories</th>
              <th className="py-2">Protein</th>
              <th className="py-2">Carbs</th>
              <th className="py-2">Fat</th>
              <th className="py-2">Fiber</th>
              <th className="py-2">Stars</th>
            </tr>
          </thead>
          <tbody>
            {rangeReport.meals.map(m => (
              <tr key={m.id} className="border-b border-stone-200">
                <td className="py-1.5 font-mono">{m.analyzedAt.slice(0, 10)}</td>
                <td className="py-1.5 font-semibold">{m.mealTitle}</td>
                <td className="py-1.5">{m.totalNutrition?.calories || 0} kcal</td>
                <td className="py-1.5">{m.totalNutrition?.protein || 0}g</td>
                <td className="py-1.5">{m.totalNutrition?.carbohydrates || 0}g</td>
                <td className="py-1.5">{m.totalNutrition?.fat || 0}g</td>
                <td className="py-1.5">{m.totalNutrition?.fiber || 0}g</td>
                <td className="py-1.5">{m.nutrientRichness?.stars?.toFixed(1) || '1.0'} ★</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
