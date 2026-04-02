import { createContext, useCallback, useContext, useMemo } from "react";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

const ToastContext = createContext({ add: () => {} });

function cssVar(name, alpha = 1) {
  if (typeof document === "undefined") return "";
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  if (!value) return "";
  return alpha < 1 ? `hsl(${value} / ${alpha})` : `hsl(${value})`;
}

function resolveToastColors() {
  return {
    background: cssVar("--card") || "hsl(0 0% 100%)",
    color: cssVar("--card-foreground") || "hsl(224 27% 14%)",
    border: `1px solid ${cssVar("--border", 0.85)}`,
    shadow: "0 14px 34px hsl(224 40% 2% / 0.26)",
  };
}

export function ToastProvider({ children }) {
  const add = useCallback((message, { type = "info", duration = 3200 } = {}) => {
    const icon =
      type === "error"
        ? "error"
        : type === "success"
        ? "success"
        : type === "warning"
        ? "warning"
        : "info";

    const palette = resolveToastColors();

    Swal.fire({
      toast: true,
      position: "top-end",
      icon,
      title: message,
      showConfirmButton: false,
      timer: Math.max(1000, duration || 3200),
      timerProgressBar: true,
      background: palette.background,
      color: palette.color,
      customClass: {
        popup: "sigap-toast-popup",
      },
      didOpen: (popup) => {
        popup.style.background = palette.background;
        popup.style.opacity = "1";
        popup.style.border = palette.border;
        popup.style.borderRadius = "14px";
        popup.style.boxShadow = palette.shadow;
      },
    });
  }, []);

  const value = useMemo(() => ({ add }), [add]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  return useContext(ToastContext);
}
