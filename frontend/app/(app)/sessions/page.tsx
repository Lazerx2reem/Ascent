"use client";

import { FormEvent, useEffect, useState } from "react";
import { useConfirm } from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import IconButton from "@/components/IconButton";
import PageHeader from "@/components/PageHeader";
import { SkeletonRows } from "@/components/Skeleton";
import { formatDate } from "@/lib/format";
import { api, ApiError } from "@/lib/api";
import type { SessionType, TrainingSession, WorkoutItem } from "@/lib/types";

const TYPE_LABELS: Record<SessionType, string> = {
  gym: "Gym",
  board: "Board",
  outdoor: "Outdoor",
  hangboard: "Hangboard",
  other: "Other",
};

const inputCls = "field";

export default function SessionsPage() {
  const confirm = useConfirm();
  const [sessions, setSessions] = useState<TrainingSession[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [sessionDate, setSessionDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [sessionType, setSessionType] = useState<SessionType>("gym");
  const [duration, setDuration] = useState(90);
  const [rpe, setRpe] = useState(6);
  const [notes, setNotes] = useState("");
  const [workout, setWorkout] = useState<WorkoutItem[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.listSessions().then(setSessions).catch((e) => setError(String(e.message)));
  }, []);

  function updateWorkoutItem(index: number, patch: Partial<WorkoutItem>) {
    setWorkout((items) =>
      items.map((item, i) => (i === index ? { ...item, ...patch } : item))
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await api.createSession({
        session_date: sessionDate,
        session_type: sessionType,
        duration_minutes: duration,
        rpe,
        notes: notes || null,
        workout_details: workout.length > 0 ? workout : null,
      });
      setSessions((prev) => [created, ...(prev ?? [])]);
      setNotes("");
      setWorkout([]);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: number) {
    const ok = await confirm({
      title: "Delete this session?",
      body: "It stops counting toward your volume, consistency, and load.",
      confirmLabel: "Delete session",
      danger: true,
    });
    if (!ok) return;
    await api.deleteSession(id);
    setSessions((prev) => (prev ?? []).filter((s) => s.id !== id));
  }

  return (
    <div>
      <PageHeader
        eyebrow="Your training"
        title="Training sessions"
        description="Gym days, board sessions, and hangboard work — duration, effort, and what you actually did."
        action={
          <button
            onClick={() => setShowForm((s) => !s)}
            className={showForm ? "btn-secondary" : "btn-primary"}
          >
            {showForm ? "Cancel" : "Log a session"}
          </button>
        }
      />

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {showForm && (
        <form
          onSubmit={onSubmit}
          className="card mt-4 grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          <label className="block">
            <span className="label">Date</span>
            <input
              type="date"
              required
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="label">Type</span>
            <select
              value={sessionType}
              onChange={(e) => setSessionType(e.target.value as SessionType)}
              className={inputCls}
            >
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Duration (min)</span>
            <input
              type="number"
              min={1}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="label">RPE (1–10)</span>
            <input
              type="number"
              min={1}
              max={10}
              value={rpe}
              onChange={(e) => setRpe(Number(e.target.value))}
              className={inputCls}
            />
          </label>

          <div className="sm:col-span-2 lg:col-span-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Hangboard / campus sets</span>
              <button
                type="button"
                onClick={() =>
                  setWorkout((w) => [...w, { exercise: "hangboard", detail: "", sets: 3 }])
                }
                className="text-sm font-semibold text-lake-600 hover:text-lake-700 hover:underline"
              >
                + Add set group
              </button>
            </div>
            {workout.map((item, i) => (
              <div key={i} className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  value={item.exercise}
                  onChange={(e) => updateWorkoutItem(i, { exercise: e.target.value })}
                  className="rounded-lg border border-steel-200 bg-white px-2 py-1.5 text-sm focus:border-lake-500 focus:outline-none focus:ring-2 focus:ring-lake-500/30"
                >
                  <option value="hangboard">Hangboard</option>
                  <option value="campus">Campus</option>
                  <option value="core">Core</option>
                  <option value="other">Other</option>
                </select>
                <input
                  value={item.detail}
                  onChange={(e) => updateWorkoutItem(i, { detail: e.target.value })}
                  placeholder='e.g. "20mm 7/3 repeaters"'
                  className="min-w-40 flex-1 rounded-lg border border-steel-200 bg-white px-2 py-1.5 text-sm focus:border-lake-500 focus:outline-none focus:ring-2 focus:ring-lake-500/30"
                />
                <input
                  type="number"
                  min={1}
                  value={item.sets}
                  onChange={(e) => updateWorkoutItem(i, { sets: Number(e.target.value) })}
                  className="w-16 rounded-lg border border-steel-200 bg-white px-2 py-1.5 text-sm focus:border-lake-500 focus:outline-none focus:ring-2 focus:ring-lake-500/30"
                />
                <span className="text-xs text-steel-500">sets</span>
                <button
                  type="button"
                  onClick={() => setWorkout((w) => w.filter((_, j) => j !== i))}
                  className="text-xs text-steel-400 transition-colors hover:text-red-600"
                >
                  remove
                </button>
              </div>
            ))}
          </div>

          <label className="block sm:col-span-2 lg:col-span-4">
            <span className="label">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={inputCls}
            />
          </label>
          <div className="sm:col-span-2 lg:col-span-4">
            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? "Saving…" : "Save session"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 space-y-2">
        {sessions === null && <SkeletonRows rows={4} />}
        {sessions?.length === 0 && (
          <EmptyState
            icon="sessions"
            title="No sessions logged yet"
            hint="Logging duration and RPE is what lets the training page spot consistency and recovery problems."
            action={
              <button onClick={() => setShowForm(true)} className="btn-primary">
                Log a session
              </button>
            }
          />
        )}
        {sessions?.map((session) => (
          <div
            key={session.id}
            className="card card-hover flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3"
          >
            <span className="rounded-full bg-sage-100 px-2.5 py-0.5 text-xs font-semibold text-sage-800">
              {TYPE_LABELS[session.session_type]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">
                {session.duration_minutes} min
                {session.rpe != null && (
                  <span className="font-normal text-steel-500"> · RPE {session.rpe}</span>
                )}
              </p>
              {(session.workout_details?.length ?? 0) > 0 && (
                <p className="truncate text-xs text-steel-500">
                  {session.workout_details!
                    .map((w) => `${w.exercise}: ${w.detail || "—"} ×${w.sets}`)
                    .join(" · ")}
                </p>
              )}
              {session.notes && (
                <p className="truncate text-xs text-steel-500">{session.notes}</p>
              )}
            </div>
            <span className="text-xs tabular-nums text-steel-400">
              {formatDate(session.session_date)}
            </span>
            <IconButton
              icon="trash"
              label="Delete session"
              onClick={() => void onDelete(session.id)}
              tone="danger"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
