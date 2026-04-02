import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const STORAGE_KEY = "sigap_theme";
const DEFAULT_THEME = "light";
const ALLOWED_THEMES = new Set(["light", "dark"]);

const ThemeContext = createContext({
  theme: DEFAULT_THEME,
  resolvedTheme: DEFAULT_THEME,
  setTheme: () => {},
  toggleTheme: () => {},
});

function safeStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // noop
  }
}

function normalizeTheme(rawTheme) {
  return ALLOWED_THEMES.has(rawTheme) ? rawTheme : DEFAULT_THEME;
}

function commitThemeClass(root, theme) {
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("theme-dark", theme === "dark");
  root.classList.toggle("theme-light", theme === "light");
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

function prefersReducedMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getInitialTheme() {
  if (typeof window === "undefined") return DEFAULT_THEME;
  return normalizeTheme(safeStorageGet(STORAGE_KEY));
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme);
  const pendingAnimateRef = useRef(false);
  const fallbackTimerRef = useRef(null);

  const clearFallbackAnimation = useCallback(() => {
    if (typeof document === "undefined") return;

    const root = document.documentElement;
    root.classList.remove("theme-animate");

    if (fallbackTimerRef.current !== null && typeof window !== "undefined") {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  useLayoutEffect(() => {
    if (typeof document === "undefined") return;

    const normalized = normalizeTheme(theme);
    const root = document.documentElement;
    const shouldAnimate = pendingAnimateRef.current && !prefersReducedMotion();
    const startViewTransition = document.startViewTransition?.bind(document);

    clearFallbackAnimation();

    if (shouldAnimate && typeof startViewTransition === "function") {
      startViewTransition(() => {
        commitThemeClass(root, normalized);
      });
    } else {
      if (shouldAnimate && typeof window !== "undefined") {
        root.classList.add("theme-animate");
        fallbackTimerRef.current = window.setTimeout(() => {
          root.classList.remove("theme-animate");
          fallbackTimerRef.current = null;
        }, 220);
      }

      commitThemeClass(root, normalized);
    }

    pendingAnimateRef.current = false;
    safeStorageSet(STORAGE_KEY, normalized);
  }, [clearFallbackAnimation, theme]);

  useEffect(() => {
    return () => {
      clearFallbackAnimation();
    };
  }, [clearFallbackAnimation]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const onStorage = (event) => {
      if (event.key !== STORAGE_KEY) return;
      pendingAnimateRef.current = false;
      setThemeState(normalizeTheme(event.newValue));
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTheme = useCallback((nextTheme, { animate = true } = {}) => {
    const normalized = normalizeTheme(nextTheme);
    pendingAnimateRef.current = Boolean(animate);
    setThemeState((currentTheme) =>
      currentTheme === normalized ? currentTheme : normalized
    );
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark", { animate: true });
  }, [setTheme, theme]);

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme: theme,
      setTheme,
      toggleTheme,
    }),
    [setTheme, theme, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  return useContext(ThemeContext);
}
