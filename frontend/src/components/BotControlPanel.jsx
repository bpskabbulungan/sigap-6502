import { useEffect, useMemo, useRef } from "react";
import { Bot } from "lucide-react";
import { useBotStart, useBotStatus, useBotStop } from "../queries/bot";
import { useQr } from "../queries/system";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Spinner } from "./ui/Spinner";
import { Skeleton } from "./ui/Skeleton";
import { StatusPill } from "./StatusPill";
import { useToast } from "./ui/ToastProvider.jsx";
import { useConfirm } from "./ui/ConfirmProvider.jsx";

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
    <Card className="relative overflow-hidden bg-gradient-to-br from-primary-500/15 via-slate-900/70 to-slate-900/80 shadow-primary-500/20">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.15),_transparent_55%)]" />

      <div className="flex flex-col gap-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-500/10 text-primary-400">
              <Bot className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                Kontrol Bot WhatsApp
              </h3>
              <p className="text-sm text-slate-300">
                Pantau dan kontrol status bot agar pengiriman pesan berjalan
                sesuai jadwal.
              </p>
            </div>
          </div>
          {isLoading ? (
            <Skeleton className="h-6 w-24" />
          ) : (
            <StatusPill active={active} phase={phase} />
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            variant="success"
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
            variant="danger"
            disabled={disableStop}
            type="button"
            onClick={handleStop}
          >
            {stopping && <Spinner size="sm" className="mr-2" />}
            {stopping ? "Menghentikan..." : "Stop Bot"}
          </Button>
        </div>

        {(startMutation.error || stopMutation.error) && (
          <p className="text-sm text-rose-300">
            {(startMutation.error || stopMutation.error)?.message}
          </p>
        )}

        {transitionalNotice && (
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-200">
            <Spinner size="xs" className="text-primary-300" />
            <span>{transitionalNotice}</span>
          </div>
        )}

        {/* QR helper */}
        {showQrInstructions && (
          <div className="mt-1 rounded-xl border border-white/10 bg-slate-950/60 p-4">
            <div className="mb-3">
              <p className="text-sm font-medium text-white">
                Perlu scan QR untuk login WhatsApp
              </p>
              <p className="text-xs text-slate-400">
                Buka WhatsApp di ponsel {">"} Perangkat tertaut {">"} Tautkan
                perangkat, lalu arahkan kamera ke QR di bawah.
              </p>
            </div>

            {qr ? (
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
                    qr
                  )}`}
                  alt="QR WhatsApp"
                  className="h-auto w-40 rounded border border-white/10 bg-white/5 p-2 sm:w-48"
                />
                <div className="flex-1 text-xs text-slate-400 sm:pl-4">
                  <p className="mb-2">
                    QR diperbarui otomatis setiap beberapa detik hingga berhasil
                    login.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      outline
                      size="sm"
                      onClick={() => {
                        navigator.clipboard?.writeText(qr);
                        addToast("QR disalin ke clipboard.", { type: "info" });
                      }}
                    >
                      Salin kode mentah
                    </Button>
                    <span className="self-center text-[11px] text-slate-500">
                      {qrStatusLabel}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className={`flex items-center gap-2 text-xs ${
                  phase === "error" ? "text-rose-300" : "text-slate-400"
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
