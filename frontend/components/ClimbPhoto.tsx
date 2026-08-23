"use client";

import { useEffect, useState } from "react";
import Icon from "./Icon";
import { api } from "@/lib/api";

/**
 * A climb's photo, fetched with the caller's bearer token.
 *
 * The image endpoint is authorized, so a plain <img src> can't reach it —
 * the bytes come back as a blob and become an object URL, revoked on unmount
 * so long logbook scrolls don't leak them. Remount (via key) to refetch after
 * a replace.
 */
export default function ClimbPhoto({
  climbId,
  alt,
  className = "",
}: {
  climbId: number;
  alt: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    api
      .climbImageUrl(climbId)
      .then((u) => {
        if (cancelled) {
          if (u) URL.revokeObjectURL(u);
          return;
        }
        if (u) {
          objectUrl = u;
          setUrl(u);
        } else {
          setFailed(true);
        }
      })
      .catch(() => !cancelled && setFailed(true));

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [climbId]);

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center bg-steel-100 text-steel-400 ${className}`}
      >
        <Icon name="mountain" className="h-6 w-6" />
      </div>
    );
  }

  if (!url) return <div className={`skeleton ${className}`} />;

  // eslint-disable-next-line @next/next/no-img-element -- blob: URL, so the
  // Next image optimizer has nothing to fetch or cache.
  return <img src={url} alt={alt} className={`object-cover ${className}`} />;
}
