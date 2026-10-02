import React from 'react';

export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading page content"
      className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-16"
    >
      <div className="relative flex items-center justify-center mb-4">
        {/* Outer pulsing ring */}
        <div className="w-14 h-14 rounded-full bg-emerald-100/60 animate-ping absolute inset-0" />
        {/* Inner branded spinner */}
        <div className="w-12 h-12 rounded-full border-3 border-stone-200 border-t-emerald-700 animate-spin relative z-10" />
      </div>
      <p className="text-sm font-semibold text-stone-700 tracking-tight">
        Loading Track-a-Bite...
      </p>
      <p className="text-xs text-stone-400 mt-1">
        Preparing your regional nutrition intelligence
      </p>
    </div>
  );
}
