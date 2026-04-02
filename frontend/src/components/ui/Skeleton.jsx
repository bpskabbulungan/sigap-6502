import clsx from "clsx";

const variants = {
  default: "bg-muted/80",
  light: "bg-muted/55",
  dark: "bg-secondary",
};

const shapes = {
  rounded: "rounded-xl",
  circle: "rounded-full",
  square: "rounded-none",
};

export function Skeleton({
  className,
  variant = "default",
  shape = "rounded",
  animated = true,
  effect = "shimmer",
  ...props
}) {
  const isShimmer = animated && effect === "shimmer";
  const isPulse = animated && effect === "pulse";

  return (
    <div
      className={clsx(
        "relative overflow-hidden select-none ring-1 ring-border/60",
        variants[variant] ?? variants.default,
        shapes[shape] ?? shapes.rounded,
        isPulse && "animate-pulse",
        className
      )}
      aria-busy="true"
      aria-live="polite"
      {...props}
    >
      {isShimmer ? (
        <span
          aria-hidden
          className={clsx(
            "pointer-events-none absolute inset-y-0 left-0 -translate-x-full",
            "w-2/3 blur-[2px] animate-shimmer-soft",
            "bg-[linear-gradient(110deg,transparent,hsl(var(--background)/0.62),transparent)]",
            "opacity-70"
          )}
        />
      ) : null}
    </div>
  );
}
