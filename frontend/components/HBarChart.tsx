"use client";

import { useEffect, useState } from "react";

/**
 * Horizontal bar chart (single series). Used for the grade pyramid and
 * wall-angle volume. Bars: ≤24px thick, 4px rounded data-end, square at the
 * baseline; values ride the bar tips in text ink, never the series color.
 *
 * Bars draw out from the baseline on mount, staggered top to bottom, so the
 * shape of the distribution registers before the numbers do.
 */
export interface HBarDatum {
  label: string;
  value: number;
}

export default function HBarChart({
  data,
  ariaLabel,
}: {
  data: HBarDatum[];
  ariaLabel: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const [drawn, setDrawn] = useState(false);

  // Paint once at zero width, then let the CSS transition carry it out.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div role="img" aria-label={ariaLabel} className="space-y-1.5">
      {data.map(({ label, value }, i) => {
        const pct = drawn ? (value / max) * 100 : 0;
        return (
          <div key={label} className="group flex items-center gap-3">
            <span className="w-12 shrink-0 text-right text-xs font-semibold text-steel-500 transition-colors group-hover:text-steel-700">
              {label}
            </span>
            <div className="relative h-5 flex-1">
              {/* Track — gives the row a floor to read against. */}
              <div className="absolute inset-y-0.5 inset-x-0 rounded bg-steel-50" />
              <div
                className="absolute inset-y-0.5 left-0 rounded-r bg-gradient-to-r from-lake-600 to-lake-500 transition-[width] duration-700 ease-out group-hover:from-lake-700 group-hover:to-lake-600"
                style={{
                  width: `${pct}%`,
                  minWidth: drawn ? "2px" : 0,
                  transitionDelay: `${i * 45}ms`,
                }}
              />
              <span
                className="absolute inset-y-0 flex items-center pl-2 text-xs font-semibold tabular-nums text-steel-600 transition-[left] duration-700 ease-out"
                style={{ left: `${pct}%`, transitionDelay: `${i * 45}ms` }}
              >
                {value}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
