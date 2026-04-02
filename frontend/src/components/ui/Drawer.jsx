import { useEffect, useRef } from "react";
import clsx from "clsx";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Drawer({
  open,
  onClose,
  title,
  side = "right",
  children,
  size = "sm",
  panelClassName = "",
  backdropClassName = "",
  closeText = "Tutup",
  closeAriaLabel = "Tutup panel",
  closeAsIcon = false,
  closeButtonClassName = "",
  closeOnBackdrop = true,
  closeOnEsc = true,
}) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !closeOnEsc) return undefined;
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeOnEsc, onClose]);

  useEffect(() => {
    if (!open || !panelRef.current) return;
    const firstFocusable = panelRef.current.querySelector(FOCUSABLE_SELECTOR);
    if (firstFocusable instanceof HTMLElement) {
      firstFocusable.focus();
      return;
    }
    panelRef.current.focus();
  }, [open]);

  const widthClass = size === "lg" ? "w-80" : size === "md" ? "w-72" : "w-64";
  const sidePos = side === "right" ? "right-0" : "left-0";
  const sideClosed = side === "right" ? "translate-x-full" : "-translate-x-full";
  const sideBorder = side === "right" ? "border-l" : "border-r";

  return (
    <div
      aria-hidden={!open}
      className={clsx(
        "fixed inset-0 z-[60] transition-[visibility] duration-200",
        open ? "visible pointer-events-auto" : "invisible pointer-events-none"
      )}
    >
      <div
        className={clsx(
          "absolute inset-0 bg-background/70 transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0",
          backdropClassName
        )}
        onClick={closeOnBackdrop ? onClose : undefined}
      />

      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title || "Panel"}
        tabIndex={-1}
        className={clsx(
          "absolute flex h-full max-w-[85vw] flex-col border border-[hsl(var(--border))] bg-[hsl(var(--popover))] text-[hsl(var(--popover-foreground))] shadow-lg outline-none transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] sm:max-w-[80vw]",
          sidePos,
          widthClass,
          sideBorder,
          open ? "translate-x-0" : sideClosed,
          panelClassName
        )}
      >
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-4 py-3.5">
          <h3
            className="text-base font-semibold tracking-tight text-[hsl(var(--menu-ink))]"
            data-drawer-focus
          >
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className={clsx(
              "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45",
              closeAsIcon
                ? "grid h-8 w-8 place-items-center rounded-full bg-transparent text-sm font-semibold leading-none text-[hsl(var(--menu-ink))] opacity-80 hover:bg-muted/65 hover:opacity-100"
                : "rounded-lg px-2 py-1 text-sm text-[hsl(var(--menu-ink))] opacity-80 hover:bg-muted hover:opacity-100",
              closeButtonClassName
            )}
            aria-label={closeAriaLabel}
          >
            {closeText}
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {children}
          <div className="h-[env(safe-area-inset-bottom,0)]" />
        </div>
      </aside>
    </div>
  );
}
