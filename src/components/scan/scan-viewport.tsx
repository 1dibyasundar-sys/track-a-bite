'use client';

import React, { useRef } from 'react';
import { ScanStage, DetectedFoodItem } from '../../lib/types';
import { CameraIcon, UploadIcon, RefreshCwIcon, SparklesIcon, AlertCircleIcon } from '../ui/icons';
import { AnalysisRadar } from './analysis-radar';

export interface ScanViewportProps {
  stage: ScanStage;
  items: DetectedFoodItem[];
  previewUrl?: string | null;
  selectedScenarioTitle?: string;
  selectedScenarioId?: string;
  validationError?: string | null;
  isAnalyzing?: boolean;
  onCapture: () => void;
  onStartAnalysis?: () => void;
  onUploadFile: (file: File) => void;
  onAnalysisComplete: () => void;
  onReset: () => void;
  onSelectSample: (scenarioId: string) => void;
  onClearValidationError?: () => void;
}

export function ScanViewport({
  stage,
  items,
  previewUrl,
  selectedScenarioTitle,
  selectedScenarioId,
  validationError,
  isAnalyzing = false,
  onCapture,
  onStartAnalysis,
  onUploadFile,
  onAnalysisComplete,
  onReset,
  onSelectSample,
  onClearValidationError,
}: ScanViewportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUploadFile(e.target.files[0]);
    }
  };

  const isScanning = stage === 'analyzing';
  const isPreview = stage === 'preview';
  const showDetections = stage === 'detected' || stage === 'reviewing' || stage === 'completed';

  const scenarios = [
    { id: 'multi-thali-4food', label: '🍱 Hostel Thali', desc: 'Rice + Dal + Sabzi + Pickle' },
    { id: 'thali-multi-compartment', label: '🍱 Thali (2 Curries + Papad)', desc: '2 Curry Compartments Grouped' },
    { id: 'pakhala-bhata-thali', label: '🥣 Pakhala Thali', desc: 'Fermented Water Rice + Dalma + Papad' },
    { id: 'regional-chakuli-dalma', label: '🥞 Chakuli + Dalma', desc: 'Odia Crepe & Lentil Stew' },
    { id: 'thali-with-salad', label: '🥗 Thali + Salad', desc: 'Rice + Dal + Sabzi + Salad' },
    { id: 'kachori-chutney', label: '🥟 Kachori + Chutney', desc: 'Khasta kachori & chutney' },
    { id: 'hostel-maggi-egg', label: '🍜 Maggi + Egg', desc: 'Hostel combo' },
    { id: 'sprouts-chaat', label: '🌱 Sprouts Chaat', desc: '1 bowl (~180g)' },
    { id: 'chips-juice', label: '🍟 Chips + Juice', desc: 'Packaged snacks' },
    { id: 'low-confidence-curry', label: '⚠️ Low Confidence', desc: 'Please confirm' },
    { id: 'empty-plate-no-food', label: '❌ Empty Plate', desc: 'No food detected' },
  ];

  return (
    <div className="relative w-full max-w-2xl mx-auto rounded-3xl overflow-hidden bg-stone-900 border-2 border-stone-800 shadow-lg text-white">
      {/* Top Overlay Bar */}
      <div className="absolute top-0 inset-x-0 p-4 z-10 flex items-center justify-between bg-gradient-to-b from-stone-950/80 to-transparent">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isScanning
                ? 'bg-amber-400 animate-ping'
                : isPreview
                ? 'bg-sky-400 animate-pulse'
                : 'bg-emerald-500 animate-pulse'
            }`}
          />
          <span className="text-xs font-semibold tracking-wide text-white uppercase">
            {stage === 'idle'
              ? 'Ready to Scan'
              : stage === 'preview'
              ? 'Photo Captured • Preview'
              : stage === 'analyzing'
              ? 'Identifying Food...'
              : `${items.length} Food Item${items.length === 1 ? '' : 's'} Detected`}
          </span>
        </div>

        {stage !== 'idle' && (
          <button
            type="button"
            onClick={onReset}
            disabled={isScanning}
            className="text-xs px-2.5 py-1 rounded-lg bg-stone-800/80 hover:bg-stone-700 text-stone-200 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCwIcon size={12} />
            <span>New Scan</span>
          </button>
        )}
      </div>

      {/* Validation Error Alert Banner */}
      {validationError && (
        <div
          role="alert"
          className="relative z-20 m-3 p-3 rounded-xl bg-rose-950/90 border border-rose-500/60 text-rose-100 text-xs flex items-center justify-between gap-2 shadow-lg"
        >
          <div className="flex items-center gap-2">
            <AlertCircleIcon size={16} className="text-rose-400 shrink-0" />
            <span>{validationError}</span>
          </div>
          {onClearValidationError && (
            <button
              type="button"
              onClick={onClearValidationError}
              className="text-rose-300 hover:text-white font-bold px-2 py-0.5"
              aria-label="Dismiss error"
            >
              &times;
            </button>
          )}
        </div>
      )}

      {/* Main Viewport Window */}
      <div className="relative w-full aspect-4/3 sm:aspect-16/10 bg-stone-950 flex items-center justify-center overflow-hidden">
        {/* Synthetic Camera Background Grid (Only when not showing captured image) */}
        {!previewUrl && (
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px]" />
        )}

        {/* Captured/Uploaded Image Preview */}
        {previewUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Captured food plate"
              className="w-full h-full object-contain"
            />
          </div>
        )}

        {/* Framing Guides (Shown in idle and preview) */}
        {!isScanning && !showDetections && !previewUrl && (
          <div className="absolute inset-8 sm:inset-12 border border-white/20 rounded-2xl pointer-events-none flex items-center justify-center">
            {/* Circular Plate Alignment Guide */}
            <div className="w-48 h-48 sm:w-64 sm:h-64 rounded-full border border-dashed border-emerald-400/40 pointer-events-none flex items-center justify-center">
              <span className="text-3xs tracking-widest text-emerald-300/40 uppercase font-mono">
                Center Food Plate
              </span>
            </div>

            {/* Corner Marks */}
            <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-emerald-400" />
            <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-emerald-400" />
            <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-emerald-400" />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-emerald-400" />
          </div>
        )}

        {/* Image Quality Guidance Overlay in Preview Mode */}
        {isPreview && previewUrl && (
          <div className="absolute bottom-3 inset-x-4 bg-stone-950/80 backdrop-blur-xs text-emerald-300 text-2xs py-1.5 px-3 rounded-xl border border-emerald-500/30 text-center flex items-center justify-center gap-1.5 pointer-events-none z-10">
            <SparklesIcon size={12} className="text-emerald-400" />
            <span>Ensure all meal items are well-lit and fully visible before analyzing</span>
          </div>
        )}

        {/* Idle Instructions */}
        {stage === 'idle' && (
          <div className="z-10 text-center px-6 max-w-sm">
            <div className="w-14 h-14 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto mb-3 shadow-lg">
              <CameraIcon size={26} />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white mb-1">
              Point camera at your meal or snack
            </h3>
            <p className="text-xs text-stone-400 leading-relaxed mb-4">
              Center your thali, bowl, or snack. Supports single snacks, multi-dish plates, and packaged canteen foods.
            </p>
          </div>
        )}

        {/* Visual Bounding Boxes for Detected Items */}
        {showDetections &&
          items.map(item => {
            if (!item.boundingBox) return null;
            const { x, y, width, height } = item.boundingBox;
            const confPct = Math.round(item.confidence * 100);
            return (
              <div
                key={item.detectionId}
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  width: `${width}%`,
                  height: `${height}%`,
                }}
                className="absolute border-2 border-emerald-400 bg-emerald-500/15 rounded-xl z-10 transition-all pointer-events-none flex flex-col justify-between p-1.5"
              >
                <div className="flex items-center gap-1 self-start bg-emerald-950/90 text-emerald-300 text-3xs font-bold px-1.5 py-0.5 rounded shadow-xs border border-emerald-700/60">
                  <span>{item.name}</span>
                  <span className="text-emerald-400">({confPct}%)</span>
                </div>
                <span className="self-end text-3xs text-white/90 bg-stone-900/80 px-1 py-0.5 rounded font-mono">
                  ~{item.estimatedGrams}g
                </span>
              </div>
            );
          })}

        {/* Analyzing Overlay Radar with Staged Progress */}
        {isScanning && <AnalysisRadar onComplete={onAnalysisComplete} />}
      </div>

      {/* Bottom Control Bar */}
      <div className="p-4 sm:p-5 bg-stone-900 border-t border-stone-800 space-y-4">
        {/* Sample Meal Quick Switcher (Only in Idle state) */}
        {stage === 'idle' && (
          <div>
            <div className="flex items-center justify-between mb-2 text-2xs text-stone-400 uppercase tracking-wider font-semibold">
              <span>Perception Test Scenarios:</span>
              {selectedScenarioTitle && (
                <span className="text-emerald-400 truncate max-w-[200px]">{selectedScenarioTitle}</span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {scenarios.map(sc => {
                const isSelected = selectedScenarioId === sc.id;
                return (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => onSelectSample(sc.id)}
                    className={`py-2 px-2 rounded-lg text-2xs font-medium text-center border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-900/50 border-emerald-500 text-emerald-200'
                        : 'bg-stone-800 hover:bg-stone-700 text-stone-200 border-stone-700 hover:border-emerald-500'
                    }`}
                    title={sc.desc}
                  >
                    <span className="block truncate">{sc.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Hidden Inputs for File Upload & Camera Capture */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          aria-label="Upload food photo"
          onChange={handleFileChange}
        />

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          aria-label="Take food photo using camera"
          onChange={handleFileChange}
        />

        {/* Action Controls for PREVIEW STAGE */}
        {isPreview ? (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={onReset}
              className="py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-medium text-xs flex items-center justify-center gap-1.5 border border-stone-700 transition-colors cursor-pointer"
            >
              <RefreshCwIcon size={14} />
              <span>Retake Photo</span>
            </button>

            <button
              type="button"
              onClick={onStartAnalysis || onCapture}
              disabled={isAnalyzing}
              className="flex-1 min-w-[160px] py-2.5 sm:py-3 px-5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <SparklesIcon size={16} />
              <span>{isAnalyzing ? 'Analyzing...' : 'Analyze Meal'}</span>
            </button>
          </div>
        ) : (
          /* Action Controls for IDLE / DETECTED STAGES */
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
            {/* Upload Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isScanning}
              className="flex-1 min-w-[120px] py-2.5 sm:py-3 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-medium text-xs flex items-center justify-center gap-1.5 border border-stone-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              <UploadIcon size={15} />
              <span>Upload Photo</span>
            </button>

            {/* Mobile / Native Camera Shutter Trigger */}
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={isScanning}
              className="flex-1 min-w-[110px] py-2.5 sm:py-3 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-medium text-xs inline-flex items-center justify-center gap-1.5 border border-stone-700 transition-colors cursor-pointer disabled:opacity-50"
              title="Take food photo using device camera"
            >
              <CameraIcon size={15} />
              <span>Take Photo</span>
            </button>

            {/* Shutter / Capture Scenario Button */}
            <button
              type="button"
              onClick={onCapture}
              disabled={isScanning}
              className="flex-1 min-w-[140px] py-2.5 sm:py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <CameraIcon size={16} />
              <span>{stage === 'idle' ? 'Capture Plate' : 'Re-scan'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
