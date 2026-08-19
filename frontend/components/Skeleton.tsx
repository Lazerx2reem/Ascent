/**
 * Shaped loading placeholders. These replace the literal word "Loading…" —
 * a skeleton holds the layout, so content lands in place instead of shoving
 * the page around when it arrives.
 */
export function Skeleton({ className = "h-4 w-full" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

/** A few staggered lines, for prose-shaped content. */
export function SkeletonText({ lines = 3 }: { lines?: number }) {
  // Ragged widths so it reads as text rather than as a stack of bars.
  const widths = ["w-full", "w-11/12", "w-4/5", "w-9/12", "w-10/12"];
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={`h-3.5 ${widths[i % widths.length]}`} />
      ))}
    </div>
  );
}

/** Placeholder rows matching the list-row cards used across the app. */
export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="card flex items-center gap-4 px-4 py-3.5">
          <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Placeholder for a chart panel. */
export function SkeletonChart({ bars = 6 }: { bars?: number }) {
  const heights = ["h-16", "h-24", "h-12", "h-28", "h-20", "h-14", "h-24"];
  return (
    <div className="flex h-40 items-end gap-2">
      {Array.from({ length: bars }, (_, i) => (
        <Skeleton
          key={i}
          className={`flex-1 rounded-t ${heights[i % heights.length]}`}
        />
      ))}
    </div>
  );
}
