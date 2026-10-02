'use client';

import React from 'react';
import { Badge } from '../ui/badge';

interface CloudSyncStatusProps {
  dataSource?: 'cloud' | 'local' | 'mixed';
  isAuthenticated?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function CloudSyncStatus({
  dataSource = 'local',
  isAuthenticated = false,
  onRefresh,
  isRefreshing = false,
}: CloudSyncStatusProps) {
  return (
    <div className="flex items-center justify-between py-2 px-3.5 rounded-2xl bg-stone-100/70 border border-stone-200/60 text-2xs text-stone-600">
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${
            dataSource === 'cloud'
              ? 'bg-emerald-500 animate-pulse'
              : dataSource === 'mixed'
              ? 'bg-amber-500'
              : 'bg-stone-400'
          }`}
          aria-hidden="true"
        />
        <span>
          {dataSource === 'cloud'
            ? 'Cloud Synchronized'
            : dataSource === 'mixed'
            ? 'Local & Cloud Synced'
            : isAuthenticated
            ? 'Local Cache Mode'
            : 'Guest Mode (Local Storage)'}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="text-stone-500 hover:text-stone-800 font-semibold cursor-pointer disabled:opacity-50"
            aria-label="Refresh dashboard data"
          >
            {isRefreshing ? 'Refreshing...' : '↻ Refresh'}
          </button>
        )}
        <Badge
          variant={dataSource === 'cloud' ? 'emerald' : 'stone'}
          className="text-3xs px-1.5 py-0 font-medium"
        >
          {dataSource === 'cloud' ? 'Firestore Live' : 'Offline Ready'}
        </Badge>
      </div>
    </div>
  );
}
