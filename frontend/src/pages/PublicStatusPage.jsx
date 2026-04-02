import { useMemo } from "react";
import { BarChart3, CalendarClock, ScrollText } from "lucide-react";

import { QueryErrorNotice } from "../components/error/QueryErrorNotice";
import { PublicLayout } from "../components/layout/PublicLayout";
import { StatusPill } from "../components/StatusPill";
import { ScheduleGrid } from "../components/ScheduleGrid";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { DataPlaceholder } from "../components/ui/DataPlaceholder";
import { Skeleton } from "../components/ui/Skeleton";
import { Spinner } from "../components/ui/Spinner";
import { ToneSurface } from "../components/ui/ToneSurface";
import { compareAppDates, formatAppDate } from "../lib/dateFormatter";
import { usePublicNextRun, usePublicSchedule } from "../queries/schedule";
import { useLogs, useSystemHealth, useSystemStats } from "../queries/system";
import { useDocumentTitle } from "../utils/useDocumentTitle.js";

const DEFAULT_TIMES = {
  1: "16:00",
  2: "16:00",
  3: "16:00",
  4: "16:00",
  5: "16:30",
  6: null,
  7: null,
};

const TIMEZONE_LABELS = {
  "Asia/Jakarta": "WIB",
  "Asia/Makassar": "WITA",
  "Asia/Jayapura": "WIT",
};

const MONITORING_ITEMS = [
  "Status koneksi dan kesiapan bot",
  "Log dan statistik aktivitas",
  "Jadwal pengiriman otomatis harian",
];

function uppercaseFirst(value) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getPart(parts, partType, fallback = "") {
  return parts.find((part) => part.type === partType)?.value ?? fallback;
}

function formatUptimeHours(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "0";

  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numericValue);
}

function formatStatCount(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "0";

  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(numericValue);
}

function formatNextRunDisplay(nextRun) {
  if (!nextRun?.timestamp) return null;

  const date = new Date(nextRun.timestamp);
  if (Number.isNaN(date.getTime())) return null;

  const rawTz = nextRun?.timezone;
  const timeZone = typeof rawTz === "string" && rawTz.includes("/") ? rawTz : "Asia/Makassar";
  const timeZoneLabel =
    TIMEZONE_LABELS[timeZone] ||
    (typeof rawTz === "string" && !rawTz.includes("/") ? rawTz : timeZone);

  try {
    const dateParts = new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone,
    }).formatToParts(date);

    const timeParts = new Intl.DateTimeFormat("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone,
    }).formatToParts(date);

    const weekday = uppercaseFirst(getPart(dateParts, "weekday"));
    const day = getPart(dateParts, "day");
    const month = getPart(dateParts, "month");
    const year = getPart(dateParts, "year");
    const hour = getPart(timeParts, "hour", "00");
    const minute = getPart(timeParts, "minute", "00");
    const second = getPart(timeParts, "second", "00");

    return {
      dateLine: weekday
        ? `${weekday}, ${day}-${month}-${year}`
        : `${day}-${month}-${year}`,
      timeLine: `Pukul ${hour}:${minute}:${second} ${timeZoneLabel}`,
    };
  } catch {
    return null;
  }
}

export default function PublicStatusPage() {
  useDocumentTitle("Status Publik");

  const { data: health, isLoading: healthLoading } = useSystemHealth();
  const { data: scheduleData, isLoading: scheduleLoading } =
    usePublicSchedule();
  const { data: nextRunData, isLoading: nextRunLoading } = usePublicNextRun();
  const {
    data: logsData,
    isLoading: logsLoading,
    isError: logsError,
    error: logsErrorObj,
    refetch: refetchLogs,
  } = useLogs(50, "public");
  const { data: stats, isLoading: statsLoading } = useSystemStats();

  const schedule = scheduleData?.schedule;
  const nextRun = nextRunData?.nextRun;
  const nextRunManualEvent = nextRun?.manualEvent || nextRun?.override || null;
  const nextRunDisplay = useMemo(() => formatNextRunDisplay(nextRun), [nextRun]);
  const scheduleDayKeys = ["1", "2", "3", "4", "5", "6", "7"];
  const dailyTimes = scheduleDayKeys.reduce((acc, day) => {
    const value = schedule?.dailyTimes?.[day] ?? DEFAULT_TIMES[day];
    acc[day] = value || DEFAULT_TIMES[day];
    return acc;
  }, {});
  const hasDailySchedule = Boolean(
    dailyTimes && Object.values(dailyTimes).some((value) => value)
  );
  const logLines = Array.isArray(logsData?.logs) ? logsData.logs : [];

  const botPhase = health?.botStatus?.phase ?? health?.botPhase;

  const statsSummary = useMemo(() => {
    const messagesPerDay = stats?.messagesPerDay || {};
    const errorsPerDay = stats?.errorsPerDay || {};
    const uptimePerDay = stats?.uptimePerDay || {};

    const totalMessages = Object.values(messagesPerDay).reduce(
      (sum, value) => sum + value,
      0
    );
    const totalErrors = Object.values(errorsPerDay).reduce(
      (sum, value) => sum + value,
      0
    );
    const totalUptime = Object.values(uptimePerDay).reduce(
      (sum, value) => sum + value,
      0
    );

    const latestDays = Object.keys({
      ...messagesPerDay,
      ...errorsPerDay,
      ...uptimePerDay,
    })
      .sort(compareAppDates)
      .slice(-7);

    return {
      totalMessages,
      totalErrors,
      totalUptime,
      latestDays,
    };
  }, [stats]);

  return (
    <PublicLayout>
      <div className="ds-page-stack pb-2">
        <section
          id="status"
          className="grid gap-5 xl:grid-cols-[minmax(0,1.75fr)_minmax(320px,1fr)]"
        >
          <Card className="relative overflow-hidden border-border/70 bg-[linear-gradient(145deg,hsl(var(--card))_0%,hsl(var(--card))_50%,hsl(var(--primary)/0.06)_100%)] p-5 shadow-md sm:p-7">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-r from-primary/12 via-info/6 to-transparent" />
            <div className="pointer-events-none absolute -right-14 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative flex h-full flex-col gap-6">
              <div className="space-y-3">
                <h1 className="ds-hero-title">SIGAP 6502</h1>
                <p className="text-sm font-medium text-foreground/85 sm:text-base">
                  Sistem Informasi Pengingat Presensi - BPS Kabupaten Bulungan
                </p>
                <p className="ds-body-lg max-w-3xl">
                  SIGAP 6502 adalah inovasi pengingat absensi berbasis WhatsApp
                  untuk membantu disiplin presensi pegawai. Halaman ini
                  menampilkan kondisi layanan secara realtime.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-border/70 bg-background/50 p-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Tentang SIGAP
                  </p>
                  <p className="ds-body mt-2">
                    Dikembangkan oleh BPS Kabupaten Bulungan untuk mengirim
                    pengingat presensi secara otomatis melalui WhatsApp Bot.
                    Inovasi ini diharapkan dapat meningkatkan kedisiplinan
                    presensi dan ketepatan pelaporan kehadiran pegawai.
                  </p>
                </div>

                <div className="rounded-xl border border-border/70 bg-background/50 p-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Monitoring Layanan
                  </p>
                  <p className="ds-body mt-2">
                    Informasi utama yang ditampilkan pada halaman publik.
                  </p>
                  <ul className="mt-3 grid gap-2">
                    {MONITORING_ITEMS.map((item, index) => (
                      <li
                        key={item}
                        className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-background/70 px-2.5 py-2"
                      >
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-primary/35 bg-primary/10 text-[11px] font-semibold text-primary">
                          {index + 1}
                        </span>
                        <span className="text-sm leading-6 text-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

            </div>
          </Card>

          <Card className="overflow-hidden border-border/70 bg-[linear-gradient(180deg,hsl(var(--card))_0%,hsl(var(--muted)/0.2)_100%)] p-5 shadow-md sm:p-6">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <h2 className="ds-section-title">Ringkasan Operasional</h2>
                <p className="text-xs leading-5 text-muted-foreground sm:text-sm">
                  Ringkasan status bot, jumlah pengumuman aktif, dan
                  jadwal pengiriman berikutnya.
                </p>
              </div>

              <div className="space-y-2.5 rounded-xl border border-border/70 bg-background/45 p-3 sm:p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground sm:text-sm">Status bot</span>
                  {healthLoading ? (
                    <Spinner size="sm" />
                  ) : (
                    <StatusPill
                      active={Boolean(health?.botActive)}
                      phase={botPhase}
                      labelActive="Bot Aktif"
                      labelInactive="Bot Nonaktif"
                    />
                  )}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground sm:text-sm">
                    Pengumuman aktif
                  </span>
                  <span className="text-sm font-semibold text-foreground sm:text-base">
                    {schedule?.announcementsCount ?? schedule?.overridesCount ?? 0}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Pengiriman berikutnya
                </p>
                {nextRunLoading ? (
                  <div className="space-y-3 rounded-xl border border-border/70 bg-muted/30 p-4">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : nextRun?.timestamp ? (
                  <div className="space-y-4 rounded-xl border border-border/70 bg-muted/30 p-4">
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Waktu pengiriman
                      </p>
                      <p className="text-xl font-semibold text-foreground sm:text-2xl">
                        {nextRunDisplay?.dateLine ?? nextRun.formatted}
                      </p>
                      <p className="text-xs text-muted-foreground sm:text-sm">
                        {nextRunDisplay?.timeLine ?? nextRun.timezone}
                      </p>
                    </div>

                    {nextRunManualEvent ? (
                      <ToneSurface tone="warning" size="md" className="space-y-1 text-xs sm:text-sm">
                        <p className="font-semibold text-foreground">Pengumuman terjadwal</p>
                        <p>
                          {formatAppDate(nextRunManualEvent.date, { withWeekday: true })} pukul{" "}
                          {nextRunManualEvent.time}
                          {nextRunManualEvent.note ? ` - ${nextRunManualEvent.note}` : ""}
                        </p>
                      </ToneSurface>
                    ) : (
                      <p className="rounded-xl border border-border/70 bg-background/55 px-3 py-2.5 text-xs text-muted-foreground sm:text-sm">
                        Pengiriman mengikuti jadwal default.
                      </p>
                    )}
                  </div>
                ) : (
                  <DataPlaceholder
                    icon={<CalendarClock className="h-10 w-10" aria-hidden="true" />}
                    title="Belum ada jadwal berikutnya"
                    description="Hubungi administrator untuk mengatur jadwal baru."
                    size="sm"
                  />
                )}
              </div>
            </div>
          </Card>
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(290px,1fr)]">
          <Card
            id="public-activity"
            className="flex min-h-[360px] flex-col overflow-hidden border-border/70 bg-[linear-gradient(180deg,hsl(var(--card))_0%,hsl(var(--muted)/0.16)_100%)] p-0"
          >
            <div className="border-b border-border/70 bg-background/35 px-5 py-4 sm:px-6 sm:py-5">
              <h2 className="ds-section-title flex items-center gap-2.5">
                <ScrollText
                  className="h-5 w-5 text-muted-foreground"
                  aria-hidden="true"
                />
                <span>Laporan Aktivitas Terkini</span>
              </h2>
              <p className="text-xs leading-5 text-muted-foreground sm:text-sm">
                Riwayat aktivitas sistem yang dapat dilihat publik.
              </p>
            </div>

            <div className="min-h-0 flex-1 p-4 sm:p-5">
              {logsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-40" />
                </div>
              ) : logsError ? (
                <QueryErrorNotice
                  error={logsErrorObj}
                  fallbackMessage="Log publik belum dapat dimuat dari server."
                  onRetry={() => refetchLogs()}
                  retryLabel="Muat ulang log"
                  size="sm"
                />
              ) : logLines.length ? (
                <div className="h-full max-h-[420px] overflow-auto rounded-xl border border-info/20 bg-[linear-gradient(165deg,hsl(var(--muted)/0.3),hsl(var(--info)/0.06))]">
                  <ul className="divide-y divide-border/55">
                    {logLines.map((line, index) => (
                      <li
                        key={`${index}-${line}`}
                        className="px-3 py-2.5 font-mono text-[11px] leading-5 text-muted-foreground sm:px-4 sm:text-xs"
                      >
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <DataPlaceholder
                  icon={<ScrollText className="h-10 w-10" aria-hidden="true" />}
                  title="Belum ada log"
                  description="Aktivitas sistem akan tampil di sini."
                  size="sm"
                />
              )}
            </div>
          </Card>

          <Card
            id="public-stats"
            className="flex min-h-[360px] flex-col overflow-hidden border-border/70 bg-[linear-gradient(180deg,hsl(var(--card))_0%,hsl(var(--muted)/0.16)_100%)] p-0"
          >
            <div className="border-b border-border/70 bg-background/35 px-5 py-4 sm:px-6 sm:py-5">
              <h2 className="ds-section-title flex items-center gap-2.5">
                <BarChart3
                  className="h-5 w-5 text-muted-foreground"
                  aria-hidden="true"
                />
                <span>Statistik Aktivitas Bot</span>
              </h2>
              <p className="text-xs leading-5 text-muted-foreground sm:text-sm">
                Ringkasan statistik aktivitas Bot selama 7 hari terakhir.
              </p>
            </div>

            <div className="min-h-0 flex-1 p-4 sm:p-5">
              {statsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-24" />
                </div>
              ) : !stats ? (
                <DataPlaceholder
                  icon={<BarChart3 className="h-10 w-10" aria-hidden="true" />}
                  title="Belum ada data"
                  description="Statistik belum tersedia."
                  size="sm"
                />
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Pesan
                      </p>
                      <p
                        className="mt-1 break-all text-lg font-semibold leading-tight text-foreground sm:text-xl"
                        title={`${statsSummary.totalMessages}`}
                      >
                        {formatStatCount(statsSummary.totalMessages)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Error
                      </p>
                      <p
                        className="mt-1 break-all text-lg font-semibold leading-tight text-foreground sm:text-xl"
                        title={`${statsSummary.totalErrors}`}
                      >
                        {formatStatCount(statsSummary.totalErrors)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Uptime (jam)
                      </p>
                      <p
                        className="mt-1 break-all text-lg font-semibold leading-tight text-foreground sm:text-xl"
                        title={`${statsSummary.totalUptime}`}
                      >
                        {formatUptimeHours(statsSummary.totalUptime)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {statsSummary.latestDays.map((day) => {
                      const totalMessagesPerDay = stats.messagesPerDay?.[day] || 0;
                      const totalErrorsPerDay = stats.errorsPerDay?.[day] || 0;
                      const totalEvents = totalMessagesPerDay + totalErrorsPerDay;
                      const messageWidth = totalEvents
                        ? (totalMessagesPerDay / totalEvents) * 100
                        : 0;
                      const errorWidth = totalEvents
                        ? (totalErrorsPerDay / totalEvents) * 100
                        : 0;

                      return (
                        <div key={day} className="space-y-1.5">
                          <div className="flex flex-wrap items-start justify-between gap-1.5 text-[11px] text-muted-foreground sm:flex-nowrap sm:items-center sm:gap-3 sm:text-xs">
                            <span className="font-medium">
                              {formatAppDate(day, { withWeekday: true })}
                            </span>
                            <span className="w-full break-words text-left sm:w-auto sm:text-right">
                              {formatStatCount(totalMessagesPerDay)} pesan,{" "}
                              {formatStatCount(totalErrorsPerDay)} error
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div className="flex h-full w-full">
                              <div
                                className="h-full bg-primary/85"
                                style={{ width: `${messageWidth}%` }}
                              />
                              <div
                                className="h-full bg-destructive/75"
                                style={{ width: `${errorWidth}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </section>

        <section id="schedule">
          <Card className="relative overflow-hidden border-border/70 bg-[linear-gradient(145deg,hsl(var(--card))_0%,hsl(var(--card))_52%,hsl(var(--info)/0.05)_100%)] p-5 shadow-md sm:p-7">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-info/10 via-primary/5 to-transparent" />
            <div className="relative grid gap-7 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
              <div className="space-y-5">
                <Badge variant="info" className="w-fit normal-case tracking-normal">
                  Jadwal Pengiriman Pesan
                </Badge>

                <div className="space-y-2.5">
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl lg:text-[2rem]">
                    Lihat jam pengiriman default setiap harinya.
                  </h2>
                  <p className="ds-body">
                    Jadwal ini menjadi acuan utama kapan bot mengirim pesan
                    pengingat ke pegawai BPS Kabupaten Bulungan.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs">
                  {schedule?.timezone ? (
                    <span className="rounded-full border border-border/70 bg-background/65 px-2.5 py-1 text-muted-foreground">
                      Zona waktu: {schedule.timezone}
                    </span>
                  ) : null}
                  {schedule?.paused ? (
                    <Badge variant="warning" className="normal-case tracking-normal">
                      Penjadwalan dijeda
                    </Badge>
                  ) : hasDailySchedule ? (
                    <Badge variant="success" className="normal-case tracking-normal">
                      Penjadwalan aktif
                    </Badge>
                  ) : (
                    <Badge variant="default" className="normal-case tracking-normal">
                      Belum terkonfigurasi
                    </Badge>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                {scheduleLoading ? (
                  <div className="space-y-4 rounded-xl border border-border/70 bg-muted/30 p-4 sm:p-5">
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-4 w-64" />
                    </div>
                    <ScheduleGrid loading readOnly values={null} />
                  </div>
                ) : hasDailySchedule ? (
                  <div className="space-y-4 rounded-xl border border-border/70 bg-muted/30 p-4 sm:p-5">
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Jadwal default
                      </p>
                      <p className="text-xs text-muted-foreground sm:text-sm">
                        Waktu yang ditampilkan mengikuti zona waktu aktif.
                      </p>
                    </div>

                    <ScheduleGrid
                      readOnly
                      values={dailyTimes}
                      timeSuffix={
                        (schedule?.timezone === "Asia/Makassar" && "WITA") ||
                        (schedule?.timezone === "Asia/Jakarta" && "WIB") ||
                        (schedule?.timezone === "Asia/Jayapura" && "WIT") ||
                        undefined
                      }
                    />

                    {schedule?.paused ? (
                      <ToneSurface tone="warning" size="md" className="text-xs sm:text-sm">
                        Penjadwalan otomatis sementara dijeda. Pengumuman
                        terjadwal tetap berjalan.
                      </ToneSurface>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-4 rounded-xl border border-border/70 bg-muted/30 p-4 sm:p-5">
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Jadwal default
                      </p>
                      <p className="text-xs text-muted-foreground sm:text-sm">
                        Belum ada jam pengiriman harian yang diatur. Pengiriman
                        akan mengandalkan pengumuman terjadwal.
                      </p>
                    </div>
                    <DataPlaceholder
                      icon={null}
                      title="Belum ada jadwal"
                      description="Masuk sebagai admin untuk menetapkan jam pengiriman harian agar bot berjalan otomatis."
                      size="sm"
                    />
                  </div>
                )}
              </div>
            </div>
          </Card>
        </section>
      </div>
    </PublicLayout>
  );
}
