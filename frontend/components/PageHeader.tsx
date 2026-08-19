import type { ReactNode } from "react";

/**
 * Every page opened with its own ad-hoc h1 + paragraph, at slightly different
 * sizes and spacings. This is that pattern, once.
 */
export default function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-lake-600">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-tight text-ink">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-steel-500">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
