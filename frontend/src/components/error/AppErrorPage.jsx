import clsx from "clsx";
import {
  ArrowLeft,
  Home,
  RefreshCcw,
} from "lucide-react";

import { resolveErrorMeta } from "../../lib/errorPresentation";
import { AppFooter } from "../layout/AppFooter";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

const PAGE_THEME = {
  info: {
    badgeVariant: "info",
    glowClass:
      "bg-[radial-gradient(72%_58%_at_18%_0%,hsl(var(--info)/0.2),transparent_72%)]",
  },
  warning: {
    badgeVariant: "warning",
    glowClass:
      "bg-[radial-gradient(72%_58%_at_18%_0%,hsl(var(--warning)/0.18),transparent_72%)]",
  },
  danger: {
    badgeVariant: "danger",
    glowClass:
      "bg-[radial-gradient(72%_58%_at_18%_0%,hsl(var(--destructive)/0.2),transparent_72%)]",
  },
  default: {
    badgeVariant: "default",
    glowClass:
      "bg-[radial-gradient(72%_58%_at_18%_0%,hsl(var(--primary)/0.14),transparent_72%)]",
  },
};

function defaultActions() {
  return [
    {
      label: "Muat ulang",
      variant: "primary",
      icon: RefreshCcw,
      onClick: () => {
        if (typeof window !== "undefined") {
          window.location.reload();
        }
      },
    },
    {
      label: "Ke beranda",
      variant: "secondary",
      icon: Home,
      onClick: () => {
        if (typeof window !== "undefined") {
          window.location.assign("/");
        }
      },
    },
  ];
}

function createActionHandler(action) {
  return () => {
    if (typeof action?.onClick === "function") {
      action.onClick();
      return;
    }

    if (action?.href && typeof window !== "undefined") {
      window.location.assign(action.href);
    }
  };
}

function ActionButton({ action }) {
  const Icon = action?.icon;
  const variant = action?.variant === "ghost" ? "secondary" : action?.variant || "secondary";
  const outline = action?.variant === "ghost";

  return (
    <Button
      type="button"
      variant={variant}
      outline={outline}
      size={action?.size || "md"}
      onClick={createActionHandler(action)}
      className={clsx("min-w-[10rem] justify-center", action?.className)}
    >
      {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
      {action?.label}
    </Button>
  );
}

export function AppErrorPage({
  status,
  title,
  description,
  actions,
  showFooter = true,
  className,
}) {
  const meta = resolveErrorMeta(status, { context: "page" });
  const resolvedTone = PAGE_THEME[meta.tone] ? meta.tone : "default";
  const theme = PAGE_THEME[resolvedTone];
  const renderedActions = Array.isArray(actions) && actions.length ? actions : defaultActions();

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background text-foreground">
      <div className={clsx("pointer-events-none absolute inset-x-0 top-0 h-96", theme.glowClass)} />

      <main className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 items-center px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <Card
          className={clsx(
            "w-full border-border/70 bg-[linear-gradient(180deg,hsl(var(--card))_0%,hsl(var(--muted)/0.14)_100%)] shadow-xl",
            className
          )}
          padding="lg"
        >
          <div className="mx-auto max-w-2xl space-y-5 text-center sm:space-y-6">
            <div className="flex items-center justify-center">
              <Badge variant={theme.badgeVariant} className="normal-case tracking-normal">
                {meta.badge}
              </Badge>
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {title || meta.title}
            </h1>

            <p className="text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
              {description || meta.description}
            </p>

            <div className="flex flex-wrap justify-center gap-2.5">
              {renderedActions.slice(0, 2).map((action, index) => (
                <ActionButton
                  key={`${action?.label || "error-action"}-${index}`}
                  action={action}
                />
              ))}
            </div>
          </div>
        </Card>
      </main>

      {showFooter ? <AppFooter className="relative z-10 !border-0 bg-transparent pt-0" /> : null}
    </div>
  );
}

export const ERROR_ACTION_ICONS = {
  refresh: RefreshCcw,
  home: Home,
  back: ArrowLeft,
};
