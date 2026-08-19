/**
 * Inline stroke icon set. Hand-rolled rather than a dependency: the app needs
 * about a dozen glyphs, and they inherit currentColor so they pick up whatever
 * text color they sit in.
 *
 * All drawn on a 24x24 grid at a 1.75 stroke so they sit evenly beside
 * 14-16px text without looking heavier than it.
 */
const PATHS = {
  dashboard: ["M4 20v-7", "M10 20V5", "M16 20v-9", "M3.5 20h17"],
  logbook: [
    "M4 5.5A2.5 2.5 0 016.5 3H12v16H6.5A2.5 2.5 0 004 21.5v-16z",
    "M20 5.5A2.5 2.5 0 0017.5 3H12v16h5.5A2.5 2.5 0 0120 21.5v-16z",
  ],
  sessions: [
    "M4 8a2 2 0 012-2h12a2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V8z",
    "M4 11h16",
    "M8.5 3v4",
    "M15.5 3v4",
  ],
  analysis: [
    "M4 6.5A2.5 2.5 0 016.5 4h11A2.5 2.5 0 0120 6.5v11a2.5 2.5 0 01-2.5 2.5h-11A2.5 2.5 0 014 17.5v-11z",
    "M10.5 9.2l4.3 2.8-4.3 2.8V9.2z",
  ],
  training: [
    "M12 21a9 9 0 100-18 9 9 0 000 18z",
    "M12 17a5 5 0 100-10 5 5 0 000 10z",
    "M12 13.2a1.2 1.2 0 100-2.4 1.2 1.2 0 000 2.4z",
  ],
  coach: [
    "M21 11.6a8.4 8.4 0 01-8.5 8.4 9 9 0 01-3.9-.9L4 20.8l1.3-3.9a8.3 8.3 0 01-1.3-4.5A8.4 8.4 0 0112.5 4 8.4 8.4 0 0121 11.6z",
  ],
  logout: ["M15.5 16.5L20 12l-4.5-4.5", "M20 12H9.5", "M12.5 20H6.5a2 2 0 01-2-2V6a2 2 0 012-2h6"],
  plus: ["M12 5.5v13", "M5.5 12h13"],
  mountain: ["M3 19l6.4-10.8 3.9 6.4 2.5-3.9L21 19H3z", "M9.4 8.2l1.9 3.2"],
  spark: ["M12 3.5l1.8 5.3 5.3 1.8-5.3 1.8L12 17.7l-1.8-5.3L4.9 10.6l5.3-1.8L12 3.5z"],
  clock: ["M12 21a9 9 0 100-18 9 9 0 000 18z", "M12 7.2V12l3.3 2"],
  flame: [
    "M12 21c3.6 0 6-2.3 6-5.5 0-3.9-3.6-5.6-3.6-9.2 0 0-2.6 1.2-2.6 4.3 0 1.6-1 2.2-1.7 1.5-.6-.6-.7-1.8-.7-1.8S7 12.1 7 15.5C7 18.7 8.4 21 12 21z",
  ],
} as const;

export type IconName = keyof typeof PATHS;

export default function Icon({
  name,
  className = "h-5 w-5",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
