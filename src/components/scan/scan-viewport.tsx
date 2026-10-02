'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ScanStage, DetectedFoodItem } from '../../lib/types';
import { CameraIcon, UploadIcon, RefreshCwIcon, SparklesIcon, AlertCircleIcon } from '../ui/icons';
import { AnalysisRadar } from './analysis-radar';

export type CameraStatus = 'idle' | 'requesting' | 'live' | 'denied' | 'unavailable' | 'error';

export interface ScanViewportProps {
  stage: ScanStage;
  items: DetectedFoodItem[];
  previewUrl?: string | null;
  selectedScenarioTitle?: string;
  selectedScenarioId?: string;
  validationError?: string | null;
  isAnalyzing?: boolean;
  onCapture: (capturedFile?: File) => void;
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraState, setCameraState] = useState<CameraStatus>('idle');
  const [cameraErrorMessage, setCameraErrorMessage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);

  // Stop all camera tracks cleanly
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Request real camera stream via getUserMedia
  const requestCamera = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraState('unavailable');
      setCameraErrorMessage('Camera unavailable on this device.');
      return;
    }

    // Stop existing stream first to avoid multiple streams
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setCameraState('requesting');
    setCameraErrorMessage(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      // Check torch capability
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const trackWithCaps = videoTrack as MediaStreamTrack & {
          getCapabilities?: () => Record<string, unknown>;
        };
        const caps = trackWithCaps.getCapabilities ? trackWithCaps.getCapabilities() : {};
        if (caps && 'torch' in caps && Boolean(caps.torch)) {
          setTorchAvailable(true);
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      setCameraState('live');
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setCameraState('denied');
        setCameraErrorMessage('Camera access was denied.');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setCameraState('unavailable');
        setCameraErrorMessage('Camera unavailable on this device.');
      } else {
        setCameraState('error');
        setCameraErrorMessage(error.message || 'Unable to access camera.');
      }
    }
  }, [facingMode]);

  // Turn off camera tracks when leaving the scanning stage or unmounting
  useEffect(() => {
    if (stage !== 'idle') {
      stopCamera();
    }
  }, [stage, stopCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Snap frame from live video
  const captureFrameFromVideo = (): File | null => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

      // Convert base64 dataUrl to File
      const byteString = atob(dataUrl.split(',')[1]);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: 'image/jpeg' });
      return new File([blob], `scan-${Date.now()}.jpg`, { type: 'image/jpeg' });
    } catch {
      return null;
    }
  };

  const handleShutterCapture = () => {
    if (cameraState === 'live') {
      const capturedFile = captureFrameFromVideo();
      if (capturedFile) {
        stopCamera();
        onCapture(capturedFile);
        return;
      } else {
        setCameraErrorMessage('Could not capture frame from camera stream. Please try again or upload a photo.');
        setCameraState('error');
        return;
      }
    }
    // If camera is not live, prompt user to enable camera
    requestCamera();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      stopCamera();
      setCameraState('idle');
      onUploadFile(e.target.files[0]);
    }
  };

  const handleReset = () => {
    stopCamera();
    setCameraState('idle');
    setCameraErrorMessage(null);
    onReset();
  };

  // Flip camera facing mode
  const flipCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
    if (cameraState === 'live') {
      setTimeout(() => {
        requestCamera();
      }, 50);
    }
  };

  // Toggle torch light
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      try {
        const nextState = !torchOn;
        const trackWithApply = videoTrack as MediaStreamTrack & {
          applyConstraints: (c: unknown) => Promise<void>;
        };
        await trackWithApply.applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setTorchOn(nextState);
      } catch {
        // Torch toggle failed
      }
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
    <div className="card-3d relative w-full max-w-2xl mx-auto rounded-3xl overflow-hidden bg-[#0c130e] border-2 border-emerald-900/60 dark:border-emerald-500/20 shadow-[0_16px_40px_-8px_rgba(4,120,87,0.25)] text-white">
      {/* Top Overlay Bar */}
      <div className="absolute top-0 inset-x-0 p-4 z-20 flex items-center justify-between bg-gradient-to-b from-black/85 via-black/40 to-transparent">
        <div className="flex items-center gap-2.5">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isScanning
                ? 'bg-amber-400 animate-ping'
                : isPreview
                ? 'bg-sky-400 animate-pulse'
                : cameraState === 'live'
                ? 'bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse'
                : 'bg-stone-500'
            }`}
          />
          <span className="text-xs font-bold tracking-wide text-white uppercase flex items-center gap-1.5 font-mono">
            {stage === 'idle'
              ? cameraState === 'live'
                ? 'LIVE CAMERA • AI READY'
                : cameraState === 'requesting'
                ? 'STARTING CAMERA...'
                : 'CAMERA READY'
              : stage === 'preview'
              ? 'PHOTO CAPTURED • PREVIEW'
              : stage === 'analyzing'
              ? 'SCANNING PLATE NUTRITION...'
              : `${items.length} FOOD ITEM${items.length === 1 ? '' : 'S'} DETECTED`}
          </span>
        </div>

        {stage !== 'idle' && (
          <button
            type="button"
            onClick={handleReset}
            disabled={isScanning}
            className="text-xs px-3 py-1 rounded-xl bg-stone-800/90 hover:bg-stone-700 text-stone-200 border border-stone-700 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
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
          className="relative z-30 m-3 p-3 rounded-xl bg-rose-950/90 border border-rose-500/60 text-rose-100 text-xs flex items-center justify-between gap-2 shadow-lg"
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
        {/* Real Live Camera Video Stream */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            cameraState === 'live' && !previewUrl ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        />

        {/* Synthetic Camera Background Grid (when camera is not active and not showing captured image) */}
        {!previewUrl && cameraState !== 'live' && (
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px]" />
        )}

        {/* Captured/Uploaded Image Preview */}
        {previewUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Captured food plate"
              className="w-full h-full object-contain"
            />
          </div>
        )}

        {/* Live Camera Framing Guides & Reticle */}
        {cameraState === 'live' && !previewUrl && (
          <div className="absolute inset-6 sm:inset-10 border border-white/20 rounded-3xl pointer-events-none flex items-center justify-center z-10 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
            {/* AI Scanning Beam */}
            <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-scan-beam" />

            {/* Circular Plate Alignment Guide */}
            <div className="w-52 h-52 sm:w-68 sm:h-68 rounded-full border-2 border-dashed border-emerald-400/80 pointer-events-none flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.25)]">
              <span className="text-3xs tracking-widest text-emerald-300 uppercase font-mono px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-emerald-500/40">
                Center Food Plate
              </span>
            </div>

            {/* Corner Marks with Soft Glow */}
            <div className="absolute -top-1 -left-1 w-6 h-6 border-t-3 border-l-3 border-emerald-400 rounded-tl-xl shadow-[0_0_8px_#34d399]" />
            <div className="absolute -top-1 -right-1 w-6 h-6 border-t-3 border-r-3 border-emerald-400 rounded-tr-xl shadow-[0_0_8px_#34d399]" />
            <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-3 border-l-3 border-emerald-400 rounded-bl-xl shadow-[0_0_8px_#34d399]" />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-3 border-r-3 border-emerald-400 rounded-br-xl shadow-[0_0_8px_#34d399]" />
          </div>
        )}

        {/* Camera Starting / Requesting State */}
        {cameraState === 'requesting' && (
          <div className="z-10 text-center px-6 max-w-sm flex flex-col items-center">
            <RefreshCwIcon className="w-8 h-8 text-emerald-400 animate-spin mb-3" />
            <h3 className="text-base font-bold text-white mb-1">Starting camera...</h3>
            <p className="text-xs text-stone-400">Requesting permission to access device camera</p>
          </div>
        )}

        {/* Camera Permission Denied State */}
        {cameraState === 'denied' && (
          <div className="z-10 text-center px-6 max-w-sm flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mb-3">
              <AlertCircleIcon size={24} />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Camera access was denied.</h3>
            <p className="text-xs text-stone-300 leading-relaxed mb-4">
              Enable camera permission in your browser settings to scan with your camera, or use the file upload below.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={requestCamera}
                className="px-3.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCwIcon size={13} /> Try Again
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Upload Photo
              </button>
            </div>
          </div>
        )}

        {/* Camera Unavailable State */}
        {cameraState === 'unavailable' && (
          <div className="z-10 text-center px-6 max-w-sm flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl bg-stone-800 text-stone-300 flex items-center justify-center mb-3">
              <CameraIcon size={24} />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Camera unavailable on this device.</h3>
            <p className="text-xs text-stone-400 leading-relaxed mb-4">
              No compatible video capture device was detected. You can upload a photo of your meal directly.
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Upload Photo
            </button>
          </div>
        )}

        {/* Camera Error State */}
        {cameraState === 'error' && (
          <div className="z-10 text-center px-6 max-w-sm flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mb-3">
              <AlertCircleIcon size={24} />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Camera Error</h3>
            <p className="text-xs text-stone-300 leading-relaxed mb-4">
              {cameraErrorMessage || 'Unable to access the camera.'}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={requestCamera}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCwIcon size={14} /> Try Again
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                Upload Photo
              </button>
            </div>
          </div>
        )}

        {/* Idle Instructions (When camera has not been requested yet) */}
        {stage === 'idle' && cameraState === 'idle' && !previewUrl && (
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
            <button
              type="button"
              id="enable-camera-btn"
              data-testid="enable-camera-btn"
              onClick={requestCamera}
              className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 mx-auto cursor-pointer"
            >
              <CameraIcon size={16} /> Enable Camera
            </button>
          </div>
        )}

        {/* Image Quality Guidance Overlay in Preview Mode */}
        {isPreview && previewUrl && (
          <div className="absolute bottom-3 inset-x-4 bg-stone-950/80 backdrop-blur-xs text-emerald-300 text-2xs py-1.5 px-3 rounded-xl border border-emerald-500/30 text-center flex items-center justify-center gap-1.5 pointer-events-none z-20">
            <SparklesIcon size={12} className="text-emerald-400" />
            <span>Ensure all meal items are well-lit and fully visible before analyzing</span>
          </div>
        )}

        {/* Visual Bounding Boxes for Detected Items */}
        {showDetections &&
          items.map((item) => {
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
        {/* Sample Meal Quick Switcher (Only in Idle state when camera is idle) */}
        {stage === 'idle' && cameraState !== 'live' && (
          <div>
            <div className="flex items-center justify-between mb-2 text-2xs text-stone-400 uppercase tracking-wider font-semibold">
              <span>Perception Test Scenarios:</span>
              {selectedScenarioTitle && (
                <span className="text-emerald-400 truncate max-w-[200px]">{selectedScenarioTitle}</span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {scenarios.map((sc) => {
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
              onClick={handleReset}
              className="py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-medium text-xs flex items-center justify-center gap-1.5 border border-stone-700 transition-colors cursor-pointer"
            >
              <RefreshCwIcon size={14} />
              <span>Retake Photo</span>
            </button>

            <button
              type="button"
              onClick={onStartAnalysis || handleShutterCapture}
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
            {/* Upload Button Fallback */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isScanning}
              className="flex-1 min-w-[120px] py-2.5 sm:py-3 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-medium text-xs flex items-center justify-center gap-1.5 border border-stone-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              <UploadIcon size={15} />
              <span>Upload Photo</span>
            </button>

            {/* When Camera is Live: Show Flip and Shutter */}
            {cameraState === 'live' ? (
              <>
                <button
                  type="button"
                  onClick={flipCamera}
                  className="py-2.5 sm:py-3 px-3.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-medium text-xs inline-flex items-center justify-center gap-1.5 border border-stone-700 transition-colors cursor-pointer"
                  title="Switch front/back camera"
                >
                  <CameraIcon size={15} />
                  <span>Flip</span>
                </button>

                {torchAvailable && (
                  <button
                    type="button"
                    onClick={toggleTorch}
                    className={`py-2.5 sm:py-3 px-3.5 rounded-xl font-medium text-xs inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      torchOn
                        ? 'bg-amber-400 text-stone-950 font-bold'
                        : 'bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700'
                    }`}
                  >
                    ⚡ {torchOn ? 'Torch On' : 'Torch'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleShutterCapture}
                  disabled={isScanning}
                  className="flex-1 min-w-[140px] py-2.5 sm:py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <CameraIcon size={16} />
                  <span>Capture Plate</span>
                </button>
              </>
            ) : (
              /* When Camera is Idle: Show Take Photo / Enable Camera */
              <>
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

                <button
                  type="button"
                  onClick={requestCamera}
                  disabled={isScanning || cameraState === 'requesting'}
                  className="flex-1 min-w-[140px] py-2.5 sm:py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <CameraIcon size={16} />
                  <span>{cameraState === 'requesting' ? 'Starting...' : 'Enable Camera'}</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
