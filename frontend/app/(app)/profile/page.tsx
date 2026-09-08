"use client";

import { FormEvent, useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { SkeletonText } from "@/components/Skeleton";
import { api, ApiError } from "@/lib/api";
import type { UserProfile } from "@/lib/types";

const STYLES: { value: string; label: string }[] = [
  { value: "boulder", label: "Bouldering" },
  { value: "sport", label: "Sport" },
  { value: "trad", label: "Trad" },
  { value: "all-round", label: "All-round" },
];

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [style, setStyle] = useState("");
  const [homeGym, setHomeGym] = useState("");
  const [boulderRange, setBoulderRange] = useState("");
  const [routeRange, setRouteRange] = useState("");
  const [goals, setGoals] = useState("");

  function load(p: UserProfile) {
    setProfile(p);
    setDisplayName(p.display_name);
    setStyle(p.climbing_style ?? "");
    setHomeGym(p.home_gym ?? "");
    setBoulderRange(p.grade_range_boulder ?? "");
    setRouteRange(p.grade_range_route ?? "");
    setGoals(p.goals ?? "");
  }

  useEffect(() => {
    api
      .me()
      .then(load)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load your profile"));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      load(
        await api.updateProfile({
          display_name: displayName.trim(),
          climbing_style: style || null,
          home_gym: homeGym.trim() || null,
          grade_range_boulder: boulderRange.trim() || null,
          grade_range_route: routeRange.trim() || null,
          goals: goals.trim() || null,
        })
      );
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save your profile");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Your account"
        title="Profile"
        description="The coach reads this before every answer, so the more it knows about how and where you climb, the more specific its advice gets."
      />

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {!profile ? (
        <div className="card mt-4 p-5">
          <SkeletonText lines={6} />
        </div>
      ) : (
        <form onSubmit={onSubmit} className="card mt-4 grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <label className="block">
            <span className="label">Name</span>
            <input
              required
              maxLength={100}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="field"
            />
          </label>
          <label className="block">
            <span className="label">Email</span>
            <input value={profile.email} disabled className="field bg-steel-50 text-steel-500" />
          </label>
          <label className="block">
            <span className="label">Primary discipline</span>
            <select value={style} onChange={(e) => setStyle(e.target.value)} className="field">
              <option value="">—</option>
              {STYLES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Home gym</span>
            <input
              value={homeGym}
              onChange={(e) => setHomeGym(e.target.value)}
              placeholder="where you climb most"
              className="field"
            />
          </label>
          <label className="block">
            <span className="label">Boulder grade range</span>
            <input
              value={boulderRange}
              onChange={(e) => setBoulderRange(e.target.value)}
              placeholder="e.g. V4-V6"
              className="field"
            />
          </label>
          <label className="block">
            <span className="label">Route grade range</span>
            <input
              value={routeRange}
              onChange={(e) => setRouteRange(e.target.value)}
              placeholder="e.g. 5.10d-5.11b"
              className="field"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Goals</span>
            <textarea
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              rows={3}
              placeholder="e.g. Send V7 outdoors by end of season; build finger strength."
              className="field"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? "Saving…" : "Save profile"}
            </button>
            {saved && <span className="text-sm text-sage-700">Saved.</span>}
          </div>
        </form>
      )}
    </div>
  );
}
