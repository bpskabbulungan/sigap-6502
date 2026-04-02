import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "../queries/auth";
import { useAdminSchedule, useUpdateSchedule } from "../queries/schedule";
import { ScheduleGrid } from "../components/ScheduleGrid";
import { AdminLayout } from "../components/layout/AdminLayout";
import { QueryErrorNotice } from "../components/error/QueryErrorNotice";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { Spinner } from "../components/ui/Spinner";
import { MetricCard } from "../components/ui/MetricCard";
import { ToneSurface } from "../components/ui/ToneSurface";
import { useToast } from "../components/ui/ToastProvider.jsx";
import { useConfirm } from "../components/ui/ConfirmProvider.jsx";
import {
  Save,
  RotateCcw,
  Info,
  AlertTriangle,
  CalendarDays,
} from "lucide-react";
import { useDocumentTitle } from "../utils/useDocumentTitle.js";

const DEFAULT_TIMES = {
  1: "16:00",
  2: "16:00",
  3: "16:00",
  4: "16:00",
  5: "16:30",
  6: "",
  7: "",
};

const DAY_NAMES = {
  1: "Senin",
  2: "Selasa",
  3: "Rabu",
  4: "Kamis",
  5: "Jumat",
  6: "Sabtu",
  7: "Minggu",
};

const TZ_LABEL = {
  "Asia/Jakarta": "WIB",
  "Asia/Makassar": "WITA",
  "Asia/Jayapura": "WIT",
};

function isValidTimeHHMM(value) {
  if (!value) return true;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isValidIanaTZ(timezone) {
  try {
    new Intl.DateTimeFormat("id-ID", { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function nowInTZ(timezone) {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date());
  } catch {
    return "";
  }
}

function formatUpdatedAt(timestamp) {
  if (!timestamp) return "-";
  return new Date(timestamp).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminSchedulePage() {
  const { data: session, isLoading: sessionLoading } = useSession();
  const { add: addToast } = useToast();
  const { confirm } = useConfirm();

  useDocumentTitle("Jadwal Otomatis");

  const {
    data: scheduleResponse,
    isLoading: scheduleLoading,
    isFetching: scheduleFetching,
    isError: scheduleError,
    error: scheduleErrorState,
    dataUpdatedAt: scheduleUpdatedAt,
    refetch: refetchSchedule,
  } = useAdminSchedule();
  const updateScheduleMutation = useUpdateSchedule();

  const schedule = scheduleResponse?.schedule;
  const isSchedulePending = scheduleLoading && !schedule;
  const isScheduleUpdating = scheduleFetching && !scheduleLoading;

  const [dailyTimes, setDailyTimes] = useState(DEFAULT_TIMES);
  const [timezone, setTimezone] = useState("Asia/Makassar");
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (schedule) {
      setDailyTimes({ ...DEFAULT_TIMES, ...(schedule.dailyTimes ?? {}) });
      setTimezone(schedule.timezone || "Asia/Makassar");
      setPaused(Boolean(schedule.paused));
    }
  }, [schedule]);

  const resetScheduleDraft = useCallback(
    (showToast = true) => {
      if (!schedule) return;
      setDailyTimes({ ...DEFAULT_TIMES, ...(schedule.dailyTimes || {}) });
      setTimezone(schedule.timezone || "Asia/Makassar");
      setPaused(Boolean(schedule.paused));
      if (showToast) addToast("Perubahan jadwal direset.", { type: "info" });
    },
    [schedule, addToast]
  );

  const invalidDays = useMemo(() => {
    return Object.entries(dailyTimes)
      .filter(([, value]) => !isValidTimeHHMM(value))
      .map(([day]) => Number(day));
  }, [dailyTimes]);

  const tzValid = isValidIanaTZ(timezone);
  const tzNow = tzValid ? nowInTZ(timezone) : "";
  const tzSuffix = TZ_LABEL[timezone];

  const scheduleDirty = useMemo(() => {
    const normalizedDraft = Object.fromEntries(
      Object.entries(dailyTimes).map(([day, value]) => [day, value || null])
    );
    const normalizedServer = Object.fromEntries(
      Object.entries({ ...DEFAULT_TIMES, ...(schedule?.dailyTimes || {}) }).map(
        ([day, value]) => [day, value || null]
      )
    );

    return (
      JSON.stringify(normalizedDraft) !== JSON.stringify(normalizedServer) ||
      timezone !== (schedule?.timezone || "Asia/Makassar") ||
      Boolean(paused) !== Boolean(schedule?.paused)
    );
  }, [dailyTimes, timezone, paused, schedule?.dailyTimes, schedule?.timezone, schedule?.paused]);

  const disableSave =
    updateScheduleMutation.isLoading || invalidDays.length > 0 || !tzValid || !scheduleDirty;

  const handleScheduleSubmit = useCallback(
    (event) => {
      event?.preventDefault?.();

      const normalizedTimes = Object.fromEntries(
        Object.entries(dailyTimes).map(([day, value]) => [day, value || null])
      );

      updateScheduleMutation.mutate(
        { dailyTimes: normalizedTimes, timezone, paused },
        {
          onSuccess: () => addToast("Jadwal berhasil disimpan.", { type: "success" }),
          onError: (error) =>
            addToast(error?.message || "Gagal menyimpan jadwal.", {
              type: "error",
            }),
        }
      );
    },
    [dailyTimes, timezone, paused, updateScheduleMutation, addToast]
  );

  const handleAskReset = useCallback(async () => {
    if (!scheduleDirty || !schedule) return;
    const confirmed = await confirm({
      title: "Reset perubahan?",
      message: "Perubahan jadwal yang belum disimpan akan hilang.",
      confirmText: "Ya, reset",
      variant: "warning",
    });
    if (!confirmed) return;
    resetScheduleDraft(true);
  }, [confirm, scheduleDirty, schedule, resetScheduleDraft]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        if (disableSave) return;
        event.preventDefault();
        handleScheduleSubmit();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [disableSave, handleScheduleSubmit]);

  const validationState =
    invalidDays.length > 0 || !tzValid
      ? "Perlu perbaikan"
      : scheduleDirty
      ? "Siap disimpan"
      : "Tidak ada perubahan";

  return (
    <AdminLayout username={session?.user?.username} loading={sessionLoading}>
      <div className="ds-page-stack">
        <Card className="overflow-hidden border-border/70 bg-[linear-gradient(180deg,hsl(var(--card))_0%,hsl(var(--muted)/0.2)_100%)] p-0">
          <div className="border-b border-border/70 bg-background/35 px-4 py-4 sm:px-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-2">
                <h1 className="ds-page-title">
                  Manajemen Jadwal
                </h1>
                <p className="text-xs leading-5 text-muted-foreground sm:text-sm">
                  Halaman kelola jam kirim, zona waktu, dan status penjadwalan otomatis.
                </p>
              </div>

              {scheduleDirty ? (
                <Badge variant="warning" className="w-fit normal-case tracking-normal">
                  <Info className="h-3.5 w-3.5" /> Perubahan belum disimpan
                </Badge>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs">
              <span className="rounded-full border border-border/70 bg-background/75 px-2.5 py-1 text-muted-foreground">
                Sinkron terakhir: {formatUpdatedAt(scheduleUpdatedAt)}
              </span>
              <span className="rounded-full border border-border/70 bg-background/75 px-2.5 py-1 text-muted-foreground">
                Zona aktif: {schedule?.timezone || "Asia/Makassar"}
              </span>
            </div>

            {isScheduleUpdating ? (
              <div className="mt-3 inline-flex w-fit items-center gap-2 rounded-full border border-primary/35 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary sm:text-xs">
                <Spinner size="sm" />
                <span>Data jadwal sedang disinkronkan...</span>
              </div>
            ) : null}
          </div>

          <div className="p-4 sm:p-6">
            {scheduleError ? (
              <QueryErrorNotice
                error={scheduleErrorState}
                fallbackMessage="Data jadwal belum dapat dimuat dari server."
                onRetry={() => refetchSchedule()}
                retryLabel="Muat ulang jadwal"
                className="mb-4"
              />
            ) : null}

            <div className="space-y-6">
              {scheduleDirty ? (
                <div className="grid gap-2 sm:hidden">
                  <p className="text-[11px] text-muted-foreground">
                    Perubahan jadwal belum disimpan.
                    {invalidDays.length > 0 ? " Perbaiki format jam dulu." : ""}
                    {!tzValid ? " Zona waktu masih tidak valid." : ""}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      className="text-xs"
                      onClick={handleAskReset}
                      disabled={updateScheduleMutation.isLoading}
                    >
                      Reset
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      className="text-xs shadow-sm shadow-primary/20"
                      loading={updateScheduleMutation.isLoading}
                      loadingText="Menyimpan..."
                      disabled={disableSave}
                      onClick={handleScheduleSubmit}
                    >
                      Simpan
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-3">
                <MetricCard
                  label="Status Penjadwalan"
                  value={paused ? "Sedang dijeda" : "Aktif"}
                  helper={
                    paused
                      ? "Pengiriman otomatis sedang dijeda."
                      : "Pengiriman otomatis aktif."
                  }
                  tone={paused ? "amber" : "emerald"}
                />
                <MetricCard
                  label="Zona Waktu Draft"
                  value={timezone}
                  helper={tzValid ? `Waktu saat ini: ${tzNow}` : "Zona waktu belum valid"}
                  tone="sky"
                />
                <MetricCard
                  label="Validasi Draft"
                  value={validationState}
                  helper={
                    validationState === "Perlu perbaikan"
                      ? "Periksa format jam atau zona waktu."
                      : validationState === "Siap disimpan"
                      ? "Semua validasi lolos, siap dikirim."
                      : "Draft sudah sinkron dengan data server."
                  }
                  tone={
                    validationState === "Perlu perbaikan"
                      ? "amber"
                      : validationState === "Siap disimpan"
                      ? "sky"
                      : "slate"
                  }
                />
              </div>

              {isSchedulePending ? (
                <ScheduleGrid loading />
              ) : (
                <form className="space-y-6" onSubmit={handleScheduleSubmit}>
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    <p className="text-sm font-medium text-foreground">Jam kirim otomatis per hari</p>
                  </div>

                  <ScheduleGrid
                    values={dailyTimes}
                    onChange={setDailyTimes}
                    timeSuffix={tzSuffix}
                    invalidDays={invalidDays}
                  />

                  {invalidDays.length > 0 ? (
                    <ToneSurface tone="warning" size="md" className="text-xs sm:text-sm">
                      <div className="flex items-start gap-2">
                        <Info className="mt-0.5 h-4 w-4 flex-none" />
                        <span>
                          Format waktu tidak valid pada{" "}
                          <strong>{invalidDays.map((day) => DAY_NAMES[day] || day).join(", ")}</strong>.
                          Gunakan format 24 jam <code>HH:MM</code>.
                        </span>
                      </div>
                    </ToneSurface>
                  ) : null}

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-3 rounded-2xl border border-info/30 bg-[linear-gradient(160deg,hsl(var(--info)/0.08),hsl(var(--card)))] p-4">
                      <div className="space-y-1">
                        <Label htmlFor="timezone" size="sm">
                          Zona waktu
                        </Label>
                        <p className="text-[11px] text-muted-foreground sm:text-xs">
                          Gunakan format IANA timezone seperti <code>Asia/Makassar</code>.
                        </p>
                      </div>

                      <div className="relative">
                        <Input
                          id="timezone"
                          list="tz-list"
                          value={timezone}
                          onChange={(event) => setTimezone(event.target.value)}
                          required
                          variant={tzValid ? "default" : "error"}
                          aria-invalid={!tzValid}
                          className="rounded-xl border-border bg-card pr-24"
                          placeholder="Asia/Makassar"
                        />
                        <datalist id="tz-list">
                          <option value="Asia/Jakarta">WIB</option>
                          <option value="Asia/Makassar">WITA</option>
                          <option value="Asia/Jayapura">WIT</option>
                        </datalist>
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-border/70 bg-muted/30 px-2 py-0.5 text-xs text-foreground">
                          {TZ_LABEL[timezone] || "TZ"}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {Object.entries(TZ_LABEL).map(([tz, short]) => (
                          <button
                            key={tz}
                            type="button"
                            onClick={() => setTimezone(tz)}
                            className={`rounded-full border px-2.5 py-1 text-[11px] transition sm:text-xs ${
                              timezone === tz
                                ? "border-primary/45 bg-primary/10 text-primary"
                                : "border-border/70 bg-background/90 text-muted-foreground hover:border-primary/35 hover:text-foreground"
                            }`}
                          >
                            {short} ({tz})
                          </button>
                        ))}
                      </div>

                      <p className={`text-[11px] sm:text-xs ${tzValid ? "text-muted-foreground" : "text-destructive"}`}>
                        {tzValid ? `Sekarang di ${timezone}: ${tzNow}` : "Zona waktu tidak dikenali sistem."}
                      </p>
                    </div>

                    <div className="space-y-3 rounded-2xl border border-success/25 bg-[linear-gradient(160deg,hsl(var(--success)/0.08),hsl(var(--card)))] p-4">
                      <div className="space-y-1">
                        <Label htmlFor="paused" size="sm">
                          Status penjadwalan
                        </Label>
                        <p className="text-[11px] text-muted-foreground sm:text-xs">
                          Saat dijeda, pengiriman otomatis berhenti sementara, pengumuman terjadwal tetap berjalan.
                        </p>
                      </div>

                      <label
                        htmlFor="paused"
                        className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/85 px-3 py-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-foreground">Jeda pengiriman otomatis</p>
                          <p className="text-[11px] text-muted-foreground sm:text-xs">
                            Cocok untuk maintenance atau jeda sementara.
                          </p>
                        </div>
                        <input
                          id="paused"
                          type="checkbox"
                          className="h-4 w-4 accent-primary"
                          checked={paused}
                          onChange={(event) => setPaused(event.target.checked)}
                        />
                      </label>
                    </div>
                  </div>

                  {updateScheduleMutation.error ? (
                    <ToneSurface tone="danger" size="md" className="text-xs sm:text-sm">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                        <span>{updateScheduleMutation.error.message}</span>
                      </div>
                    </ToneSurface>
                  ) : null}

                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleAskReset}
                      disabled={!scheduleDirty || updateScheduleMutation.isLoading}
                      className="text-xs sm:text-sm"
                    >
                      <RotateCcw className="h-4 w-4" /> Reset
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      loading={updateScheduleMutation.isLoading}
                      loadingText="Menyimpan..."
                      disabled={disableSave}
                      className="text-xs shadow-sm shadow-primary/20 sm:text-sm"
                    >
                      {updateScheduleMutation.isLoading ? null : (
                        <>
                          <Save className="h-4 w-4" /> Simpan
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </Card>

      </div>
    </AdminLayout>
  );
}
