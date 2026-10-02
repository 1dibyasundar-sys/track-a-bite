/**
 * Track-a-Bite — Package OCR Service (Client-side)
 *
 * Calls the server OCR endpoint to read printed MFG / EXP / Batch stamps.
 */

import { PackageOcrResult, ExpiryStatus } from '../types/barcode';

export interface PackageOcrResponse {
  success: boolean;
  ocrResult: PackageOcrResult;
  expiryStatus: ExpiryStatus;
  daysRemaining: number | null;
  statusLabel: string;
  errorMessage?: string;
}

export class PackageOcrService {
  async extractPackageDetails(dataUrl: string): Promise<PackageOcrResponse> {
    try {
      const res = await fetch('/api/ocr-package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return {
          success: false,
          ocrResult: {
            manufacturingDate: null,
            rawManufacturingDateText: null,
            expiryDate: null,
            rawExpiryDateText: null,
            bestBeforePeriodText: null,
            isEstimatedExpiry: false,
            batchNumber: null,
            rawBatchText: null,
            confidence: 'unverified',
            unverifiedReason: body.errorMessage || 'Failed to analyze package photo.',
          },
          expiryStatus: 'UNKNOWN',
          daysRemaining: null,
          statusLabel: 'Date Unverified',
          errorMessage: body.errorMessage,
        };
      }

      const data = await res.json();
      return data;
    } catch (err: unknown) {
      const error = err as Error;
      return {
        success: false,
        ocrResult: {
          manufacturingDate: null,
          rawManufacturingDateText: null,
          expiryDate: null,
          rawExpiryDateText: null,
          bestBeforePeriodText: null,
          isEstimatedExpiry: false,
          batchNumber: null,
          rawBatchText: null,
          confidence: 'unverified',
          unverifiedReason: error.message || 'Network error occurred.',
        },
        expiryStatus: 'UNKNOWN',
        daysRemaining: null,
        statusLabel: 'Date Unverified',
        errorMessage: error.message,
      };
    }
  }
}

export const packageOcrService = new PackageOcrService();
