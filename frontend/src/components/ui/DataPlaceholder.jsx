import clsx from "clsx";
import { toneClass } from "../../lib/toneVariants";

const baseStyles =
  "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed text-center";

const variants = {
  default: toneClass("default", "subtleSurface"),
  info: toneClass("info", "subtleSurface"),
  warning: toneClass("warning", "subtleSurface"),
  danger: toneClass("danger", "subtleSurface"),
};

const sizes = {
  sm: "min-h-[140px] p-6",
  md: "min-h-[180px] p-8",
  lg: "min-h-[220px] p-10",
};

export function DataPlaceholder({
  icon,
  title,
  description,
  action,
  variant = "default",
  size = "md",
  className,
  ...props
}) {
  return (
    <div
      className={clsx(
        baseStyles,
        variants[variant] ?? variants.default,
        sizes[size] ?? sizes.md,
        className
      )}
      {...props}
    >
      {icon ? <div className="text-4xl text-primary/80">{icon}</div> : null}

      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>

      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
