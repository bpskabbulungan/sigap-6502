import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession, useLogout } from "../queries/auth";
import { useAdminNextRun, useAdminSchedule } from "../queries/schedule";
import { BotControlPanel } from "../components/BotControlPanel";
import { LogsPanel } from "../components/LogsPanel";
import { NextRunCard } from "../components/NextRunCard.jsx";
import { ScheduleGrid } from "../components/ScheduleGrid";
import { QueryErrorNotice } from "../components/error/QueryErrorNotice";
import { Card } from "../components/ui/Card";
import { Spinner } from "../components/ui/Spinner";
import { ToneSurface } from "../components/ui/ToneSurface";
import { AdminLayout } from "../components/layout/AdminLayout";
import { MetricCard } from "../components/ui/MetricCard";
import { ScrollText, CalendarDays, CalendarClock } from "lucide-react";
import { useDocumentTitle } from "../utils/useDocumentTitle.js";

const TZ_LABEL = {
  "Asia/Jakarta": "WIB",
  "Asia/Makassar": "WITA",
  "Asia/Jayapura": "WIT",
};

const PANEL_TABS = [
  {
    id: "logs",
    label: "Log Aktivitas",
    hint: "Pantau event realtime",
    icon: ScrollText,
  },
  {
    id: "schedule",
    label: "Jadwal Otomatis",
    hint: "Lihat jadwal kirim",
    icon: CalendarDays,
  },
  {
    id: "next",
    label: "Pengiriman Berikutnya",
    hint: "Validasi eksekusi",
    icon: CalendarClock,
  },
];

function formatUpdatedAt(timestamp) {
  if (!timestamp) return "-";
  return new Date(timestamp).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const { data: session, isLoading: sessionLoading } = useSession();
  const logoutMutation = useLogout();

  useDocumentTitle("Dashboard");

  const {
    data: scheduleResponse,
    isLoading: scheduleLoading,
    isFetching: scheduleFetching,
    isError: scheduleError,
    error: scheduleErrorState,
    dataUpdatedAt: scheduleUpdatedAt,
    refetch: refetchSchedule,
  } = useAdminSchedule();

  const {
    data: nextRun,
    isLoading: nextRunLoading,
    isError: nextRunError,
    error: nextRunErrorState,
    refetch: refetchNextRun,
  } = useAdminNextRun();

  const schedule = scheduleResponse?.schedule;
  const isSchedulePending = scheduleLoading && !schedule;
  const isScheduleUpdating = scheduleFetching && !scheduleLoading;

  const [panelTab, setPanelTab] = useState("logs");

  const handleTabsNavigation = useCallback(
    (event) => {
      if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
      event.preventDefault();

      const currentIndex = PANEL_TABS.findIndex((tab) => tab.id === panelTab);
      let nextIndex = currentIndex;

      if (event.key === "ArrowRight") {
        nextIndex = (currentIndex + 1) % PANEL_TABS.length;
      } else if (event.key === "ArrowLeft") {
        nextIndex = (currentIndex - 1 + PANEL_TABS.length) % PANEL_TABS.length;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = PANEL_TABS.length - 1;
      }

      const nextTab = PANEL_TABS[nextIndex];
      setPanelTab(nextTab.id);
      requestAnimationFrame(() => {
        document.getElementById(`tab-${nextTab.id}`)?.focus();
      });
    },
    [panelTab]
  );

  const activeDaysCount = useMemo(
    () => Object.values(schedule?.dailyTimes || {}).filter(Boolean).length,
    [schedule?.dailyTimes]
  );
  const activeManualAnnouncementsCount = useMemo(
    () =>
      (schedule?.manualOverrides || []).filter((item) => !item?.consumedAt)
        .length,
    [schedule?.manualOverrides]
  );

  const metrics = useMemo(
    () => [
      {
        label: "Status Jadwal",
        value: schedule ? (schedule.paused ? "Dijeda" : "Aktif") : "Memuat...",
        helper: schedule
          ? schedule.paused
            ? "Pengiriman otomatis sedang dijeda."
            : "Pengiriman berjalan sesuai konfigurasi."
          : "Menunggu data jadwal dari server.",
        tone: schedule?.paused ? "amber" : "emerald",
      },
      {
        label: "Zona Waktu Aktif",
        value: schedule?.timezone || "Asia/Makassar",
        helper: schedule
          ? "Dipakai untuk menghitung jadwal."
          : "Menunggu data jadwal dari server.",
        tone: "sky",
      },
      {
        label: "Hari Terjadwal",
        value: schedule ? String(activeDaysCount) : "Memuat...",
        helper: schedule
          ? "Jumlah hari dengan jam kirim aktif."
          : "Menghitung konfigurasi dari server.",
        tone: "slate",
      },
      {
        label: "Pengumuman Aktif",
        value: String(activeManualAnnouncementsCount),
        helper: activeManualAnnouncementsCount
          ? "Pengumuman terjadwal otomatis ditandai selesai setelah terkirim."
          : schedule
          ? "Belum ada pengumuman terjadwal."
          : "Menunggu data jadwal dari server.",
        tone: "slate",
      },
    ],
    [schedule, activeDaysCount, activeManualAnnouncementsCount]
  );

  const scheduleTimezone = schedule?.timezone || "Asia/Makassar";
  const scheduleTzSuffix = TZ_LABEL[scheduleTimezone];

  return (
    <AdminLayout
      username={session?.user?.username}
      onLogout={() =>
        logoutMutation.mutate(undefined, {
          onSuccess: () => navigate("/admin/login", { replace: true }),
        })
      }
      isLoggingOut={logoutMutation.isLoading}
      loading={sessionLoading}
    >
      <div className="ds-page-stack">
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.75fr)_minmax(320px,1fr)] xl:grid-cols-[minmax(0,1.85fr)_minmax(340px,1fr)]">
          <Card className="relative overflow-hidden border-border/70 bg-[linear-gradient(145deg,hsl(var(--card))_0%,hsl(var(--card))_46%,hsl(var(--primary)/0.05)_100%)] p-5 shadow-md sm:p-7">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-r from-primary/12 via-info/6 to-transparent" />
            <div className="pointer-events-none absolute -left-16 -top-20 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative flex h-full flex-col gap-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <h1 className="dashboard-hero-title text-2xl font-semibold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                      Halo, {session?.user?.username || "Admin"}.
                    </h1>
                    <p className="dashboard-hero-copy max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                      Halaman manajemen status bot, log operasional, dan ringkasan jadwal.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs">
                <span className="rounded-full border border-border/70 bg-background/75 px-2.5 py-1 text-muted-foreground">
                  Sinkron terakhir: {formatUpdatedAt(scheduleUpdatedAt)}
                </span>
                <span className="rounded-full border border-border/70 bg-background/75 px-2.5 py-1 text-muted-foreground">
                  Zona aktif: {scheduleTimezone}
                </span>
                <span className="rounded-full border border-border/70 bg-background/75 px-2.5 py-1 text-muted-foreground">
                  Status bot dipantau realtime
                </span>
              </div>

              {isScheduleUpdating ? (
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/35 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary sm:text-xs">
                  <Spinner size="sm" />
                  <span>Data jadwal sedang disinkronkan...</span>
                </div>
              ) : null}

              {scheduleError ? (
                <QueryErrorNotice
                  error={scheduleErrorState}
                  fallbackMessage="Data jadwal belum dapat dimuat dari server."
                  onRetry={() => refetchSchedule()}
                  retryLabel="Muat ulang jadwal"
                />
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {metrics.map((metric) => (
                  <MetricCard
                    key={metric.label}
                    label={metric.label}
                    value={metric.value}
                    helper={metric.helper}
                    tone={metric.tone}
                    loading={isSchedulePending}
                    loadingTone="onLight"
                  />
                ))}
              </div>
            </div>
          </Card>

          <BotControlPanel />
        </section>

        <section>
          <Card className="overflow-hidden border-border/70 bg-[linear-gradient(180deg,hsl(var(--card))_0%,hsl(var(--muted)/0.2)_100%)] p-0">
            <div className="border-b border-border/70 bg-background/35 px-4 py-4 sm:px-6">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-1">
                  <h2 className="dashboard-section-title text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                    Panel Operasional
                  </h2>
                  <p className="text-xs leading-5 text-muted-foreground sm:text-sm">
                    Gunakan tab untuk memantau log, melihat jadwal, dan memvalidasi pengiriman berikutnya.
                  </p>
                </div>
              </div>

              <div
                role="tablist"
                aria-label="Panel operasional dashboard"
                onKeyDown={handleTabsNavigation}
                className="grid gap-2 rounded-2xl border border-border/70 bg-muted/20 p-1 sm:grid-cols-3"
              >
                {PANEL_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const selected = panelTab === tab.id;

                  return (
                    <button
                      key={tab.id}
                      id={`tab-${tab.id}`}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      aria-controls={`panel-${tab.id}`}
                      tabIndex={selected ? 0 : -1}
                      onClick={() => setPanelTab(tab.id)}
                      className={`rounded-xl border px-3 py-2 text-left transition-[background-color,border-color,color] sm:px-4 sm:py-3 ${
                        selected
                          ? "border-primary/40 bg-[linear-gradient(145deg,hsl(var(--primary)/0.14),hsl(var(--info)/0.08))] text-foreground shadow-sm"
                          : "border-transparent text-muted-foreground hover:border-border/70 hover:bg-background/60 hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`grid h-6 w-6 place-items-center rounded-md border ${
                            selected
                              ? "border-primary/35 bg-primary/10 text-primary"
                              : "border-border/60 bg-background/60 text-muted-foreground"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5 flex-none" />
                        </span>
                        <span className="text-sm font-semibold">{tab.label}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">{tab.hint}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-4 sm:p-6">
              <div
                role="tabpanel"
                id="panel-logs"
                aria-labelledby="tab-logs"
                hidden={panelTab !== "logs"}
              >
                {panelTab === "logs" ? <LogsPanel embedded /> : null}
              </div>

              <div
                role="tabpanel"
                id="panel-schedule"
                aria-labelledby="tab-schedule"
                hidden={panelTab !== "schedule"}
              >
                {panelTab === "schedule" ? (
                  <div className="space-y-6">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <MetricCard
                        label="Status Penjadwalan"
                        value={schedule ? (schedule.paused ? "Sedang dijeda" : "Aktif") : "Memuat..."}
                        helper={
                          schedule
                            ? schedule.paused
                              ? "Pengiriman otomatis sedang dijeda."
                              : "Pengiriman otomatis aktif."
                            : "Menunggu data jadwal dari server."
                        }
                        tone={schedule?.paused ? "amber" : "emerald"}
                        loading={isSchedulePending}
                        loadingTone="onLight"
                      />
                      <MetricCard
                        label="Zona Waktu Aktif"
                        value={scheduleTimezone}
                        helper={
                          schedule
                            ? scheduleTzSuffix
                              ? `Format tampilan: ${scheduleTzSuffix}`
                              : "Zona waktu server"
                            : "Menunggu data jadwal dari server."
                        }
                        tone="sky"
                        loading={isSchedulePending}
                        loadingTone="onLight"
                      />
                      <MetricCard
                        label="Hari Terjadwal"
                        value={schedule ? String(activeDaysCount) : "Memuat..."}
                        helper={
                          schedule
                            ? "Jumlah hari dengan jam kirim aktif."
                            : "Menghitung konfigurasi dari server."
                        }
                        tone="sky"
                        loading={isSchedulePending}
                        loadingTone="onLight"
                      />
                    </div>

                    {isSchedulePending ? (
                      <ScheduleGrid loading readOnly values={null} />
                    ) : (
                      <ScheduleGrid
                        readOnly
                        values={schedule?.dailyTimes}
                        timeSuffix={scheduleTzSuffix}
                      />
                    )}

                    {schedule?.paused ? (
                      <ToneSurface tone="warning" size="md" className="text-xs sm:text-sm">
                        Penjadwalan otomatis sementara dijeda. Pengumuman terjadwal tetap berjalan.
                      </ToneSurface>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div
                role="tabpanel"
                id="panel-next"
                aria-labelledby="tab-next"
                hidden={panelTab !== "next"}
              >
                {panelTab === "next" ? (
                  <NextRunCard
                    nextRun={nextRun}
                    loading={nextRunLoading}
                    error={nextRunError ? nextRunErrorState : null}
                    onRetry={() => refetchNextRun()}
                    embedded
                  />
                ) : null}
              </div>
            </div>
          </Card>
        </section>

      </div>
    </AdminLayout>
  );
}
