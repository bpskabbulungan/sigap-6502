import { useEffect, useMemo, useRef } from "react";
import { Bot } from "lucide-react";
import { useBotStart, useBotStatus, useBotStop } from "../queries/bot";
import { useQr } from "../queries/system";
import { QueryErrorNotice } from "./error/QueryErrorNotice";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Spinner } from "./ui/Spinner";
import { Skeleton } from "./ui/Skeleton";
import { StatusPill } from "./StatusPill";
import { useToast } from "./ui/ToastProvider.jsx";
import { useConfirm } from "./ui/ConfirmProvider.jsx";

function buildQrRevision(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export function BotControlPanel() {
  const { data, isLoading, refetch: refetchStatus } = useBotStatus();
  const startMutation = useBotStart();
  const stopMutation = useBotStop();
  const { data: qrData, isLoading: qrLoading } = useQr();
  const { add: addToast } = useToast();
  const { confirm } = useConfirm();

  const starting = startMutation.isLoading;
  const stopping = stopMutation.isLoading;
  const active = Boolean(data?.active);
  const phase = data?.phase || "idle";
  const qr = qrData?.qr || null;

  const transitionalPhases = useMemo(
    () => new Set(["starting", "waiting-qr", "authenticated", "restarting"]),
    []
  );
  // Phases where it is safe/expected to allow a manual Stop action (even if still starting)
  const stoppablePhases = useMemo(
    () => new Set(["starting", "waiting-qr", "authenticated", "ready", "restarting", "error"]),
    []
  );

  // When QR disappears or we’re waiting for WhatsApp to get ready, poll faster
  useEffect(() => {
    const shouldPoll =
      !active &&
      (phase === "authenticated" ||
        phase === "starting" ||
        phase === "restarting" ||
        (!qr && phase !== "stopped"));

    if (!shouldPoll) return undefined;

    const id = setInterval(() => refetchStatus(), 2_000);
    return () => clearInterval(id);
  }, [active, phase, qr, refetchStatus]);

  // Toast when bot transitions to active
  const wasActiveRef = useRef(active);
  useEffect(() => {
    if (!wasActiveRef.current && active) {
      addToast("WhatsApp terhubung. Bot siap.", { type: "success" });
    }
    wasActiveRef.current = active;
  }, [active, addToast]);

  const disableStart = starting || active || transitionalPhases.has(phase);
  const allowStop = active || stoppablePhases.has(phase);
  const disableStop = stopping || !allowStop;

  const handleStop = async () => {
    if (disableStop) return;

    const ok = await confirm({
      title: "Hentikan bot?",
      message:
        "Bot akan berhenti menerima dan mengirim pesan otomatis hingga dijalankan kembali.",
      confirmText: "Ya, stop",
      variant: "danger",
    });

    if (!ok) return;

    stopMutation.mutate(undefined, {
      onSuccess: () => addToast("Bot dihentikan.", { type: "success" }),
      onError: (err) =>
        addToast(err?.message || "Gagal menghentikan bot.", { type: "error" }),
    });
  };

  const qrHelperMessage = useMemo(() => {
    if (phase === "authenticated") {
      return "QR berhasil dipindai, menunggu WhatsApp siap...";
    }
    if (phase === "starting") {
      return "Menyiapkan WhatsApp client...";
    }
    if (phase === "restarting") {
      return "Bot sedang restart otomatis. Menunggu WhatsApp siap kembali...";
    }
    if (phase === "error") {
      return "Autentikasi gagal. Klik \"Start Bot\" untuk mencoba lagi.";
    }
    if (phase === "stopped") {
      return "Bot dalam keadaan berhenti. Klik \"Start Bot\" untuk memulai sesi baru.";
    }
    if (phase === "waiting-qr") {
      return "QR siap dipindai. Buka WhatsApp > Perangkat tertaut.";
    }
    return "Menunggu WhatsApp siap. QR baru akan muncul bila diperlukan.";
  }, [phase]);

  const qrStatusLabel = useMemo(() => {
    if (phase === "authenticated") {
      return "QR sudah dipindai, menunggu WhatsApp siap";
    }
    if (phase === "waiting-qr") return "Menunggu QR...";
    if (phase === "starting") return "Menyiapkan client...";
    if (phase === "restarting") return "Melanjutkan sesi setelah restart...";
    if (qrLoading) return "Memuat QR...";
    return "Memantau status WhatsApp...";
  }, [phase, qrLoading]);

  const qrImageUrl = useMemo(() => {
    if (!qr) return "";
    const revision = buildQrRevision(qr);
    return `/api/system/qr.svg?v=${revision}`;
  }, [qr]);

  const showQrInstructions =
    !active && ["waiting-qr", "error", "stopped"].includes(phase);
  const transitionalNotice =
    !active &&
    !showQrInstructions &&
    (phase === "authenticated" ||
      phase === "starting" ||
      phase === "restarting")
      ? qrHelperMessage
      : null;

  return (
    <Card className="bot-panel-cq relative overflow-hidden border-border/70 bg-[linear-gradient(165deg,hsl(var(--card))_0%,hsl(var(--card))_58%,hsl(var(--info)/0.06)_100%)]">
      <div className="pointer-events-none absolute -right-16 -top-14 h-32 w-32 rounded-full bg-primary/12 blur-3xl" />
      <div className="relative flex flex-col gap-4 p-4 sm:gap-5 sm:p-6">
        <div className="bot-panel-header flex flex-col gap-3">
          <div className="bot-panel-title-row flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary sm:h-10 sm:w-10">
              <Bot className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="bot-panel-title-copy min-w-0">
              <h3 className="text-base font-semibold text-foreground sm:text-lg">
                Kontrol Bot WhatsApp
              </h3>
              <p className="text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6">
                Pantau dan kontrol status bot agar pengiriman pesan berjalan
                sesuai jadwal.
              </p>
            </div>
          </div>
          {isLoading ? (
            <Skeleton className="h-6 w-24" />
          ) : (
            <div className="bot-panel-status self-start">
              <StatusPill active={active} phase={phase} />
            </div>
          )}
        </div>

        <div className="bot-panel-actions grid gap-2 sm:gap-3">
          <Button
            variant="success"
            className="w-full text-xs !border-emerald-700 !bg-emerald-600 !text-white shadow-sm shadow-emerald-700/20 hover:!bg-emerald-700 disabled:!border-emerald-300 disabled:!bg-emerald-200 disabled:!text-emerald-900 sm:text-sm"
            disabled={disableStart}
            type="button"
            onClick={() =>
              startMutation.mutate(undefined, {
                onSuccess: () =>
                  addToast("Bot berhasil diaktifkan.", { type: "success" }),
                onError: (err) =>
                  addToast(err?.message || "Gagal mengaktifkan bot.", {
                    type: "error",
                  }),
              })
            }
          >
            {starting && <Spinner size="sm" className="mr-2" />}
            {starting ? "Mengaktifkan..." : "Start Bot"}
          </Button>
          <Button
            variant="destructive"
            className="w-full text-xs !border-red-700 !bg-red-600 !text-white shadow-sm shadow-red-700/20 hover:!bg-red-700 disabled:!border-red-300 disabled:!bg-red-200 disabled:!text-red-900 sm:text-sm"
            disabled={disableStop}
            type="button"
            onClick={handleStop}
          >
            {stopping && <Spinner size="sm" className="mr-2" />}
            {stopping ? "Menghentikan..." : "Stop Bot"}
          </Button>
        </div>

        {(startMutation.error || stopMutation.error) && (
          <QueryErrorNotice
            error={startMutation.error || stopMutation.error}
            fallbackMessage="Perintah bot belum dapat diproses."
            onRetry={active ? handleStop : () => startMutation.mutate()}
            retryLabel={active ? "Coba stop lagi" : "Coba start lagi"}
            size="sm"
          />
        )}

        {transitionalNotice && (
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-info/30 bg-info/10 px-3 py-1 text-[11px] text-foreground sm:text-xs">
            <Spinner size="xs" className="text-primary" />
            <span>{transitionalNotice}</span>
          </div>
        )}

        {/* QR helper */}
        {showQrInstructions && (
          <div className="mt-1 rounded-xl border border-info/25 bg-[linear-gradient(165deg,hsl(var(--info)/0.08),hsl(var(--card)))] p-3 sm:p-4">
            <div className="mb-3">
              <p className="text-xs font-medium text-foreground sm:text-sm">
                Scan QR untuk login WhatsApp
              </p>
              <p className="text-[11px] text-muted-foreground sm:text-xs">
                Buka WhatsApp di ponsel {">"} Perangkat tertaut {">"} Tautkan
                perangkat, lalu arahkan kamera ke QR di bawah.
              </p>
            </div>

            {qr ? (
              <div className="bot-panel-qr-layout flex flex-col items-start gap-3">
                <img
                  src={qrImageUrl}
                  alt="QR WhatsApp"
                  className="bot-panel-qr-image h-auto w-36 rounded border border-border/70 bg-background/85 p-2"
                />
                <div className="bot-panel-qr-meta flex-1 text-[11px] text-muted-foreground sm:text-xs">
                  <p className="mb-2">
                    QR diperbarui otomatis setiap beberapa detik hingga berhasil
                    login.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="info"
                      outline
                      size="sm"
                      className="text-[11px] sm:text-xs"
                      onClick={() => {
                        navigator.clipboard?.writeText(qr);
                        addToast("QR disalin ke clipboard.", { type: "info" });
                      }}
                    >
                      Salin kode mentah
                    </Button>
                    <span className="self-center text-[11px] text-muted-foreground sm:text-xs">
                      {qrStatusLabel}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className={`flex items-center gap-2 text-[11px] sm:text-xs ${
                  phase === "error" ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                {phase !== "error" ? <Spinner size="sm" /> : null}
                <span>{qrHelperMessage}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
