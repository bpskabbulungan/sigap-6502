import clsx from "clsx";
import {
  AlertTriangle,
  RefreshCcw,
  SearchX,
  ServerCrash,
  WifiOff,
  Wrench,
} from "lucide-react";

import { resolveErrorMeta } from "../../lib/errorPresentation";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { ToneSurface } from "../ui/ToneSurface";

const TONE_TO_BADGE_VARIANT = {
  danger: "danger",
  warning: "warning",
  info: "info",
  default: "default",
};

function resolveIcon(meta, status, error) {
  if (error?.code === "NETWORK_ERROR") return WifiOff;
  if (status === 404) return SearchX;
  if (status === 503) return Wrench;
  if (status && status >= 500) return ServerCrash;
  if (meta.tone === "warning") return Wrench;
  return AlertTriangle;
}

function resolveIconClasses(meta) {
  if (meta.tone === "danger") {
    return "border-destructive/35 bg-destructive/12 text-destructive";
  }

  if (meta.tone === "warning") {
    return "border-warning/40 bg-warning/14 text-warning";
  }

  if (meta.tone === "info") {
    return "border-info/35 bg-info/12 text-info";
  }

  return "border-border/70 bg-muted/35 text-muted-foreground";
}

export function QueryErrorNotice({
  error,
  status,
  fallbackMessage,
  title,
  description,
  onRetry,
  retryLabel = "Coba lagi",
  className,
  size = "md",
  showStatusBadge = false,
}) {
  const source = error ?? status;
  const meta = resolveErrorMeta(source, {
    context: "inline",
    fallbackMessage,
  });

  const resolvedStatus = meta.status ?? status ?? null;
  const Icon = resolveIcon(meta, resolvedStatus, error);
  const badgeVariant = TONE_TO_BADGE_VARIANT[meta.tone] || "default";

  return (
    <ToneSurface tone={meta.tone} size={size} className={clsx("space-y-3", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            className={clsx(
              "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
              resolveIconClasses(meta)
            )}
            aria-hidden="true"
          >
            <Icon className="h-4 w-4" />
          </span>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground">{title || meta.title}</p>
              {showStatusBadge && resolvedStatus ? (
                <Badge variant={badgeVariant} className="px-2 py-0.5 text-[10px] tracking-normal">
                  {resolvedStatus}
                </Badge>
              ) : null}
            </div>
            <p className="text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6">
              {description || meta.description}
            </p>
          </div>
        </div>

        {onRetry ? (
          <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
            <RefreshCcw className="h-4 w-4" />
            {retryLabel}
          </Button>
        ) : null}
      </div>
    </ToneSurface>
  );
}
