'use client';

import React, { useEffect, useState } from 'react';
import { SparklesIcon } from '../ui/icons';

export interface AnalysisRadarProps {
  onComplete?: () => void;
  durationMs?: number;
}

export function AnalysisRadar({ onComplete, durationMs = 1800 }: AnalysisRadarProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    'Preparing image...',
    'Detecting foods...',
    'Estimating portions...',
    'Calculating nutrition...',
    'Personalizing recommendations...',
  ];

  useEffect(() => {
    const stepInterval = durationMs / steps.length;
    const interval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev < steps.length - 1) {
          return prev + 1;
        }
        clearInterval(interval);
        return prev;
      });
    }, stepInterval);

    const timeout = setTimeout(() => {
      onComplete?.();
    }, durationMs);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [durationMs, onComplete, steps.length]);

  return (
    <div className="absolute inset-0 bg-stone-950/75 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-white text-center z-20 animate-in fade-in duration-200">
      {/* Visual scanning circle */}
      <div className="relative w-28 h-28 sm:w-32 sm:h-32 mb-6">
        <div className="absolute inset-0 rounded-full border-2 border-emerald-500/30 animate-ping" />
        <div className="absolute inset-2 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-emerald-600/50 flex items-center justify-center text-emerald-300">
            <SparklesIcon size={24} />
          </div>
        </div>
      </div>

      <h3 className="text-base sm:text-lg font-bold tracking-tight text-white mb-2">
        Analyzing Plate Composition
      </h3>

      <p className="text-xs sm:text-sm text-emerald-300 font-medium h-6 transition-all duration-300">
        {steps[currentStep]}
      </p>

      {/* Progress Dots */}
      <div className="flex items-center gap-2 mt-4">
        {steps.map((_, idx) => (
          <span
            key={idx}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              idx <= currentStep ? 'bg-emerald-400 scale-110' : 'bg-stone-600'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
