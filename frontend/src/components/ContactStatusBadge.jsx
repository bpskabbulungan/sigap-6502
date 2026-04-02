import clsx from "clsx";
import { toneFromStatus } from "../lib/statusVariantMap";
import { formatStatusLabel } from "../lib/contactFormatters";

const STATUS_BADGE_TONE_CLASS = {
  default:
    "border-[hsl(var(--border)/0.82)] bg-[hsl(var(--muted)/0.45)] text-[hsl(var(--foreground))]",
  success:
    "border-[hsl(var(--success)/0.45)] bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]",
  warning:
    "border-[hsl(var(--warning)/0.5)] bg-[hsl(var(--warning)/0.18)] text-[hsl(var(--warning-foreground))]",
  info: "border-[hsl(var(--info)/0.45)] bg-[hsl(var(--info)/0.14)] text-[hsl(var(--info))]",
  danger:
    "border-[hsl(var(--destructive)/0.45)] bg-[hsl(var(--destructive)/0.15)] text-[hsl(var(--destructive))]",
};

export function ContactStatusBadge({ status, className }) {
  const normalized = (status || "").toLowerCase();
  const tone = toneFromStatus(normalized, "default");
  const toneClass = STATUS_BADGE_TONE_CLASS[tone] ?? STATUS_BADGE_TONE_CLASS.default;

  return (
    <span
      role="status"
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors normal-case tracking-normal",
        toneClass,
        className
      )}
    >
      {formatStatusLabel(normalized || status)}
    </span>
  );
}
