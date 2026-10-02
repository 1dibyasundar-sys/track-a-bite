/**
 * Track-a-Bite — Expiry Calculation Service (Phase 4)
 *
 * Evaluates package manufacturing/expiry dates, computes estimated
 * best-before dates, and assigns strict expiry statuses:
 * - VALID
 * - EXPIRING_SOON (within 30 days)
 * - EXPIRED
 * - UNKNOWN
 *
 * Strict Rules:
 * - Never mark a product expired if the date could not be confidently determined.
 * - Derived "Best Before X months from MFD" must be explicitly marked as
 *   "Estimated Best Before", never fabricated as a printed expiry date.
 */

import { ExpiryStatus, PackageOcrResult } from '../types/barcode';

const EXPIRING_SOON_THRESHOLD_DAYS = 30;

/**
 * Normalizes common date strings into ISO YYYY-MM-DD format.
 * Supports:
 * - DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
 * - YYYY-MM-DD, YYYY/MM/DD
 * - DD MMM YYYY (e.g. 12 Aug 2026, 15-Sep-2025)
 * - MM/YYYY, MM-YYYY (defaults to last day of month)
 */
export function normalizeDateStringToIso(rawDateStr: string | null | undefined): string | null {
  if (!rawDateStr) return null;
  const str = rawDateStr.trim();

  // 1. ISO format: YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // 2. Day-Month-Year with month name: e.g. 12 Aug 2026 or 12-AUG-26
  const monthNames: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    january: '01', february: '02', march: '03', april: '04', june: '06',
    july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
  };

  const textMonthMatch = str.match(/^(\d{1,2})[\s/-]+([A-Za-z]+)[\s/-]+(\d{2,4})$/);
  if (textMonthMatch) {
    const [, day, monthStr, yearStr] = textMonthMatch;
    const mNum = monthNames[monthStr.toLowerCase()];
    if (mNum) {
      let yNum = yearStr;
      if (yNum.length === 2) {
        yNum = parseInt(yNum, 10) > 70 ? `19${yNum}` : `20${yNum}`;
      }
      return `${yNum}-${mNum}-${day.padStart(2, '0')}`;
    }
  }

  // 3. DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (dmyMatch) {
    const [, day, month, yearStr] = dmyMatch;
    let yNum = yearStr;
    if (yNum.length === 2) {
      yNum = parseInt(yNum, 10) > 70 ? `19${yNum}` : `20${yNum}`;
    }
    const mVal = parseInt(month, 10);
    const dVal = parseInt(day, 10);
    if (mVal >= 1 && mVal <= 12 && dVal >= 1 && dVal <= 31) {
      return `${yNum}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }

  // 4. Month/Year format: e.g. 08/2026 or AUG 2026
  const myMatch = str.match(/^(\d{1,2})[-/.](\d{4})$/);
  if (myMatch) {
    const [, month, year] = myMatch;
    const mVal = parseInt(month, 10);
    if (mVal >= 1 && mVal <= 12) {
      // Use last day of that month for expiry
      const lastDay = new Date(parseInt(year, 10), mVal, 0).getDate();
      return `${year}-${month.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }
  }

  return null;
}

/**
 * Parses Best Before duration (e.g. "6 Months", "180 Days", "1 Year")
 * and computes derived best before date from MFD.
 */
export function calculateBestBeforeFromMfd(
  mfdIso: string,
  bestBeforePeriodText: string
): {
  estimatedDate: string | null;
  isEstimated: boolean;
  durationMonths?: number;
  durationDays?: number;
} {
  if (!mfdIso || !bestBeforePeriodText) {
    return { estimatedDate: null, isEstimated: false };
  }

  const mfdDate = new Date(`${mfdIso}T00:00:00Z`);
  if (isNaN(mfdDate.getTime())) {
    return { estimatedDate: null, isEstimated: false };
  }

  const lower = bestBeforePeriodText.toLowerCase();
  let daysToAdd = 0;
  let monthsToAdd = 0;

  const monthMatch = lower.match(/(\d+)\s*(?:month|mth|m)/);
  const dayMatch = lower.match(/(\d+)\s*(?:day|d)/);
  const yearMatch = lower.match(/(\d+)\s*(?:year|yr|y)/);

  if (monthMatch) {
    monthsToAdd = parseInt(monthMatch[1], 10);
  } else if (dayMatch) {
    daysToAdd = parseInt(dayMatch[1], 10);
  } else if (yearMatch) {
    monthsToAdd = parseInt(yearMatch[1], 10) * 12;
  } else {
    return { estimatedDate: null, isEstimated: false };
  }

  const derived = new Date(mfdDate);
  if (monthsToAdd > 0) {
    derived.setUTCMonth(derived.getUTCMonth() + monthsToAdd);
  }
  if (daysToAdd > 0) {
    derived.setUTCDate(derived.getUTCDate() + daysToAdd);
  }

  const iso = derived.toISOString().split('T')[0];
  return {
    estimatedDate: iso,
    isEstimated: true,
    durationMonths: monthsToAdd,
    durationDays: daysToAdd,
  };
}


/**
 * Calculates ExpiryStatus comparing expiry date against current date.
 *
 * @param effectiveExpiryDate YYYY-MM-DD or null
 * @param referenceDate Optional date for testing (defaults to now)
 */
export function calculateExpiryStatus(
  effectiveExpiryDate: string | null | undefined,
  referenceDate: Date = new Date()
): {
  status: ExpiryStatus;
  daysRemaining: number | null;
  statusLabel: string;
} {
  if (!effectiveExpiryDate) {
    return {
      status: 'UNKNOWN',
      daysRemaining: null,
      statusLabel: 'Date Unverified',
    };
  }

  const exp = new Date(`${effectiveExpiryDate}T00:00:00`);
  if (isNaN(exp.getTime())) {
    return {
      status: 'UNKNOWN',
      daysRemaining: null,
      statusLabel: 'Date Unverified',
    };
  }

  // Compare strictly on date boundaries (start of day)
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const expDay = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate());

  const diffMs = expDay.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      status: 'EXPIRED',
      daysRemaining: diffDays,
      statusLabel: 'Expired',
    };
  }

  if (diffDays <= EXPIRING_SOON_THRESHOLD_DAYS) {
    return {
      status: 'EXPIRING_SOON',
      daysRemaining: diffDays,
      statusLabel: `Expires in ${diffDays} day${diffDays === 1 ? '' : 's'}`,
    };
  }

  return {
    status: 'VALID',
    daysRemaining: diffDays,
    statusLabel: 'Valid Product',
  };
}

/**
 * Formats ISO date (YYYY-MM-DD) into readable human display format (e.g. "12 Aug 2026").
 */
export function formatPackageDate(isoDateStr: string | null | undefined): string {
  if (!isoDateStr) return 'Not available';
  try {
    const [year, month, day] = isoDateStr.split('-');
    if (!year || !month || !day) return isoDateStr;
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    const mIdx = parseInt(month, 10) - 1;
    if (mIdx >= 0 && mIdx < 12) {
      return `${parseInt(day, 10)} ${months[mIdx]} ${year}`;
    }
    return isoDateStr;
  } catch {
    return isoDateStr;
  }
}

/**
 * Evaluates an entire PackageOcrResult and computes its effective expiry date and status.
 */
export function evaluatePackageOcr(
  ocr: Partial<PackageOcrResult>,
  referenceDate: Date = new Date()
): {
  evaluatedOcr: PackageOcrResult;
  status: ExpiryStatus;
  daysRemaining: number | null;
  statusLabel: string;
} {
  const mfd = normalizeDateStringToIso(ocr.manufacturingDate || ocr.rawManufacturingDateText);
  let exp = normalizeDateStringToIso(ocr.expiryDate || ocr.rawExpiryDateText);
  let isEstimated = false;
  let estimatedBestBefore: string | null = null;

  // If no explicit EXP date, but MFD + Best Before duration exist
  if (!exp && mfd && ocr.bestBeforePeriodText) {
    const calc = calculateBestBeforeFromMfd(mfd, ocr.bestBeforePeriodText);
    if (calc.estimatedDate) {
      exp = calc.estimatedDate;
      estimatedBestBefore = calc.estimatedDate;
      isEstimated = true;
    }
  }

  const { status, daysRemaining, statusLabel } = calculateExpiryStatus(exp, referenceDate);

  const confidence = ocr.confidence || (exp ? 'high' : 'unverified');

  const evaluatedOcr: PackageOcrResult = {
    manufacturingDate: mfd,
    rawManufacturingDateText: ocr.rawManufacturingDateText || null,
    expiryDate: exp,
    rawExpiryDateText: ocr.rawExpiryDateText || null,
    bestBeforePeriodText: ocr.bestBeforePeriodText || null,
    isEstimatedExpiry: isEstimated,
    estimatedBestBeforeDate: estimatedBestBefore,
    batchNumber: ocr.batchNumber || ocr.rawBatchText || null,
    rawBatchText: ocr.rawBatchText || null,
    confidence,
    unverifiedReason: !exp ? 'Manufacturing/expiry date could not be verified from the package.' : undefined,
    rawOcrText: ocr.rawOcrText || undefined,
  };

  return {
    evaluatedOcr,
    status,
    daysRemaining,
    statusLabel,
  };
}

export function calculateExpiryFromDates(
  input: {
    manufacturingDate?: string | null;
    expiryDate?: string | null;
    bestBeforePeriod?: string | null;
  },
  referenceDate: Date = new Date()
): {
  status: ExpiryStatus;
  derivedExpiryDate?: string | null;
  isDerived: boolean;
  daysRemaining?: number | null;
  explanation: string;
} {
  const mfd = normalizeDateStringToIso(input.manufacturingDate);
  let exp = normalizeDateStringToIso(input.expiryDate);
  let isDerived = false;
  let derivedExpiryDate: string | null = null;

  if (!exp && mfd && input.bestBeforePeriod) {
    const calc = calculateBestBeforeFromMfd(mfd, input.bestBeforePeriod);
    if (calc.estimatedDate) {
      exp = calc.estimatedDate;
      derivedExpiryDate = calc.estimatedDate;
      isDerived = true;
    }
  }

  const { status, daysRemaining } = calculateExpiryStatus(exp, referenceDate);

  let explanation = '';
  if (status === 'EXPIRED') {
    explanation = isDerived
      ? `Estimated Best Before date (${formatPackageDate(exp)}) has passed.`
      : `Printed expiration date (${formatPackageDate(exp)}) has passed.`;
  } else if (status === 'EXPIRING_SOON') {
    explanation = `Item expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}.`;
  } else if (status === 'VALID') {
    explanation = isDerived
      ? `Estimated Best Before: ${formatPackageDate(exp)}.`
      : `Product is within its valid shelf life (${formatPackageDate(exp)}).`;
  } else {
    explanation = 'Manufacturing/expiry date could not be verified from the package.';
  }

  return {
    status,
    derivedExpiryDate,
    isDerived,
    daysRemaining,
    explanation,
  };
}

export const expiryCalculationService = {
  normalizeDateStringToIso,
  calculateBestBeforeFromMfd,
  calculateExpiryStatus,
  formatPackageDate,
  formatHumanDate: formatPackageDate,
  evaluatePackageOcr,
  calculateExpiryFromDates,
};

