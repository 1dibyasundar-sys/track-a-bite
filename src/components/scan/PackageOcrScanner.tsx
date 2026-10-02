'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { CameraIcon, AlertCircleIcon, RefreshCwIcon } from '../ui/icons';
import { PackageOcrResult, ExpiryStatus } from '../../lib/types/barcode';
import { packageOcrService } from '../../lib/services/packageOcrService';
import { expiryCalculationService } from '../../lib/services/expiryCalculationService';

interface PackageOcrScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyDetails: (details: PackageOcrResult) => void;
  currentDetails?: PackageOcrResult | null;
}

export function PackageOcrScanner({
  isOpen,
  onClose,
  onApplyDetails,
  currentDetails,
}: PackageOcrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);

  // Form editable states
  const [mfgDate, setMfgDate] = useState(currentDetails?.manufacturingDate || '');
  const [expDate, setExpDate] = useState(currentDetails?.expiryDate || '');
  const [batchNumber, setBatchNumber] = useState(currentDetails?.batchNumber || '');
  const [bestBeforePeriod, setBestBeforePeriod] = useState(currentDetails?.bestBeforePeriod || '');
  const [rawText, setRawText] = useState(currentDetails?.rawOcrText || '');
  const [isUncertain, setIsUncertain] = useState(currentDetails?.needsUserConfirmation ?? false);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);

  // Stop camera cleanly
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Start camera for package detail targeting asynchronously
  const startCamera = useCallback(async () => {
    stopCamera();

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setHasCamera(false);
      setCameraError('Camera is not supported on this device.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      setCameraError(null);
      setHasCamera(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err: unknown) {
      const error = err as Error;
      setHasCamera(false);
      setCameraError(error.message || 'Camera access error.');
    }
  }, [stopCamera]);

  useEffect(() => {
    let isMounted = true;
    if (isOpen) {
      const init = async () => {
        if (isMounted) {
          await startCamera();
        }
      };
      init();
    } else {
      stopCamera();
    }
    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  // Process image blob with OCR service
  const runOcrOnImage = async (dataUrl: string) => {
    setIsProcessingOcr(true);
    setOcrError(null);

    try {
      const result = await packageOcrService.extractPackageDetails(dataUrl);

      if (result.success && result.ocrResult) {
        const d = result.ocrResult;
        setMfgDate(d.manufacturingDate || '');
        setExpDate(d.expiryDate || '');
        setBatchNumber(d.batchNumber || '');
        setBestBeforePeriod(d.bestBeforePeriod || d.bestBeforePeriodText || '');
        setRawText(d.rawOcrText || '');
        setIsUncertain(Boolean(d.needsUserConfirmation));
      } else {
        setOcrError(
          result.errorMessage ||
            'Could not extract date stamps. Please enter the details manually below.'
        );
        setIsUncertain(true);
      }
    } catch (err: unknown) {
      const error = err as Error;
      setOcrError(error.message || 'OCR processing failed.');
      setIsUncertain(true);
    } finally {
      setIsProcessingOcr(false);
    }
  };

  if (!isOpen) return null;

  // Capture frame from live video
  const handleSnap = async () => {
    if (!videoRef.current) return;
    setIsCapturing(true);

    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      setCapturedPreview(dataUrl);

      await runOcrOnImage(dataUrl);
    } finally {
      setIsCapturing(false);
    }
  };

  // Upload photo file for OCR
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setCapturedPreview(dataUrl);
      await runOcrOnImage(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // Live recalculate expiry status from the user's current values
  const currentExpiryEvaluation = expiryCalculationService.calculateExpiryFromDates({
    manufacturingDate: mfgDate.trim() || undefined,
    expiryDate: expDate.trim() || undefined,
    bestBeforePeriod: bestBeforePeriod.trim() || undefined,
  });

  // Apply confirmed details
  const handleSave = () => {
    const details: PackageOcrResult = {
      manufacturingDate: mfgDate.trim() || null,
      expiryDate: expDate.trim() || null,
      batchNumber: batchNumber.trim() || null,
      bestBeforePeriod: bestBeforePeriod.trim() || null,
      bestBeforePeriodText: bestBeforePeriod.trim() || null,
      isBestBeforeDerived: currentExpiryEvaluation.isDerived,
      derivedBestBeforeDate: currentExpiryEvaluation.derivedExpiryDate,
      estimatedBestBeforeDate: currentExpiryEvaluation.derivedExpiryDate,
      expiryStatus: currentExpiryEvaluation.status,
      expiryExplanation: currentExpiryEvaluation.explanation,
      rawOcrText: rawText.trim() || undefined,
      confidence: isUncertain ? 'medium' : 'high',
      needsUserConfirmation: false,
    };

    onApplyDetails(details);
    onClose();
  };

  const getStatusBadge = (status: ExpiryStatus) => {
    switch (status) {
      case 'VALID':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            🟢 Valid Product
          </span>
        );
      case 'EXPIRING_SOON':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            🟡 Expiring Soon
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            🔴 Expired
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700">
            ⚪ Date Unverified
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white dark:bg-[#1D1A17] rounded-3xl max-w-xl w-full p-5 sm:p-6 text-stone-900 dark:text-stone-100 border border-stone-200 dark:border-[#38312A] shadow-2xl space-y-4 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 dark:border-[#38312A] pb-3">
          <div>
            <span className="text-2xs font-bold tracking-widest text-[#E86A33] uppercase px-2 py-0.5 rounded-full bg-[#FEF7EE] dark:bg-[#2A1C14] border border-[#FBD5BD] dark:border-[#4D2918]">
              Package Intelligence • OCR
            </span>
            <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100 mt-1">
              Scan MFG, EXP &amp; Batch Details
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 flex items-center justify-center text-sm font-bold"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-stone-600 leading-relaxed">
          Point your camera directly at the printed date stamp (MFG, EXP, Use By, or Batch number) on the package back or crimp.
        </p>

        {/* Viewport / Snapshot area */}
        <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-stone-950 border border-stone-800 flex items-center justify-center">
          {capturedPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={capturedPreview}
              alt="Package Snapshot"
              className="w-full h-full object-cover"
            />
          ) : (
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="w-full h-full object-cover"
            />
          )}

          {/* Guide Overlay when camera active */}
          {!capturedPreview && hasCamera && !cameraError && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-4">
              <div className="w-56 h-28 border-2 border-dashed border-amber-300/90 rounded-xl bg-amber-500/10 flex items-center justify-center shadow-lg">
                <span className="text-2xs font-semibold text-amber-200 uppercase tracking-wider px-2 py-1 rounded bg-black/60">
                  Align Date Stamp Here
                </span>
              </div>
            </div>
          )}

          {/* OCR Processing Spinner */}
          {isProcessingOcr && (
            <div className="absolute inset-0 bg-stone-950/80 backdrop-blur-xs flex flex-col items-center justify-center text-center p-4">
              <RefreshCwIcon className="w-8 h-8 text-emerald-400 animate-spin mb-2" />
              <span className="text-sm font-bold text-white">
                Reading Package Details...
              </span>
              <span className="text-xs text-stone-300 mt-0.5">
                Extracting MFG, EXP and Batch with AI OCR
              </span>
            </div>
          )}
        </div>

        {/* Action buttons under camera */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2">
            {!capturedPreview ? (
              <button
                type="button"
                onClick={handleSnap}
                disabled={isCapturing || isProcessingOcr || !hasCamera}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <CameraIcon size={14} /> Snap Date Stamp
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setCapturedPreview(null);
                  startCamera();
                }}
                className="px-3.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                <RefreshCwIcon size={13} /> Retake Photo
              </button>
            )}

            <label className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition-colors cursor-pointer">
              📁 Upload Photo
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </div>

          <div className="text-right">
            {getStatusBadge(currentExpiryEvaluation.status)}
          </div>
        </div>

        {/* OCR Error or Uncertainty Alert */}
        {ocrError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
            <AlertCircleIcon size={16} className="text-rose-600 shrink-0 mt-0.5" />
            <span>{ocrError}</span>
          </div>
        )}

        {isUncertain && !ocrError && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
            <AlertCircleIcon size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold block">Please confirm the detected date.</span>
              <span className="text-2xs text-amber-800">
                Printed package dates can be faint or stylized. Verify below before saving.
              </span>
            </div>
          </div>
        )}

        {/* Extracted Details & Manual Verification Form */}
        <div className="bg-stone-50 dark:bg-[#1D1A17] rounded-2xl p-4 border border-stone-200 dark:border-[#38312A] space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-stone-800 dark:text-stone-200 uppercase tracking-wider">
              Extracted Package Details
            </h4>
            <span className="text-3xs text-stone-500 dark:text-stone-400 font-medium">
              Editable • Never fabricated
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Manufacturing Date */}
            <div>
              <label className="text-2xs font-semibold text-stone-600 dark:text-stone-400 block mb-1">
                Manufacturing Date (MFG / PKD)
              </label>
              <input
                type="text"
                value={mfgDate}
                onChange={(e) => setMfgDate(e.target.value)}
                placeholder="e.g. 12/08/2026 or 12 Aug 2026"
                className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-[#25211D] border border-stone-300 dark:border-[#38312A] font-mono text-stone-800 dark:text-stone-100 focus:outline-hidden focus:border-[#E86A33]"
              />
            </div>

            {/* Expiry Date */}
            <div>
              <label className="text-2xs font-semibold text-stone-600 dark:text-stone-400 block mb-1">
                Expiry Date (EXP / Use By)
              </label>
              <input
                type="text"
                value={expDate}
                onChange={(e) => setExpDate(e.target.value)}
                placeholder="e.g. 11/02/2027 or 11 Feb 2027"
                className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-[#25211D] border border-stone-300 dark:border-[#38312A] font-mono text-stone-800 dark:text-stone-100 focus:outline-hidden focus:border-[#E86A33]"
              />
            </div>

            {/* Best Before Period */}
            <div>
              <label className="text-2xs font-semibold text-stone-600 dark:text-stone-400 block mb-1">
                Best Before Clause (if printed)
              </label>
              <input
                type="text"
                value={bestBeforePeriod}
                onChange={(e) => setBestBeforePeriod(e.target.value)}
                placeholder="e.g. 6 Months from MFD"
                className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-[#25211D] border border-stone-300 dark:border-[#38312A] text-stone-800 dark:text-stone-100 focus:outline-hidden focus:border-[#E86A33]"
              />
            </div>

            {/* Batch / Lot */}
            <div>
              <label className="text-2xs font-semibold text-stone-600 dark:text-stone-400 block mb-1">
                Batch / Lot Number
              </label>
              <input
                type="text"
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                placeholder="e.g. B24X91"
                className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-[#25211D] border border-stone-300 dark:border-[#38312A] font-mono text-stone-800 dark:text-stone-100 uppercase focus:outline-hidden focus:border-[#E86A33]"
              />
            </div>
          </div>

          {/* Derived Best Before Notice if applicable */}
          {currentExpiryEvaluation.isDerived && currentExpiryEvaluation.derivedExpiryDate && (
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-2xs text-emerald-900 dark:text-emerald-200">
              <span className="font-bold">Estimated Best Before:</span>{' '}
              {expiryCalculationService.formatHumanDate(currentExpiryEvaluation.derivedExpiryDate)}{' '}
              (Calculated from printed MFG date &amp; {bestBeforePeriod})
            </div>
          )}

          {/* Unverified note if neither date is present */}
          {!mfgDate && !expDate && (
            <p className="text-2xs text-stone-500 dark:text-stone-400 italic">
              &quot;Manufacturing/expiry date could not be verified from the package.&quot;
            </p>
          )}

          {/* Expiry explanation note */}
          {currentExpiryEvaluation.explanation && (
            <p className="text-2xs text-stone-600 dark:text-stone-400">
              <span className="font-semibold">Expiry Assessment:</span>{' '}
              {currentExpiryEvaluation.explanation}
            </p>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 text-xs font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            Save &amp; Apply Package Details
          </button>
        </div>
      </div>
    </div>
  );
}
