import { useEffect, useState } from "react";

function getSystemTheme() {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia?.("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function getStoredTheme() {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("sigap_theme");
  } catch {
    return null;
  }
}

export function ThemeToggle({ className = "" }) {
  // Mulai dari 'dark' untuk hindari mismatch saat SSR, lalu sinkron setelah mount
  const [theme, setTheme] = useState("dark");

  // Sinkron awal dari storage / system
  useEffect(() => {
    const initial = getStoredTheme() || getSystemTheme();
    setTheme(initial);
  }, []);

  // Terapkan class ke <html> + simpan ke localStorage + animasi (jika tidak reduce motion)
  useEffect(() => {
    if (typeof document === "undefined") return;

    const root = document.documentElement;
    const prefersReduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    root.classList.remove("theme-light", "theme-dark");
    root.classList.add(theme === "light" ? "theme-light" : "theme-dark");

    try {
      localStorage.setItem("sigap_theme", theme);
    } catch {
      // Ignore storage errors (e.g. private mode)
    }

    if (!prefersReduced) {
      root.classList.add("theme-animate");
      const t = setTimeout(() => root.classList.remove("theme-animate"), 300);
      return () => clearTimeout(t);
    }
  }, [theme]);

  // Ikuti perubahan system theme & perubahan dari tab lain (storage)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onSystemChange = (e) => {
      const stored = getStoredTheme();
      // Hanya auto-ikuti sistem kalau user belum memilih manual (tidak ada di storage)
      if (!stored) setTheme(e.matches ? "light" : "dark");
    };
    mq.addEventListener?.("change", onSystemChange);

    const onStorage = (e) => {
      if (e.key === "sigap_theme" && e.newValue) {
        setTheme(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      mq.removeEventListener?.("change", onSystemChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Sun icon */}
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        className="text-yellow-400"
      >
        <circle cx="12" cy="12" r="4" fill="currentColor" />
        <g stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2v3" />
          <path d="M12 19v3" />
          <path d="M2 12h3" />
          <path d="M19 12h3" />
          <path d="M4.2 4.2l2.1 2.1" />
          <path d="M17.7 17.7l2.1 2.1" />
          <path d="M4.2 19.8l2.1-2.1" />
          <path d="M17.7 6.3l2.1-2.1" />
        </g>
      </svg>

      <label className="relative inline-flex cursor-pointer items-center">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={theme === "dark"}
          onChange={(e) => setTheme(e.target.checked ? "dark" : "light")}
          aria-label={
            theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
          }
        />

        {/* Track + knob di ::before */}
        <span
          className="
      relative inline-block h-5 w-10 rounded-full bg-slate-600
      transition-colors duration-200 ease-out
      peer-checked:bg-primary-500

      before:absolute before:top-0.5 before:left-0.5
      before:h-4 before:w-4 before:rounded-full before:bg-white
      before:content-[''] before:transition before:duration-300
      before:ease-[cubic-bezier(0.22,1,0.36,1)]
      peer-checked:before:translate-x-5
      motion-reduce:before:transition-none
    "
        />
      </label>

      {/* Moon icon */}
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        className="text-slate-300"
      >
        <path
          d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"
          fill="currentColor"
        />
      </svg>
    </div>
  );
}
