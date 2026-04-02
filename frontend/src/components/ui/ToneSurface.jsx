import clsx from "clsx";
import { toneClass } from "../../lib/toneVariants";

const sizeClasses = {
  sm: "px-3 py-2 text-xs",
  md: "px-4 py-3 text-sm",
  lg: "p-4 text-sm",
};

export function ToneSurface({
  as = "div",
  tone = "default",
  size = "md",
  className,
  children,
  ...props
}) {
  const Tag = as;

  return (
    <Tag
      className={clsx(
        "rounded-xl border",
        toneClass(tone, "softSurface"),
        sizeClasses[size] ?? sizeClasses.md,
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}
