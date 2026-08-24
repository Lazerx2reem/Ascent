"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ClimbPhoto from "@/components/ClimbPhoto";
import Icon from "@/components/Icon";
import { Skeleton, SkeletonText } from "@/components/Skeleton";
import { api, ApiError } from "@/lib/api";
import type { Climb, SendType } from "@/lib/types";

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

export default function ClimbDetailPage() {
  const { id } = useParams<{ id: string }>();
  const climbId = Number(id);
  const router = useRouter();

  const [climb, setClimb] = useState<Climb | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Bumped on every photo change so ClimbPhoto remounts and refetches rather
  // than showing the replaced image from its first render.
  const [photoVersion, setPhotoVersion] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .getClimb(climbId)
      .then(setClimb)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Climb not found"));
  }, [climbId]);

  async function onPickPhoto(file: File | null) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setClimb(await api.uploadClimbImage(climbId, file));
      setPhotoVersion((v) => v + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not upload that photo");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function onRemovePhoto() {
    if (!window.confirm("Remove this photo?")) return;
    setBusy(true);
    try {
      setClimb(await api.deleteClimbImage(climbId));
      setPhotoVersion((v) => v + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove the photo");
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteClimb() {
    if (!window.confirm("Delete this climb and its photo?")) return;
    await api.deleteClimb(climbId);
    router.push("/logbook");
  }

  if (error && !climb) return <p className="text-sm text-red-600">{error}</p>;

  if (!climb) {
    return (
      <div>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-3 h-8 w-72" />
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-5">
          <Skeleton className="aspect-[4/3] w-full rounded-2xl lg:col-span-3" />
          <div className="card p-5 lg:col-span-2">
            <SkeletonText lines={6} />
          </div>
        </div>
      </div>
    );
  }

  const facts: [string, string][] = [
    ["Type", climb.climb_type],
    ["Grade", climb.grade],
    ["Wall angle", climb.wall_angle ?? "—"],
    ["Location", climb.location ?? "—"],
    ["Attempts", String(climb.attempt_count)],
    ["Date", climb.climbed_on],
  ];

  return (
    <div>
      <Link
        href="/logbook"
        className="group inline-flex items-center gap-1.5 text-sm font-medium text-lake-700 transition-colors hover:text-lake-800"
      >
        <span className="transition-transform duration-200 group-hover:-translate-x-0.5">←</span>
        All climbs
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-2xl font-bold text-lake-700">{climb.grade}</span>
          <h1 className="truncate text-[28px] font-bold leading-tight tracking-tight text-ink">
            {climb.name}
          </h1>
        </div>
        <span className={`badge px-2.5 py-1 ${SEND_STYLES[climb.send_type]}`}>
          {SEND_LABELS[climb.send_type]}
        </span>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Photo */}
        <div className="lg:col-span-3">
          <div className="card overflow-hidden">
            {climb.has_image ? (
              <ClimbPhoto
                key={photoVersion}
                climbId={climb.id}
                alt={climb.name}
                className="aspect-[4/3] w-full"
              />
            ) : (
              <div className="flex aspect-[4/3] w-full flex-col items-center justify-center bg-steel-50 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-lake-100 to-sage-100 text-lake-600 ring-1 ring-inset ring-white/60">
                  <Icon name="mountain" className="h-6 w-6" />
                </span>
                <p className="mt-3.5 text-sm font-semibold text-ink">No photo yet</p>
                <p className="mt-1 max-w-xs text-sm text-steel-500">
                  Add a shot of the line so you recognise it next time.
                </p>
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={busy}
              onChange={(e) => void onPickPhoto(e.target.files?.[0] ?? null)}
              className="block flex-1 text-sm text-steel-600 file:mr-3 file:rounded-lg file:border-0 file:bg-lake-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-lake-700 hover:file:bg-lake-100 disabled:opacity-50"
            />
            {climb.has_image && (
              <button
                onClick={() => void onRemovePhoto()}
                disabled={busy}
                className="btn-secondary"
              >
                Remove photo
              </button>
            )}
          </div>
          <p className="mt-1.5 text-xs text-steel-400">
            JPEG, PNG, WebP or GIF, up to 10 MB. Uploading replaces the current photo.
          </p>
        </div>

        {/* Facts + notes */}
        <div className="space-y-4 lg:col-span-2">
          <section className="card p-5">
            <h2 className="font-semibold text-ink">Details</h2>
            <dl className="mt-3 space-y-2">
              {facts.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 text-sm">
                  <dt className="text-steel-500">{label}</dt>
                  <dd className="truncate font-medium capitalize text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="card p-5">
            <h2 className="font-semibold text-ink">Notes</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-steel-600">
              {climb.notes || (
                <span className="text-steel-400">
                  Nothing logged — beta, conditions, and how it felt all go here.
                </span>
              )}
            </p>
          </section>

          <button
            onClick={() => void onDeleteClimb()}
            className="w-full rounded-lg border border-steel-200 bg-white px-4 py-2 text-sm font-semibold text-steel-600 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
          >
            Delete climb
          </button>
        </div>
      </div>
    </div>
  );
}
