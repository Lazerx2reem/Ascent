"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import Logo from "@/components/Logo";
import { api, ApiError } from "@/lib/api";
import { setToken } from "@/lib/token";

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { access_token } = await api.register(email, password, displayName);
      setToken(access_token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-lake-50 via-mist to-sage-50 p-4">
      {/* Soft alpine glow accents */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-lake-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-20 h-72 w-72 rounded-full bg-sage-200/50 blur-3xl" />

      <div className="relative w-full max-w-sm rounded-2xl border border-steel-200 bg-white/90 p-8 shadow-lift backdrop-blur">
        <div className="flex items-center gap-2.5">
          <Logo className="h-9 w-9" />
          <span className="text-2xl font-bold tracking-tight text-ink">Ascent</span>
        </div>
        <h1 className="mt-4 text-xl font-bold text-ink">Create your account</h1>
        <p className="mt-1 text-sm text-steel-500">
          Start tracking sends and training.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="label">Name</span>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="field"
            />
          </label>
          <label className="block">
            <span className="label">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field"
            />
          </label>
          <label className="block">
            <span className="label">Password</span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field"
            />
            <span className="mt-1 block text-xs text-steel-400">
              At least 8 characters.
            </span>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? "Creating account…" : "Sign up"}
          </button>
        </form>

        <p className="mt-6 text-sm text-steel-500">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-lake-600 hover:text-lake-700 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
