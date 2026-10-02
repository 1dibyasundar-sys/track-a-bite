'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../auth/AuthProvider';
import { HomeIcon, HistoryIcon, CameraIcon, BarChartIcon, UserIcon } from '../ui/icons';
import { cn } from '../../lib/utils';

export function MobileBottomNav() {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();

  // Navigation must respect authentication state. Unauthenticated users should never receive authenticated navigation.
  if (!isAuthenticated) {
    return null;
  }

  // Active check helper
  const isHomeActive = pathname === '/dashboard' || pathname === '/';
  const isHistoryActive = pathname === '/history' && !pathname.includes('analytics');
  const isScanActive = pathname === '/scan';
  const isAnalyticsActive = pathname === '/reports' || (pathname.startsWith('/history') && typeof window !== 'undefined' && window.location.search.includes('analytics'));
  const isProfileActive = pathname === '/profile';

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#0c130e]/95 backdrop-blur-md border-t border-stone-200/90 dark:border-[#23382b] shadow-lg md:hidden transition-all duration-200"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around h-16 px-2 max-w-md mx-auto relative">
        {/* 1. Home */}
        <Link
          href="/dashboard"
          className={cn(
            'flex flex-col items-center justify-center flex-1 py-1 min-h-[48px] min-w-[48px] rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700',
            isHomeActive
              ? 'text-emerald-800 dark:text-emerald-400 font-bold'
              : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 font-medium'
          )}
          aria-label="Dashboard Home"
          aria-current={isHomeActive ? 'page' : undefined}
        >
          <HomeIcon
            size={20}
            className={isHomeActive ? 'text-emerald-700 dark:text-emerald-400 stroke-[2.5]' : 'text-stone-500 dark:text-stone-400'}
          />
          <span className="text-3xs tracking-tight mt-1">Home</span>
        </Link>

        {/* 2. History */}
        <Link
          href="/history"
          className={cn(
            'flex flex-col items-center justify-center flex-1 py-1 min-h-[48px] min-w-[48px] rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700',
            isHistoryActive
              ? 'text-emerald-800 dark:text-emerald-400 font-bold'
              : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 font-medium'
          )}
          aria-label="Meal History"
          aria-current={isHistoryActive ? 'page' : undefined}
        >
          <HistoryIcon
            size={20}
            className={isHistoryActive ? 'text-emerald-700 dark:text-emerald-400 stroke-[2.5]' : 'text-stone-500 dark:text-stone-400'}
          />
          <span className="text-3xs tracking-tight mt-1">History</span>
        </Link>

        {/* 3. Center Elevated Scan Button */}
        <div className="flex flex-col items-center justify-center flex-1 relative -top-3">
          <Link
            href="/scan"
            className={cn(
              'w-13 h-13 rounded-full flex flex-col items-center justify-center shadow-lg transition-all transform active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
              isScanActive
                ? 'bg-emerald-700 text-white ring-4 ring-emerald-100 dark:ring-emerald-950 shadow-emerald-900/30'
                : 'bg-emerald-800 dark:bg-emerald-600 hover:bg-emerald-900 dark:hover:bg-emerald-500 text-white shadow-emerald-950/20'
            )}
            aria-label="Scan Food"
            aria-current={isScanActive ? 'page' : undefined}
          >
            <CameraIcon size={24} className="text-white" />
          </Link>
          <span className="text-3xs font-bold tracking-tight text-emerald-900 dark:text-emerald-300 mt-1">Scan</span>
        </div>

        {/* 4. Analytics */}
        <Link
          href="/reports"
          className={cn(
            'flex flex-col items-center justify-center flex-1 py-1 min-h-[48px] min-w-[48px] rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700',
            isAnalyticsActive
              ? 'text-emerald-800 dark:text-emerald-400 font-bold'
              : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 font-medium'
          )}
          aria-label="Nutrition Analytics"
          aria-current={isAnalyticsActive ? 'page' : undefined}
        >
          <BarChartIcon
            size={20}
            className={isAnalyticsActive ? 'text-emerald-700 dark:text-emerald-400 stroke-[2.5]' : 'text-stone-500 dark:text-stone-400'}
          />
          <span className="text-3xs tracking-tight mt-1">Analytics</span>
        </Link>

        {/* 5. Profile */}
        <Link
          href="/profile"
          className={cn(
            'flex flex-col items-center justify-center flex-1 py-1 min-h-[48px] min-w-[48px] rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700',
            isProfileActive
              ? 'text-emerald-800 dark:text-emerald-400 font-bold'
              : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 font-medium'
          )}
          aria-label="User Profile"
          aria-current={isProfileActive ? 'page' : undefined}
        >
          <UserIcon
            size={20}
            className={isProfileActive ? 'text-emerald-700 dark:text-emerald-400 stroke-[2.5]' : 'text-stone-500 dark:text-stone-400'}
          />
          <span className="text-3xs tracking-tight mt-1">Profile</span>
        </Link>
      </div>
    </nav>
  );
}
