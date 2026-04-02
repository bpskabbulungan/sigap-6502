import clsx from "clsx";

const baseStyles =
  "card-surface rounded-2xl border border-border shadow-sm transition-all focus-within:ring-1 focus-within:ring-ring/35";

const variants = {
  default: "bg-card text-card-foreground",
  glass: "bg-card text-card-foreground",
  solid: "bg-muted/35 text-foreground",
};

const paddings = {
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export function Card({
  className,
  children,
  variant = "default",
  padding = "md",
  header,
  footer,
  ...props
}) {
  return (
    <div
      className={clsx(
        baseStyles,
        variants[variant] ?? variants.default,
        paddings[padding] ?? paddings.md,
        className
      )}
      {...props}
    >
      {header && <div className="mb-4 border-b border-border pb-3">{header}</div>}
      {children}
      {footer && <div className="mt-4 border-t border-border pt-3">{footer}</div>}
    </div>
  );
}
