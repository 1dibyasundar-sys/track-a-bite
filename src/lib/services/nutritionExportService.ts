/**
 * TRACK-A-BITE — NUTRITION EXPORT SERVICE (Phase 8.5.2)
 *
 * Dedicated production service for generating, formatting, sanitizing, and downloading
 * patient/user nutrition reports and historical journals in JSON, CSV, and Printable formats.
 *
 * Architecture & Guarantees:
 * - Deterministic ordering by meal timestamp
 * - Absolute secret isolation: zero passwords, tokens, API keys, or private metadata
 * - Authenticated ownership verification: strictly binds exports to Firebase Auth user.uid
 * - Multi-tier source resolution: Cloud Firestore with local storage fallback
 * - Standards-compliant RFC 4180 CSV with Unicode UTF-8 BOM for spreadsheet compatibility
 * - Browser-native PDF print pipeline without external heavyweight binaries
 */

import { MealAnalysis } from '../types/meal';
import { UserProfile } from '../types/profile';
import {
  NutritionReport,
  NutritionDateRange,
  NutritionDateRangePreset,
  NutritionExportPayload,
  NutritionExportResult,
  PrintableNutritionReportData,
  SanitizedExportMealItem,
} from '../types/reporting';
import { getLocalISODate } from '../utils';
import { nutritionAnalyticsService } from './nutritionAnalyticsService';

export class NutritionExportService {
  private static instance: NutritionExportService;

  public static getInstance(): NutritionExportService {
    if (!NutritionExportService.instance) {
      NutritionExportService.instance = new NutritionExportService();
    }
    return NutritionExportService.instance;
  }

  /**
   * Validates that the requested export user matches the authenticated Firebase Auth user.
   * Cross-user exports or arbitrary client-supplied UIDs are strictly forbidden.
   */
  public validateExportOwnership(requestedUid?: string, authUid?: string): boolean {
    if (!authUid || typeof authUid !== 'string' || authUid.trim() === '') {
      return false;
    }
    if (requestedUid && requestedUid !== authUid) {
      return false;
    }
    return true;
  }

  /**
   * Converts canonical MealAnalysis domain records into sanitized export items.
   * Strips all internal metadata, raw images, internal errors, and ensures normalized ISO timestamps.
   */
  public sanitizeMeals(meals: MealAnalysis[]): SanitizedExportMealItem[] {
    if (!Array.isArray(meals)) return [];

    // Deterministic chronological ordering (newest first)
    const sorted = [...meals].sort((a, b) => {
      const timeA = a.analyzedAt ? new Date(a.analyzedAt).getTime() : 0;
      const timeB = b.analyzedAt ? new Date(b.analyzedAt).getTime() : 0;
      return timeB - timeA;
    });

    return sorted.map(m => {
      // Normalize timestamp to ISO string without leaking Firestore Timestamp objects
      let isoDate: string;
      const rawAnalyzedAt = m.analyzedAt as unknown;
      if (typeof rawAnalyzedAt === 'string') {
        isoDate = rawAnalyzedAt;
      } else if (
        rawAnalyzedAt &&
        typeof rawAnalyzedAt === 'object' &&
        'toDate' in rawAnalyzedAt &&
        typeof (rawAnalyzedAt as { toDate: () => Date }).toDate === 'function'
      ) {
        isoDate = (rawAnalyzedAt as { toDate: () => Date }).toDate().toISOString();
      } else if (
        rawAnalyzedAt &&
        typeof rawAnalyzedAt === 'object' &&
        'seconds' in rawAnalyzedAt &&
        typeof (rawAnalyzedAt as { seconds: number }).seconds === 'number'
      ) {
        isoDate = new Date((rawAnalyzedAt as { seconds: number }).seconds * 1000).toISOString();
      } else {
        isoDate = new Date().toISOString();
      }

      return {
        id: String(m.id || ''),
        mealTitle: String(m.mealTitle || 'Untitled Meal'),
        analyzedAt: isoDate,
        calories: Math.max(0, Math.round(Number(m.totalNutrition?.calories) || 0)),
        protein: Math.max(0, Math.round((Number(m.totalNutrition?.protein) || 0) * 10) / 10),
        carbohydrates: Math.max(0, Math.round((Number(m.totalNutrition?.carbohydrates) || 0) * 10) / 10),
        fat: Math.max(0, Math.round((Number(m.totalNutrition?.fat) || 0) * 10) / 10),
        fiber: Math.max(0, Math.round((Number(m.totalNutrition?.fiber) || 0) * 10) / 10),
        stars: Number(m.nutrientRichness?.stars) || 1,
        items: Array.isArray(m.items) ? m.items.map(i => String(i.name || '')) : [],
      };
    });
  }

  /**
   * Constructs a strongly typed NutritionExportPayload adhering to Section 2 specification.
   * Explicitly excludes passwords, session tokens, Firebase credentials, and GEMINI_API_KEY.
   */
  public buildNutritionExportPayload(
    report: NutritionReport,
    profile?: UserProfile | null
  ): NutritionExportPayload {
    const sanitizedMeals = this.sanitizeMeals(report.meals || []);

    const payload: NutritionExportPayload = {
      application: 'Track-a-Bite',
      exportVersion: '1.0',
      generatedAt: new Date().toISOString(),
      user: profile
        ? {
            displayName: (profile as { displayName?: string })?.displayName || undefined,
            age: profile.age,
            gender: profile.gender,
            heightCm: profile.heightCm,
            weightKg: profile.weightKg,
            healthGoal: profile.healthGoal,
            dietaryRestrictions: profile.dietaryRestrictions,
            isHostelite: Boolean(profile.isHostelite),
            targetCalories: profile.targetCalories,
            targetProteinG: profile.targetProteinG,
            targetCarbsG: profile.targetCarbsG,
            targetFatG: profile.targetFatG,
            targetHydrationMl: profile.targetHydrationMl,
            customTargetsActive: profile.customTargetsActive,
          }
        : undefined,
      userProfile: profile
        ? {
            age: profile.age,
            gender: profile.gender,
            heightCm: profile.heightCm,
            weightKg: profile.weightKg,
            healthGoal: profile.healthGoal,
            isHostelite: Boolean(profile.isHostelite),
            dietaryRestrictions: profile.dietaryRestrictions,
            budgetPreference: profile.budgetPreference,
            targetCalories: profile.targetCalories,
            targetProteinG: profile.targetProteinG,
            targetCarbsG: profile.targetCarbsG,
            targetFatG: profile.targetFatG,
            targetHydrationMl: profile.targetHydrationMl,
            customTargetsActive: profile.customTargetsActive,
          }
        : undefined,
      period: {
        startDate: report.dateRange.startDate,
        endDate: report.dateRange.endDate,
        preset: report.dateRange.preset,
      },
      dateRange: report.dateRange,
      summary: {
        totalMeals: report.totalMeals,
        totalCalories: report.totalCalories ?? report.averageCalories,
        totalProteinG: report.totalProteinG ?? report.averageProteinG,
        totalCarbsG: report.totalCarbsG ?? report.averageCarbsG,
        totalFatG: report.totalFatG ?? report.averageFatG,
        totalFiberG: report.totalFiberG ?? report.averageFiberG,
        activeDaysCount: report.activeDaysCount,
        averageCalories: report.averageCalories,
        averageProteinG: report.averageProteinG,
        averageCarbsG: report.averageCarbsG,
        averageFatG: report.averageFatG,
        averageFiberG: report.averageFiberG,
        averageNutritionScore: report.averageNutritionScore,
        consistencyPercentage: report.consistencyPercentage,
      },
      nutritionSummary: {
        totalMeals: report.totalMeals,
        totalCalories: report.totalCalories ?? report.averageCalories,
        totalProteinG: report.totalProteinG ?? report.averageProteinG,
        totalCarbsG: report.totalCarbsG ?? report.averageCarbsG,
        totalFatG: report.totalFatG ?? report.averageFatG,
        totalFiberG: report.totalFiberG ?? report.averageFiberG,
        activeDaysCount: report.activeDaysCount,
        averageCalories: report.averageCalories,
        averageProteinG: report.averageProteinG,
        averageCarbsG: report.averageCarbsG,
        averageFatG: report.averageFatG,
        averageFiberG: report.averageFiberG,
        averageNutritionScore: report.averageNutritionScore,
        consistencyPercentage: report.consistencyPercentage,
      },
      targets: report.targets || (profile ? nutritionAnalyticsService.calculateDailyTargets(profile) : undefined),
      meals: sanitizedMeals,
      micronutrients: report.micronutrients,
      hydration: report.hydration,
    };

    return payload;
  }

  /**
   * Generates sanitized, human-readable JSON string.
   */
  public exportNutritionJSON(report: NutritionReport, profile?: UserProfile | null): string {
    const payload = this.buildNutritionExportPayload(report, profile);
    return JSON.stringify(payload, null, 2);
  }

  /**
   * Generates standards-compliant RFC 4180 CSV with UTF-8 BOM for Microsoft Excel.
   * Accurately escapes quotes, commas, and newlines.
   */
  public exportNutritionCSV(report: NutritionReport, explicitMeals?: MealAnalysis[]): string {
    const mealsToExport = this.sanitizeMeals(
      explicitMeals && explicitMeals.length > 0 ? explicitMeals : report.meals || []
    );

    const escapeCsv = (val: unknown): string => {
      if (val === undefined || val === null) return '""';
      const str = String(val);
      // Escape inner quotes by doubling them; wrap cell in quotes
      return `"${str.replace(/"/g, '""')}"`;
    };

    const headers = [
      'Date',
      'Meal Title',
      'Calories (kcal)',
      'Protein (g)',
      'Carbohydrates (g)',
      'Fat (g)',
      'Fiber (g)',
      'Nutrition Stars',
      'Food Items',
    ];

    const rows = mealsToExport.map(m => {
      const itemsList = m.items.join(', ');
      return [
        escapeCsv(getLocalISODate(m.analyzedAt)),
        escapeCsv(m.mealTitle),
        escapeCsv(m.calories),
        escapeCsv(m.protein),
        escapeCsv(m.carbohydrates),
        escapeCsv(m.fat),
        escapeCsv(m.fiber),
        escapeCsv(m.stars.toFixed(1)),
        escapeCsv(itemsList),
      ].join(',');
    });

    // UTF-8 BOM (\uFEFF) for immediate UTF-8 recognition in Excel and spreadsheet viewers
    return '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows].join('\r\n');
  }

  /**
   * Builds formal printable report model for browser print/PDF views.
   */
  public buildPrintableReportData(
    report: NutritionReport,
    profile?: UserProfile | null
  ): PrintableNutritionReportData {
    const sanitizedMeals = this.sanitizeMeals(report.meals || []);

    const targets = report.targets || nutritionAnalyticsService.calculateDailyTargets(profile);
    const dailySummary: import('../types/analytics').DailyNutritionSummary = {
      date: report.dateRange.endDate,
      totalCalories: report.totalCalories ?? report.averageCalories,
      totalProteinG: report.totalProteinG ?? report.averageProteinG,
      totalCarbsG: report.totalCarbsG ?? report.averageCarbsG,
      totalFatG: report.totalFatG ?? report.averageFatG,
      totalFiberG: report.totalFiberG ?? report.averageFiberG,
      targetCalories: targets.targetCalories,
      targetProteinG: targets.targetProteinG,
      targetCarbsG: targets.targetCarbsG,
      targetFatG: targets.targetFatG,
      targetFiberG: targets.targetFiberG,
      calorieProgressPercent: report.calorieProgressPercent ?? 0,
      proteinProgressPercent: report.proteinProgressPercent ?? 0,
      carbsProgressPercent: report.carbsProgressPercent ?? 0,
      fatProgressPercent: report.fatProgressPercent ?? 0,
      fiberProgressPercent: report.fiberProgressPercent ?? 0,
      mealCount: report.totalMeals,
      nutritionScore: report.averageNutritionScore,
      nutritionRating: report.nutritionRating || 'good',
      meals: report.meals || [],
      dataSource: report.dataSource,
    };

    const recommendations = nutritionAnalyticsService.getNextMealRecommendations(dailySummary, profile);

    return {
      title: 'Track-a-Bite Nutrition Report',
      generatedAt: new Date().toISOString(),
      period: {
        startDate: report.dateRange.startDate,
        endDate: report.dateRange.endDate,
        preset: report.dateRange.preset,
      },
      user: profile
        ? {
            displayName: (profile as { displayName?: string })?.displayName || undefined,
            age: profile.age,
            gender: profile.gender,
            heightCm: profile.heightCm,
            weightKg: profile.weightKg,
            healthGoal: profile.healthGoal,
            dietaryRestrictions: profile.dietaryRestrictions,
            isHostelite: Boolean(profile.isHostelite),
            targetCalories: profile.targetCalories,
            targetProteinG: profile.targetProteinG,
            targetCarbsG: profile.targetCarbsG,
            targetFatG: profile.targetFatG,
            customTargetsActive: profile.customTargetsActive,
          }
        : undefined,
      summary: {
        totalMeals: report.totalMeals,
        totalCalories: report.totalCalories ?? report.averageCalories,
        totalProteinG: report.totalProteinG ?? report.averageProteinG,
        totalCarbsG: report.totalCarbsG ?? report.averageCarbsG,
        totalFatG: report.totalFatG ?? report.averageFatG,
        totalFiberG: report.totalFiberG ?? report.averageFiberG,
        activeDaysCount: report.activeDaysCount,
        averageCalories: report.averageCalories,
        averageProteinG: report.averageProteinG,
        averageCarbsG: report.averageCarbsG,
        averageFatG: report.averageFatG,
        averageFiberG: report.averageFiberG,
        averageNutritionScore: report.averageNutritionScore,
        consistencyPercentage: report.consistencyPercentage,
      },
      score: {
        value: report.averageNutritionScore,
        rating: report.nutritionRating,
        consistencyPercentage: report.consistencyPercentage,
      },
      targets: report.targets || targets,
      progress: {
        caloriesPercent: report.calorieProgressPercent ?? 0,
        proteinPercent: report.proteinProgressPercent ?? 0,
        carbsPercent: report.carbsProgressPercent ?? 0,
        fatPercent: report.fatProgressPercent ?? 0,
      },
      insights: report.insights || [],
      recommendations,
      meals: sanitizedMeals,
      dataSource: report.dataSource,
      micronutrients: report.micronutrients,
      hydration: report.hydration,
    };
  }

  /**
   * High-level entry point to fetch and export authenticated user nutrition history.
   * Reuses the existing nutritionAnalyticsService to prevent duplicate queries or calculations.
   */
  public async exportUserNutritionHistory(
    authUid: string | undefined,
    dateRange: NutritionDateRange | NutritionDateRangePreset,
    format: 'json' | 'csv',
    profile?: UserProfile | null
  ): Promise<NutritionExportResult> {
    const report = await nutritionAnalyticsService.getDateRangeReport(authUid, dateRange, profile);
    const filenameDate = `${report.dateRange.startDate}_to_${report.dateRange.endDate}`;

    if (format === 'csv') {
      return {
        format: 'csv',
        filename: `track-a-bite-journal-${filenameDate}.csv`,
        mimeType: 'text/csv;charset=utf-8;',
        content: this.exportNutritionCSV(report),
      };
    }

    return {
      format: 'json',
      filename: `track-a-bite-report-${filenameDate}.json`,
      mimeType: 'application/json;charset=utf-8;',
      content: this.exportNutritionJSON(report, profile),
    };
  }

  /**
   * Browser-safe file download trigger for JSON content.
   */
  public downloadJSON(filename: string, content: string): void {
    this.triggerBrowserDownload(filename, content, 'application/json;charset=utf-8;');
  }

  /**
   * Browser-safe file download trigger for CSV content.
   */
  public downloadCSV(filename: string, content: string): void {
    this.triggerBrowserDownload(filename, content, 'text/csv;charset=utf-8;');
  }

  /**
   * Triggers native browser print dialog for "Save as PDF" or physical printing.
   */
  public triggerPrintReport(): void {
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    }
  }

  /**
   * Helper that triggers standard HTML5 <a> tag download in browser context.
   * Gracefully no-ops in Node.js / SSR test environments.
   */
  private triggerBrowserDownload(filename: string, content: string, mimeType: string): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export const nutritionExportService = NutritionExportService.getInstance();
