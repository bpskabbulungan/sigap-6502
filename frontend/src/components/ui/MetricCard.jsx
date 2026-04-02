import clsx from "clsx";
import { Skeleton } from "./Skeleton";

function toneToKey(tone) {
  if (tone === "emerald") return "success";
  if (tone === "amber") return "warning";
  if (tone === "sky") return "info";
  if (tone === "rose") return "danger";
  return "neutral";
}

export function MetricCard({
  label,
  value,
  helper,
  tone = "slate",
  loading = false,
  loadingTone = "onDark",
}) {
  const key = toneToKey(tone);

  if (loading) {
    const toneProp = loadingTone === "onLight" ? "onLight" : "onDark";
    return (
      <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-sm sm:px-5 sm:py-4">
        <Skeleton
          tone={toneProp}
          effect="shimmer"
          className="mb-3 h-3 w-24 rounded-full"
        />
        <Skeleton
          tone={toneProp}
          effect="shimmer"
          className="mb-2 h-6 w-28 rounded-full"
        />
        <Skeleton
          tone={toneProp}
          effect="shimmer"
          className="h-3 w-40 rounded-full"
        />
      </div>
    );
  }

  const style = {
    backgroundColor: `var(--tone-${key}-bg)`,
    color: `var(--tone-${key}-text)`,
    borderColor: `var(--tone-${key}-border)`,
  };

  return (
    <div
      style={style}
      className={clsx(
        "min-w-0 rounded-2xl border px-4 py-3 shadow-sm transition-[transform,box-shadow,background-color] sm:px-5 sm:py-4",
        "bg-[linear-gradient(170deg,transparent,hsl(var(--background)/0.22))] hover:-translate-y-0.5 hover:shadow-md"
      )}
    >
      <p className="metric-card-label text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">
        {label}
      </p>
      <p className="metric-card-value mt-1.5 text-xl font-semibold leading-tight [overflow-wrap:anywhere] sm:mt-2 sm:text-2xl">
        {value}
      </p>
      {helper ? (
        <p className="metric-card-helper mt-1.5 text-[11px] leading-5 text-muted-foreground [overflow-wrap:anywhere] sm:mt-2 sm:text-xs">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
