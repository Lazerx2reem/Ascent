import type { ReactNode } from "react";
import Icon, { type IconName } from "./Icon";

/**
 * The "nothing here yet" panel. An icon and a next step read as an invitation;
 * the bare dashed box it replaces read as something being broken.
 */
export default function EmptyState({
  icon = "mountain",
  title,
  hint,
  action,
  bare = false,
}: {
  icon?: IconName;
  title: string;
  hint?: ReactNode;
  action?: ReactNode;
  /** Drop the dashed frame when this sits inside a card — a box drawn inside
   *  a box reads as a mistake rather than as an empty slot. */
  bare?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center px-6 text-center ${
        bare
          ? "py-8"
          : "rounded-2xl border border-dashed border-steel-300 bg-white/60 py-12"
      }`}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-lake-100 to-sage-100 text-lake-600 ring-1 ring-inset ring-white/60">
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <p className="mt-3.5 text-sm font-semibold text-ink">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm leading-relaxed text-steel-500">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
