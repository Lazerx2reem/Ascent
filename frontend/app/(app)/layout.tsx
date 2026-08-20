"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Icon, { type IconName } from "@/components/Icon";
import Logo from "@/components/Logo";
import { clearToken, getToken } from "@/lib/token";

const NAV_LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/logbook", label: "Logbook", icon: "logbook" },
  { href: "/sessions", label: "Sessions", icon: "sessions" },
  { href: "/videos", label: "Analysis", icon: "analysis" },
  { href: "/training", label: "Training", icon: "training" },
  { href: "/coach", label: "Coach", icon: "coach" },
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
    // Branded hold rather than the word "Loading" — this flashes on every
    // cold load, so it may as well look like the product.
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3">
        <Logo className="h-10 w-10 animate-pulse" />
        <p className="text-sm text-steel-400">Loading your logbook…</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-steel-200/70 bg-white/70 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-2.5">
          <Link
            href="/dashboard"
            className="group flex shrink-0 items-center gap-2.5 rounded-lg pr-1"
          >
            <Logo className="h-7 w-7 transition-transform duration-300 group-hover:-translate-y-0.5" />
            <span className="text-lg font-bold tracking-tight text-ink">Ascent</span>
          </Link>

          {/* Scrolls on narrow screens rather than wrapping the header. */}
          <div className="-mx-1 flex flex-1 gap-0.5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {NAV_LINKS.map(({ href, label, icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all duration-200 ${
                    active
                      ? "bg-gradient-to-b from-lake-500 to-lake-600 text-white shadow-sm"
                      : "text-steel-500 hover:bg-steel-100 hover:text-steel-700"
                  }`}
                >
                  <Icon name={icon} className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              );
            })}
          </div>

          <button
            onClick={() => {
              clearToken();
              router.replace("/login");
            }}
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-steel-500 transition-colors hover:bg-steel-100 hover:text-steel-700"
          >
            <Icon name="logout" className="h-4 w-4" />
            <span className="hidden md:inline">Log out</span>
          </button>
        </nav>
      </header>

      {/* Keyed on the route so each navigation settles in rather than snapping. */}
      <main key={pathname} className="mx-auto max-w-5xl animate-fade-up px-4 py-8">
        {children}
      </main>
    </div>
  );
}
