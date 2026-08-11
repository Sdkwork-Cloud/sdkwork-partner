/** Shared display helpers for partner admin surfaces. */

/** Format an ISO/epoch date-time string into the effective display locale. */
export function formatDateTime(value: string | null | undefined, locale?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Format a decimal money string (e.g. "100.50") into a readable display. */
export function formatDecimal(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-';
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return String(value);
  return number.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** Convert a minor-unit cents string to a decimal money display. */
export function formatCents(cents: string | number | null | undefined): string {
  if (cents === null || cents === undefined || cents === '') return '-';
  const number = typeof cents === 'number' ? cents : Number(cents);
  if (!Number.isFinite(number)) return String(cents);
  return (number / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Extract a readable error message; falls back to a stable message. */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}
