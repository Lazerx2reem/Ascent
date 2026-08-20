"use client";

import { useEffect, useState } from "react";
import type { ProgressPoint } from "@/lib/types";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function monthLabel(month: string): string {
  const idx = Number(month.slice(5, 7)) - 1;
  return MONTH_NAMES[idx] ?? month;
}

/**
 * Sends per month as a column chart. Hairline gridlines on clean tick values,
 * 4px rounded caps square at the baseline, and a per-column hover tooltip.
 * Columns rise from the baseline on mount, left to right.
 */
export default function MonthlySends({ data }: { data: ProgressPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [drawn, setDrawn] = useState(false);
  const max = Math.max(...data.map((d) => d.sends), 1);
  // Clean y ticks: 0, half, max rounded up to an even value
  const top = Math.max(2, Math.ceil(max / 2) * 2);
  const ticks = [0, top / 2, top];

  useEffect(() => {
    const raf = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div>
      <div className="relative h-40">
        {/* Gridlines */}
        {ticks.map((t) => (
          <div
            key={t}
            className="absolute inset-x-0 flex items-center gap-2"
            style={{ bottom: `${(t / top) * 100}%` }}
          >
            <span className="w-5 -translate-y-px text-right text-[10px] tabular-nums text-steel-400">
              {t}
            </span>
            <div
              className={`h-px flex-1 ${t === 0 ? "bg-steel-300" : "bg-steel-200"}`}
            />
          </div>
        ))}
        {/* Columns */}
        <div className="absolute inset-y-0 left-7 right-0 flex items-end gap-[2px]">
          {data.map((point, i) => (
            <div
              key={point.month}
              className="relative flex h-full flex-1 items-end justify-center"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <div
                className={`w-full max-w-6 rounded-t bg-gradient-to-t transition-all duration-700 ease-out ${
                  hover === i
                    ? "from-lake-700 to-lake-500"
                    : "from-lake-600 to-lake-400"
                }`}
                style={{
                  height: drawn ? `${(point.sends / top) * 100}%` : 0,
                  transitionDelay: `${Math.min(i * 35, 400)}ms`,
                }}
              />
              {hover === i && (
                <div className="pointer-events-none absolute bottom-full z-10 mb-1.5 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs text-white shadow-lift">
                  {monthLabel(point.month)} {point.month.slice(0, 4)}:{" "}
                  <span className="font-semibold">{point.sends}</span> sends
                  <span className="absolute left-1/2 top-full -ml-1 border-4 border-transparent border-t-ink" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      {/* X labels */}
      <div className="ml-7 mt-1 flex gap-[2px]">
        {data.map((point, i) => (
          <span
            key={point.month}
            className={`flex-1 text-center text-[10px] transition-colors ${
              hover === i ? "font-semibold text-steel-700" : "text-steel-400"
            }`}
          >
            {monthLabel(point.month)}
          </span>
        ))}
      </div>
    </div>
  );
}
