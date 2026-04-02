import { useEffect, useRef } from "react";
import clsx from "clsx";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = "max-w-lg",
  footer,
  closeOnBackdrop = true,
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
    if (!open) return undefined;

    const handleKeydown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;

      const focusables = panelRef.current.querySelectorAll(FOCUSABLE_SELECTOR);
      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !panelRef.current) return;
    const firstFocusable = panelRef.current.querySelector(FOCUSABLE_SELECTOR);
    if (firstFocusable instanceof HTMLElement) {
      firstFocusable.focus();
      return;
    }
    panelRef.current.focus();
  }, [open]);

  return (
    <div
      aria-hidden={!open}
      className={clsx(
        "fixed inset-0 z-[70] flex items-center justify-center p-4 transition-[visibility] duration-200",
        open ? "visible pointer-events-auto" : "invisible pointer-events-none"
      )}
    >
      <div
        className={clsx(
          "absolute inset-0 bg-background/18 transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0"
        )}
        onClick={closeOnBackdrop ? onClose : undefined}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title || "Dialog"}
        tabIndex={-1}
        className={clsx(
          "relative z-10 flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-2xl border border-border bg-[hsl(var(--popover))] text-popover-foreground opacity-100 shadow-lg outline-none",
          maxWidth,
          "transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
          open
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-2 scale-[0.98] opacity-0"
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-sm font-semibold text-popover-foreground">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
            aria-label="Tutup dialog"
          >
            Tutup
          </button>
        </div>

        <div className="max-h-[70vh] overflow-auto p-5">{children}</div>

        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
