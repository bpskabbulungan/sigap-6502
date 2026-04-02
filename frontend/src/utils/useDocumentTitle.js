import { useEffect } from "react";

const DEFAULT_SUFFIX = "SIGAP 6502";
const DEFAULT_SEPARATOR = " | ";

export function useDocumentTitle(title, options = {}) {
  const {
    suffix = DEFAULT_SUFFIX,
    separator = DEFAULT_SEPARATOR,
    defaultTitle,
  } = options;

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const previousTitle = document.title;
    const normalizedTitle =
      typeof title === "string" ? title.trim() : "";

    const finalTitle = normalizedTitle
      ? `${normalizedTitle}${suffix ? `${separator}${suffix}` : ""}`
      : defaultTitle || (suffix ? `${suffix}` : previousTitle);

    if (finalTitle) {
      document.title = finalTitle;
    }

    return () => {
      document.title = previousTitle;
    };
  }, [title, suffix, separator, defaultTitle]);
}
