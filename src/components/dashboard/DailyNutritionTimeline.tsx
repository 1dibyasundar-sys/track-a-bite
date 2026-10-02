'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { MealAnalysis } from '../../lib/types/meal';
import { HydrationLogEntry } from '../../lib/types/hydration';
import { ArrowRightIcon, DropletIcon, CheckIcon } from '../ui/icons';

interface TimelineEvent {
  id: string;
  type: 'meal' | 'hydration';
  timestamp: string; // ISO string
  timeFormatted: string;
  title: string;
  subtitle: string;
  calories?: number;
  proteinG?: number;
  amountMl?: number;
  tags: string[];
  mealId?: string;
  hour: number;
}

interface DailyNutritionTimelineProps {
  meals: MealAnalysis[];
  hydrationEntries?: HydrationLogEntry[];
  proteinDeficitG?: number;
}

interface JourneyPhase {
  id: 'morning' | 'afternoon' | 'evening' | 'night';
  name: string;
  subTitle: string;
  timeRange: string;
  icon: string;
  events: TimelineEvent[];
  status: 'completed' | 'in_progress' | 'opportunity' | 'pending';
  statusLabel: string;
  opportunityNote?: string;
}

export function DailyNutritionTimeline({
  meals = [],
  hydrationEntries = [],
  proteinDeficitG = 0,
}: DailyNutritionTimelineProps) {
  // Combine real meals and hydration events chronologically
  const allEvents: TimelineEvent[] = [];

  for (const meal of meals) {
    const timeIso = meal.analyzedAt || (meal as unknown as { createdAt?: string }).createdAt || new Date().toISOString();
    const dateObj = new Date(timeIso);
    const hour = !isNaN(dateObj.getTime()) ? dateObj.getHours() : 12;
    const timeStr = !isNaN(dateObj.getTime())
      ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '--:--';

    const tags: string[] = [];
    const prot = meal.totalNutrition?.protein || 0;
    const carbs = meal.totalNutrition?.carbohydrates || 0;
    const cals = meal.totalNutrition?.calories || 0;

    if (prot >= 15) tags.push(`+${Math.round(prot)}g Protein`);
    if (carbs > 0) tags.push(`${Math.round(carbs)}g Carbs`);

    const ironTotal = (meal.items || []).reduce((acc, it) => acc + (it.micronutrients?.iron || 0), 0);
    if (ironTotal >= 2) tags.push(`${ironTotal.toFixed(1)}mg Iron`);

    allEvents.push({
      id: `meal-${meal.id}`,
      type: 'meal',
      timestamp: timeIso,
      timeFormatted: timeStr,
      title: meal.mealTitle || 'Scanned Meal',
      subtitle: `${meal.items?.length || 1} food items detected`,
      calories: Math.round(cals),
      proteinG: Math.round(prot),
      tags,
      mealId: meal.id,
      hour,
    });
  }

  for (const h of hydrationEntries) {
    const timeIso = h.loggedAt || h.date || new Date().toISOString();
    const dateObj = new Date(timeIso);
    const hour = !isNaN(dateObj.getTime()) ? dateObj.getHours() : 12;
    const timeStr = !isNaN(dateObj.getTime())
      ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '--:--';

    allEvents.push({
      id: `hyd-${h.id}`,
      type: 'hydration',
      timestamp: timeIso,
      timeFormatted: timeStr,
      title: 'Water Logged',
      subtitle: h.source === 'quick_add' ? 'Quick log' : 'Custom log',
      amountMl: h.amountMl,
      tags: [`+${h.amountMl} ml fluid`],
      hour,
    });
  }

  // Current hour of day
  const currentHour = new Date().getHours();

  // Partition events into the 4 Journey Phases
  const morningEvents = allEvents.filter(e => e.hour >= 5 && e.hour < 11);
  const afternoonEvents = allEvents.filter(e => e.hour >= 11 && e.hour < 16);
  const eveningEvents = allEvents.filter(e => e.hour >= 16 && e.hour < 19);
  const nightEvents = allEvents.filter(e => e.hour >= 19 || e.hour < 5);

  const phases: JourneyPhase[] = [
    {
      id: 'morning',
      name: 'Morning',
      subTitle: 'Breakfast & Early Fluid',
      timeRange: '6 AM – 11 AM',
      icon: '🌅',
      events: morningEvents,
      status: morningEvents.length > 0 ? 'completed' : currentHour >= 11 ? 'pending' : 'in_progress',
      statusLabel: morningEvents.length > 0 ? 'Logged' : currentHour >= 11 ? 'Missed log' : 'In progress',
    },
    {
      id: 'afternoon',
      name: 'Afternoon',
      subTitle: 'Lunch & Hydration',
      timeRange: '11 AM – 4 PM',
      icon: '☀️',
      events: afternoonEvents,
      status: afternoonEvents.length > 0 ? 'completed' : currentHour >= 16 ? 'pending' : currentHour >= 11 ? 'in_progress' : 'pending',
      statusLabel: afternoonEvents.length > 0 ? 'Logged' : currentHour >= 16 ? 'Missed log' : currentHour >= 11 ? 'In progress' : 'Upcoming',
    },
    {
      id: 'evening',
      name: 'Evening',
      subTitle: 'Snack & Recovery',
      timeRange: '4 PM – 7 PM',
      icon: '🌇',
      events: eveningEvents,
      status: eveningEvents.length > 0
        ? 'completed'
        : proteinDeficitG > 15 && currentHour >= 16
        ? 'opportunity'
        : currentHour >= 19
        ? 'pending'
        : currentHour >= 16
        ? 'in_progress'
        : 'pending',
      statusLabel: eveningEvents.length > 0
        ? 'Logged'
        : proteinDeficitG > 15 && currentHour >= 16
        ? 'Protein opportunity'
        : currentHour >= 19
        ? 'Skipped'
        : currentHour >= 16
        ? 'In progress'
        : 'Upcoming',
      opportunityNote: proteinDeficitG > 15 ? 'Great window for chana, sprouts, or boiled eggs.' : undefined,
    },
    {
      id: 'night',
      name: 'Night',
      subTitle: 'Dinner & Final Hydration',
      timeRange: '7 PM – 11 PM',
      icon: '🌙',
      events: nightEvents,
      status: nightEvents.length > 0 ? 'completed' : currentHour >= 19 ? 'in_progress' : 'pending',
      statusLabel: nightEvents.length > 0 ? 'Logged' : currentHour >= 19 ? 'Recommended action' : 'Upcoming',
      opportunityNote: currentHour >= 19 && nightEvents.length === 0 ? 'Complete today’s journey with a balanced dinner.' : undefined,
    },
  ];

  const totalJourneyEvents = allEvents.length;

  if (totalJourneyEvents === 0) {
    return (
      <Card className="border border-stone-200/80 bg-white shadow-xs">
        <CardContent className="p-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto text-xl font-bold">
            🌱
          </div>
          <div>
            <h3 className="text-sm font-bold text-stone-900">Today&apos;s Nutrition Journey</h3>
            <p className="text-xs text-stone-500 max-w-xs mx-auto mt-1">
              No meals or hydration logged today yet. As you record meals, your day will build out chronologically.
            </p>
          </div>
          <Link
            href="/scan"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition-colors shadow-2xs"
          >
            <span>Scan First Meal</span>
            <ArrowRightIcon size={12} />
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-stone-200/80 bg-white shadow-xs overflow-hidden">
      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-stone-900">Today&apos;s Nutrition Journey</h2>
            <p className="text-2xs text-stone-500 mt-0.5">
              Chronological progress through morning, afternoon, evening, and night.
            </p>
          </div>
          <Badge variant="stone" className="text-2xs font-semibold px-2 py-0.5">
            {totalJourneyEvents} {totalJourneyEvents === 1 ? 'event' : 'events'} logged
          </Badge>
        </div>

        {/* Journey Timeline */}
        <div className="space-y-4 relative before:absolute before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-stone-100">
          {phases.map((phase) => (
            <div key={phase.id} className="relative pl-9 space-y-2">
              {/* Phase Node Dot */}
              <div
                className={`absolute left-2.5 top-0.5 -translate-x-1/2 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  phase.status === 'completed'
                    ? 'bg-emerald-600 border-white text-white shadow-2xs'
                    : phase.status === 'opportunity'
                    ? 'bg-amber-500 border-white text-white shadow-2xs'
                    : phase.status === 'in_progress'
                    ? 'bg-blue-500 border-white text-white shadow-2xs'
                    : 'bg-stone-200 border-white'
                }`}
                aria-hidden="true"
              >
                {phase.status === 'completed' && <CheckIcon size={10} />}
              </div>

              {/* Phase Header */}
              <div className="flex items-center justify-between flex-wrap gap-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{phase.icon}</span>
                  <span className="text-xs font-bold text-stone-800">{phase.name}</span>
                  <span className="text-3xs text-stone-400 font-medium">({phase.timeRange})</span>
                </div>
                <span
                  className={`text-3xs font-semibold px-1.5 py-0.5 rounded-full ${
                    phase.status === 'completed'
                      ? 'bg-emerald-100 text-emerald-800'
                      : phase.status === 'opportunity'
                      ? 'bg-amber-100 text-amber-900'
                      : phase.status === 'in_progress'
                      ? 'bg-blue-100 text-blue-900'
                      : 'bg-stone-100 text-stone-500'
                  }`}
                >
                  {phase.statusLabel}
                </span>
              </div>

              {/* Opportunity advisory */}
              {phase.opportunityNote && phase.events.length === 0 && (
                <div className="p-2 rounded-xl bg-amber-50/80 border border-amber-200/60 text-2xs text-amber-900">
                  {phase.opportunityNote}
                </div>
              )}

              {/* Events in phase */}
              {phase.events.length > 0 && (
                <div className="space-y-1.5">
                  {phase.events.map((event) => (
                    <div
                      key={event.id}
                      className="p-2.5 rounded-xl border border-stone-100 bg-stone-50/60 hover:bg-stone-50 transition-colors flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        {event.type === 'hydration' ? (
                          <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                            <DropletIcon size={12} />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold text-2xs">
                            🍽️
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-stone-800">{event.title}</span>
                            <span className="text-3xs text-stone-400 font-mono">{event.timeFormatted}</span>
                          </div>
                          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                            {event.calories !== undefined && (
                              <span className="text-3xs text-stone-600 font-medium">
                                {event.calories} kcal
                              </span>
                            )}
                            {event.tags.map((t, idx) => (
                              <span
                                key={idx}
                                className="text-3xs px-1.5 py-0 rounded bg-stone-200/60 text-stone-600 font-medium"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {event.mealId && (
                        <Link
                          href={`/results?id=${event.mealId}`}
                          className="shrink-0 p-1 text-stone-400 hover:text-stone-700 transition-colors"
                          aria-label={`View analysis for ${event.title}`}
                        >
                          <ArrowRightIcon size={14} />
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
