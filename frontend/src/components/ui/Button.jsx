import clsx from "clsx";
import { Spinner } from "./Spinner";

const baseClasses =
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-px disabled:pointer-events-none disabled:opacity-55";

const variants = {
  primary:
    "border border-primary/80 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
  secondary:
    "border border-border/85 bg-secondary text-secondary-foreground shadow-sm hover:bg-muted",
  ghost:
    "border border-transparent bg-transparent text-foreground hover:bg-muted/70",
  destructive:
    "border border-destructive/75 bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
  success:
    "border border-success/75 bg-success text-success-foreground shadow-sm hover:bg-success/90",
  info:
    "border border-info/75 bg-info text-info-foreground shadow-sm hover:bg-info/90",
  warning:
    "border border-warning/75 bg-warning text-warning-foreground shadow-sm hover:bg-warning/90",
};

const outlines = {
  primary:
    "border border-primary/45 bg-transparent text-primary hover:bg-primary/10",
  secondary:
    "border border-border bg-transparent text-foreground hover:bg-muted/70",
  ghost:
    "border border-transparent bg-transparent text-foreground hover:bg-muted/70",
  destructive:
    "border border-destructive/50 bg-transparent text-destructive hover:bg-destructive/10",
  success:
    "border border-success/50 bg-transparent text-success hover:bg-success/10",
  info:
    "border border-info/50 bg-transparent text-info hover:bg-info/10",
  warning:
    "border border-warning/55 bg-transparent text-warning hover:bg-warning/10",
};

const sizes = {
  sm: "h-9 px-3.5 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-base",
};

const iconOnlySizes = {
  sm: "h-9 w-9 p-0",
  md: "h-10 w-10 p-0",
  lg: "h-12 w-12 p-0",
};

const iconOnlySolidOverrides = {
  success: "!border-emerald-700 !bg-emerald-600 !text-white hover:!bg-emerald-700",
  info: "!border-sky-700 !bg-sky-600 !text-white hover:!bg-sky-700",
  destructive: "!border-red-700 !bg-red-600 !text-white hover:!bg-red-700",
  warning: "!border-amber-700 !bg-amber-500 !text-slate-950 hover:!bg-amber-600",
};

export function Button({
  variant = "primary",
  outline = false,
  size = "md",
  iconOnly = false,
  loading = false,
  loadingText,
  className,
  children,
  disabled,
  ...props
}) {
  const legacyAliases = { danger: "destructive" };
  const normalizedVariant = legacyAliases[variant] ?? variant;
  const resolvedVariant = variants[normalizedVariant] ? normalizedVariant : "primary";
  const iconOnlyVariantClass =
    iconOnly && !outline ? iconOnlySolidOverrides[resolvedVariant] : null;
  const isDisabled = Boolean(disabled || loading);

  return (
    <button
      aria-busy={loading || undefined}
      disabled={isDisabled}
      className={clsx(
        baseClasses,
        iconOnly
          ? (iconOnlySizes[size] ?? iconOnlySizes.md)
          : (sizes[size] ?? sizes.md),
        outline ? outlines[resolvedVariant] : variants[resolvedVariant],
        iconOnlyVariantClass,
        className
      )}
      {...props}
    >
      {loading ? <Spinner size="sm" className="text-current" /> : null}
      {iconOnly && loading ? null : loading && loadingText ? loadingText : children}
    </button>
  );
}
