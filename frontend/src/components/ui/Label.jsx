import clsx from "clsx";

const baseStyles = "block font-semibold tracking-wide uppercase";

const variants = {
  default: "text-muted-foreground",
  error: "text-destructive",
  success: "text-success",
  disabled: "cursor-not-allowed text-muted-foreground/70",
};

const sizes = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};

export function Label({
  className,
  children,
  variant = "default",
  size = "md",
  required = false,
  ...props
}) {
  return (
    <label
      className={clsx(
        baseStyles,
        variants[variant] ?? variants.default,
        sizes[size] ?? sizes.md,
        className
      )}
      {...props}
    >
      {children}
      {required ? (
        <span className="ml-1 text-destructive" aria-hidden="true">
          *
        </span>
      ) : null}
    </label>
  );
}
