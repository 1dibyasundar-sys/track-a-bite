'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CameraIcon, AlertCircleIcon, RefreshCwIcon } from '../ui/icons';

interface BarcodeScannerViewportProps {
  onBarcodeDetected: (barcode: string, format?: string) => void;
  isProcessing?: boolean;
}

interface NativeBarcodeItem {
  rawValue: string;
  format: string;
}

interface NativeBarcodeDetectorInstance {
  detect(source: HTMLVideoElement | HTMLImageElement): Promise<NativeBarcodeItem[]>;
}

interface NativeBarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): NativeBarcodeDetectorInstance;
}

interface ZXingReaderInstance {
  reset: () => void;
  decodeFromVideoElement: (
    video: HTMLVideoElement,
    cb: (result: { getText: () => string; getBarcodeFormat: () => { toString: () => string } } | undefined) => void
  ) => void;
  decodeFromImageUrl: (url: string) => Promise<{ getText: () => string; getBarcodeFormat: () => { toString: () => string } }>;
}

export const SAMPLE_BARCODES = [
  { label: 'Parle-G Biscuits', barcode: '8901719101039' },
  { label: 'Maggi 2-Minute Noodles', barcode: '8901058852331' },
  { label: 'Amul Taaza Milk', barcode: '8901262010054' },
  { label: 'Haldiram Bhujia', barcode: '8904004400588' },
];

export function BarcodeScannerViewport({
  onBarcodeDetected,
  isProcessing = false,
}: BarcodeScannerViewportProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningLoopRef = useRef<number | null>(null);
  const zxingReaderRef = useRef<ZXingReaderInstance | null>(null);

  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualInputOpen, setManualInputOpen] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [detectedFormat, setDetectedFormat] = useState<string | null>(null);

  // Stop camera tracks cleanly
  const stopCamera = useCallback(() => {
    if (scanningLoopRef.current) {
      cancelAnimationFrame(scanningLoopRef.current);
      scanningLoopRef.current = null;
    }
    if (zxingReaderRef.current) {
      try {
        zxingReaderRef.current.reset();
      } catch {
        // ignore
      }
      zxingReaderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Handle successful detection
  const handleDetected = useCallback(
    (code: string, format?: string) => {
      const clean = code.trim();
      if (!clean || isProcessing) return;

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(100);
        } catch {
          // ignore
        }
      }

      setDetectedFormat(format || 'BARCODE');
      onBarcodeDetected(clean, format);
    },
    [isProcessing, onBarcodeDetected]
  );

  // Start camera stream asynchronously
  const startCamera = useCallback(async () => {
    stopCamera();

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setHasCamera(false);
      setCameraError('Camera API is not supported by your browser or environment.');
      return;
    }

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
      setCameraError(null);
      setHasCamera(true);

      // Check torch capability
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const trackWithCaps = videoTrack as MediaStreamTrack & {
          getCapabilities?: () => Record<string, unknown>;
        };
        const capabilities = trackWithCaps.getCapabilities ? trackWithCaps.getCapabilities() : {};
        if (capabilities && 'torch' in capabilities && Boolean(capabilities.torch)) {
          setTorchAvailable(true);
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      // Check if native BarcodeDetector is available
      const hasNativeDetector =
        typeof window !== 'undefined' && 'BarcodeDetector' in window;

      if (hasNativeDetector) {
        try {
          const detectorCtor = (window as unknown as { BarcodeDetector: NativeBarcodeDetectorConstructor })
            .BarcodeDetector;
          const barcodeDetector = new detectorCtor({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
          });

          const scanFrame = async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) {
              scanningLoopRef.current = requestAnimationFrame(scanFrame);
              return;
            }

            try {
              const barcodes = await barcodeDetector.detect(videoRef.current);
              if (barcodes && barcodes.length > 0) {
                const detected = barcodes[0];
                handleDetected(detected.rawValue, detected.format);
                return;
              }
            } catch {
              // Frame dropped or not ready, continue
            }

            scanningLoopRef.current = requestAnimationFrame(scanFrame);
          };

          scanningLoopRef.current = requestAnimationFrame(scanFrame);
          return;
        } catch {
          // Native detector init failed, fallback to ZXing
        }
      }

      // Fallback to ZXing BrowserMultiFormatReader
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const codeReader = new BrowserMultiFormatReader() as unknown as ZXingReaderInstance;
        zxingReaderRef.current = codeReader;

        if (videoRef.current) {
          codeReader.decodeFromVideoElement(videoRef.current, (result) => {
            if (result) {
              handleDetected(result.getText(), result.getBarcodeFormat().toString());
            }
          });
        }
      } catch (err: unknown) {
        console.warn('Barcode scanner fallback warning:', err);
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Camera access error:', error);
      setHasCamera(false);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setCameraError('Camera access was denied. Please allow camera permissions in your browser settings.');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setCameraError('No camera found on this device. You can enter the barcode manually.');
      } else {
        setCameraError(error.message || 'Unable to access camera.');
      }
    }
  }, [facingMode, handleDetected, stopCamera]);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      if (isMounted) {
        await startCamera();
      }
    };
    init();
    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [startCamera, stopCamera]);

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

  // Flip camera
  const flipCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Handle image file upload for barcode decoding
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.src = objectUrl;

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      // Try native BarcodeDetector first
      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        try {
          const detectorCtor = (window as unknown as { BarcodeDetector: NativeBarcodeDetectorConstructor })
            .BarcodeDetector;
          const barcodeDetector = new detectorCtor({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
          });
          const barcodes = await barcodeDetector.detect(img);
          if (barcodes && barcodes.length > 0) {
            URL.revokeObjectURL(objectUrl);
            handleDetected(barcodes[0].rawValue, barcodes[0].format);
            return;
          }
        } catch {
          // Native decode failed, try ZXing
        }
      }

      // Try ZXing
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader() as unknown as ZXingReaderInstance;
      const result = await reader.decodeFromImageUrl(objectUrl);
      URL.revokeObjectURL(objectUrl);

      if (result) {
        handleDetected(result.getText(), result.getBarcodeFormat().toString());
      } else {
        alert('No barcode detected in this image. Please try another photo or enter manually.');
      }
    } catch {
      alert('Could not detect a barcode from this image. Please enter the barcode number manually.');
    }
  };

  return (
    <div className="relative w-full rounded-3xl overflow-hidden bg-stone-950 border border-stone-800 shadow-xl">
      {/* Video Viewport */}
      <div className="relative aspect-[4/3] sm:aspect-video w-full flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="w-full h-full object-cover"
        />

        {/* Viewfinder Reticle Overlay */}
        {hasCamera && !cameraError && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
            {/* Darkened backdrop with transparent cutout */}
            <div className="relative w-64 h-36 sm:w-80 sm:h-44 border-2 border-emerald-400/90 rounded-2xl shadow-[0_0_25px_rgba(16,185,129,0.3)] flex items-center justify-center overflow-hidden">
              {/* Corner Accents */}
              <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

              {/* Animated Laser Scanning Line */}
              <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-bounce opacity-85 shadow-[0_0_8px_#34d399]" />

              <span className="text-2xs font-semibold text-emerald-200/90 tracking-wider uppercase px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-500/30">
                {detectedFormat ? `Format: ${detectedFormat}` : 'Point at Barcode'}
              </span>
            </div>

            <p className="mt-4 text-xs font-medium text-stone-300 drop-shadow-md text-center max-w-xs">
              Supports EAN-13, EAN-8, UPC-A, UPC-E &amp; Code 128
            </p>
          </div>
        )}

        {/* Processing State Overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-stone-950/75 backdrop-blur-xs flex flex-col items-center justify-center p-4 z-20">
            <RefreshCwIcon className="w-8 h-8 text-emerald-400 animate-spin mb-3" />
            <span className="text-sm font-bold text-white tracking-wide">
              Looking up product...
            </span>
            <span className="text-xs text-stone-400 mt-1">
              Querying verified food packaging database
            </span>
          </div>
        )}

        {/* Error / No Camera Fallback Overlay */}
        {cameraError && (
          <div className="absolute inset-0 bg-stone-900/95 flex flex-col items-center justify-center p-6 text-center z-10">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3">
              <AlertCircleIcon size={24} />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Camera Unavailable</h3>
            <p className="text-xs text-stone-400 max-w-sm mb-4 leading-relaxed">
              {cameraError}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={startCamera}
                className="px-3.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCwIcon size={14} /> Retry Camera
              </button>
              <button
                type="button"
                onClick={() => setManualInputOpen(true)}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Enter Barcode Manually
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="p-3 sm:p-4 bg-stone-900/90 border-t border-stone-800 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          {torchAvailable && (
            <button
              type="button"
              onClick={toggleTorch}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                torchOn
                  ? 'bg-amber-400 text-stone-950 font-bold'
                  : 'bg-stone-800 hover:bg-stone-700 text-stone-300'
              }`}
            >
              ⚡ {torchOn ? 'Torch On' : 'Torch'}
            </button>
          )}

          <button
            type="button"
            onClick={flipCamera}
            className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Switch front/back camera"
          >
            <CameraIcon size={14} /> Flip
          </button>

          {/* Upload image fallback */}
          <label className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer">
            📁 Upload Photo
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
        </div>

        <button
          type="button"
          onClick={() => setManualInputOpen(true)}
          className="px-3 py-1.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-bold transition-colors ml-auto cursor-pointer"
        >
          ⌨️ Enter Barcode Manually
        </button>
      </div>

      {/* Manual Barcode Input Modal */}
      {manualInputOpen && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-md w-full p-6 text-stone-100 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>🔳</span> Enter Product Barcode
              </h3>
              <button
                type="button"
                onClick={() => setManualInputOpen(false)}
                className="text-stone-400 hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-stone-400 leading-relaxed">
              Type the 8, 12, or 13-digit EAN/UPC number printed under the barcode on your packaged food item.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (manualBarcode.trim()) {
                  setManualInputOpen(false);
                  handleDetected(manualBarcode.trim(), 'MANUAL');
                }
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-2xs font-semibold text-stone-400 uppercase tracking-wider block mb-1">
                  Barcode Number (GTIN / EAN / UPC)
                </label>
                <input
                  type="text"
                  pattern="[0-9A-Za-z\-]+"
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  placeholder="e.g. 8901058852331"
                  autoFocus
                  className="w-full px-4 py-2.5 rounded-xl bg-stone-950 border border-stone-700 text-white font-mono text-sm tracking-wider focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Sample Quick Pick Buttons */}
              <div className="space-y-1.5 pt-1">
                <span className="text-2xs font-medium text-stone-400 block">
                  Or test with common Indian packaged foods:
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {SAMPLE_BARCODES.map((item) => (
                    <button
                      key={item.barcode}
                      type="button"
                      onClick={() => {
                        setManualBarcode(item.barcode);
                        setManualInputOpen(false);
                        handleDetected(item.barcode, 'SAMPLE');
                      }}
                      className="px-2.5 py-1.5 text-left rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-2xs text-stone-200 transition-colors"
                    >
                      <span className="font-semibold block truncate">{item.label}</span>
                      <span className="font-mono text-stone-400 text-3xs">{item.barcode}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setManualInputOpen(false)}
                  className="px-4 py-2 rounded-xl text-stone-400 hover:text-white text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!manualBarcode.trim()}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Look Up Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
