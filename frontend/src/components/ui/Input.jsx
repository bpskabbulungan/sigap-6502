import { forwardRef } from "react";
import clsx from "clsx";

const baseStyles =
  "block w-full rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground shadow-sm transition-[border-color,background-color,color,box-shadow] duration-200 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-60";

const variants = {
  default: "border-input focus:border-ring",
  error:
    "border-destructive/55 focus:border-destructive focus:ring-destructive/25",
  success: "border-success/55 focus:border-success focus:ring-success/25",
};

const sizes = {
  sm: "h-9 px-3 text-xs",
  md: "h-10 px-3.5 text-sm",
  lg: "h-12 px-4 text-base",
};

const wrapperSizes = {
  sm: "h-9 px-3 text-xs",
  md: "h-10 px-3.5 text-sm",
  lg: "h-12 px-4 text-base",
};

const innerInputSizes = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};

export const Input = forwardRef(function Input(
  {
    className,
    variant = "default",
    size = "md",
    prefix,
    suffix,
    ...props
  },
  ref
) {
  const resolvedVariant = variants[variant] ? variant : "default";

  if (prefix || suffix) {
    return (
      <div
        className={clsx(
          "flex w-full items-center gap-2 rounded-xl border border-input bg-background shadow-sm transition-[border-color,background-color,box-shadow] duration-200 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25",
          variants[resolvedVariant],
          wrapperSizes[size] ?? wrapperSizes.md,
          className
        )}
      >
        {prefix ? <span className="shrink-0 text-muted-foreground">{prefix}</span> : null}
        <input
          ref={ref}
          className={clsx(
            "min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground",
            innerInputSizes[size] ?? innerInputSizes.md
          )}
          {...props}
        />
        {suffix ? <span className="shrink-0 text-muted-foreground">{suffix}</span> : null}
      </div>
    );
  }

  return (
    <input
      ref={ref}
      className={clsx(
        baseStyles,
        variants[resolvedVariant],
        sizes[size] ?? sizes.md,
        className
      )}
      {...props}
    />
  );
});
