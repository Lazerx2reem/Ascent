"use client";

import { useEffect, useState } from "react";
import EmptyState from "@/components/EmptyState";
import HBarChart from "@/components/HBarChart";
import MonthlySends from "@/components/MonthlySends";
import PageHeader from "@/components/PageHeader";
import { Skeleton, SkeletonChart } from "@/components/Skeleton";
import StatCard from "@/components/StatCard";
import { api } from "@/lib/api";
import type {
  AngleEntry,
  ProgressPoint,
  PyramidEntry,
  StatsSummary,
} from "@/lib/types";

const ANGLE_LABELS: Record<string, string> = {
  slab: "Slab",
  vertical: "Vert",
  overhang: "Over",
  roof: "Roof",
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [pyramid, setPyramid] = useState<PyramidEntry[] | null>(null);
  const [discipline, setDiscipline] = useState<"boulder" | "route">("boulder");
  const [progress, setProgress] = useState<ProgressPoint[] | null>(null);
  const [angles, setAngles] = useState<AngleEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.summary(), api.progress(), api.angles()])
      .then(([s, p, a]) => {
        setSummary(s);
        setProgress(p);
        setAngles(a);
      })
      .catch((e) => setError(String(e.message)));
  }, []);

  useEffect(() => {
    api.pyramid(discipline).then(setPyramid).catch((e) => setError(String(e.message)));
  }, [discipline]);

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  const empty =
    summary !== null && summary.total_climbs === 0 && summary.total_sessions === 0;

  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="Your climbing at a glance — what you've sent, how often you're training, and where the volume is going."
      />

      {summary === null && (
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="card p-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-2.5 h-7 w-14" />
            </div>
          ))}
        </div>
      )}

      {empty && (
        <div className="mt-5">
          <EmptyState
            icon="mountain"
            title="Nothing here yet"
            hint="Log a climb or a training session and your grade pyramid, monthly sends, and angle volume will start filling in."
          />
        </div>
      )}

      {summary && !empty && (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Total sends", value: String(summary.total_sends), icon: "flame" as const },
              { label: "Hardest boulder", value: summary.hardest_boulder ?? "—", icon: "mountain" as const },
              { label: "Hardest route", value: summary.hardest_route ?? "—", icon: "spark" as const },
              { label: "Training hours", value: summary.total_hours.toLocaleString(), icon: "clock" as const },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className="animate-fade-up"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <StatCard {...stat} />
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="card p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-ink">Grade pyramid</h2>
                <div className="segment-group">
                  {(["boulder", "route"] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDiscipline(d)}
                      className={`segment ${discipline === d ? "segment-active" : ""}`}
                    >
                      {d === "boulder" ? "Boulders" : "Routes"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4">
                {pyramid === null ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Skeleton key={i} className="h-5 w-full" />
                    ))}
                  </div>
                ) : pyramid.length === 0 ? (
                  <p className="py-6 text-center text-sm text-steel-400">
                    No {discipline === "boulder" ? "boulder" : "route"} sends yet.
                  </p>
                ) : (
                  <HBarChart
                    key={discipline}
                    ariaLabel={`Sends by grade (${discipline})`}
                    data={pyramid.map((p) => ({ label: p.grade, value: p.count }))}
                  />
                )}
              </div>
            </section>

            <section className="card p-5">
              <h2 className="font-semibold text-ink">Sends per month</h2>
              <div className="mt-4">
                {progress === null ? (
                  <SkeletonChart />
                ) : progress.length === 0 ? (
                  <p className="py-6 text-center text-sm text-steel-400">No sends yet.</p>
                ) : (
                  <MonthlySends data={progress} />
                )}
              </div>
            </section>

            <section className="card p-5 lg:col-span-2">
              <h2 className="font-semibold text-ink">Volume by wall angle</h2>
              <p className="mt-0.5 text-xs text-steel-400">
                All logged climbs with a recorded angle.
              </p>
              <div className="mt-4 max-w-md">
                {angles === null ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }, (_, i) => (
                      <Skeleton key={i} className="h-5 w-full" />
                    ))}
                  </div>
                ) : angles.length === 0 ? (
                  <p className="text-sm text-steel-400">
                    Tag climbs with a wall angle to see this.
                  </p>
                ) : (
                  <HBarChart
                    ariaLabel="Climb volume by wall angle"
                    data={angles.map((a) => ({
                      label: ANGLE_LABELS[a.wall_angle] ?? a.wall_angle,
                      value: a.count,
                    }))}
                  />
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
