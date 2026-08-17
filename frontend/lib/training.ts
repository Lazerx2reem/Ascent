import type { SessionType, WeaknessSeverity } from "./types";

/**
 * Weakness priority palette. Deliberately the inverse reading of the analysis
 * SEVERITY map: there, a high score is good; here, a *low* score is what needs
 * attention, so "high" severity gets the warm accent.
 */
export const PRIORITY: Record<
  WeaknessSeverity,
  { label: string; badge: string; bar: string }
> = {
  high: {
    label: "Priority",
    badge: "bg-rose-100 text-rose-700",
    bar: "bg-rose-500",
  },
  moderate: {
    label: "Worth work",
    badge: "bg-amber-100 text-amber-800",
    bar: "bg-amber-500",
  },
  low: {
    label: "Solid",
    badge: "bg-sage-200 text-sage-800",
    bar: "bg-sage-500",
  },
};

/** Badge styling for a planned session's logbook type. */
export const SESSION_TYPE_STYLES: Record<SessionType, string> = {
  gym: "bg-lake-50 text-lake-700",
  board: "bg-lake-100 text-lake-800",
  outdoor: "bg-sage-200 text-sage-800",
  hangboard: "bg-amber-100 text-amber-800",
  other: "bg-steel-100 text-steel-600",
};

export const PLAN_WEEK_OPTIONS = [3, 4, 6, 8];
export const PLAN_DAY_OPTIONS = [2, 3, 4, 5];

/** Group a plan's sessions by week, preserving day order. */
export function byWeek<T extends { week: number }>(sessions: T[]): [number, T[]][] {
  const weeks = new Map<number, T[]>();
  for (const session of sessions) {
    const bucket = weeks.get(session.week);
    if (bucket) bucket.push(session);
    else weeks.set(session.week, [session]);
  }
  return Array.from(weeks.entries()).sort((a, b) => a[0] - b[0]);
}
