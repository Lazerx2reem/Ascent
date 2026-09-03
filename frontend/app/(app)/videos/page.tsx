"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import ScoreDial from "@/components/ScoreDial";
import { useConfirm } from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import FilePicker from "@/components/FilePicker";
import IconButton from "@/components/IconButton";
import PageHeader from "@/components/PageHeader";
import { SkeletonRows } from "@/components/Skeleton";
import { formatTimestamp } from "@/lib/format";
import { api, ApiError } from "@/lib/api";
import { isPending, STATUS_STYLES } from "@/lib/analysis";
import type { Climb, VideoSummary } from "@/lib/types";

export default function VideosPage() {
  const confirm = useConfirm();
  const [videos, setVideos] = useState<VideoSummary[] | null>(null);
  const [climbs, setClimbs] = useState<Climb[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [climbId, setClimbId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const list = await api.listVideos();
    setVideos(list);
    return list;
  }

  useEffect(() => {
    refresh().catch((e) => setError(String(e.message)));
    api.listClimbs().then(setClimbs).catch(() => {});
  }, []);

  // Poll while any upload is still being analyzed.
  useEffect(() => {
    if (!videos?.some((v) => isPending(v.status))) return;
    const id = setInterval(() => refresh().catch(() => {}), 3000);
    return () => clearInterval(id);
  }, [videos]);

  async function onUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await api.uploadVideo(file, climbId ? Number(climbId) : undefined);
      setFile(null);
      setClimbId("");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function onSample() {
    setBusy(true);
    setError(null);
    try {
      await api.createSampleVideo();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create sample");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: number) {
    const ok = await confirm({
      title: "Delete this video?",
      body: "The clip and its movement analysis are both removed.",
      confirmLabel: "Delete video",
      danger: true,
    });
    if (!ok) return;
    await api.deleteVideo(id);
    setVideos((prev) => (prev ?? []).filter((v) => v.id !== id));
  }

  return (
    <div>
      <PageHeader
        eyebrow="Movement"
        title="Video Analysis"
        description="Upload a climbing attempt for automated feedback on four movement fundamentals — hip position, center-of-gravity control, silent feet, and body tension — from a MediaPipe pose estimate."
        action={
          <button onClick={onSample} disabled={busy} className="btn-secondary">
            Try a sample
          </button>
        }
      />

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <form onSubmit={onUpload} className="card mt-4 flex flex-wrap items-end gap-4 p-5">
        <div className="block">
          <p className="label">Video file</p>
          <FilePicker
            accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
            file={file}
            onSelect={setFile}
            buttonLabel="Choose clip"
            emptyLabel="mp4, mov, webm or mkv"
            className="mt-1"
          />
        </div>
        <label className="block">
          <span className="label">Link to a climb (optional)</span>
          <select
            value={climbId}
            onChange={(e) => setClimbId(e.target.value)}
            className="field"
          >
            <option value="">— none —</option>
            {climbs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.grade} · {c.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={busy || !file} className="btn-primary">
          {busy ? "Uploading…" : "Upload & analyze"}
        </button>
      </form>

      <div className="mt-5 space-y-2">
        {videos === null && <SkeletonRows rows={3} />}
        {videos?.length === 0 && (
          <EmptyState
            icon="analysis"
            title="No attempts uploaded yet"
            hint="Upload a clip, or generate a sample analysis to see the whole flow without filming anything."
            action={
              <button onClick={onSample} disabled={busy} className="btn-primary">
                Try a sample analysis
              </button>
            }
          />
        )}
        {videos?.map((video) => {
          const status = STATUS_STYLES[video.status];
          return (
            <div key={video.id} className="card card-hover flex items-center gap-4 px-4 py-3">
              {video.analysis ? (
                <ScoreDial score={video.analysis.overall_score} size={56} label="" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-steel-100 text-xs text-steel-400">
                  {isPending(video.status) ? "···" : "—"}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{video.original_filename}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-steel-500">
                  <span className={`badge whitespace-nowrap ${status.badge}`}>
                    {status.label}
                  </span>
                  <span className="tabular-nums">{formatTimestamp(video.created_at)}</span>
                  {video.duration_seconds != null && (
                    <span>{video.duration_seconds.toFixed(1)}s</span>
                  )}
                  {video.status === "failed" && video.error_message && (
                    <span className="text-rose-600">{video.error_message}</span>
                  )}
                </p>
              </div>
              {video.analysis && (
                <Link
                  href={`/videos/${video.id}`}
                  className="rounded-lg border border-steel-200 px-3 py-1.5 text-sm font-medium text-lake-700 transition-colors hover:bg-lake-50"
                >
                  View feedback
                </Link>
              )}
              <IconButton
                icon="trash"
                label="Delete video"
                onClick={() => void onDelete(video.id)}
                tone="danger"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
