"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import MetricBar from "@/components/MetricBar";
import ScoreDial from "@/components/ScoreDial";
import { Skeleton, SkeletonText } from "@/components/Skeleton";
import { api, ApiError } from "@/lib/api";
import { isPending, SEVERITY } from "@/lib/analysis";
import type { VideoDetail } from "@/lib/types";

// Fixed display order for the four movement metrics.
const METRIC_ORDER = ["hip_position", "cog_stability", "foot_control", "body_tension"];

export default function VideoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const videoId = Number(id);
  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);

  async function load() {
    const v = await api.getVideo(videoId);
    setVideo(v);
    return v;
  }

  useEffect(() => {
    load().catch((e) => setError(String(e.message)));
  }, [videoId]);

  // Poll while analysis is still running.
  useEffect(() => {
    if (!video || !isPending(video.status)) return;
    const t = setInterval(() => load().catch(() => {}), 3000);
    return () => clearInterval(t);
  }, [video]);

  // Load the (authorized) media file once analyzed, if a real file exists.
  useEffect(() => {
    if (!video || video.size_bytes === 0) return;
    let revoked: string | null = null;
    api.videoFileUrl(videoId).then((url) => {
      if (url) {
        revoked = url;
        setMediaUrl(url);
      }
    });
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [video, videoId]);

  async function onReanalyze() {
    try {
      await api.reanalyzeVideo(videoId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not re-analyze");
    }
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!video) {
    return (
      <div>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-3 h-7 w-64" />
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-5">
          <Skeleton className="aspect-[9/16] w-full rounded-2xl lg:col-span-2" />
          <div className="space-y-4 lg:col-span-3">
            <div className="card p-5">
              <SkeletonText lines={5} />
            </div>
            <div className="card p-5">
              <SkeletonText lines={4} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const a = video.analysis;

  return (
    <div>
      <Link
        href="/videos"
        className="group inline-flex items-center gap-1.5 text-sm font-medium text-lake-700 transition-colors hover:text-lake-800"
      >
        <span className="transition-transform duration-200 group-hover:-translate-x-0.5">←</span>
        All videos
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <h1 className="truncate text-2xl font-bold tracking-tight text-ink">
          {video.original_filename}
        </h1>
        {a && (
          <span className="text-xs text-steel-500">
            {a.source === "synthetic" ? "Sample analysis" : "MediaPipe pose analysis"} ·{" "}
            {a.frame_count} frames @ {a.analyzed_fps.toFixed(1)}fps
          </span>
        )}
      </div>

      {isPending(video.status) && (
        <div className="card mt-6 flex flex-col items-center px-6 py-12 text-center">
          <span className="relative flex h-12 w-12 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-lake-200 opacity-60" />
            <span className="relative h-3 w-3 rounded-full bg-lake-600" />
          </span>
          <p className="mt-4 text-sm font-semibold text-ink">Analyzing your climb</p>
          <p className="mt-1 text-sm text-steel-500">
            Running pose estimation over the clip — this page updates itself.
          </p>
        </div>
      )}

      {video.status === "failed" && (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-6">
          <p className="font-semibold text-rose-700">Analysis failed</p>
          <p className="mt-1 text-sm text-rose-600">
            {video.error_message ??
              "We couldn't detect a climber in this video. Try a clip where your whole body is in frame."}
          </p>
          <button
            onClick={onReanalyze}
            className="btn-primary mt-4"
          >
            Re-analyze
          </button>
        </div>
      )}

      {a && (
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-5">
          {/* Left: player + overall score */}
          <div className="lg:col-span-2">
            <div className="card overflow-hidden">
              {mediaUrl ? (
                <video src={mediaUrl} controls className="aspect-[9/16] w-full bg-black" />
              ) : (
                <div className="flex aspect-[9/16] w-full items-center justify-center bg-steel-100 text-center text-sm text-steel-400">
                  {video.size_bytes === 0
                    ? "Sample analysis — no video file"
                    : "Preview unavailable"}
                </div>
              )}
            </div>
            <div className="card mt-4 flex items-center gap-4 p-5">
              <ScoreDial score={a.overall_score} />
              <div>
                <p className="font-semibold text-ink">Movement score</p>
                <p className="mt-1 text-sm text-steel-500">
                  A blend of the four metrics. Work the lowest-scoring ones first —
                  they're ordered below with the biggest opportunity on top.
                </p>
              </div>
            </div>
          </div>

          {/* Right: metrics + feedback */}
          <div className="space-y-4 lg:col-span-3">
            <section className="card p-5">
              <h2 className="font-semibold text-ink">Movement metrics</h2>
              <div className="mt-4 space-y-4">
                {METRIC_ORDER.filter((k) => a.metrics[k]).map((k) => (
                  <MetricBar key={k} metric={a.metrics[k]} />
                ))}
              </div>
            </section>

            <section className="card p-5">
              <h2 className="font-semibold text-ink">Coaching notes</h2>
              <div className="mt-3 space-y-3">
                {a.feedback.map((f) => (
                  <div
                    key={f.category}
                    className="flex gap-3 rounded-xl border border-steel-200 p-3"
                  >
                    <span
                      className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${SEVERITY[f.severity].bar}`}
                    />
                    <div>
                      <p className="text-sm font-semibold text-ink">{f.title}</p>
                      <p className="mt-0.5 text-sm text-steel-600">{f.message}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-steel-400">
                Heuristic analysis for guidance, not a substitute for a coach&apos;s eye.
                Ask the{" "}
                <Link href="/coach" className="font-medium text-lake-700 hover:underline">
                  coach
                </Link>{" "}
                about these results to dig into what to do about them.
              </p>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
