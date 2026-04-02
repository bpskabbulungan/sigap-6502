import { CalendarClock } from "lucide-react";

import { Card } from "./ui/Card";
import { Badge } from "./ui/Badge";
import { Skeleton } from "./ui/Skeleton";
import { DataPlaceholder } from "./ui/DataPlaceholder";
import { ToneSurface } from "./ui/ToneSurface";
import { QueryErrorNotice } from "./error/QueryErrorNotice";
import { formatAppDate } from "../lib/dateFormatter";

const weekdayOnlyFormatter = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
});

function normalizeWeekdayLabel(label) {
  if (!label || typeof label !== "string") return "";
  const trimmed = label.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function extractWeekdayFromPublicLabel(label) {
  if (!label || typeof label !== "string") return "";
  const [prefix] = label.split(",");
  return normalizeWeekdayLabel(prefix);
}

function resolveWeekdayLabel(details) {
  const fromPublicLabel = extractWeekdayFromPublicLabel(details?.publicLabel);
  if (fromPublicLabel) {
    return fromPublicLabel;
  }

  if (!details?.timestamp) {
    return "";
  }

  const parsedDate = new Date(details.timestamp);
  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  const formatter =
    details?.timezone && typeof details.timezone === "string"
      ? new Intl.DateTimeFormat("id-ID", {
          weekday: "long",
          timeZone: details.timezone,
        })
      : weekdayOnlyFormatter;

  return normalizeWeekdayLabel(formatter.format(parsedDate));
}

function formatNextRunLabelWithWeekday(details) {
  const baseLabel = (details?.formatted || details?.adminLabel || "").trim();
  if (!baseLabel) {
    return "";
  }

  const weekday = resolveWeekdayLabel(details);
  if (!weekday) {
    return baseLabel;
  }

  const normalizedBase = baseLabel.toLocaleLowerCase("id-ID");
  const normalizedWeekday = weekday.toLocaleLowerCase("id-ID");
  if (normalizedBase.startsWith(`${normalizedWeekday},`)) {
    return baseLabel;
  }

  return `${weekday}, ${baseLabel}`;
}

function mapTzLabel(tz) {
  const map = {
    "Asia/Makassar": "WITA",
    "Asia/Jakarta": "WIB",
    "Asia/Jayapura": "WIT",
  };
  const abbr = map[tz];
  return abbr ? `${abbr} (${tz})` : tz || "";
}

export function NextRunCard({
  nextRun,
  loading,
  error,
  onRetry,
  embedded = false,
}) {
  const Wrapper = ({ children, className }) =>
    embedded ? (
      <div className={className}>{children}</div>
    ) : (
      <Card className={className}>{children}</Card>
    );

  if (loading) {
    return (
      <Wrapper className="space-y-5 border-border/70 bg-[linear-gradient(165deg,hsl(var(--card))_0%,hsl(var(--muted)/0.26)_100%)] p-4 sm:space-y-6 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary sm:h-10 sm:w-10">
            <CalendarClock size={20} />
          </div>
          <div className="flex flex-col gap-2">
            <div className="h-5 w-40 animate-pulse rounded-full bg-muted/80" />
            <div className="h-4 w-72 animate-pulse rounded-full bg-muted/80" />
          </div>
        </div>
        <Skeleton className="h-32" />
      </Wrapper>
    );
  }

  if (error) {
    return (
      <Wrapper className="space-y-5 border-border/70 bg-[linear-gradient(165deg,hsl(var(--card))_0%,hsl(var(--muted)/0.26)_100%)] p-4 sm:space-y-6 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary sm:h-10 sm:w-10">
            <CalendarClock size={20} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground sm:text-lg">Pengiriman Berikutnya</h2>
            <p className="text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6">
              Informasi jadwal terdekat yang akan dieksekusi oleh sistem pengingat.
            </p>
          </div>
        </div>
        <QueryErrorNotice
          error={error}
          fallbackMessage="Jadwal pengiriman berikutnya belum dapat dimuat."
          onRetry={onRetry}
          retryLabel="Muat ulang jadwal"
          size="sm"
        />
      </Wrapper>
    );
  }

  if (!nextRun || !nextRun.nextRun?.timestamp) {
    return (
      <Wrapper className="space-y-5 border-border/70 bg-[linear-gradient(165deg,hsl(var(--card))_0%,hsl(var(--muted)/0.26)_100%)] p-4 sm:space-y-6 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary sm:h-10 sm:w-10">
            <CalendarClock size={20} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground sm:text-lg">Pengiriman Berikutnya</h2>
            <p className="text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6">
              Informasi jadwal terdekat yang akan dieksekusi oleh sistem pengingat.
            </p>
          </div>
        </div>
        <DataPlaceholder
          icon={null}
          title="Belum ada jadwal berikutnya"
          description="Hubungi administrator untuk menentukan jadwal pengiriman yang baru."
        />
      </Wrapper>
    );
  }

  const details = nextRun.nextRun;
  const manualEvent = details.manualEvent || details.override || null;
  const tzLabel = mapTzLabel(details.timezone);
  const detailedRunLabel = formatNextRunLabelWithWeekday(details);

  return (
    <Wrapper className="flex flex-col gap-4 border-border/70 bg-[linear-gradient(165deg,hsl(var(--card))_0%,hsl(var(--info)/0.05)_100%)] p-4 sm:gap-5 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary sm:h-10 sm:w-10">
          <CalendarClock size={20} />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground sm:text-lg">Pengiriman Berikutnya</h2>
          <p className="text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6">
            Informasi jadwal terdekat yang akan dieksekusi oleh sistem pengingat.
          </p>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-info/20 bg-[linear-gradient(160deg,hsl(var(--muted)/0.36),hsl(var(--info)/0.08))] p-4 sm:space-y-4 sm:p-5">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground sm:text-xs">Waktu pengiriman</p>
          <p className="mt-1 text-xl font-semibold text-foreground sm:text-2xl">{detailedRunLabel || details.formatted}</p>
          <p className="text-xs text-muted-foreground sm:text-sm">{tzLabel}</p>
        </div>
        {manualEvent ? (
          <ToneSurface tone="warning" size="md" className="text-xs sm:text-sm">
            <p className="font-semibold">Pengumuman terjadwal</p>
            <p>
              {formatAppDate(manualEvent.date)} pukul {manualEvent.time}
              {manualEvent.note ? ` - ${manualEvent.note}` : null}
            </p>
          </ToneSurface>
        ) : (
          <Badge variant="info" className="w-fit uppercase tracking-wide">
            Mengikuti jadwal otomatis
          </Badge>
        )}
      </div>
    </Wrapper>
  );
}
