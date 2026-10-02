'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { SmartNudge } from '../../lib/types/analytics';
import { ArrowRightIcon } from '../ui/icons';

interface SmartNudgesCardProps {
  nudges: SmartNudge[];
  onActionClick?: (nudge: SmartNudge) => void;
}

export function SmartNudgesCard({ nudges = [], onActionClick }: SmartNudgesCardProps) {
  if (nudges.length === 0) {
    return null;
  }

  const getPriorityBadgeVariant = (priority: SmartNudge['priority']): 'rose' | 'amber' | 'emerald' => {
    switch (priority) {
      case 'HIGH':
        return 'rose';
      case 'MEDIUM':
        return 'amber';
      case 'LOW':
      default:
        return 'emerald';
    }
  };

  const getCategoryIcon = (category: SmartNudge['category']) => {
    switch (category) {
      case 'hydration':
        return '💧';
      case 'protein':
        return '🥩';
      case 'meal':
        return '🍽️';
      case 'micronutrient':
        return '🥬';
      case 'consistency':
        return '🔥';
      default:
        return '💡';
    }
  };

  return (
    <Card className="border border-stone-200/80 bg-white shadow-xs overflow-hidden">
      <CardContent className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">🔔</span>
            <h2 className="text-sm font-semibold text-stone-900">Today&apos;s Smart Nudges</h2>
          </div>
          <span className="text-3xs font-medium text-stone-500 uppercase tracking-wider">
            Prioritized Updates
          </span>
        </div>

        <div className="space-y-2.5">
          {nudges.map(nudge => (
            <div
              key={nudge.id}
              className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                nudge.priority === 'HIGH'
                  ? 'bg-rose-50/40 border-rose-200/80'
                  : nudge.priority === 'MEDIUM'
                  ? 'bg-amber-50/40 border-amber-200/80'
                  : 'bg-stone-50 border-stone-200/70'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span className="text-lg shrink-0 mt-0.5" aria-hidden="true">
                  {getCategoryIcon(nudge.category)}
                </span>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-semibold text-stone-900">{nudge.title}</span>
                    <Badge
                      variant={getPriorityBadgeVariant(nudge.priority)}
                      className="text-3xs uppercase font-bold px-1.5 py-0"
                    >
                      {nudge.priority}
                    </Badge>
                  </div>
                  <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">{nudge.message}</p>
                </div>
              </div>

              {nudge.actionLabel && (
                <div className="shrink-0 self-end sm:self-center">
                  {nudge.actionHref ? (
                    <Link
                      href={nudge.actionHref}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition-colors shadow-2xs"
                    >
                      <span>{nudge.actionLabel}</span>
                      <ArrowRightIcon size={12} />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onActionClick?.(nudge)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-2xs"
                    >
                      <span>{nudge.actionLabel}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
