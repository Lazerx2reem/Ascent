"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Logo from "@/components/Logo";
import { getToken } from "@/lib/token";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace(getToken() ? "/dashboard" : "/login");
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3">
      <Logo className="h-10 w-10 animate-pulse" />
      <p className="text-sm text-steel-400">Ascent</p>
    </main>
  );
}
