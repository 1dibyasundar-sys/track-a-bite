'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CameraIcon, AlertCircleIcon, RefreshCwIcon, CheckIcon } from '../ui/icons';
import {
  MultiFormatReader,
  DecodeHintType,
  BarcodeFormat,
  HTMLCanvasElementLuminanceSource,
  HybridBinarizer,
  GlobalHistogramBinarizer,
  BinaryBitmap,
  NotFoundException,
} from '@zxing/library';

export interface BarcodeScannerViewportProps {
  onBarcodeDetected: (barcode: string, format?: string) => void;
  isProcessing?: boolean;
}

interface NativeBarcodeItem {
  rawValue: string;
  format: string;
}

interface NativeBarcodeDetectorInstance {
  detect(source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement): Promise<NativeBarcodeItem[]>;
}

interface NativeBarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): NativeBarcodeDetectorInstance;
  getSupportedFormats?: () => Promise<string[]>;
}

export const SAMPLE_BARCODES = [
  { label: 'Parle-G Biscuits', barcode: '8901719101039' },
  { label: 'Maggi 2-Minute Noodles', barcode: '8901058852331' },
  { label: 'Amul Taaza Milk', barcode: '8901262010054' },
  { label: 'Haldiram Bhujia', barcode: '8904004400588' },
];

// EAN-13 bit pattern tables for generating test barcodes
const L_PATTERNS = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G_PATTERNS = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const R_PATTERNS = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const FIRST_DIGIT_PARITY = [
  'LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG',
  'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'
];

/**
 * Generates an exact, mathematically valid EAN-13 barcode canvas for test verification.
 * Includes official quiet zones (10 modules on each side), start/center/end guards, and parity encodings.
 */
export function generateEan13Canvas(barcode: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  if (barcode.length !== 13) return canvas;

  const first = parseInt(barcode[0], 10);
  const parity = FIRST_DIGIT_PARITY[first];
  let modules = '0000000000'; // 10 quiet modules
  modules += '101'; // start guard
  for (let i = 1; i <= 6; i++) {
    const digit = parseInt(barcode[i], 10);
    modules += parity[i - 1] === 'L' ? L_PATTERNS[digit] : G_PATTERNS[digit];
  }
  modules += '01010'; // center guard
  for (let i = 7; i <= 12; i++) {
    const digit = parseInt(barcode[i], 10);
    modules += R_PATTERNS[digit];
  }
  modules += '101'; // end guard
  modules += '0000000000'; // 10 quiet modules

  const scale = 3;
  const w = modules.length * scale;
  const h = 120;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#000000';

  for (let i = 0; i < modules.length; i++) {
    if (modules[i] === '1') {
      ctx.fillRect(i * scale, 10, scale, 90);
    }
  }

  // Draw human-readable numbers under the bars
  ctx.font = '12px monospace';
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.fillText(barcode, w / 2, 114);

  return canvas;
}

/**
 * Normalizes barcode string: trims whitespace, removes non-alphanumeric separators,
 * and strictly preserves leading zeros.
 */
export function normalizeBarcode(raw: string): string {
  if (!raw) return '';
  return raw.replace(/[^0-9A-Za-z]/g, '').trim();
}

/**
 * Validates barcode format and structural length:
 * - 8 digits: EAN-8
 * - 12 digits: UPC-A
 * - 13 digits: EAN-13
 * - 14 digits: ITF-14 / GTIN-14
 * - 3 to 48 alphanumeric characters: Code 128 / Code 39
 * Preserves barcodes beginning with 0.
 */
export function validateBarcode(barcode: string): boolean {
  if (!barcode || barcode.length < 3) return false;

  const isNumericOnly = /^\d+$/.test(barcode);

  if (isNumericOnly) {
    if ([8, 12, 13, 14].includes(barcode.length)) {
      return true;
    }
  }

  // Alpha-numeric barcodes like Code-128 / Code-39
  if (barcode.length >= 3 && barcode.length <= 48) {
    return true;
  }

  return false;
}

/**
 * Normalizes and infers human-readable barcode format.
 * Never returns '?' or 'BARCODE' when the format can be inferred from the numeric code.
 * For 13 digits, normalizes to EAN-13.
 */
export function normalizeBarcodeFormat(code: string, rawFormat?: string): string {
  if (rawFormat) {
    const cleaned = String(rawFormat).trim().toLowerCase().replace(/[-_\s]/g, '');
    if (cleaned === 'ean13' || cleaned === '7') return 'EAN-13';
    if (cleaned === 'ean8' || cleaned === '6') return 'EAN-8';
    if (cleaned === 'upca' || cleaned === '14') return 'UPC-A';
    if (cleaned === 'upce' || cleaned === '15') return 'UPC-E';
    if (cleaned === 'code128' || cleaned === '4') return 'Code 128';
    if (cleaned === 'code39' || cleaned === '2') return 'Code 39';
    if (cleaned === 'itf' || cleaned === 'itf14' || cleaned === '8') return 'ITF-14';
    if (cleaned === 'qr' || cleaned === 'qrcode' || cleaned === '11') return 'QR Code';
    if (rawFormat !== '?' && rawFormat !== 'unknown' && rawFormat !== 'BARCODE' && rawFormat.trim() !== '') {
      return rawFormat.toUpperCase();
    }
  }

  // Infer from numeric code
  const digits = code ? code.replace(/\D/g, '') : '';
  if (digits.length === 13) return 'EAN-13';
  if (digits.length === 12) return 'UPC-A';
  if (digits.length === 8) return 'EAN-8';
  if (digits.length === 14) return 'ITF-14';
  if (code && code.length >= 3 && code.length <= 48 && !/^\d+$/.test(code)) return 'Code 128';

  return 'EAN-13';
}

/**
 * Mathematically extracts the Region of Interest (ROI) from the video stream
 * corresponding exactly to what the user sees inside the visual viewfinder reticle.
 * Correctly accounts for videoWidth/videoHeight, container clientWidth/clientHeight,
 * object-fit: cover, and object-position: 50% 50%.
 */
export function calculateVideoRoi(
  video: HTMLVideoElement,
  reticleEl: HTMLElement | null,
  marginScale: number = 1.25
): { sx: number; sy: number; sw: number; sh: number } | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh || video.readyState < 2) return null;

  if (!reticleEl) {
    // Symmetrical central fallback if reticle ref is not yet attached
    const isPortrait = vh > vw;
    const rw = Math.round(vw * (isPortrait ? 0.85 : 0.70) * marginScale);
    const rh = Math.round(vh * (isPortrait ? 0.35 : 0.50) * marginScale);
    return {
      sx: Math.max(0, Math.round((vw - rw) / 2)),
      sy: Math.max(0, Math.round((vh - rh) / 2)),
      sw: Math.min(vw, rw),
      sh: Math.min(vh, rh),
    };
  }

  const vRect = video.getBoundingClientRect();
  const rRect = reticleEl.getBoundingClientRect();

  if (vRect.width <= 0 || vRect.height <= 0) return null;

  // Calculate object-fit: cover scaling
  const scale = Math.max(vRect.width / vw, vRect.height / vh);
  const renderedW = vw * scale;
  const renderedH = vh * scale;

  // Centered object-position offsets (in client CSS space)
  const offsetX = (vRect.width - renderedW) / 2;
  const offsetY = (vRect.height - renderedH) / 2;

  // Reticle offset relative to the rendered video top-left
  const rx = rRect.left - vRect.left - offsetX;
  const ry = rRect.top - vRect.top - offsetY;
  const rw = rRect.width;
  const rh = rRect.height;

  // Map to intrinsic video coordinates
  let vx = rx / scale;
  let vy = ry / scale;
  let vwCrop = rw / scale;
  let vhCrop = rh / scale;

  // Apply safety margin (so barcodes and quiet zones near reticle borders are completely captured)
  const deltaW = (vwCrop * (marginScale - 1)) / 2;
  const deltaH = (vhCrop * (marginScale - 1)) / 2;
  vx -= deltaW;
  vy -= deltaH;
  vwCrop += deltaW * 2;
  vhCrop += deltaH * 2;

  // Clamp strictly to video frame bounds
  const sx = Math.max(0, Math.min(vw - 20, Math.round(vx)));
  const sy = Math.max(0, Math.min(vh - 20, Math.round(vy)));
  const sw = Math.min(vw - sx, Math.max(20, Math.round(vwCrop)));
  const sh = Math.min(vh - sy, Math.max(20, Math.round(vhCrop)));

  return { sx, sy, sw, sh };
}

interface DecodeResult {
  code: string;
  format: string;
  engine: 'Native' | 'ZXing';
  pass: string;
  raw: string;
}

/**
 * Applies dynamic min-max contrast stretch and grayscale conversion
 * to bring out faded, reflective, or poorly-lit barcode bars.
 */
function applyContrastStretch(
  srcCanvas: HTMLCanvasElement,
  targetCanvas: HTMLCanvasElement
): boolean {
  const w = srcCanvas.width;
  const h = srcCanvas.height;
  if (w <= 0 || h <= 0) return false;

  targetCanvas.width = w;
  targetCanvas.height = h;

  const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
  const targetCtx = targetCanvas.getContext('2d', { willReadFrequently: true });
  if (!srcCtx || !targetCtx) return false;

  let imgData: ImageData;
  try {
    imgData = srcCtx.getImageData(0, 0, w, h);
  } catch {
    return false;
  }

  const d = imgData.data;
  const total = w * h;

  // Fast luminance analysis
  let minLum = 255;
  let maxLum = 0;
  for (let i = 0; i < total; i += 4) {
    const o = i * 4;
    const lum = (d[o] * 306 + d[o + 1] * 601 + d[o + 2] * 117) >> 10;
    if (lum < minLum) minLum = lum;
    if (lum > maxLum) maxLum = lum;
  }

  const range = maxLum - minLum;
  if (range < 20 || range >= 225) {
    // Normal grayscale conversion
    for (let i = 0; i < total; i++) {
      const o = i * 4;
      const lum = (d[o] * 306 + d[o + 1] * 601 + d[o + 2] * 117) >> 10;
      d[o] = lum;
      d[o + 1] = lum;
      d[o + 2] = lum;
    }
  } else {
    // Stretch contrast across 0-255 dynamic range
    const factor = 255 / range;
    for (let i = 0; i < total; i++) {
      const o = i * 4;
      const lum = (d[o] * 306 + d[o + 1] * 601 + d[o + 2] * 117) >> 10;
      const stretched = Math.min(255, Math.max(0, (lum - minLum) * factor));
      d[o] = stretched;
      d[o + 1] = stretched;
      d[o + 2] = stretched;
    }
  }

  targetCtx.putImageData(imgData, 0, 0);
  return true;
}

/**
 * Decodes a canvas using ZXing with both GlobalHistogramBinarizer and HybridBinarizer.
 * Leverages HTMLCanvasElementLuminanceSource so ZXing's OneDReader can automatically
 * perform 90-degree CCW rotation when TRY_HARDER is active.
 */
function decodeCanvasWithZxing(
  canvas: HTMLCanvasElement,
  reader: MultiFormatReader,
  passName: string
): DecodeResult | null {
  if (canvas.width <= 0 || canvas.height <= 0) return null;

  // Pass 1: GlobalHistogramBinarizer (specialized for 1D barcodes and uniform background)
  try {
    const source = new HTMLCanvasElementLuminanceSource(canvas);
    const bitmap = new BinaryBitmap(new GlobalHistogramBinarizer(source));
    const res = reader.decodeWithState(bitmap);
    if (res && res.getText()) {
      const clean = normalizeBarcode(res.getText());
      if (validateBarcode(clean)) {
        const rawFmt = res.getBarcodeFormat();
        const fmtName = BarcodeFormat[rawFmt] || (typeof rawFmt === 'number' ? rawFmt.toString() : '');
        return {
          code: clean,
          format: normalizeBarcodeFormat(clean, fmtName),
          engine: 'ZXing',
          pass: `${passName} (GlobalHistogram)`,
          raw: res.getText(),
        };
      }
    }
  } catch (e) {
    if (!(e instanceof NotFoundException)) {
      // Non-not-found exceptions safely caught
    }
  } finally {
    try {
      reader.reset();
    } catch {}
  }

  // Pass 2: HybridBinarizer (resilient against shadows and non-uniform lighting)
  try {
    const source = new HTMLCanvasElementLuminanceSource(canvas);
    const bitmap = new BinaryBitmap(new HybridBinarizer(source));
    const res = reader.decodeWithState(bitmap);
    if (res && res.getText()) {
      const clean = normalizeBarcode(res.getText());
      if (validateBarcode(clean)) {
        const rawFmt = res.getBarcodeFormat();
        const fmtName = BarcodeFormat[rawFmt] || (typeof rawFmt === 'number' ? rawFmt.toString() : '');
        return {
          code: clean,
          format: normalizeBarcodeFormat(clean, fmtName),
          engine: 'ZXing',
          pass: `${passName} (Hybrid)`,
          raw: res.getText(),
        };
      }
    }
  } catch (e) {
    if (!(e instanceof NotFoundException)) {
      // Non-not-found exceptions safely caught
    }
  } finally {
    try {
      reader.reset();
    } catch {}
  }

  return null;
}

export function BarcodeScannerViewport({
  onBarcodeDetected,
  isProcessing = false,
}: BarcodeScannerViewportProps) {
  const isDev = process.env.NODE_ENV !== 'production';

  const videoRef = useRef<HTMLVideoElement>(null);
  const reticleRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isScanningFrameRef = useRef<boolean>(false);
  const isLockedRef = useRef<boolean>(false);

  // Telemetry ref counters (updated without React render penalty)
  const framesStartedRef = useRef<number>(0);
  const framesCompletedRef = useRef<number>(0);
  const framesSkippedRef = useRef<number>(0);
  const nativeDetectionsRef = useRef<number>(0);
  const zxingDetectionsRef = useRef<number>(0);
  const lastDiagUpdateRef = useRef<number>(0);

  const nativeDetectorRef = useRef<NativeBarcodeDetectorInstance | null>(null);
  const zxingReaderRef = useRef<MultiFormatReader | null>(null);
  const roiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const contrastCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fullCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannerState, setScannerState] = useState<'initializing' | 'scanning' | 'detected' | 'error'>('initializing');
  const [detectedBarcode, setDetectedBarcode] = useState<string | null>(null);
  const [detectedFormat, setDetectedFormat] = useState<string | null>(null);

  const [manualInputOpen, setManualInputOpen] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Diagnostics panel expanded state
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(true);

  // Live telemetry data state
  const [diagData, setDiagData] = useState({
    // Camera
    cameraStatus: 'INVALID' as 'AVAILABLE' | 'INVALID',
    readyState: 0,
    videoWidth: 0,
    videoHeight: 0,
    facingMode: 'environment',
    trackCapabilities: 'None',

    // Native Barcode Detector
    nativeSupported: false,
    nativeSupportedFormats: [] as string[],
    nativeRoiAttempted: false,
    nativeRoiDetectionCount: 0,
    nativeFullFrameDetectionCount: 0,
    nativeStatus: 'UNSUPPORTED' as 'DETECTED' | 'NO DETECTION' | 'UNSUPPORTED' | 'ERROR',
    nativeLastError: 'None',

    // ZXing
    zxingRoiGlobalAttempted: false,
    zxingRoiHybridAttempted: false,
    zxingContrastRoiAttempted: false,
    zxingRotatedAttempted: false,
    zxingFullFrameAttempted: false,
    zxingRoiStatus: 'NO DETECTION' as 'DETECTED' | 'NO DETECTION' | 'ERROR',
    zxingFullFrameStatus: 'NO DETECTION' as 'DETECTED' | 'NO DETECTION' | 'ERROR',
    zxingLastError: 'None',
    zxingDecodeDurationMs: 0,

    // Pipeline
    framesStarted: 0,
    framesCompleted: 0,
    framesSkipped: 0,
    totalFramesProcessed: 0,
    totalNativeDetections: 0,
    totalZxingDetections: 0,
    lastDecoderFailure: 'None',
    lastEngineUsed: 'None',
    lastDetectedCode: 'None',
    lastDetectedFormat: 'None',
    lastPass: 'None',

    // Upload Test
    uploadStatus: 'IDLE' as 'DETECTED' | 'NO DETECTION' | 'ERROR' | 'IDLE',
    uploadResult: 'None',
  });

  // Debug visual snapshot data state
  const [debugSnapshots, setDebugSnapshots] = useState<{
    cameraFrameUrl: string | null;
    cameraRes: string;
    roiCanvasUrl: string | null;
    roiRes: string;
    contrastCanvasUrl: string | null;
    contrastRes: string;
    capturedAt: string | null;
  }>({
    cameraFrameUrl: null,
    cameraRes: '---',
    roiCanvasUrl: null,
    roiRes: '---',
    contrastCanvasUrl: null,
    contrastRes: '---',
    capturedAt: null,
  });

  // Stop scanning interval cleanly
  const stopScanTimer = useCallback(() => {
    if (scanTimerRef.current) {
      clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    isScanningFrameRef.current = false;
  }, []);

  // Stop camera tracks and cleanup readers
  const stopCamera = useCallback(() => {
    stopScanTimer();

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

    nativeDetectorRef.current = null;
  }, [stopScanTimer]);

  // Lock scanner and notify parent of confirmed detection
  const lockAndTrigger = useCallback(
    (code: string, format?: string) => {
      if (isLockedRef.current || isProcessing) return;
      isLockedRef.current = true;

      // Haptic confirmation
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate([60, 40, 60]);
        } catch {
          // ignore
        }
      }

      const clean = normalizeBarcode(code);
      const normalizedFormat = normalizeBarcodeFormat(clean, format);

      if (process.env.NODE_ENV !== 'production') {
        console.log('[Barcode Handoff] lockAndTrigger confirmed:', {
          cleanCode: clean,
          normalizedFormat,
          rawCode: code,
          rawFormat: format,
        });
      }

      setDetectedBarcode(clean);
      setDetectedFormat(normalizedFormat);
      setScannerState('detected');

      // Halt scanning loop immediately
      stopScanTimer();

      // Trigger callback once with clean normalized code and format
      onBarcodeDetected(clean, normalizedFormat);
    },
    [isProcessing, onBarcodeDetected, stopScanTimer]
  );

  // Unlock scanner for next scan
  const unlockScanner = useCallback(() => {
    isLockedRef.current = false;
    setDetectedBarcode(null);
    setDetectedFormat(null);
    setScannerState('scanning');
  }, []);

  // Capture Debug Frame button handler
  const handleCaptureDebugFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0) {
      alert('Camera frame is not ready to capture.');
      return;
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;

    // 1. Full camera frame snapshot
    const camCanvas = document.createElement('canvas');
    camCanvas.width = vw;
    camCanvas.height = vh;
    const camCtx = camCanvas.getContext('2d');
    if (camCtx) {
      camCtx.drawImage(video, 0, 0, vw, vh);
    }
    const cameraFrameUrl = camCanvas.toDataURL('image/jpeg', 0.85);

    // 2. ROI Canvas snapshot
    let roiCanvasUrl: string | null = null;
    let roiRes = '---';
    if (roiCanvasRef.current && roiCanvasRef.current.width > 0) {
      roiCanvasUrl = roiCanvasRef.current.toDataURL('image/png');
      roiRes = `${roiCanvasRef.current.width} × ${roiCanvasRef.current.height}`;
    }

    // 3. Contrast Canvas snapshot
    let contrastCanvasUrl: string | null = null;
    let contrastRes = '---';
    if (contrastCanvasRef.current && contrastCanvasRef.current.width > 0) {
      contrastCanvasUrl = contrastCanvasRef.current.toDataURL('image/png');
      contrastRes = `${contrastCanvasRef.current.width} × ${contrastCanvasRef.current.height}`;
    }

    setDebugSnapshots({
      cameraFrameUrl,
      cameraRes: `${vw} × ${vh}`,
      roiCanvasUrl,
      roiRes,
      contrastCanvasUrl,
      contrastRes,
      capturedAt: new Date().toLocaleTimeString(),
    });
  }, []);

  // Test Known Barcode (3017620422003 - Nutella) handler
  const handleTestKnownBarcode = useCallback(() => {
    const knownCode = '3017620422003';
    const testCanvas = generateEan13Canvas(knownCode);

    // Test with ZXing
    let zxingRes: DecodeResult | null = null;
    if (zxingReaderRef.current) {
      zxingRes = decodeCanvasWithZxing(testCanvas, zxingReaderRef.current, 'Known EAN-13 Test');
    }

    setDiagData((prev) => ({
      ...prev,
      uploadStatus: zxingRes ? 'DETECTED' : 'ERROR',
      uploadResult: zxingRes
        ? `Decoded ${zxingRes.code} (${zxingRes.format}) via ${zxingRes.pass}`
        : 'Failed to decode generated EAN-13 canvas',
      lastDetectedCode: zxingRes ? zxingRes.code : prev.lastDetectedCode,
      lastDetectedFormat: zxingRes ? zxingRes.format : prev.lastDetectedFormat,
    }));

    setDebugSnapshots((prev) => ({
      ...prev,
      roiCanvasUrl: testCanvas.toDataURL('image/png'),
      roiRes: `${testCanvas.width} × ${testCanvas.height}`,
      capturedAt: `Known Barcode 3017620422003 Tested (${zxingRes ? 'SUCCESS' : 'FAILED'})`,
    }));
  }, []);

  // Diagnostic Upload Test Image handler
  const handleDiagnosticUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.src = objectUrl;

    img.onload = async () => {
      let nativeFound: string | null = null;
      let nativeFmt: string | null = null;
      let nativeErr: string = 'None';

      if (nativeDetectorRef.current) {
        try {
          const bcs = await nativeDetectorRef.current.detect(img);
          if (bcs && bcs.length > 0 && bcs[0].rawValue) {
            nativeFound = bcs[0].rawValue;
            nativeFmt = bcs[0].format;
          }
        } catch (err) {
          nativeErr = err instanceof Error ? err.message : String(err);
        }
      }

      // Draw to canvas for ZXing
      const canvas = document.createElement('canvas');
      const origW = img.naturalWidth || img.width;
      const origH = img.naturalHeight || img.height;
      const maxDim = 1200;
      const scale = Math.min(1, maxDim / Math.max(origW, origH));
      const targetW = Math.round(origW * scale);
      const targetH = Math.round(origH * scale);
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(img, 0, 0, targetW, targetH);

      let zxingRes: DecodeResult | null = null;
      if (zxingReaderRef.current) {
        zxingRes = decodeCanvasWithZxing(canvas, zxingReaderRef.current, 'Diagnostic Upload');
        if (!zxingRes) {
          const contrastCanvas = document.createElement('canvas');
          if (applyContrastStretch(canvas, contrastCanvas)) {
            zxingRes = decodeCanvasWithZxing(contrastCanvas, zxingReaderRef.current, 'Diagnostic Upload Contrast');
          }
        }
      }

      const detected = nativeFound || zxingRes?.code || null;
      const format = nativeFmt || zxingRes?.format || null;
      const engine = nativeFound ? 'Native' : zxingRes ? 'ZXing' : 'None';

      setDiagData((prev) => ({
        ...prev,
        uploadStatus: detected ? 'DETECTED' : 'NO DETECTION',
        uploadResult: detected ? `${detected} (${format}) via ${engine}` : 'No barcode found in image',
        nativeStatus: nativeFound ? 'DETECTED' : nativeDetectorRef.current ? 'NO DETECTION' : 'UNSUPPORTED',
        nativeLastError: nativeErr,
        zxingFullFrameStatus: zxingRes ? 'DETECTED' : 'NO DETECTION',
        lastDetectedCode: detected || 'None',
        lastDetectedFormat: format || 'None',
      }));

      setDebugSnapshots({
        cameraFrameUrl: canvas.toDataURL('image/jpeg', 0.8),
        cameraRes: `${origW} × ${origH} (scaled to ${targetW} × ${targetH})`,
        roiCanvasUrl: canvas.toDataURL('image/png'),
        roiRes: `${targetW} × ${targetH}`,
        contrastCanvasUrl: null,
        contrastRes: '---',
        capturedAt: `Uploaded File: ${file.name}`,
      });

      URL.revokeObjectURL(objectUrl);
    };
  }, []);

  // Single Frame Analysis Cycle
  const processFrame = useCallback(async () => {
    if (isLockedRef.current || isProcessing) return;

    if (isScanningFrameRef.current) {
      framesSkippedRef.current += 1;
      return;
    }

    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    isScanningFrameRef.current = true;
    framesStartedRef.current += 1;
    const cycleStart = performance.now();

    let decodeResult: DecodeResult | null = null;
    let decodeException: string | null = null;

    let nativeRoiAttempted = false;
    let nativeStatus: 'DETECTED' | 'NO DETECTION' | 'UNSUPPORTED' | 'ERROR' = nativeDetectorRef.current
      ? 'NO DETECTION'
      : 'UNSUPPORTED';
    let nativeLastError = 'None';

    let zxingRoiGlobalAttempted = false;
    let zxingRoiHybridAttempted = false;
    let zxingContrastRoiAttempted = false;
    let zxingFullFrameAttempted = false;
    let zxingRoiStatus: 'DETECTED' | 'NO DETECTION' | 'ERROR' = 'NO DETECTION';
    let zxingFullFrameStatus: 'DETECTED' | 'NO DETECTION' | 'ERROR' = 'NO DETECTION';
    let zxingLastError = 'None';

    try {
      const vw = video.videoWidth;
      const vh = video.videoHeight;

      // 1. Calculate mathematically exact ROI corresponding to the visual reticle
      const roi = calculateVideoRoi(video, reticleRef.current, 1.25);
      if (!roiCanvasRef.current) {
        roiCanvasRef.current = document.createElement('canvas');
      }
      const roiCanvas = roiCanvasRef.current;

      let hasValidRoi = false;
      if (roi && roi.sw > 20 && roi.sh > 20) {
        // Use crisp 1:1 intrinsic pixel mapping (no bicubic blur on 1D barcode lines)
        roiCanvas.width = roi.sw;
        roiCanvas.height = roi.sh;

        const roiCtx = roiCanvas.getContext('2d', { willReadFrequently: true });
        if (roiCtx) {
          roiCtx.imageSmoothingEnabled = false;
          roiCtx.drawImage(video, roi.sx, roi.sy, roi.sw, roi.sh, 0, 0, roi.sw, roi.sh);
          hasValidRoi = true;
        }
      }

      // -------------------------------------------------------------
      // Path 1: Native BarcodeDetector (Optimization Only)
      // -------------------------------------------------------------
      if (nativeDetectorRef.current) {
        // 1a. Try on ROI first if available
        if (hasValidRoi) {
          nativeRoiAttempted = true;
          try {
            const barcodes = await nativeDetectorRef.current.detect(roiCanvas);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              const clean = normalizeBarcode(barcodes[0].rawValue);
              if (validateBarcode(clean)) {
                const normalizedFormat = normalizeBarcodeFormat(clean, barcodes[0].format);
                decodeResult = {
                  code: clean,
                  format: normalizedFormat,
                  engine: 'Native',
                  pass: 'Native BarcodeDetector (ROI)',
                  raw: barcodes[0].rawValue,
                };
                nativeStatus = 'DETECTED';
                nativeDetectionsRef.current += 1;
              }
            }
          } catch (nativeErr) {
            nativeStatus = 'ERROR';
            nativeLastError = nativeErr instanceof Error ? nativeErr.message : String(nativeErr);
            decodeException = nativeLastError;
          }
        }

        // 1b. If ROI didn't detect with native, try native on full video element
        if (!decodeResult) {
          try {
            const fullBarcodes = await nativeDetectorRef.current.detect(video);
            if (fullBarcodes && fullBarcodes.length > 0 && fullBarcodes[0].rawValue) {
              const clean = normalizeBarcode(fullBarcodes[0].rawValue);
              if (validateBarcode(clean)) {
                const normalizedFormat = normalizeBarcodeFormat(clean, fullBarcodes[0].format);
                decodeResult = {
                  code: clean,
                  format: normalizedFormat,
                  engine: 'Native',
                  pass: 'Native BarcodeDetector (Full Frame)',
                  raw: fullBarcodes[0].rawValue,
                };
                nativeStatus = 'DETECTED';
                nativeDetectionsRef.current += 1;
              }
            }
          } catch (videoErr) {
            nativeLastError = videoErr instanceof Error ? videoErr.message : String(videoErr);
          }
        }
      }

      // -------------------------------------------------------------
      // Path 2: ZXing on ROI Canvas (Original)
      // -------------------------------------------------------------
      // Native detector MUST NEVER prevent ZXing from running
      if (!decodeResult && zxingReaderRef.current && hasValidRoi) {
        zxingRoiGlobalAttempted = true;
        zxingRoiHybridAttempted = true;
        try {
          decodeResult = decodeCanvasWithZxing(roiCanvas, zxingReaderRef.current, 'ROI Original');
          if (decodeResult) {
            zxingRoiStatus = 'DETECTED';
            zxingDetectionsRef.current += 1;
          }
        } catch (zxingErr) {
          zxingRoiStatus = 'ERROR';
          zxingLastError = zxingErr instanceof Error ? zxingErr.message : String(zxingErr);
          decodeException = zxingLastError;
        }
      }

      // -------------------------------------------------------------
      // Path 3: ZXing on ROI Canvas (Contrast & Grayscale Preprocessed)
      // -------------------------------------------------------------
      if (!decodeResult && zxingReaderRef.current && hasValidRoi) {
        zxingContrastRoiAttempted = true;
        if (!contrastCanvasRef.current) {
          contrastCanvasRef.current = document.createElement('canvas');
        }
        const hasContrast = applyContrastStretch(roiCanvas, contrastCanvasRef.current);
        if (hasContrast) {
          try {
            decodeResult = decodeCanvasWithZxing(
              contrastCanvasRef.current,
              zxingReaderRef.current,
              'ROI Contrast'
            );
            if (decodeResult) {
              zxingRoiStatus = 'DETECTED';
              zxingDetectionsRef.current += 1;
            }
          } catch (contrastErr) {
            zxingLastError = contrastErr instanceof Error ? contrastErr.message : String(contrastErr);
          }
        }
      }

      // -------------------------------------------------------------
      // Path 4: Full-Frame Fallback (if ROI fails)
      // -------------------------------------------------------------
      if (!decodeResult) {
        zxingFullFrameAttempted = true;
        if (!fullCanvasRef.current) {
          fullCanvasRef.current = document.createElement('canvas');
        }
        const fullCanvas = fullCanvasRef.current;
        // Limit full frame dimension to keep decode times well under 25ms
        const maxDim = 960;
        const fScale = Math.min(1, maxDim / Math.max(vw, vh));
        const fw = Math.round(vw * fScale);
        const fh = Math.round(vh * fScale);

        fullCanvas.width = fw;
        fullCanvas.height = fh;
        const fullCtx = fullCanvas.getContext('2d', { willReadFrequently: true });
        if (fullCtx) {
          fullCtx.imageSmoothingEnabled = false;
          fullCtx.drawImage(video, 0, 0, fw, fh);

          // Native fallback on full canvas
          if (nativeDetectorRef.current) {
            try {
              const fullCanvasBarcodes = await nativeDetectorRef.current.detect(fullCanvas);
              if (fullCanvasBarcodes && fullCanvasBarcodes.length > 0 && fullCanvasBarcodes[0].rawValue) {
                const clean = normalizeBarcode(fullCanvasBarcodes[0].rawValue);
                if (validateBarcode(clean)) {
                  const normalizedFormat = normalizeBarcodeFormat(clean, fullCanvasBarcodes[0].format);
                  decodeResult = {
                    code: clean,
                    format: normalizedFormat,
                    engine: 'Native',
                    pass: 'Native BarcodeDetector (Full Frame Canvas)',
                    raw: fullCanvasBarcodes[0].rawValue,
                  };
                  nativeStatus = 'DETECTED';
                  nativeDetectionsRef.current += 1;
                }
              }
            } catch {}
          }

          // ZXing fallback on full frame
          if (!decodeResult && zxingReaderRef.current) {
            try {
              decodeResult = decodeCanvasWithZxing(
                fullCanvas,
                zxingReaderRef.current,
                'Full-Frame Fallback'
              );
              if (decodeResult) {
                zxingFullFrameStatus = 'DETECTED';
                zxingDetectionsRef.current += 1;
              }
            } catch (fullErr) {
              zxingFullFrameStatus = 'ERROR';
              zxingLastError = fullErr instanceof Error ? fullErr.message : String(fullErr);
            }
          }
        }
      }

      const cycleDuration = Math.round(performance.now() - cycleStart);
      framesCompletedRef.current += 1;

      // Update diagnostic state (throttled to avoid render thrashing)
      const now = performance.now();
      if (now - lastDiagUpdateRef.current > 350 || decodeResult) {
        lastDiagUpdateRef.current = now;

        // Inspect camera track capabilities
        const videoTrack = streamRef.current?.getVideoTracks()[0];
        let capsSummary = 'None';
        if (videoTrack) {
          try {
            const trackWithCaps = videoTrack as MediaStreamTrack & { getCapabilities?: () => MediaTrackCapabilities };
            const caps = trackWithCaps.getCapabilities?.() as Record<string, unknown> | undefined;
            if (caps) {
              capsSummary = JSON.stringify({
                focusMode: caps['focusMode'],
                zoom: caps['zoom'],
                torch: caps['torch'],
              });
            }
          } catch {}
        }

        setDiagData((prev) => ({
          ...prev,
          cameraStatus: 'AVAILABLE',
          readyState: video.readyState,
          videoWidth: vw,
          videoHeight: vh,
          facingMode,
          trackCapabilities: capsSummary,

          nativeSupported: Boolean(nativeDetectorRef.current),
          nativeRoiAttempted,
          nativeRoiDetectionCount: nativeDetectionsRef.current,
          nativeFullFrameDetectionCount: nativeDetectionsRef.current,
          nativeStatus,
          nativeLastError,

          zxingRoiGlobalAttempted,
          zxingRoiHybridAttempted,
          zxingContrastRoiAttempted,
          zxingRotatedAttempted: true, // HTMLCanvasElementLuminanceSource rotation is enabled via TRY_HARDER
          zxingFullFrameAttempted,
          zxingRoiStatus,
          zxingFullFrameStatus,
          zxingLastError,
          zxingDecodeDurationMs: cycleDuration,

          framesStarted: framesStartedRef.current,
          framesCompleted: framesCompletedRef.current,
          framesSkipped: framesSkippedRef.current,
          totalFramesProcessed: framesCompletedRef.current,
          totalNativeDetections: nativeDetectionsRef.current,
          totalZxingDetections: zxingDetectionsRef.current,
          lastDecoderFailure: decodeException || (decodeResult ? 'None' : 'NotFoundException (No barcode in frame)'),
          lastEngineUsed: decodeResult ? decodeResult.engine : prev.lastEngineUsed,
          lastDetectedCode: decodeResult ? decodeResult.code : prev.lastDetectedCode,
          lastDetectedFormat: decodeResult ? decodeResult.format : prev.lastDetectedFormat,
          lastPass: decodeResult ? decodeResult.pass : prev.lastPass,
        }));
      }

      // Candidate Normalization, Validation & Triggering
      if (decodeResult) {
        const clean = normalizeBarcode(decodeResult.code);
        if (validateBarcode(clean)) {
          const normalizedFormat = normalizeBarcodeFormat(clean, decodeResult.format);
          if (process.env.NODE_ENV !== 'production') {
            console.log('[Barcode Handoff] Confirmed detection in processFrame:', {
              rawDetectedValue: decodeResult.raw,
              normalizedValue: clean,
              detectedFormat: normalizedFormat,
              engineUsed: decodeResult.engine,
              pass: decodeResult.pass,
            });
          }
          lockAndTrigger(clean, normalizedFormat);
          return;
        }
      }
    } finally {
      isScanningFrameRef.current = false;
    }
  }, [facingMode, isProcessing, lockAndTrigger]);

  // Start controlled scan interval loop (every 160ms ~ 6.25 FPS)
  const startScanTimer = useCallback(() => {
    stopScanTimer();
    scanTimerRef.current = setInterval(() => {
      void processFrame();
    }, 160);
  }, [processFrame, stopScanTimer]);

  // Start Camera Stream
  const startCamera = useCallback(async () => {
    stopCamera();
    setScannerState('initializing');
    setCameraError(null);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setHasCamera(false);
      setScannerState('error');
      setCameraError('Camera API is not supported by your browser or environment.');
      return;
    }

    try {
      // 1280x720 / 30fps stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: false,
      });

      streamRef.current = stream;
      setCameraError(null);
      setHasCamera(true);

      // Inspect video track capabilities and apply continuous autofocus
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const trackWithCaps = videoTrack as MediaStreamTrack & {
          getCapabilities?: () => Record<string, unknown>;
          applyConstraints?: (c: unknown) => Promise<void>;
        };

        if (typeof trackWithCaps.getCapabilities === 'function') {
          try {
            const capabilities = trackWithCaps.getCapabilities();

            // Prefer continuous autofocus for packaged food scanning
            if (capabilities && 'focusMode' in capabilities) {
              const focusModes = capabilities.focusMode as string[] | undefined;
              if (Array.isArray(focusModes) && focusModes.includes('continuous')) {
                try {
                  await trackWithCaps.applyConstraints?.({
                    advanced: [{ focusMode: 'continuous' }],
                  });
                } catch {
                  // Focus mode application failed, degrade gracefully
                }
              }
            }

            // Check torch capability
            if (capabilities && 'torch' in capabilities && Boolean(capabilities.torch)) {
              setTorchAvailable(true);
            }
          } catch {
            // Capabilities inspection safely caught
          }
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch {
          // Play was interrupted or auto-play restriction; continue
        }
      }

      // Initialize Engine A: Native BarcodeDetector (if supported)
      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        try {
          const detectorCtor = (window as unknown as { BarcodeDetector: NativeBarcodeDetectorConstructor })
            .BarcodeDetector;

          const desiredFormats = [
            'ean_13',
            'ean_8',
            'upc_a',
            'upc_e',
            'code_128',
            'code_39',
            'itf',
            'codabar',
          ];
          let supportedFormats = desiredFormats;

          if (typeof detectorCtor.getSupportedFormats === 'function') {
            try {
              const available = await detectorCtor.getSupportedFormats();
              const filtered = desiredFormats.filter((fmt) => available.includes(fmt));
              if (filtered.length > 0) {
                supportedFormats = filtered;
              }
              setDiagData((prev) => ({ ...prev, nativeSupportedFormats: available }));
            } catch {
              // Ignore getSupportedFormats error
            }
          }

          nativeDetectorRef.current = new detectorCtor({ formats: supportedFormats });
          setDiagData((prev) => ({ ...prev, nativeSupported: true }));
        } catch {
          try {
            // Fallback to constructor without options if format restrictions failed
            const detectorCtor = (window as unknown as { BarcodeDetector: NativeBarcodeDetectorConstructor })
              .BarcodeDetector;
            nativeDetectorRef.current = new detectorCtor();
            setDiagData((prev) => ({ ...prev, nativeSupported: true }));
          } catch {
            nativeDetectorRef.current = null;
            setDiagData((prev) => ({ ...prev, nativeSupported: false, nativeStatus: 'UNSUPPORTED' }));
          }
        }
      } else {
        setDiagData((prev) => ({ ...prev, nativeSupported: false, nativeStatus: 'UNSUPPORTED' }));
      }

      // Initialize Engine B: Direct ZXing MultiFormatReader with explicit retail barcode formats and TRY_HARDER
      try {
        const hints = new Map<DecodeHintType, unknown>();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.ITF,
          BarcodeFormat.CODABAR,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);

        const reader = new MultiFormatReader();
        reader.setHints(hints);
        zxingReaderRef.current = reader;
      } catch (err) {
        console.warn('ZXing initialization warning:', err);
      }

      // Enter active scanning state
      setScannerState('scanning');
      startScanTimer();
    } catch (err: unknown) {
      const error = err as Error;
      setHasCamera(false);
      setScannerState('error');
      setDiagData((prev) => ({ ...prev, cameraStatus: 'INVALID' }));
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setCameraError('Camera access was denied. Please allow camera permissions in your browser settings.');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setCameraError('No camera was detected on this device. You can enter the barcode manually or upload a photo.');
      } else {
        setCameraError(error.message || 'Unable to access the camera.');
      }
    }
  }, [facingMode, startScanTimer, stopCamera]);

  // Mount effect: start camera and cleanup on unmount
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      if (isMounted) {
        await startCamera();
      }
    };
    void init();

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // Handle visibility change (pause scanning when tab is hidden, resume when visible)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopScanTimer();
      } else if (!isLockedRef.current && !isProcessing && hasCamera) {
        startScanTimer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [hasCamera, isProcessing, startScanTimer, stopScanTimer]);

  // Auto-unlock / reset detection lock when processing completes and user is still on scanner
  const prevProcessingRef = useRef(isProcessing);
  useEffect(() => {
    if (prevProcessingRef.current && !isProcessing) {
      const timer = setTimeout(() => {
        if (isLockedRef.current) {
          unlockScanner();
          startScanTimer();
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
    prevProcessingRef.current = isProcessing;
  }, [isProcessing, startScanTimer, unlockScanner]);

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

  // Flip camera between front and back
  const flipCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Handle image file upload for barcode decoding using direct ZXing multi-pass
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.src = objectUrl;

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      let detectedCode: string | null = null;
      let detectedFmt: string | null = null;

      // 1. Try Native BarcodeDetector on image
      if (nativeDetectorRef.current) {
        try {
          const barcodes = await nativeDetectorRef.current.detect(img);
          if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
            detectedCode = barcodes[0].rawValue;
            detectedFmt = barcodes[0].format;
          }
        } catch {
          // Native decode failed, continue to ZXing
        }
      }

      // 2. Direct ZXing Multi-pass on image canvas
      if (!detectedCode && zxingReaderRef.current) {
        const canvas = document.createElement('canvas');
        const origW = img.naturalWidth || img.width;
        const origH = img.naturalHeight || img.height;
        const maxDim = 1400;
        const scale = Math.min(1, maxDim / Math.max(origW, origH));
        const targetW = Math.round(origW * scale);
        const targetH = Math.round(origH * scale);

        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(img, 0, 0, targetW, targetH);

          // Pass 1: Original image canvas
          let res = decodeCanvasWithZxing(canvas, zxingReaderRef.current, 'Upload Image');
          if (res) {
            detectedCode = res.code;
            detectedFmt = res.format;
          }

          // Pass 2: Contrast stretched
          if (!detectedCode) {
            const contrastCanvas = document.createElement('canvas');
            if (applyContrastStretch(canvas, contrastCanvas)) {
              res = decodeCanvasWithZxing(contrastCanvas, zxingReaderRef.current, 'Upload Contrast');
              if (res) {
                detectedCode = res.code;
                detectedFmt = res.format;
              }
            }
          }

          // Pass 3: Central 70% crop pass for photos with large packaging borders
          if (!detectedCode && targetW > 500) {
            const cropW = Math.round(targetW * 0.75);
            const cropH = Math.round(targetH * 0.6);
            const cropX = Math.round((targetW - cropW) / 2);
            const cropY = Math.round((targetH - cropH) / 2);

            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = cropW;
            cropCanvas.height = cropH;
            const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true });
            if (cropCtx) {
              cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
              res = decodeCanvasWithZxing(cropCanvas, zxingReaderRef.current, 'Upload Central Crop');
              if (res) {
                detectedCode = res.code;
                detectedFmt = res.format;
              }
            }
          }
        }
      }

      URL.revokeObjectURL(objectUrl);
      setIsUploading(false);

      if (detectedCode) {
        const clean = normalizeBarcode(detectedCode);
        if (validateBarcode(clean)) {
          lockAndTrigger(clean, detectedFmt || 'UPLOAD');
        } else {
          alert(`Decoded barcode "${clean}" is not a recognized retail barcode format.`);
        }
      } else {
        alert('No barcode detected in this image. Please ensure the barcode is clearly visible and well-lit, or enter manually.');
      }
    } catch {
      setIsUploading(false);
      alert('Could not decode a barcode from this image. Please enter the barcode number manually.');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const isDetected = scannerState === 'detected' || Boolean(detectedBarcode);

  return (
    <div className="space-y-4 w-full">
      <div className="card-3d relative w-full rounded-3xl overflow-hidden bg-[#151311] border-2 border-[#38312A] shadow-[0_16px_40px_-8px_rgba(0,0,0,0.5)]">
        {/* Video Viewport */}
        <div className="relative aspect-[4/3] sm:aspect-video w-full flex items-center justify-center overflow-hidden bg-black">
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
              {/* Viewfinder Target Box (referenced by reticleRef for pixel-accurate crop) */}
              <div
                ref={reticleRef}
                className={`relative w-64 h-36 sm:w-80 sm:h-44 rounded-2xl transition-all duration-300 flex items-center justify-center overflow-hidden ${
                  isDetected
                    ? 'border-3 border-[#3F8F68] shadow-[0_0_35px_rgba(63,143,104,0.6)] bg-[#3F8F68]/10'
                    : 'border-2 border-[#E86A33]/85 shadow-[0_0_25px_rgba(232,106,51,0.25)]'
                }`}
              >
                {/* Corner Accents */}
                <div
                  className={`absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 rounded-tl-lg transition-colors ${
                    isDetected ? 'border-[#3F8F68]' : 'border-[#E86A33]'
                  }`}
                />
                <div
                  className={`absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 rounded-tr-lg transition-colors ${
                    isDetected ? 'border-[#3F8F68]' : 'border-[#E86A33]'
                  }`}
                />
                <div
                  className={`absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 rounded-bl-lg transition-colors ${
                    isDetected ? 'border-[#3F8F68]' : 'border-[#E86A33]'
                  }`}
                />
                <div
                  className={`absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 rounded-br-lg transition-colors ${
                    isDetected ? 'border-[#3F8F68]' : 'border-[#E86A33]'
                  }`}
                />

                {/* Animated Laser Scanning Beam */}
                {!isDetected ? (
                  <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#E86A33] to-transparent animate-scan-beam opacity-90 shadow-[0_0_12px_#E86A33]" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#3F8F68]/20 backdrop-blur-xs">
                    <div className="w-10 h-10 rounded-full bg-[#3F8F68] text-white flex items-center justify-center shadow-lg animate-bounce">
                      <CheckIcon size={22} />
                    </div>
                  </div>
                )}

                {/* Status Badge in Reticle */}
                <span
                  className={`absolute bottom-2 text-2xs font-bold tracking-wider uppercase px-3 py-1 rounded-full font-mono transition-colors shadow-sm ${
                    isDetected
                      ? 'bg-[#3F8F68] text-white'
                      : 'bg-[#1D1A17]/90 text-[#F4A340] border border-[#E86A33]/40'
                  }`}
                >
                  {isDetected ? `✓ ${detectedBarcode}` : 'Point at Barcode'}
                </span>
              </div>

              {/* Guidance Text Under Viewfinder */}
              <div className="mt-4 text-center max-w-sm px-4">
                <p className="text-xs font-semibold text-stone-200 drop-shadow-md">
                  {isDetected
                    ? 'Barcode detected — looking up product...'
                    : 'Point your camera at the barcode'}
                </p>
                <p className="text-3xs text-stone-400 mt-0.5">
                  {isDetected
                    ? `Format: ${detectedFormat || normalizeBarcodeFormat(detectedBarcode || '', '')}`
                    : 'Supports EAN-13, EAN-8, UPC-A, UPC-E & Code 128'}
                </p>
              </div>
            </div>
          )}

          {/* Processing State Overlay */}
          {isProcessing && (
            <div className="absolute inset-0 bg-[#151311]/80 backdrop-blur-xs flex flex-col items-center justify-center p-4 z-20">
              <div className="w-12 h-12 rounded-2xl bg-[#2A1C14] border border-[#E86A33]/40 flex items-center justify-center text-[#E86A33] mb-3 shadow-lg">
                <RefreshCwIcon size={24} className="animate-spin text-[#E86A33]" />
              </div>
              <span className="text-sm font-bold text-white tracking-wide">
                Looking up product...
              </span>
              <span className="text-xs text-stone-400 mt-1">
                Querying verified food packaging database
              </span>
            </div>
          )}

          {/* Upload Decoding Spinner */}
          {isUploading && (
            <div className="absolute inset-0 bg-[#151311]/85 backdrop-blur-xs flex flex-col items-center justify-center p-4 z-20">
              <RefreshCwIcon size={24} className="animate-spin text-[#E86A33] mb-2" />
              <span className="text-xs font-bold text-white">Analyzing uploaded photo...</span>
            </div>
          )}

          {/* Error / No Camera Fallback Overlay */}
          {cameraError && (
            <div className="absolute inset-0 bg-[#1D1A17]/95 flex flex-col items-center justify-center p-6 text-center z-10">
              <div className="w-12 h-12 rounded-2xl bg-[#2A1C14] border border-[#E86A33]/40 flex items-center justify-center text-[#E86A33] mb-3">
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
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCwIcon size={14} /> Retry Camera
                </button>
                <button
                  type="button"
                  onClick={() => setManualInputOpen(true)}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#E86A33] hover:bg-[#d65f2c] text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  Enter Barcode Manually
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Control Bar */}
        <div className="p-3 sm:p-4 bg-[#1D1A17] border-t border-[#38312A] flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            {torchAvailable && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  torchOn
                    ? 'bg-[#F4A340] text-stone-950 font-bold shadow-xs'
                    : 'bg-[#25211D] hover:bg-[#2F2925] text-stone-300 border border-[#38312A]'
                }`}
              >
                <span>⚡</span> {torchOn ? 'Torch On' : 'Torch'}
              </button>
            )}

            <button
              type="button"
              onClick={flipCamera}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#25211D] hover:bg-[#2F2925] text-stone-300 text-xs font-semibold transition-colors flex items-center gap-1.5 border border-[#38312A] cursor-pointer"
              title="Switch front/back camera"
            >
              <CameraIcon size={16} /> <span>Flip</span>
            </button>

            {/* Upload image fallback */}
            <label className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#25211D] hover:bg-[#2F2925] text-stone-300 text-xs font-semibold transition-colors flex items-center gap-1.5 border border-[#38312A] cursor-pointer">
              <span>📁</span> <span>Upload Photo</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {isDetected && !isProcessing && (
              <button
                type="button"
                onClick={() => {
                  unlockScanner();
                  startScanTimer();
                }}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold transition-colors cursor-pointer border border-stone-700"
              >
                Scan Again
              </button>
            )}

            <button
              type="button"
              onClick={() => setManualInputOpen(true)}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#E86A33] hover:bg-[#d65f2c] text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
            >
              ⌨️ Enter Barcode Manually
            </button>
          </div>
        </div>
      </div>

      {/* Development-Only "Barcode Diagnostics" Collapsible Panel (Must NOT appear in production) */}
      {isDev && (
        <div className="w-full bg-[#181512] border-2 border-amber-600/40 rounded-2xl overflow-hidden text-stone-200 text-xs shadow-xl font-mono">
          {/* Header Toggle */}
          <button
            type="button"
            onClick={() => setDiagnosticsOpen((prev) => !prev)}
            className="w-full p-3.5 bg-[#201B17] hover:bg-[#27211C] flex items-center justify-between border-b border-amber-600/30 cursor-pointer transition-colors text-left"
          >
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-bold text-amber-400 text-sm flex items-center gap-1.5">
                <span>🔬</span> Barcode Diagnostics
              </span>
              <span className="px-2 py-0.5 rounded text-3xs font-bold bg-amber-950 text-amber-300 border border-amber-800">
                DEV ONLY
              </span>
              {/* Quick Status Pills */}
              <span className={`px-2 py-0.5 rounded text-3xs font-bold ${diagData.cameraStatus === 'AVAILABLE' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300'}`}>
                CAM: {diagData.cameraStatus}
              </span>
              <span className={`px-2 py-0.5 rounded text-3xs font-bold ${diagData.nativeStatus === 'DETECTED' ? 'bg-emerald-950 text-emerald-300' : diagData.nativeStatus === 'UNSUPPORTED' ? 'bg-stone-800 text-stone-400' : 'bg-amber-950 text-amber-300'}`}>
                NATIVE: {diagData.nativeStatus}
              </span>
              <span className={`px-2 py-0.5 rounded text-3xs font-bold ${diagData.zxingRoiStatus === 'DETECTED' ? 'bg-emerald-950 text-emerald-300' : 'bg-stone-800 text-stone-300'}`}>
                ZXING ROI: {diagData.zxingRoiStatus}
              </span>
              <span className={`px-2 py-0.5 rounded text-3xs font-bold ${diagData.zxingFullFrameStatus === 'DETECTED' ? 'bg-emerald-950 text-emerald-300' : 'bg-stone-800 text-stone-300'}`}>
                FULL-FRAME: {diagData.zxingFullFrameStatus}
              </span>
            </div>
            <span className="text-amber-400 font-bold ml-2">
              {diagnosticsOpen ? '▼ Hide' : '▶ Expand'}
            </span>
          </button>

          {diagnosticsOpen && (
            <div className="p-4 space-y-4 bg-[#141210]">
              {/* Diagnostic Actions */}
              <div className="flex flex-wrap gap-2 pt-1 border-b border-stone-800 pb-3">
                <button
                  type="button"
                  onClick={handleCaptureDebugFrame}
                  className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>📸</span> Capture Debug Frame
                </button>

                <button
                  type="button"
                  onClick={handleTestKnownBarcode}
                  className="px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Test verified Nutella EAN-13 barcode canvas"
                >
                  <span>🧪</span> Test Known Nutella Barcode (3017620422003)
                </button>

                <label className="px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-stone-700">
                  <span>📁</span> Decode Uploaded Test Image
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleDiagnosticUpload}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => {
                    framesStartedRef.current = 0;
                    framesCompletedRef.current = 0;
                    framesSkippedRef.current = 0;
                    nativeDetectionsRef.current = 0;
                    zxingDetectionsRef.current = 0;
                    setDiagData((prev) => ({
                      ...prev,
                      framesStarted: 0,
                      framesCompleted: 0,
                      framesSkipped: 0,
                      totalFramesProcessed: 0,
                      totalNativeDetections: 0,
                      totalZxingDetections: 0,
                      lastDecoderFailure: 'None',
                    }));
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-400 text-2xs transition-colors ml-auto cursor-pointer"
                >
                  Reset Telemetry
                </button>
              </div>

              {/* Visual Frame Inspection Viewports */}
              {debugSnapshots.capturedAt && (
                <div className="space-y-2.5 p-3 rounded-xl bg-[#1C1814] border border-amber-600/30">
                  <div className="flex items-center justify-between text-2xs font-bold text-amber-400">
                    <span>VISUAL DECODER SNAPSHOTS (Captured: {debugSnapshots.capturedAt})</span>
                    <span className="text-stone-400 text-3xs">Inspect raw image data delivered to decoders</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Camera Frame */}
                    <div className="space-y-1 bg-black/60 p-2 rounded-lg border border-stone-800">
                      <div className="flex items-center justify-between text-3xs text-stone-300">
                        <span className="font-bold text-white">Full Camera Frame</span>
                        <span className="text-amber-400 font-mono">{debugSnapshots.cameraRes}</span>
                      </div>
                      {debugSnapshots.cameraFrameUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={debugSnapshots.cameraFrameUrl}
                          alt="Full camera frame"
                          className="w-full h-32 object-contain bg-black rounded"
                        />
                      ) : (
                        <div className="h-32 flex items-center justify-center text-3xs text-stone-600">No snapshot</div>
                      )}
                    </div>

                    {/* ROI Canvas */}
                    <div className="space-y-1 bg-black/60 p-2 rounded-lg border border-stone-800">
                      <div className="flex items-center justify-between text-3xs text-stone-300">
                        <span className="font-bold text-emerald-400">Exact ROI Canvas (1:1)</span>
                        <span className="text-amber-400 font-mono">{debugSnapshots.roiRes}</span>
                      </div>
                      {debugSnapshots.roiCanvasUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={debugSnapshots.roiCanvasUrl}
                          alt="ROI canvas"
                          className="w-full h-32 object-contain bg-black rounded"
                        />
                      ) : (
                        <div className="h-32 flex items-center justify-center text-3xs text-stone-600">No snapshot</div>
                      )}
                    </div>

                    {/* Contrast Preprocessed ROI */}
                    <div className="space-y-1 bg-black/60 p-2 rounded-lg border border-stone-800">
                      <div className="flex items-center justify-between text-3xs text-stone-300">
                        <span className="font-bold text-cyan-400">Contrast Stretched ROI</span>
                        <span className="text-amber-400 font-mono">{debugSnapshots.contrastRes}</span>
                      </div>
                      {debugSnapshots.contrastCanvasUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={debugSnapshots.contrastCanvasUrl}
                          alt="Contrast canvas"
                          className="w-full h-32 object-contain bg-black rounded"
                        />
                      ) : (
                        <div className="h-32 flex items-center justify-center text-3xs text-stone-600">No snapshot</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Telemetry Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-2xs">
                {/* 1. CAMERA */}
                <div className="p-3 rounded-xl bg-stone-900/80 border border-stone-800 space-y-1.5">
                  <div className="font-bold text-amber-400 border-b border-stone-800 pb-1 flex items-center justify-between">
                    <span>1. CAMERA</span>
                    <span className={diagData.cameraStatus === 'AVAILABLE' ? 'text-emerald-400' : 'text-rose-400'}>
                      {diagData.cameraStatus}
                    </span>
                  </div>
                  <div><span className="text-stone-400">readyState:</span> {diagData.readyState} ({diagData.readyState >= 2 ? 'READY' : 'NOT READY'})</div>
                  <div><span className="text-stone-400">Resolution:</span> {diagData.videoWidth} × {diagData.videoHeight}</div>
                  <div><span className="text-stone-400">facingMode:</span> {diagData.facingMode}</div>
                  <div className="truncate"><span className="text-stone-400">Capabilities:</span> <span className="text-3xs text-stone-300">{diagData.trackCapabilities}</span></div>
                </div>

                {/* 2. NATIVE DETECTOR */}
                <div className="p-3 rounded-xl bg-stone-900/80 border border-stone-800 space-y-1.5">
                  <div className="font-bold text-amber-400 border-b border-stone-800 pb-1 flex items-center justify-between">
                    <span>2. NATIVE DETECTOR</span>
                    <span className={diagData.nativeStatus === 'DETECTED' ? 'text-emerald-400' : 'text-stone-400'}>
                      {diagData.nativeStatus}
                    </span>
                  </div>
                  <div><span className="text-stone-400">Supported:</span> {diagData.nativeSupported ? 'YES' : 'NO'}</div>
                  <div className="truncate"><span className="text-stone-400">Formats:</span> {diagData.nativeSupportedFormats.join(', ') || 'Default'}</div>
                  <div><span className="text-stone-400">ROI Attempted:</span> {diagData.nativeRoiAttempted ? 'YES' : 'NO'}</div>
                  <div><span className="text-stone-400">Detections:</span> {diagData.nativeRoiDetectionCount}</div>
                  <div className="truncate"><span className="text-stone-400">Last Error:</span> {diagData.nativeLastError}</div>
                </div>

                {/* 3. ZXING ENGINE */}
                <div className="p-3 rounded-xl bg-stone-900/80 border border-stone-800 space-y-1.5">
                  <div className="font-bold text-amber-400 border-b border-stone-800 pb-1 flex items-center justify-between">
                    <span>3. ZXING ENGINE</span>
                    <span className={diagData.zxingRoiStatus === 'DETECTED' || diagData.zxingFullFrameStatus === 'DETECTED' ? 'text-emerald-400' : 'text-stone-400'}>
                      {diagData.zxingRoiStatus}
                    </span>
                  </div>
                  <div><span className="text-stone-400">ROI GlobalHist:</span> {diagData.zxingRoiGlobalAttempted ? 'Attempted' : 'Skipped'}</div>
                  <div><span className="text-stone-400">ROI Hybrid:</span> {diagData.zxingRoiHybridAttempted ? 'Attempted' : 'Skipped'}</div>
                  <div><span className="text-stone-400">Contrast ROI:</span> {diagData.zxingContrastRoiAttempted ? 'Attempted' : 'Skipped'}</div>
                  <div><span className="text-stone-400">Rotated Pass:</span> {diagData.zxingRotatedAttempted ? 'Enabled' : 'Disabled'}</div>
                  <div><span className="text-stone-400">Full-Frame Pass:</span> {diagData.zxingFullFrameAttempted ? 'Attempted' : 'Skipped'}</div>
                  <div><span className="text-stone-400">Duration:</span> {diagData.zxingDecodeDurationMs}ms</div>
                  <div className="truncate"><span className="text-stone-400">Last Error:</span> {diagData.zxingLastError}</div>
                </div>

                {/* 4. PIPELINE STATS */}
                <div className="p-3 rounded-xl bg-stone-900/80 border border-stone-800 space-y-1.5">
                  <div className="font-bold text-amber-400 border-b border-stone-800 pb-1 flex items-center justify-between">
                    <span>4. PIPELINE</span>
                    <span className="text-emerald-400 font-bold">{diagData.totalFramesProcessed} frames</span>
                  </div>
                  <div><span className="text-stone-400">Started / Done:</span> {diagData.framesStarted} / {diagData.framesCompleted}</div>
                  <div><span className="text-stone-400">Skipped (In-Flight):</span> {diagData.framesSkipped}</div>
                  <div><span className="text-stone-400">Native / ZXing Hits:</span> {diagData.totalNativeDetections} / {diagData.totalZxingDetections}</div>
                  <div><span className="text-stone-400">Last Engine:</span> <span className="text-white font-bold">{diagData.lastEngineUsed}</span></div>
                  <div><span className="text-stone-400">Last Code:</span> <span className="text-amber-300 font-bold">{diagData.lastDetectedCode}</span></div>
                  <div><span className="text-stone-400">Upload Status:</span> <span className="text-cyan-300">{diagData.uploadStatus}</span></div>
                  <div className="truncate"><span className="text-stone-400">Last Failure:</span> {diagData.lastDecoderFailure}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual Barcode Input Modal */}
      {manualInputOpen && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#1D1A17] border border-[#38312A] rounded-3xl max-w-md w-full p-6 text-stone-100 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>🔳</span> Enter Product Barcode
              </h3>
              <button
                type="button"
                onClick={() => setManualInputOpen(false)}
                className="text-stone-400 hover:text-white text-lg p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-stone-400 leading-relaxed">
              Type the 8, 12, or 13-digit EAN/UPC number printed under the barcode lines on your packaged food wrapper.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const clean = normalizeBarcode(manualBarcode);
                if (validateBarcode(clean)) {
                  setManualInputOpen(false);
                  lockAndTrigger(clean, 'MANUAL');
                } else {
                  alert('Please enter a valid 8, 12, or 13-digit retail barcode number.');
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
                  inputMode="numeric"
                  pattern="[0-9A-Za-z\-]+"
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  placeholder="e.g. 8901058852331"
                  autoFocus
                  className="w-full px-4 py-2.5 rounded-xl bg-[#151311] border border-[#38312A] text-white font-mono text-sm tracking-wider focus:outline-hidden focus:border-[#E86A33] focus:ring-1 focus:ring-[#E86A33]"
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
                        lockAndTrigger(item.barcode, 'SAMPLE');
                      }}
                      className="px-2.5 py-1.5 text-left rounded-lg bg-[#25211D] hover:bg-[#2F2925] border border-[#38312A] text-2xs text-stone-200 transition-colors cursor-pointer"
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
                  className="min-h-[44px] px-4 py-2 rounded-xl text-stone-400 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!manualBarcode.trim()}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-[#E86A33] hover:bg-[#d65f2c] disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
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
