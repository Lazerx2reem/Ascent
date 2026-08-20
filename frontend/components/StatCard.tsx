import Icon, { type IconName } from "./Icon";

/** Headline number with a label. The accent rail keeps a row of them rhythmic. */
export default function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: IconName;
}) {
  return (
    <div className="card card-hover group relative overflow-hidden p-4">
      {/* Accent rail */}
      <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-lake-500 to-sage-400" />
      {/* Corner wash — warms the surface without competing with the number. */}
      <span className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br from-lake-100/70 to-sage-100/50 blur-2xl transition-opacity duration-500 group-hover:opacity-80" />

      <div className="relative flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-steel-500">
          {label}
        </p>
        {icon && (
          <Icon
            name={icon}
            className="h-4 w-4 shrink-0 text-steel-300 transition-colors duration-300 group-hover:text-lake-500"
          />
        )}
      </div>
      <p className="relative mt-1 text-2xl font-bold tabular-nums text-ink">{value}</p>
    </div>
  );
}
