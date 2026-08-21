"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import WeaknessCard from "@/components/WeaknessCard";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import { Skeleton } from "@/components/Skeleton";
import { api, ApiError } from "@/lib/api";
import {
  byWeek,
  PLAN_DAY_OPTIONS,
  PLAN_WEEK_OPTIONS,
  SESSION_TYPE_STYLES,
} from "@/lib/training";
import type {
  TrainingPlanDetail,
  TrainingPlanSummary,
  WeaknessReport,
} from "@/lib/types";

export default function TrainingPage() {
  const [report, setReport] = useState<WeaknessReport | null>(null);
  const [plans, setPlans] = useState<TrainingPlanSummary[]>([]);
  const [plan, setPlan] = useState<TrainingPlanDetail | null>(null);
  const [weeks, setWeeks] = useState(4);
  const [days, setDays] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.weaknesses().then(setReport).catch((e) => setError(e.message));
    api
      .listPlans()
      .then((list) => {
        setPlans(list);
        if (list.length) void selectPlan(list[0].id);
      })
      .catch(() => {});
  }, []);

  async function selectPlan(id: number) {
    setError(null);
    setPlan(await api.getPlan(id));
  }

  async function onGenerate() {
    setBusy(true);
    setError(null);
    try {
      const created = await api.createPlan({ weeks, days_per_week: days });
      setPlan(created);
      setPlans(await api.listPlans());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not build a plan");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: number) {
    if (!window.confirm("Delete this plan?")) return;
    await api.deletePlan(id);
    const remaining = plans.filter((p) => p.id !== id);
    setPlans(remaining);
    if (plan?.id === id) {
      setPlan(null);
      if (remaining.length) void selectPlan(remaining[0].id);
    }
  }

  const weaknesses = report?.weaknesses ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Plan"
        title="Training"
        description="Ascent reads your logbook, sessions, and video analyses to find what's holding you back, then builds a periodized block around it."
      />

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Weaknesses */}
        <section className="card p-5 lg:col-span-2">
          <h2 className="font-semibold text-ink">What&apos;s holding you back</h2>
          <p className="mt-1 text-xs text-steel-500">
            Scored 0&ndash;100, lowest first. Lower means weaker.
          </p>

          <div className="mt-4 space-y-3">
            {report === null &&
              Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="rounded-xl border border-steel-200 p-4">
                  <Skeleton className="h-3.5 w-1/3" />
                  <Skeleton className="mt-2.5 h-2 w-full" />
                  <Skeleton className="mt-3 h-3 w-4/5" />
                </div>
              ))}
            {report !== null && weaknesses.length === 0 && (
              <EmptyState
                bare
                icon="spark"
                title="Not enough logged yet"
                hint="There isn't enough history to say anything honest about your weaknesses. Log some climbs and sessions and check back."
              />
            )}
            {weaknesses.map((weakness) => (
              <WeaknessCard key={weakness.key} weakness={weakness} />
            ))}
          </div>

          {report !== null && report.data_gaps.length > 0 && (
            <div className="mt-4 rounded-xl bg-mist p-3">
              <p className="text-xs font-semibold text-steel-600">
                Log these to sharpen the picture
              </p>
              <ul className="mt-1 space-y-0.5">
                {report.data_gaps.map((gap) => (
                  <li key={gap} className="text-xs text-steel-500">
                    · {gap}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Plan */}
        <section className="space-y-4 lg:col-span-3">
          <div className="card p-5">
            <h2 className="font-semibold text-ink">Build a block</h2>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="text-sm font-medium text-steel-700">Weeks</span>
                <select
                  value={weeks}
                  onChange={(e) => setWeeks(Number(e.target.value))}
                  className="field"
                >
                  {PLAN_WEEK_OPTIONS.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-steel-700">
                  Sessions per week
                </span>
                <select
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="field"
                >
                  {PLAN_DAY_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <button onClick={onGenerate} disabled={busy} className="btn-primary">
                {busy ? "Building…" : "Generate plan"}
              </button>
            </div>

            {plans.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-steel-200 pt-3">
                {plans.map((p) => (
                  <span
                    key={p.id}
                    className={`group flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-colors ${
                      p.id === plan?.id
                        ? "bg-lake-50 text-lake-700"
                        : "bg-steel-100 text-steel-600 hover:bg-steel-200"
                    }`}
                  >
                    <button onClick={() => void selectPlan(p.id)} className="font-medium">
                      {p.title}
                    </button>
                    <button
                      onClick={() => void onDelete(p.id)}
                      aria-label={`Delete ${p.title}`}
                      className="text-steel-400 opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {plan === null ? (
            <EmptyState
              icon="training"
              title="No plan yet"
              hint="Generate a block from your current weaknesses — pick a length above and Ascent builds the sessions."
            />
          ) : (
            <div className="card p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold text-ink">{plan.title}</h2>
                <span className="text-xs text-steel-500">
                  {plan.created_at.slice(0, 10)}
                </span>
              </div>
              <p className="mt-1 text-sm text-steel-600">{plan.summary}</p>

              {plan.cautions.map((caution) => (
                <p
                  key={caution}
                  className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"
                >
                  {caution}
                </p>
              ))}

              <div className="mt-4 space-y-4">
                {byWeek(plan.sessions).map(([week, sessions]) => (
                  <div key={week}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-steel-400">
                      Week {week}
                      {week === plan.weeks && plan.weeks >= 4 && " · deload"}
                    </p>
                    <div className="mt-2 space-y-2">
                      {sessions.map((session) => (
                        <div
                          key={`${session.week}-${session.day}`}
                          className="rounded-xl border border-steel-200 p-3"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-ink">
                              Day {session.day} · {session.title}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                SESSION_TYPE_STYLES[session.session_type]
                              }`}
                            >
                              {session.session_type}
                            </span>
                          </div>
                          <ul className="mt-2 space-y-1">
                            {session.blocks.map((block) => (
                              <li key={block.exercise} className="text-sm text-steel-600">
                                <span className="font-medium text-steel-700">
                                  {block.sets}×
                                </span>{" "}
                                {block.exercise} — {block.detail}
                              </li>
                            ))}
                          </ul>
                          {session.notes && (
                            <p className="mt-2 text-xs text-steel-500">{session.notes}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-4 border-t border-steel-200 pt-3 text-xs text-steel-400">
                Built from the weaknesses detected when the plan was generated, so it
                stays readable later. Talk it through with your{" "}
                <Link href="/coach" className="font-medium text-lake-700 hover:underline">
                  coach
                </Link>
                .
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
