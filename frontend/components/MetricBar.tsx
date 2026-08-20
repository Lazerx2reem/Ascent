import { scoreBand, SEVERITY } from "@/lib/analysis";
import type { PoseMetric } from "@/lib/types";

/** A single scored movement metric: label, 0-100 bar, and plain-language note. */
export default function MetricBar({ metric }: { metric: PoseMetric }) {
  const band = scoreBand(metric.score);
  const styles = SEVERITY[band];

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-ink">{metric.label}</span>
        <span className="flex items-center gap-2">
          <span className={`badge whitespace-nowrap ${styles.badge}`}>
            {styles.label}
          </span>
          <span className="w-8 text-right text-sm font-bold tabular-nums text-ink">
            {metric.score}
          </span>
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-steel-100">
        <div
          className={`h-full rounded-full ${styles.bar} transition-[width] duration-700`}
          style={{ width: `${Math.max(2, Math.min(100, metric.score))}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-steel-500">{metric.summary}</p>
    </div>
  );
}
