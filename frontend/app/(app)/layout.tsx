"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Logo from "@/components/Logo";
import { clearToken, getToken } from "@/lib/token";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/logbook", label: "Logbook" },
  { href: "/sessions", label: "Sessions" },
  { href: "/videos", label: "Analysis" },
  { href: "/training", label: "Training" },
  { href: "/coach", label: "Coach" },
];

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
    } else {
      setReady(true);
    }
  }, [router]);

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-mist">
        <p className="text-steel-400">Loading…</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-mist">
      <header className="sticky top-0 z-20 border-b border-steel-200 bg-white/85 backdrop-blur">
        <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Logo className="h-7 w-7" />
            <span className="text-lg font-bold tracking-tight text-ink">Ascent</span>
          </Link>
          <div className="flex gap-1">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  pathname.startsWith(href)
                    ? "bg-lake-50 text-lake-700"
                    : "text-steel-500 hover:bg-steel-100 hover:text-steel-700"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
          <button
            onClick={() => {
              clearToken();
              router.replace("/login");
            }}
            className="ml-auto rounded-lg px-3 py-1.5 text-sm text-steel-500 transition-colors hover:bg-steel-100 hover:text-steel-700"
          >
            Log out
          </button>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
