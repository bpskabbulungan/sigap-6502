import clsx from "clsx";
import { useTheme } from "./theme/ThemeProvider.jsx";

export function ThemeToggle({ className = "" }) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      data-clickable="true"
      onClick={toggleTheme}
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={clsx(
        "inline-flex h-10 items-center gap-2 rounded-full border border-border/80 bg-card px-2.5 text-muted-foreground shadow-sm",
        "transition-[background-color,border-color,color,box-shadow] duration-200 hover:border-border hover:bg-muted/60",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        className={clsx("transition-colors", !isDark ? "text-warning" : "text-muted-foreground")}
      >
        <circle cx="12" cy="12" r="4" fill="currentColor" />
        <g stroke="currentColor" strokeWidth="1.6">
          <path d="M12 2v2.8" />
          <path d="M12 19.2V22" />
          <path d="M2 12h2.8" />
          <path d="M19.2 12H22" />
          <path d="M4.2 4.2l2 2" />
          <path d="M17.8 17.8l2 2" />
          <path d="M4.2 19.8l2-2" />
          <path d="M17.8 6.2l2-2" />
        </g>
      </svg>

      <span
        aria-hidden
        className={clsx(
          "relative inline-flex h-6 w-11 items-center rounded-full border transition-all",
          isDark
            ? "border-primary/50 bg-primary/35 shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.2)]"
            : "border-border/80 bg-muted/70"
        )}
      >
        <span
          className={clsx(
            "absolute left-0 h-5 w-5 rounded-full shadow-md transition-[transform,background-color,border-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
            isDark
              ? "translate-x-6 border-slate-200/80 bg-slate-100"
              : "translate-x-0 border-slate-800/70 bg-slate-900"
          )}
        />
      </span>

      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        className={clsx("transition-colors", isDark ? "text-info" : "text-muted-foreground")}
      >
        <path
          d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"
          fill="currentColor"
        />
      </svg>
    </button>
  );
}
