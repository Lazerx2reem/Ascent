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

/**
 * Render a server *timestamp* as the viewer's local calendar date.
 *
 * `formatDate` is for bare calendar dates. Timestamps need different handling:
 * the API sends them naive ("2026-08-25T03:51:32") but they are UTC, since
 * that is what the database records and no offset survives serialization.
 * Slicing the first ten characters shows the UTC day, which runs a day ahead
 * for anyone west of Greenwich during their evening. Appending "Z" states the
 * intent so Date can convert it properly.
 */
export function formatTimestamp(iso: string): string {
  const hasZone = /[Zz]$|[+-]\d{2}:?\d{2}$/.test(iso);
  const parsed = new Date(hasZone ? iso : `${iso}Z`);
  if (Number.isNaN(parsed.getTime())) return formatDate(iso);
  return `${parsed.getDate()} ${MONTHS[parsed.getMonth()]} ${parsed.getFullYear()}`;
}

/** Same, without the year — for dates already scoped to a known period. */
export function formatDayMonth(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!m || !d) return iso;
  return `${d} ${MONTHS[m - 1]}`;
}
