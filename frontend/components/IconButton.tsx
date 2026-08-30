import Icon, { type IconName } from "./Icon";

/**
 * A square icon-only control with a real hit area.
 *
 * Replaces the bare "✕" text buttons that were scattered around: those had no
 * accessible name, no hover target beyond the glyph itself, and were often
 * hidden until hover — which leaves them undiscoverable on touch.
 */
export default function IconButton({
  icon,
  label,
  onClick,
  tone = "neutral",
  disabled = false,
  className = "",
}: {
  icon: IconName;
  /** Accessible name — also the tooltip. */
  label: string;
  onClick: () => void;
  tone?: "neutral" | "danger";
  disabled?: boolean;
  className?: string;
}) {
  const tones = {
    neutral: "text-steel-400 hover:bg-steel-100 hover:text-steel-700",
    danger: "text-steel-400 hover:bg-rose-50 hover:text-rose-600",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
        transition-colors focus-visible:outline-none focus-visible:ring-2
        focus-visible:ring-lake-500/40 disabled:cursor-not-allowed disabled:opacity-40
        ${tones[tone]} ${className}`}
    >
      <Icon name={icon} className="h-4 w-4" />
    </button>
  );
}
