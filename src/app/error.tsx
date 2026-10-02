'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { diagnosticLogger } from '../lib/services/diagnosticLogger';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error securely through centralized diagnostics
    diagnosticLogger.error('REACT_ERROR', error.message || 'An unexpected client error occurred', error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full text-center space-y-6 bg-white p-8 rounded-3xl border border-stone-200/80 shadow-xs">
        <div className="w-16 h-16 bg-amber-50 text-amber-700 rounded-2xl flex items-center justify-center mx-auto text-2xl font-bold shadow-xs">
          ⚠️
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-stone-900">Something went wrong</h1>
          <p className="text-sm text-stone-600 leading-relaxed">
            We encountered a temporary issue while loading this page. Your saved meals and profile data remain completely safe.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="px-5 py-2.5 rounded-xl bg-emerald-800 text-white text-sm font-semibold hover:bg-emerald-900 transition-colors shadow-xs cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="px-5 py-2.5 rounded-xl bg-stone-100 text-stone-700 text-sm font-semibold hover:bg-stone-200 transition-colors cursor-pointer inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
