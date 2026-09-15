"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ClimbForm from "@/components/ClimbForm";
import ClimbPhoto from "@/components/ClimbPhoto";
import { useConfirm } from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import FilePicker from "@/components/FilePicker";
import PageHeader from "@/components/PageHeader";
import IconButton from "@/components/IconButton";
import { SkeletonRows } from "@/components/Skeleton";
import { formatDate } from "@/lib/format";
import { api, ApiError } from "@/lib/api";
import type { Climb, ClimbCreate, SendType } from "@/lib/types";

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

export default function LogbookPage() {
  const confirm = useConfirm();
  const [climbs, setClimbs] = useState<Climb[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function onSubmit(values: ClimbCreate) {
    setBusy(true);
    setError(null);
    try {
      const created = await api.createClimb(values);
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
        <ClimbForm
          submitLabel="Save climb"
          busy={busy}
          onSubmit={(values) => void onSubmit(values)}
          className="mt-4"
        >
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
        </ClimbForm>
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
