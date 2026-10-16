/**
 * Utility functions for currency and date formatting across KaamSaathi.
 */

/**
 * Formats a monetary number in Indian Rupee format (e.g., ₹1,200).
 */
export function formatRupees(amount: number | string): string {
  const num = Number(amount) || 0;
  return `₹${num.toLocaleString('en-IN')}`;
}

/**
 * Returns an ISO date string (YYYY-MM-DD) offset by a given number of days relative to today.
 */
export function getRelativeDateString(offsetDays: number = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

/**
 * Returns CSS color classes for job and payment status badges.
 */
export function getStatusBadgeClasses(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'partially_paid':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'in_progress':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'pending':
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
}
