import clsx from "clsx";
import { toneClass } from "../../lib/toneVariants";

export function Badge({
  children,
  variant = "default",
  outline = false,
  className,
  ...props
}) {
  return (
    <span
      role="status"
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors",
        outline ? "bg-transparent" : undefined,
        outline
          ? toneClass(variant, "badgeOutline")
          : toneClass(variant, "badgeSolid"),
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
