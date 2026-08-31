const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Render an ISO date as "14 Aug 2026".
 *
 * The string is split rather than passed to `new Date()` on purpose: the API
 * sends bare calendar dates like "2026-08-14", which `Date` parses as UTC
 * midnight and then renders a day early in any negative-offset timezone. A
 * logged climb has no time of day, so it should never shift.
 */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Same, without the year — for dates already scoped to a known period. */
export function formatDayMonth(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!m || !d) return iso;
  return `${d} ${MONTHS[m - 1]}`;
}
