"use client";

import { FormEvent, useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { SkeletonText } from "@/components/Skeleton";
import { api, ApiError } from "@/lib/api";
import { V_SCALE, YDS } from "@/lib/grades";
import type { UserProfile } from "@/lib/types";

const STYLES: { value: string; label: string }[] = [
  { value: "boulder", label: "Bouldering" },
  { value: "sport", label: "Sport" },
  { value: "trad", label: "Trad" },
  { value: "all-round", label: "All-round" },
];

/** Grade ranges are stored as "V4-V6" / "5.10d-5.11b". Neither scale uses a
 * hyphen inside a grade, so splitting on the first one is unambiguous. */
function splitRange(range: string | null, scale: string[]): [string, string] {
  if (!range) return ["", ""];
  const [lo, hi = lo] = range.split("-").map((g) => g.trim());
  return scale.includes(lo) && scale.includes(hi) ? [lo, hi] : ["", ""];
}

function joinRange(lo: string, hi: string): string | null {
  if (!lo && !hi) return null;
  if (!lo || !hi || lo === hi) return lo || hi;
  return `${lo}-${hi}`;
}

function GradeRange({
  label,
  scale,
  value,
  onChange,
}: {
  label: string;
  scale: string[];
  value: [string, string];
  onChange: (v: [string, string]) => void;
}) {
  const [lo, hi] = value;
  return (
    <div>
      <p className="label">{label}</p>
      <div className="flex items-center gap-2">
        <select
          aria-label={`${label} — from`}
          value={lo}
          onChange={(e) => {
            const next = e.target.value;
            // Keep the range ordered: raising the floor past the ceiling drags it along.
            const bumped = hi && next && scale.indexOf(next) > scale.indexOf(hi) ? next : hi;
            onChange([next, bumped]);
          }}
          className="field"
        >
          <option value="">—</option>
          {scale.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
        <span className="mt-1 text-sm text-steel-400">to</span>
        <select
          aria-label={`${label} — to`}
          value={hi}
          onChange={(e) => onChange([lo, e.target.value])}
          className="field"
        >
          <option value="">—</option>
          {scale
            .filter((g) => !lo || scale.indexOf(g) >= scale.indexOf(lo))
            .map((g) => (
              <option key={g}>{g}</option>
            ))}
        </select>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [style, setStyle] = useState("");
  const [homeGym, setHomeGym] = useState("");
  const [boulderRange, setBoulderRange] = useState<[string, string]>(["", ""]);
  const [routeRange, setRouteRange] = useState<[string, string]>(["", ""]);
  const [goals, setGoals] = useState("");

  function load(p: UserProfile) {
    setProfile(p);
    setDisplayName(p.display_name);
    setStyle(p.climbing_style ?? "");
    setHomeGym(p.home_gym ?? "");
    setBoulderRange(splitRange(p.grade_range_boulder, V_SCALE));
    setRouteRange(splitRange(p.grade_range_route, YDS));
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
          grade_range_boulder: joinRange(...boulderRange),
          grade_range_route: joinRange(...routeRange),
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
          <GradeRange
            label="Boulder grade range"
            scale={V_SCALE}
            value={boulderRange}
            onChange={setBoulderRange}
          />
          <GradeRange
            label="Route grade range"
            scale={YDS}
            value={routeRange}
            onChange={setRouteRange}
          />
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
