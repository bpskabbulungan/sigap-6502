import clsx from "clsx";
import { Link, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../ui/Button";
import { ThemeToggle } from "../ThemeToggle";
import { Drawer } from "../ui/Drawer";
import {
  Home,
  Clock,
  Sliders,
  Users,
  Calendar as CalIcon,
  FileText,
  LogOut,
  Menu,
  MessageSquareText,
} from "../ui/icons";
import { useConfirm } from "../ui/ConfirmProvider.jsx";
import { Skeleton } from "../ui/Skeleton";
import { useDocumentTitle } from "../../utils/useDocumentTitle.js";
import { AppFooter } from "./AppFooter";

export function AdminLayout({
  username = "Admin",
  onLogout = () => {},
  isLoggingOut = false,
  loading = false,
  title,
  children,
}) {
  const { confirm } = useConfirm();
  const { pathname } = useLocation();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  useDocumentTitle(title, { defaultTitle: "SIGAP 6502 Admin" });

  const navItems = useMemo(
    () => [
      { to: "/admin/dashboard", label: "Dashboard", icon: Home },
      { to: "/admin/schedule", label: "Jadwal", icon: Clock },
      { to: "/admin/announcements", label: "Pengumuman", icon: Sliders },
      { to: "/admin/contacts", label: "Kontak", icon: Users },
      { to: "/admin/holidays", label: "Kalender", icon: CalIcon },
      { to: "/admin/templates", label: "Templat", icon: FileText },
      { to: "/admin/quotes", label: "Kutipan", icon: MessageSquareText },
    ],
    []
  );

  const initials = useMemo(() => {
    const s = String(username || "A").trim();
    const parts = s.split(/\s+/);
    return (parts[0]?.[0] || "A").toUpperCase();
  }, [username]);

  const handleLogout = async (onAfterConfirm) => {
    const ok = await confirm({
      title: "Keluar akun?",
      message: "Anda akan keluar dari dashboard admin.",
      confirmText: "Keluar",
      variant: "danger",
    });
    if (!ok) return;
    onAfterConfirm?.();
    onLogout();
  };

  const NavList = ({ onNavigate, variant = "full" }) => {
    const compact = variant === "rail";

    return (
      <nav
        aria-label="Menu admin"
        className={clsx("not-prose", !compact && "px-1")}
        data-ui-chrome="true"
      >
        <ul className={clsx(compact ? "space-y-1" : "space-y-0.5")}>
          {navItems.map((item) => {
            const { to, label } = item;
            const IconComponent = item.icon;
            const active = pathname.startsWith(to);

            return (
              <li key={to}>
                <Link
                  to={to}
                  onClick={() => onNavigate?.()}
                  aria-current={active ? "page" : undefined}
                  aria-label={label}
                  title={label}
                  style={{ color: "hsl(var(--menu-ink))" }}
                  className={clsx(
                    "group relative flex items-center rounded-lg text-sm font-medium !no-underline transition-[background-color,color] duration-200 focus:outline-none",
                    compact
                      ? "justify-center gap-2 px-2 py-2 lg:justify-start lg:px-3.5"
                      : "justify-start gap-3 px-2.5 py-2.5",
                    active
                      ? "bg-muted/70 opacity-100"
                      : "opacity-80 hover:bg-muted/55 hover:opacity-100",
                    "focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  )}
                >
                  <span
                    aria-hidden
                    className={clsx(
                      "absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full transition-opacity",
                      active ? "opacity-100" : "opacity-0"
                    )}
                    style={{ backgroundColor: "hsl(var(--menu-ink))" }}
                  />
                  <IconComponent
                    size={18}
                    className={clsx(
                      "shrink-0 transition-[opacity,color]",
                      active ? "opacity-100" : "opacity-75 group-hover:opacity-100"
                    )}
                    style={{ color: "hsl(var(--menu-ink))" }}
                  />
                  <span className={clsx("truncate", compact ? "hidden lg:inline" : "inline")}>
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  };

  const SidebarFooter = ({ variant = "full", onNavigate }) => {
    const compact = variant === "rail";

    return (
      <div className={clsx("space-y-3", !compact && "px-1")} data-ui-chrome="true">
        {loading ? (
          <>
            <Skeleton
              className={clsx(
                "rounded-xl",
                compact ? "mx-auto h-10 w-10 lg:h-10 lg:w-full" : "h-11 w-full"
              )}
              effect="shimmer"
            />
            <Skeleton
              className={clsx(
                "rounded-xl",
                compact ? "mx-auto h-10 w-10 lg:h-10 lg:w-full" : "h-10 w-full"
              )}
              effect="shimmer"
            />
          </>
        ) : (
          <>
            <div
              className={clsx(
                "flex items-center rounded-xl",
                compact
                  ? "justify-center px-2 py-2 lg:justify-start lg:gap-2 lg:px-3"
                  : "w-full gap-2 border border-border/80 px-3 py-2.5",
                compact
                  ? "border border-border/80 bg-muted/30"
                  : "bg-transparent"
              )}
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {initials}
              </span>
              <span
                className={clsx(
                  "truncate text-sm",
                  compact ? "hidden text-muted-foreground lg:inline" : "inline text-[hsl(var(--menu-ink))]"
                )}
                title={username}
              >
                {username}
              </span>
            </div>

            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleLogout(onNavigate)}
              disabled={isLoggingOut}
              className={clsx(
                compact
                  ? "w-full justify-center gap-2 px-2 lg:px-3"
                  : "w-full justify-center gap-2",
                "border-[hsl(var(--destructive)/0.75)] bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))] hover:bg-[hsl(var(--destructive)/0.9)]"
              )}
            >
              <span className={clsx(compact ? "hidden lg:inline" : "inline")}>
                {isLoggingOut ? "Keluar..." : "Keluar"}
              </span>
              <LogOut size={16} />
            </Button>
          </>
        )}
      </div>
    );
  };

  const SidebarContent = ({ variant = "full", onNavigate }) => {
    const compact = variant === "rail";

    return (
      <div className={clsx("flex h-full min-h-0 flex-col", compact ? "" : "gap-4")}>
        <div className={clsx("min-h-0 flex-1 overflow-y-auto", compact ? "pr-1" : "pr-0")}>
          <NavList variant={variant} onNavigate={onNavigate} />
        </div>
        <div
          className={clsx(
            "border-border/80",
            compact ? "mt-4 border-t pt-3" : "mt-1 border-t border-border/60 pt-4"
          )}
        >
          <SidebarFooter variant={variant} onNavigate={onNavigate} />
        </div>
      </div>
    );
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-3 focus:py-1.5 focus:text-primary-foreground"
      >
        Loncat ke konten
      </a>

      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(65%_60%_at_20%_0%,hsl(var(--primary)/0.12),transparent_70%)]" />

      <Drawer
        open={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
        title="SIGAP 6502"
        side="left"
        size="md"
        closeText="X"
        closeAriaLabel="Tutup menu"
        closeAsIcon
        closeButtonClassName="text-[hsl(var(--menu-ink))]"
        panelClassName="rounded-r-2xl border-r border-border/70 bg-card shadow-xl"
        backdropClassName="bg-black/45"
      >
        <SidebarContent
          variant="full"
          onNavigate={() => setMobileSidebarOpen(false)}
        />
      </Drawer>

      <header
        className="fixed inset-x-0 top-0 z-50 h-14 border-b border-border/80 bg-[hsl(var(--background))] shadow-sm md:h-16"
        data-ui-chrome="true"
      >
        <nav className="flex h-full w-full items-center justify-between gap-3 px-4 not-prose md:px-5 lg:px-0">
          <div className="flex min-w-0 items-center gap-2 lg:h-full lg:w-[220px] lg:border-r lg:border-border/85 lg:bg-[hsl(var(--card))] lg:px-4">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:bg-muted md:hidden"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Buka menu"
            >
              <Menu size={18} />
            </button>

            <Link
              to="/"
              className="flex items-center gap-2 text-lg font-semibold tracking-tight text-[hsl(var(--menu-ink))] no-underline hover:opacity-90"
            >
              <img src="/logo.png" alt="SIGAP" className="h-6 w-6 rounded" />
              <span className="leading-none">SIGAP 6502</span>
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 lg:pr-6">
            {loading ? (
              <>
                <Skeleton className="hidden h-9 w-28 rounded-xl sm:block" effect="shimmer" />
                <Skeleton className="h-9 w-24 rounded-xl sm:hidden" effect="shimmer" />
              </>
            ) : (
              <span className="hidden items-center gap-2 rounded-full border border-border bg-card px-2.5 py-1.5 text-sm text-muted-foreground sm:inline-flex">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {initials}
                </span>
                <span className="max-w-[12ch] truncate" title={username}>
                  {username}
                </span>
              </span>
            )}

            <ThemeToggle className="h-10" />
          </div>
        </nav>
      </header>

      <div className="flex-1 pt-14 md:pt-16">
        <div className="grid w-full grid-cols-1 md:grid-cols-[72px_minmax(0,1fr)] lg:grid-cols-1 lg:pl-[220px]">
          <aside
            className={clsx(
              "hidden bg-[hsl(var(--card))] md:block not-prose",
              "lg:fixed lg:left-0 lg:top-16 lg:z-40 lg:h-[calc(100vh-64px)] lg:w-[220px]"
            )}
            aria-label="Sidebar admin"
            data-ui-chrome="true"
          >
            <div className="h-full md:sticky md:top-16 lg:static">
              <div className="md:h-[calc(100vh-64px)] lg:h-full border-r border-border/85 bg-[hsl(var(--card))] px-2 py-4 lg:px-3 lg:py-5">
                <div className="h-full">
                  <SidebarContent variant="rail" />
                </div>
              </div>
            </div>
          </aside>

          <main id="main" className="relative z-10 px-4 py-8 sm:py-12 md:py-16">
            {children}
            <div className="h-[env(safe-area-inset-bottom,0)]" />
          </main>
        </div>
      </div>
      <AppFooter className="md:pl-[72px] lg:pl-[220px]" />
    </div>
  );
}
