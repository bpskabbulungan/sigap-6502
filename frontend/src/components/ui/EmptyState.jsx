import clsx from "clsx";
import { Button } from "./Button";
import { toneClass } from "../../lib/toneVariants";

const baseStyles =
  "flex flex-col items-center justify-center rounded-2xl border border-dashed text-center transition-all";

const variants = {
  default: toneClass("default", "subtleSurface"),
  info: toneClass("info", "subtleSurface"),
  warning: toneClass("warning", "subtleSurface"),
  danger: toneClass("danger", "subtleSurface"),
};

const sizes = {
  sm: "p-6 text-sm",
  md: "p-10 text-base",
  lg: "p-12 text-lg",
};

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  variant = "default",
  size = "md",
  className,
  actionVariant = "secondary",
}) {
  return (
    <div
      className={clsx(
        baseStyles,
        variants[variant] ?? variants.default,
        sizes[size] ?? sizes.md,
        className
      )}
    >
      {icon ? <div className="mb-3 text-4xl text-primary/80">{icon}</div> : null}
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {actionLabel ? (
        <Button
          className="mt-4"
          onClick={onAction}
          variant={actionVariant}
          size={size === "lg" ? "lg" : "md"}
        >
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
