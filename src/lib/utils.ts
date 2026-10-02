export function cn(...classes: unknown[]): string {
  return classes.filter(c => typeof c === 'string' && c.length > 0).join(' ');
}

export function formatNutrient(amount: number, unit = 'g'): string {
  if (amount === undefined || amount === null) return `0${unit}`;
  return `${amount % 1 === 0 ? amount : amount.toFixed(1)}${unit}`;
}

export function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

/**
 * Normalizes any Date or ISO string to the local calendar day format YYYY-MM-DD.
 * Prevents UTC timezone shift errors when meals are logged near midnight.
 */
export function getLocalISODate(dateInput: Date | string = new Date()): string {
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
}
