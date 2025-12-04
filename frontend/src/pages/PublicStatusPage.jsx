import { CalendarClock, AlertCircle, ScrollText, BarChart3 } from "lucide-react";
import { usePublicNextRun, usePublicSchedule } from "../queries/schedule";
import { useLogs, useSystemHealth, useSystemStats } from "../queries/system";
import { ScheduleGrid } from "../components/ScheduleGrid";
import { Card } from "../components/ui/Card";
import { Spinner } from "../components/ui/Spinner";
import { Badge } from "../components/ui/Badge";
import { Skeleton } from "../components/ui/Skeleton";
import { DataPlaceholder } from "../components/ui/DataPlaceholder";
import { StatusPill } from "../components/StatusPill";
import { PublicLayout } from "../components/layout/PublicLayout";
import { compareAppDates, formatAppDate } from "../lib/dateFormatter";

const DEFAULT_TIMES = {
  1: "16:00",
  2: "16:00",
  3: "16:00",
  4: "16:00",
  5: "16:30",
  6: null,
  7: null,
};

export default function PublicStatusPage() {
  const { data: health, isLoading: healthLoading } = useSystemHealth();
  const { data: scheduleData, isLoading: scheduleLoading } =
    usePublicSchedule();
  const { data: nextRunData, isLoading: nextRunLoading } = usePublicNextRun();
  const {
    data: logsData,
    isLoading: logsLoading,
    isError: logsError,
    error: logsErrorObj,
  } = useLogs(50, "public");
  const { data: stats, isLoading: statsLoading } = useSystemStats();

  const schedule = scheduleData?.schedule;
  const nextRun = nextRunData?.nextRun;
  const days = ["1", "2", "3", "4", "5", "6", "7"];
  const dailyTimes = days.reduce((acc, d) => {
    const v =
      (schedule?.dailyTimes && schedule.dailyTimes[d]) ?? DEFAULT_TIMES[d];
    acc[d] = v || DEFAULT_TIMES[d];
    return acc;
  }, {});
  const hasDailySchedule = Boolean(
    dailyTimes && Object.values(dailyTimes).some((v) => v)
  );
  const botPhase = health?.botPhase ?? health?.botStatus?.phase;
  const statusLabelByPhase = {
    idle: "Belum berjalan",
    starting: "Menyiapkan bot...",
    "waiting-qr": "Menunggu pemindaian QR",
    authenticated: "QR terscan, menunggu siap...",
    ready: "Aktif",
    stopped: "Bot dihentikan",
    error: "Terjadi kesalahan",
  };
  const statusSummary =
    statusLabelByPhase[botPhase] ?? (health?.botActive ? "Aktif" : "Nonaktif");

  return (
    <PublicLayout>
      <section id="status" className="mt-[56px] md:mt-[64px] space-y-12">
        <Card className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-800/80 px-6 py-10 shadow-xl backdrop-blur-md sm:px-10">
          <div className="absolute inset-y-0 right-0 -z-10 hidden w-1/2 bg-gradient-to-l from-primary-500/20 to-transparent blur-3xl sm:block" />
          <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl space-y-5">
              <Badge variant="info" className="w-fit uppercase tracking-wide">
                Monitor status harian
              </Badge>
              <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
                Sistem Informasi Pengingat Presensi (SIGAP)
              </h1>
              <p className="text-base text-slate-400">
                Sistem ini membantu Anda memantau WhatsApp Bot pengingat
                presensi dalam satu halaman terpusat, memungkinkan pengaturan
                jadwal pengiriman otomatis, penyesuaian jadwal manual, serta
                pemantauan status koneksi bot.
              </p>
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
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
                {!healthLoading && health?.timezone ? (
                  <Badge variant="info" className="uppercase tracking-wide">
                    Zona waktu: {health.timezone}
                  </Badge>
                ) : null}
              </div>
            </div>
            <div className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-6 text-sm text-slate-300">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Status Bot</span>
                {healthLoading ? (
                  <Spinner size="sm" />
                ) : (
                  <span className="font-semibold text-white">{statusSummary}</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Override aktif</span>
                <span className="font-semibold text-white">
                  {schedule?.overridesCount ?? 0}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="mb-2 text-slate-400">
                  Pengiriman berikutnya
                </span>
                {nextRunLoading ? (
                  <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/70 p-5">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-8 w-44" />
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : nextRun?.timestamp ? (
                  <div className="space-y-5 rounded-2xl border border-white/10 bg-slate-950/70 p-5">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-slate-400">
                        Waktu pengiriman
                      </p>
                      <p className="mt-1 text-2xl font-semibold text-white">
                        {nextRun.formatted}
                      </p>
                      <p className="text-sm text-slate-400">
                        {nextRun.timezone}
                      </p>
                    </div>
                    {nextRun.override ? (
                      <div className="rounded-xl border border-amber-400/30 bg-amber-500/15 p-4 text-sm text-amber-100">
                        <p className="font-semibold">Override aktif</p>
                        <p>
                          {formatAppDate(nextRun.override.date, { withWeekday: true })} pukul {nextRun.override.time}
                          {nextRun.override.note
                            ? ` � ${nextRun.override.note}`
                            : ""}
                        </p>
                      </div>
                    ) : (
                      <p className="rounded-xl border border-white/10 bg-slate-950/80 p-4 text-sm text-slate-300">
                        Pengiriman mengikuti jadwal default.
                      </p>
                    )}
                  </div>
                ) : (
                  <DataPlaceholder
                    icon={<CalendarClock className="h-12 w-12" aria-hidden="true" />}
                    title="Belum ada jadwal berikutnya"
                    description="Hubungi administrator untuk mengatur jadwal baru."
                  />
                )}
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section
        id="public-activity"
        className="mt-12 grid gap-8 lg:grid-cols-[2fr,1fr] items-stretch"
      >
        {/* Aktivitas */}
        <Card className="relative w-full h-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70 p-6 sm:p-8 shadow-xl backdrop-blur-md flex flex-col min-h-[320px]">
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold text-white">
              Aktivitas Terbaru
            </h2>
            <p className="text-sm text-slate-400">
              Log aktivitas terbaru yang dapat diakses publik.
            </p>
          </div>

          <div className="mt-4 flex-1 min-h-0">
            {logsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-40" />
              </div>
            ) : logsError ? (
              <DataPlaceholder
                icon={<AlertCircle className="h-12 w-12" aria-hidden="true" />}
                title="Gagal memuat log"
                description={logsErrorObj?.message || "Terjadi kesalahan."}
              />
            ) : logsData?.logs?.length ? (
              <pre className="h-full min-h-0 overflow-auto rounded-xl border border-white/10 bg-slate-950/70 p-4 text-xs text-slate-300">
                {logsData.logs.join("\n")}
              </pre>
            ) : (
              <DataPlaceholder
                icon={<ScrollText className="h-12 w-12" aria-hidden="true" />}
                title="Belum ada log"
                description="Aktivitas sistem akan tampil di sini."
              />
            )}
          </div>
        </Card>

        {/* Statistik */}
        <Card
          id="public-stats"
          className="relative w-full h-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70 p-6 sm:p-8 shadow-xl backdrop-blur-md flex flex-col min-h-[320px]"
        >
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold text-white">Statistik</h2>
            <p className="text-sm text-slate-400">
              Ringkasan pesan, error, dan uptime per hari.
            </p>
          </div>

          <div className="mt-4 flex-1 min-h-0">
            {statsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-24" />
              </div>
            ) : !stats ? (
              <DataPlaceholder
                icon={<BarChart3 className="h-12 w-12" aria-hidden="true" />}
                title="Belum ada data"
                description="Statistik belum tersedia."
              />
            ) : (
              (() => {
                const totalMessages = Object.values(
                  stats.messagesPerDay || {}
                ).reduce((a, b) => a + b, 0);
                const totalErrors = Object.values(
                  stats.errorsPerDay || {}
                ).reduce((a, b) => a + b, 0);
                const totalUptime = Object.values(
                  stats.uptimePerDay || {}
                ).reduce((a, b) => a + b, 0);
                const days = Object.keys({
                  ...(stats.messagesPerDay || {}),
                  ...(stats.errorsPerDay || {}),
                  ...(stats.uptimePerDay || {}),
                })
                  .sort(compareAppDates)
                  .slice(-7);

                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
                        <p className="text-xs text-slate-400">Pesan</p>
                        <p className="text-xl font-semibold text-white">
                          {totalMessages}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
                        <p className="text-xs text-slate-400">Error</p>
                        <p className="text-xl font-semibold text-white">
                          {totalErrors}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
                        <p className="text-xs text-slate-400">Uptime (jam)</p>
                        <p className="text-xl font-semibold text-white">
                          {totalUptime}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {days.map((d) => {
                        const m = stats.messagesPerDay?.[d] || 0;
                        const err = stats.errorsPerDay?.[d] || 0;
                        const max = Math.max(1, m + err);
                        return (
                          <div key={d} className="space-y-1">
                            <div className="flex items-center justify-between text-xs text-slate-400">
                              <span>{d}</span>
                              <span>
                                {m} pesan, {err} error
                              </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                              <div
                                className="h-full bg-primary-500"
                                style={{ width: `${(m / max) * 100}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        </Card>
      </section>

      <section id="schedule" className="mt-16 space-y-10">
        <Card className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-800/80 px-6 py-10 shadow-xl backdrop-blur-md sm:px-10">
          <div className="absolute inset-y-0 right-0 -z-10 hidden w-1/2 bg-gradient-to-l from-primary-500/20 to-transparent blur-3xl sm:block" />
          <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr] lg:items-start">
            <div className="space-y-6">
              <Badge variant="info" className="w-fit uppercase tracking-wide">
                Jadwal otomatis
              </Badge>
              <div className="space-y-3">
                <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
                  Lihat jam pengiriman default setiap harinya.
                </h2>
                <p className="text-base text-slate-400">
                  Jadwal ini menjadi acuan utama kapan bot mengirim pesan
                  pengingat ke tim Anda.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-300">
                {schedule?.timezone && (
                  <span className="rounded-full bg-slate-800/70 px-3 py-1 text-slate-200">
                    Zona waktu {schedule.timezone}
                  </span>
                )}
                {schedule?.paused ? (
                  <span className="rounded-full px-3 py-1 ring-1 ring-amber-400/40 bg-amber-500/15 text-amber-100">
                    Penjadwalan dijeda
                  </span>
                ) : hasDailySchedule ? (
                  <span
                    className="
                    rounded-full px-3 py-1
                    ring-1 ring-emerald-400/40
                    bg-emerald-500/15 text-emerald-100
                  "
                  >
                    Penjadwalan aktif
                  </span>
                ) : null}
              </div>
            </div>

            <div className="space-y-4">
              {scheduleLoading ? (
                <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/70 p-5">
                  <div className="space-y-3">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-64" />
                  </div>
                  <ScheduleGrid loading readOnly values={null} />
                </div>
              ) : hasDailySchedule ? (
                <div className="space-y-5 rounded-2xl border border-white/10 bg-slate-950/70 p-5">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 [.theme-dark_&]:text-slate-300">
                      Jadwal default
                    </p>
                    <p className="text-sm text-slate-300">
                      Waktu yang ditampilkan mengikuti zona waktu{" "}
                      {schedule?.timezone ?? "yang ditentukan"}.
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
                  {schedule?.paused && (
                    <div className="rounded-xl border border-amber-400/30 bg-amber-500/15 px-4 py-3 text-sm text-amber-100">
                      Penjadwalan otomatis sementara dijeda. Override manual
                      tetap berjalan.
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-5 rounded-2xl border border-white/10 bg-slate-950/70 p-5">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      Jadwal default
                    </p>
                    <p className="text-sm text-slate-300">
                      Belum ada jam pengiriman harian yang diatur. Semua
                      pengiriman akan mengandalkan override manual.
                    </p>
                  </div>
                  <DataPlaceholder
                    icon={null}
                    title="Belum ada jadwal"
                    description="Masuk sebagai admin untuk menetapkan jam pengiriman harian agar bot berjalan otomatis."
                  />
                </div>
              )}
            </div>
          </div>
        </Card>
      </section>
    </PublicLayout>
  );
}
