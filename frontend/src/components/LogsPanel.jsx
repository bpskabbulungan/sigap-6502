import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollText, History } from "lucide-react";
import { useLogs } from "../queries/system";
import { classifyLog } from "../utils/classifyLog";
import { QueryErrorNotice } from "./error/QueryErrorNotice";
import { Card } from "./ui/Card";
import { Skeleton } from "./ui/Skeleton";
import { DataPlaceholder } from "./ui/DataPlaceholder";

export function LogsPanel({ embedded = false }) {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRealtimeConnected,
    logsPollIntervalMs,
  } = useLogs(100, "admin");
  const logContainerRef = useRef(null);
  const latestLineRef = useRef(null);
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);
  const [pendingLogsCount, setPendingLogsCount] = useState(0);

  const refreshSeconds = Math.floor((logsPollIntervalMs || 0) / 1000);
  const refreshCopy = isRealtimeConnected
    ? "Realtime aktif. Polling cadangan dinonaktifkan."
    : `Refresh otomatis setiap ${refreshSeconds} detik.`;

  const toneLabel = useCallback((tone) => {
    switch (tone) {
      case "message":
        return "pesan";
      case "scheduler":
        return "jadwal";
      case "heartbeat":
        return "heartbeat";
      case "quote":
        return "kutipan";
      case "system":
        return "sistem";
      case "keepalive":
        return "keepalive";
      case "auth":
        return "autentikasi";
      case "bot":
        return "bot";
      default:
        return "log";
    }
  }, []);

  const items = useMemo(
    () => (data?.logs || []).map((line, idx) => ({ id: idx, line, tone: classifyLog(line) })),
    [data]
  );

  const scrollToLatest = useCallback((behavior = "auto") => {
    const el = logContainerRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior,
    });
  }, []);

  useEffect(() => {
    const el = logContainerRef.current;
    if (!el) return undefined;

    const onScroll = () => {
      const threshold = 32;
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      const atBottom = distanceFromBottom <= threshold;
      setIsPinnedToBottom(atBottom);
      if (atBottom) setPendingLogsCount(0);
    };

    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    const latestLine = items.length ? items[items.length - 1].line : "";
    if (!latestLine || latestLineRef.current === latestLine) return;

    const firstHydration = latestLineRef.current === null;
    latestLineRef.current = latestLine;

    if (firstHydration) {
      requestAnimationFrame(() => scrollToLatest());
      return;
    }

    if (isPinnedToBottom) {
      requestAnimationFrame(() => scrollToLatest("smooth"));
      setPendingLogsCount(0);
    } else {
      setPendingLogsCount((count) => count + 1);
    }
  }, [items, isPinnedToBottom, scrollToLatest]);

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary sm:h-10 sm:w-10">
            <ScrollText className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground sm:text-lg">Log Aktivitas</h2>
            <p className="text-[11px] leading-5 text-muted-foreground sm:text-xs">
              Memuat 100 entri log terakhir.
            </p>
          </div>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide sm:text-[11px] ${
            isRealtimeConnected
              ? "border-success/40 bg-success/10 text-success"
              : "border-border/70 bg-muted/35 text-muted-foreground"
          }`}
        >
          {isRealtimeConnected ? "Realtime" : `Polling ${refreshSeconds}s`}
        </span>
      </div>

      <div
        ref={logContainerRef}
        className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto rounded-xl border border-info/20 bg-[linear-gradient(165deg,hsl(var(--muted)/0.32),hsl(var(--info)/0.06))]"
      >
        {isLoading ? (
          <div className="flex h-full flex-col gap-4 p-4">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-full" />
          </div>
        ) : isError ? (
          <div className="p-3 sm:p-4">
            <QueryErrorNotice
              error={error}
              fallbackMessage="Log aktivitas belum dapat dimuat dari server."
              onRetry={() => refetch()}
              retryLabel="Muat ulang log"
              size="sm"
            />
          </div>
        ) : items.length ? (
          <>
            <ul className="min-h-0 space-y-1 p-3 text-[11px] leading-5 sm:p-4 sm:text-xs sm:leading-relaxed">
              {items.map(({ id, line, tone }) => (
                <li key={id}>
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide sm:text-[11px]"
                    style={{
                      backgroundColor:
                        tone === "message"
                          ? "var(--tone-info-bg)"
                          : tone === "scheduler"
                          ? "var(--tone-warning-bg)"
                          : tone === "system"
                          ? "var(--tone-neutral-bg)"
                          : tone === "bot"
                          ? "var(--tone-success-bg)"
                          : tone === "auth"
                          ? "var(--tone-danger-bg)"
                          : "transparent",
                      color:
                        tone === "message"
                          ? "var(--tone-info-text)"
                          : tone === "scheduler"
                          ? "var(--tone-warning-text)"
                          : tone === "system"
                          ? "var(--tone-neutral-text)"
                          : tone === "bot"
                          ? "var(--tone-success-text)"
                          : tone === "auth"
                          ? "var(--tone-danger-text)"
                          : "var(--text-2)",
                    }}
                  >
                    {toneLabel(tone)}
                  </span>
                  <span
                    className="ml-2 whitespace-pre-wrap break-words font-mono text-[11px] sm:text-xs"
                    style={{ color: "var(--text-2)" }}
                  >
                    {line}
                  </span>
                </li>
              ))}
            </ul>

            {pendingLogsCount > 0 ? (
              <button
                type="button"
                onClick={() => {
                  scrollToLatest("smooth");
                  setPendingLogsCount(0);
                  setIsPinnedToBottom(true);
                }}
                className="sticky bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-primary/40 bg-background/95 px-3 py-1.5 text-[11px] font-semibold text-primary shadow-sm backdrop-blur sm:text-xs"
              >
                {pendingLogsCount} log baru - lompat ke terbaru
              </button>
            ) : null}
          </>
        ) : (
          <DataPlaceholder
            icon={<History className="h-12 w-12" aria-hidden="true" />}
            title="Belum ada log"
            description="Aktivitas sistem akan ditampilkan di sini."
          />
        )}
      </div>

      <p className="text-[11px] text-muted-foreground sm:text-xs">{refreshCopy}</p>
    </>
  );

  if (embedded) {
    return <div className="flex h-full max-h-[520px] flex-col gap-3 sm:gap-4">{body}</div>;
  }

  return (
    <Card className="flex h-full max-h-[520px] flex-col gap-3 border-border/70 bg-card p-4 sm:gap-4 sm:p-6">
      {body}
    </Card>
  );
}
