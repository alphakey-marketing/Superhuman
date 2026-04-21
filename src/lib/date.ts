/**
 * Format a Date (or today by default) as a YYYY-MM-DD string in the user's
 * **local** timezone.  Using `toISOString()` would return UTC midnight, which
 * can be the wrong calendar date for users in UTC+ timezones.
 */
export function toLocalDateStr(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
