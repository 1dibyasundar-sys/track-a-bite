import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full text-center space-y-6 bg-white p-8 rounded-3xl border border-stone-200/80 shadow-xs">
        <div className="w-16 h-16 bg-emerald-50 text-emerald-800 rounded-2xl flex items-center justify-center mx-auto text-2xl font-bold shadow-xs">
          🍛
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full">
            404 — Page Not Found
          </span>
          <h1 className="text-2xl font-bold text-stone-900 mt-2">No food on this plate</h1>
          <p className="text-sm text-stone-600 leading-relaxed">
            The page you are looking for doesn&apos;t exist or might have been moved. Let&apos;s get you back to tracking your everyday meals.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/scan"
            className="px-5 py-2.5 rounded-xl bg-emerald-800 text-white text-sm font-semibold hover:bg-emerald-900 transition-colors shadow-xs cursor-pointer inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
          >
            Scan Food
          </Link>
          <Link
            href="/"
            className="px-5 py-2.5 rounded-xl bg-stone-100 text-stone-700 text-sm font-semibold hover:bg-stone-200 transition-colors cursor-pointer inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
          >
            Go to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
