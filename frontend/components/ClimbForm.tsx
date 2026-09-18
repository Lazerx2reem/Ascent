"use client";

import { FormEvent, ReactNode, useState } from "react";
import { V_SCALE, YDS } from "@/lib/grades";
import type { Climb, ClimbCreate, ClimbType, SendType, WallAngle } from "@/lib/types";

/**
 * The climb fields, shared by "Log a climb" and "Edit climb" so the two can't
 * drift. Anything beyond the JSON body (the create flow's photo picker) goes
 * in `children`, rendered just above the submit button.
 */
export default function ClimbForm({
  initial,
  submitLabel,
  busy,
  onSubmit,
  onCancel,
  children,
  className = "",
}: {
  initial?: Climb;
  submitLabel: string;
  busy: boolean;
  onSubmit: (values: ClimbCreate) => void;
  onCancel?: () => void;
  children?: ReactNode;
  className?: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [climbType, setClimbType] = useState<ClimbType>(initial?.climb_type ?? "boulder");
  const [grade, setGrade] = useState(initial?.grade ?? "V2");
  const [sendType, setSendType] = useState<SendType>(initial?.send_type ?? "redpoint");
  const [wallAngle, setWallAngle] = useState<WallAngle | "">(initial?.wall_angle ?? "");
  const [attempts, setAttempts] = useState(initial?.attempt_count ?? 1);
  const [location, setLocation] = useState(initial?.location ?? "");
  const [climbedOn, setClimbedOn] = useState(
    () => initial?.climbed_on ?? new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const gradeOptions = climbType === "boulder" ? V_SCALE : YDS;

  function onTypeChange(type: ClimbType) {
    const wasBoulder = climbType === "boulder";
    setClimbType(type);
    // Sport <-> trad share a scale, so only reset the grade across scales.
    if (wasBoulder !== (type === "boulder")) setGrade(type === "boulder" ? "V2" : "5.10a");
    // Onsight is for ropes, flash for boulders — keep the selection sane.
    if (type === "boulder" && sendType === "onsight") setSendType("flash");
    if (type !== "boulder" && sendType === "flash") setSendType("onsight");
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      name,
      grade,
      grade_system: climbType === "boulder" ? "v_scale" : "yds",
      climb_type: climbType,
      wall_angle: wallAngle === "" ? null : wallAngle,
      location: location || null,
      send_type: sendType,
      attempt_count: attempts,
      notes: notes || null,
      climbed_on: climbedOn,
    });
  }

  return (
    <form
      onSubmit={submit}
      className={`card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 ${className}`}
    >
      <label className="block sm:col-span-2 lg:col-span-1">
        <span className="label">Name</span>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Cave Classic"
          className="field"
        />
      </label>
      <label className="block">
        <span className="label">Type</span>
        <select
          value={climbType}
          onChange={(e) => onTypeChange(e.target.value as ClimbType)}
          className="field"
        >
          <option value="boulder">Boulder</option>
          <option value="sport">Sport</option>
          <option value="trad">Trad</option>
        </select>
      </label>
      <label className="block">
        <span className="label">Grade</span>
        <select value={grade} onChange={(e) => setGrade(e.target.value)} className="field">
          {gradeOptions.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="label">Result</span>
        <select
          value={sendType}
          onChange={(e) => setSendType(e.target.value as SendType)}
          className="field"
        >
          {climbType === "boulder" ? (
            <option value="flash">Flash</option>
          ) : (
            <option value="onsight">Onsight</option>
          )}
          <option value="redpoint">Redpoint</option>
          <option value="repeat">Repeat</option>
          <option value="project">Project (not sent)</option>
        </select>
      </label>
      <label className="block">
        <span className="label">Wall angle</span>
        <select
          value={wallAngle}
          onChange={(e) => setWallAngle(e.target.value as WallAngle | "")}
          className="field"
        >
          <option value="">—</option>
          <option value="slab">Slab</option>
          <option value="vertical">Vertical</option>
          <option value="overhang">Overhang</option>
          <option value="roof">Roof</option>
        </select>
      </label>
      <label className="block">
        <span className="label">Attempts</span>
        <input
          type="number"
          min={1}
          value={attempts}
          onChange={(e) => setAttempts(Number(e.target.value))}
          className="field"
        />
      </label>
      <label className="block">
        <span className="label">Date</span>
        <input
          type="date"
          required
          value={climbedOn}
          onChange={(e) => setClimbedOn(e.target.value)}
          className="field"
        />
      </label>
      <label className="block">
        <span className="label">Location</span>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="gym or crag"
          className="field"
        />
      </label>
      <label className="block sm:col-span-2 lg:col-span-3">
        <span className="label">Notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="beta, conditions, how it felt…"
          className="field"
        />
      </label>
      {children && <div className="sm:col-span-2 lg:col-span-3">{children}</div>}
      <div className="flex gap-3 sm:col-span-2 lg:col-span-3">
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? "Saving…" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
