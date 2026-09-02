"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import ClimbPhoto from "@/components/ClimbPhoto";
import { useConfirm } from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import FilePicker from "@/components/FilePicker";
import PageHeader from "@/components/PageHeader";
import IconButton from "@/components/IconButton";
import { SkeletonRows } from "@/components/Skeleton";
import { formatDate } from "@/lib/format";
import { api, ApiError } from "@/lib/api";
import { V_SCALE, YDS } from "@/lib/grades";
import type { Climb, ClimbType, SendType, WallAngle } from "@/lib/types";

const SEND_LABELS: Record<SendType, string> = {
  flash: "Flash",
  onsight: "Onsight",
  redpoint: "Redpoint",
  repeat: "Repeat",
  project: "Project",
};

const SEND_STYLES: Record<SendType, string> = {
  flash: "bg-sage-200 text-sage-800",
  onsight: "bg-sage-200 text-sage-800",
  redpoint: "bg-lake-100 text-lake-700",
  repeat: "bg-lake-50 text-lake-600",
  project: "bg-steel-100 text-steel-500",
};

const inputCls = "field";

export default function LogbookPage() {
  const confirm = useConfirm();
  const [climbs, setClimbs] = useState<Climb[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [climbType, setClimbType] = useState<ClimbType>("boulder");
  const [grade, setGrade] = useState("V2");
  const [sendType, setSendType] = useState<SendType>("redpoint");
  const [wallAngle, setWallAngle] = useState<WallAngle | "">("");
  const [attempts, setAttempts] = useState(1);
  const [location, setLocation] = useState("");
  const [climbedOn, setClimbedOn] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Local preview of the pending file, revoked whenever it's replaced.
  useEffect(() => {
    if (!photo) {
      setPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  useEffect(() => {
    api.listClimbs().then(setClimbs).catch((e) => setError(String(e.message)));
  }, []);

  const gradeOptions = climbType === "boulder" ? V_SCALE : YDS;

  function onTypeChange(type: ClimbType) {
    setClimbType(type);
    setGrade(type === "boulder" ? "V2" : "5.10a");
    // Onsight is for ropes, flash for boulders — keep the selection sane.
    if (type === "boulder" && sendType === "onsight") setSendType("flash");
    if (type !== "boulder" && sendType === "flash") setSendType("onsight");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await api.createClimb({
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
      // The climb is created first, then the photo attached to it — the
      // create endpoint is JSON, and a failed upload shouldn't lose the entry.
      let saved = created;
      if (photo) {
        try {
          saved = await api.uploadClimbImage(created.id, photo);
        } catch (err) {
          setError(
            err instanceof ApiError
              ? `Climb saved, but the photo failed: ${err.message}`
              : "Climb saved, but the photo failed to upload."
          );
        }
      }
      setClimbs((prev) => [saved, ...(prev ?? [])]);
      setName("");
      setNotes("");
      setAttempts(1);
      setPhoto(null);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: number) {
    const climb = climbs?.find((c) => c.id === id);
    const ok = await confirm({
      title: `Delete ${climb?.name ?? "this climb"}?`,
      body: "The climb and its photo are removed for good. This can't be undone.",
      confirmLabel: "Delete climb",
      danger: true,
    });
    if (!ok) return;
    await api.deleteClimb(id);
    setClimbs((prev) => (prev ?? []).filter((c) => c.id !== id));
  }

  return (
    <div>
      <PageHeader
        eyebrow="Your climbing"
        title="Logbook"
        description="Every climb you've logged, newest first — grade, angle, and how it went."
        action={
          <button
            onClick={() => setShowForm((s) => !s)}
            className={showForm ? "btn-secondary" : "btn-primary"}
          >
            {showForm ? "Cancel" : "Log a climb"}
          </button>
        }
      />

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {showForm && (
        <form
          onSubmit={onSubmit}
          className="card mt-4 grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          <label className="block sm:col-span-2 lg:col-span-1">
            <span className="label">Name</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Cave Classic"
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="label">Type</span>
            <select
              value={climbType}
              onChange={(e) => onTypeChange(e.target.value as ClimbType)}
              className={inputCls}
            >
              <option value="boulder">Boulder</option>
              <option value="sport">Sport</option>
              <option value="trad">Trad</option>
            </select>
          </label>
          <label className="block">
            <span className="label">Grade</span>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className={inputCls}
            >
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
              className={inputCls}
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
              className={inputCls}
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
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="label">Date</span>
            <input
              type="date"
              required
              value={climbedOn}
              onChange={(e) => setClimbedOn(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="label">Location</span>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="gym or crag"
              className={inputCls}
            />
          </label>
          <label className="block sm:col-span-2 lg:col-span-3">
            <span className="label">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="beta, conditions, how it felt…"
              className={inputCls}
            />
          </label>
          <div className="block sm:col-span-2 lg:col-span-3">
            <p className="label">Photo (optional)</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              {photoPreview && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={photoPreview}
                  alt="Selected photo preview"
                  className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-steel-200"
                />
              )}
              <FilePicker
                accept="image/jpeg,image/png,image/webp,image/gif"
                file={photo}
                onSelect={setPhoto}
                buttonLabel={photo ? "Change photo" : "Add photo"}
                emptyLabel="JPEG, PNG, WebP or GIF"
                className="flex-1"
              />
            </div>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? "Saving…" : "Save climb"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 space-y-2">
        {climbs === null && <SkeletonRows rows={4} />}
        {climbs?.length === 0 && (
          <EmptyState
            icon="logbook"
            title="No climbs logged yet"
            hint="Log your first climb and it starts feeding your grade pyramid, your stats, and the coach."
            action={
              <button onClick={() => setShowForm(true)} className="btn-primary">
                Log a climb
              </button>
            }
          />
        )}
        {climbs?.map((climb) => (
          <div
            key={climb.id}
            className="card card-hover relative flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3"
          >
            {/* Stretched link: the whole card is the target, but the delete
                button stays a real sibling rather than a nested control. */}
            <Link
              href={`/logbook/${climb.id}`}
              aria-label={`View ${climb.name}`}
              className="absolute inset-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-lake-500/40"
            />
            {climb.has_image ? (
              <ClimbPhoto
                climbId={climb.id}
                alt={climb.name}
                className="h-11 w-11 shrink-0 rounded-lg ring-1 ring-steel-200"
              />
            ) : (
              /* Invisible spacer: keeps every row's text on the same left
                 edge without drawing an empty box on each photo-less climb. */
              <span aria-hidden className="h-11 w-11 shrink-0" />
            )}
            <span className="w-12 text-lg font-bold text-lake-700">
              {climb.grade}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-ink">{climb.name}</p>
              <p className="truncate text-xs text-steel-500">
                {[
                  climb.climb_type,
                  climb.wall_angle,
                  climb.location,
                  `${climb.attempt_count} att.`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                {climb.notes ? ` — ${climb.notes}` : ""}
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${SEND_STYLES[climb.send_type]}`}
            >
              {SEND_LABELS[climb.send_type]}
            </span>
            <span className="text-xs tabular-nums text-steel-400">
              {formatDate(climb.climbed_on)}
            </span>
            <IconButton
              icon="trash"
              label={`Delete ${climb.name}`}
              onClick={() => void onDelete(climb.id)}
              tone="danger"
              // relative z-10 keeps this above the stretched link.
              className="relative z-10"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
