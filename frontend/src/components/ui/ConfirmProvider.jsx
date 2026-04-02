import { createContext, useCallback, useContext, useMemo } from "react";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

const ConfirmContext = createContext({ confirm: async () => false });

function cssVar(name, alpha = 1) {
  if (typeof document === "undefined") return "";
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  if (!value) return "";
  return alpha < 1 ? `hsl(${value} / ${alpha})` : `hsl(${value})`;
}

function resolveDialogPalette() {
  return {
    background: cssVar("--popover") || "hsl(0 0% 100%)",
    color: cssVar("--popover-foreground") || "hsl(224 27% 14%)",
    border: `1px solid ${cssVar("--border", 0.8)}`,
    shadow: "0 18px 44px hsl(224 40% 2% / 0.32)",
  };
}

function resolveVariant(variant) {
  if (variant === "danger") {
    return {
      icon: "warning",
      confirmButtonColor: cssVar("--destructive"),
      cancelButtonColor: cssVar("--secondary"),
      cancelButtonTextColor: cssVar("--secondary-foreground"),
    };
  }
  if (variant === "warning") {
    return {
      icon: "warning",
      confirmButtonColor: cssVar("--warning"),
      cancelButtonColor: cssVar("--secondary"),
      cancelButtonTextColor: cssVar("--secondary-foreground"),
    };
  }
  if (variant === "success") {
    return {
      icon: "question",
      confirmButtonColor: cssVar("--success"),
      cancelButtonColor: cssVar("--secondary"),
      cancelButtonTextColor: cssVar("--secondary-foreground"),
    };
  }
  return {
    icon: "question",
    confirmButtonColor: cssVar("--primary"),
    cancelButtonColor: cssVar("--secondary"),
    cancelButtonTextColor: cssVar("--secondary-foreground"),
  };
}

export function ConfirmProvider({ children }) {
  const confirm = useCallback(
    async ({
      title = "Konfirmasi",
      message = "Apakah Anda yakin?",
      confirmText = "Ya",
      cancelText = "Batal",
      variant = "warning",
    } = {}) => {
      const palette = resolveDialogPalette();
      const config = resolveVariant(variant);

      const result = await Swal.fire({
        title,
        text: message,
        icon: config.icon,
        showCancelButton: true,
        confirmButtonText: confirmText,
        cancelButtonText: cancelText,
        confirmButtonColor: config.confirmButtonColor,
        cancelButtonColor: config.cancelButtonColor,
        cancelButtonAriaLabel: cancelText,
        reverseButtons: true,
        focusCancel: true,
        background: palette.background,
        color: palette.color,
        customClass: {
          popup: "sigap-confirm-popup",
          confirmButton: "sigap-confirm-btn",
          cancelButton: "sigap-cancel-btn",
        },
        didOpen: (popup) => {
          popup.style.background = palette.background;
          popup.style.opacity = "1";
          popup.style.border = palette.border;
          popup.style.borderRadius = "16px";
          popup.style.boxShadow = palette.shadow;
          const cancelButton = popup.querySelector(".swal2-cancel");
          if (cancelButton instanceof HTMLElement) {
            cancelButton.style.color = config.cancelButtonTextColor;
          }
        },
      });

      return Boolean(result.isConfirmed);
    },
    []
  );

  const value = useMemo(() => ({ confirm }), [confirm]);

  return <ConfirmContext.Provider value={value}>{children}</ConfirmContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm() {
  return useContext(ConfirmContext);
}
