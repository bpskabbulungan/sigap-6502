import { Link } from "react-router-dom";
import { ThemeToggle } from "../ThemeToggle";
import { useCallback } from "react";
import { AppFooter } from "./AppFooter";

export function PublicLayout({ children }) {
  const scrollToId = useCallback(
    (id) => (event) => {
      event.preventDefault();
      const el = document.getElementById(id);
      if (!el) return;

      const isMd =
        typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(min-width: 768px)").matches;
      const headerH = isMd ? 64 : 56;
      const y = el.getBoundingClientRect().top + window.scrollY - headerH;
      window.scrollTo({ top: y, behavior: "smooth" });
    },
    []
  );

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-3 focus:py-1.5 focus:text-primary-foreground"
      >
        Loncat ke konten
      </a>

      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(70%_60%_at_22%_0%,hsl(var(--primary)/0.12),transparent_72%)]" />

      <header
        className="fixed inset-x-0 top-0 z-50 h-14 border-b border-border/80 bg-background/95 shadow-sm backdrop-blur md:h-16"
        data-ui-chrome="true"
      >
        <nav className="mx-auto flex h-full max-w-7xl items-center justify-between gap-3 px-4 not-prose md:px-5">
          <Link
            to="/"
            className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground no-underline hover:opacity-90"
          >
            <img src="/logo.png" alt="SIGAP" className="h-7 w-7 rounded" />
            <span>SIGAP 6502</span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-1.5 md:flex">
              <a
                href="#public-activity"
                onClick={scrollToId("public-activity")}
                className="rounded-lg px-3 py-2 text-sm font-medium !no-underline text-muted-foreground transition-[background-color,color] hover:bg-muted/55 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Aktivitas
              </a>

              <a
                href="#public-stats"
                onClick={scrollToId("public-stats")}
                className="rounded-lg px-3 py-2 text-sm font-medium !no-underline text-muted-foreground transition-[background-color,color] hover:bg-muted/55 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Statistik
              </a>

              <a
                href="#schedule"
                onClick={scrollToId("schedule")}
                className="rounded-lg px-3 py-2 text-sm font-medium !no-underline text-muted-foreground transition-[background-color,color] hover:bg-muted/55 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Jadwal
              </a>
            </div>

            <ThemeToggle className="h-10" />

            <Link
              to="/admin/login"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-primary/80 bg-primary px-3.5 text-sm font-semibold text-primary-foreground no-underline shadow-sm transition-[transform,background-color,border-color,color,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-primary/90 active:translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Admin
            </Link>
          </div>
        </nav>
      </header>

      <main
        id="main"
        className="relative z-10 mx-auto w-full max-w-7xl scroll-mt-24 px-4 pb-12 pt-20 md:pb-16 md:pt-24"
      >
        {children}
      </main>

      <AppFooter className="bg-transparent" />
    </div>
  );
}
