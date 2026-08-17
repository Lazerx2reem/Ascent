import { PRIORITY } from "@/lib/training";
import type { Weakness } from "@/lib/types";

/** One detected weakness: 0-100 bar (lower = weaker), evidence, and advice. */
export default function WeaknessCard({ weakness }: { weakness: Weakness }) {
  const styles = PRIORITY[weakness.severity];

  return (
    <div className="rounded-xl border border-steel-200 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-ink">{weakness.label}</span>
        <span className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${styles.badge}`}
          >
            {styles.label}
          </span>
          <span className="w-8 text-right text-sm font-bold tabular-nums text-ink">
            {weakness.score}
          </span>
        </span>
      </div>

      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-steel-100">
        <div
          className={`h-full rounded-full ${styles.bar} transition-[width] duration-700`}
          style={{ width: `${Math.max(2, Math.min(100, weakness.score))}%` }}
        />
      </div>

      <p className="mt-2 text-sm text-steel-700">{weakness.summary}</p>

      <ul className="mt-2 space-y-0.5">
        {weakness.evidence.map((line) => (
          <li key={line} className="text-xs text-steel-500">
            · {line}
          </li>
        ))}
      </ul>

      {weakness.advice && (
        <p className="mt-2 text-xs leading-relaxed text-steel-600">{weakness.advice}</p>
      )}
    </div>
  );
}
