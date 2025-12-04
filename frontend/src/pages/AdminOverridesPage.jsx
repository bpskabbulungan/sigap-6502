import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../queries/auth";
import {
  useAdminSchedule,
  useAddOverride,
  useRemoveOverride,
} from "../queries/schedule";
import { AdminLayout } from "../components/layout/AdminLayout";
import { Card } from "../components/ui/Card";
import { Label } from "../components/ui/Label";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { OverrideTable } from "../components/OverrideTable";
import { Modal } from "../components/ui/Modal";
import { useToast } from "../components/ui/ToastProvider.jsx";
import { useConfirm } from "../components/ui/ConfirmProvider.jsx";
import {
  formatAppDate,
  isValidAppDate,
  normalizeAppDate,
} from "../lib/dateFormatter";
import {
  Plus,
  Info,
  X,
  Calendar as CalendarIcon,
  Clock,
  Save,
} from "lucide-react";
import { useDocumentTitle } from "../utils/useDocumentTitle.js";

function toDateKey(item) {
  return typeof item === "string" ? item : item?.date || "";
}

function sanitizeDateInput(value) {
  return value.replace(/[/.]/g, "-").slice(0, 10);
}

export default function AdminOverridesPage() {
  const navigate = useNavigate();
  const { add: addToast } = useToast();
  const { confirm } = useConfirm();
  const { data: session, isLoading: sessionLoading } = useSession();
  const { data: scheduleResponse, isFetching } = useAdminSchedule();
  const addOverrideMutation = useAddOverride();
  const removeOverrideMutation = useRemoveOverride();

  const schedule = scheduleResponse?.schedule;

  useDocumentTitle("Override Manual");

  const [addOpen, setAddOpen] = useState(false);
  const [formError, setFormError] = useState("");

  const [overrideForm, setOverrideForm] = useState({
    date: "",
    time: "",
    note: "",
  });

  const dateRef = useRef(null);
  const timeRef = useRef(null);

  useEffect(() => {
    if (!sessionLoading && !session?.authenticated) {
      navigate("/admin/login", { replace: true });
    }
  }, [session, sessionLoading, navigate]);

  const existingDates = useMemo(() => {
    const list = schedule?.manualOverrides ?? [];
    return new Set(
      list
        .map((item) => normalizeAppDate(toDateKey(item)))
        .filter(Boolean)
    );
  }, [schedule]);

  const normalizedDate = normalizeAppDate(overrideForm.date);
  const isDuplicate = !!normalizedDate && existingDates.has(normalizedDate);
  const isInvalid = !normalizedDate || !overrideForm.time;

  const showNativePicker = (el) => {
    if (!el) return;
    if (typeof el.showPicker === "function") el.showPicker();
    else el.focus();
  };

  const clearForm = () => {
    setOverrideForm({ date: "", time: "", note: "" });
    setFormError("");
    setTimeout(() => dateRef.current?.focus(), 0);
  };

  const handleRemove = async (date) => {
    const normalizedTarget = normalizeAppDate(date);
    const formattedDate = formatAppDate(normalizedTarget || date);
    const ok = await confirm({
      title: "Hapus override?",
      message: `Override pada tanggal ${formattedDate} akan dihapus.`,
      confirmText: "Hapus",
      variant: "danger",
    });
    if (!ok) return;

    removeOverrideMutation.mutate(normalizedTarget || date, {
      onSuccess: () => addToast("Override dihapus.", { type: "success" }),
      onError: (err) =>
        addToast(err?.message || "Gagal menghapus override.", {
          type: "error",
        }),
    });
  };

  const handleOpenAdd = () => {
    setFormError("");
    clearForm();
    setAddOpen(true);
  };

  const handleCancelAdd = () => {
    setAddOpen(false);
    clearForm();
  };

  const handleSubmitAdd = (e) => {
    e?.preventDefault?.();
    setFormError("");

    if (!normalizedDate || !isValidAppDate(overrideForm.date)) {
      setFormError("Format tanggal harus DD-MM-YYYY.");
      return;
    }
    if (isDuplicate) {
      setFormError(
        "Tanggal tersebut sudah memiliki override. Hapus dulu untuk mengganti."
      );
      return;
    }
    if (isInvalid) return;

    addOverrideMutation.mutate(
      { ...overrideForm, date: normalizedDate },
      {
        onSuccess: () => {
          addToast("Override ditambahkan.", { type: "success" });
          setAddOpen(false);
          clearForm();
        },
        onError: (err) => {
          setFormError(err?.message || "Gagal menambahkan override.");
        },
      }
    );
  };

  const overridesCount = schedule?.manualOverrides?.length || 0;

  return (
    <AdminLayout username={session?.user?.username} loading={sessionLoading}>
      <div className="space-y-8">
        <Card className="space-y-6 border-white/10 bg-gradient-to-br from-slate-900/70 to-slate-800/70 p-6 backdrop-blur-xl">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold text-white">
                Override Manual
              </h1>
              <p className="text-sm text-slate-400">
                Jadwalkan pengiriman khusus yang <em>menggantikan</em> jadwal
                otomatis pada tanggal tertentu.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold tracking-wide text-slate-200">
                <Info className="h-3.5 w-3.5" />
                {overridesCount} override
              </span>

              {/* Tombol Tambah (buka modal) */}
              <Button
                onClick={handleOpenAdd}
                className="
                  inline-flex items-center gap-2 rounded-lg px-3 py-2
                  bg-sky-600 text-on-accent hover:bg-sky-500
                  border border-sky-400/30 shadow-lg shadow-sky-600/20
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60
                  focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface,#0b1220)]
                "
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Tambah</span>
                <span className="sm:hidden">Tambah</span>
              </Button>
            </div>
          </div>

          {/* TABLE DULU */}
          <OverrideTable
            overrides={schedule?.manualOverrides}
            onRemove={async (date) => handleRemove(date)}
          />

          {/* Fetching badge */}
          {isFetching && (
            <p className="text-xs text-slate-400">Menyinkronkan jadwal…</p>
          )}
        </Card>
      </div>

      {/* MODAL: Tambah Override */}
      <Modal open={addOpen} onClose={handleCancelAdd} title="Tambah Override">
        <form onSubmit={handleSubmitAdd} className="space-y-4">
          {/* Tanggal */}
          <div className="space-y-2">
            <Label htmlFor="override-date">Tanggal</Label>
            <div className="relative">
              <Input
                id="override-date"
                ref={dateRef}
                type="text"
                inputMode="numeric"
                pattern="\\d{2}-\\d{2}-\\d{4}"
                placeholder="dd-mm-yyyy"
                maxLength={10}
                value={overrideForm.date}
                onChange={(e) =>
                  setOverrideForm((p) => ({
                    ...p,
                    date: sanitizeDateInput(e.target.value),
                  }))
                }
                required
                className="w-full rounded-lg border-white/10 bg-slate-950/70 pr-10"
              />
              <button
                type="button"
                onClick={() => showNativePicker(dateRef.current)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-300 hover:bg-white/10"
                aria-label="Pilih tanggal dari kalender"
                title="Pilih tanggal"
              >
                <CalendarIcon className="h-4 w-4" />
              </button>
            </div>
            {overrideForm.date && isDuplicate ? (
              <p className="text-xs text-rose-300">
                Tanggal tersebut sudah memiliki override.
              </p>
            ) : null}
          </div>

          {/* Waktu */}
          <div className="space-y-2">
            <Label htmlFor="override-time">Waktu</Label>
            <div className="relative">
              <Input
                id="override-time"
                ref={timeRef}
                type="time"
                value={overrideForm.time}
                onChange={(e) =>
                  setOverrideForm((p) => ({ ...p, time: e.target.value }))
                }
                required
                className="w-full rounded-lg border-white/10 bg-slate-950/70 pr-10"
              />
              <button
                type="button"
                onClick={() => showNativePicker(timeRef.current)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-300 hover:bg-white/10"
                aria-label="Pilih waktu"
                title="Pilih waktu"
              >
                <Clock className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Catatan */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="override-note">Catatan (opsional)</Label>
              {overrideForm.note && (
                <button
                  type="button"
                  onClick={() => setOverrideForm((p) => ({ ...p, note: "" }))}
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-slate-300 hover:bg-white/5"
                  aria-label="Bersihkan catatan"
                >
                  <X className="h-3.5 w-3.5" /> Bersihkan
                </button>
              )}
            </div>
            <Input
              id="override-note"
              placeholder="Misal: Rapat koordinasi"
              value={overrideForm.note}
              onChange={(e) =>
                setOverrideForm((p) => ({ ...p, note: e.target.value }))
              }
              className="rounded-lg border-white/10 bg-slate-950/70"
            />
          </div>

          {/* Error */}
          {formError ? (
            <p className="text-sm text-rose-300">{formError}</p>
          ) : null}

          {/* Actions: kanan [Batal] [Tambah] */}
          <div className="mt-2 flex justify-end gap-3">
            <Button
              type="button"
              variant="danger"
              outline
              onClick={handleCancelAdd}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={
                isInvalid || isDuplicate || addOverrideMutation.isLoading
              }
              className="
                inline-flex items-center gap-2 rounded-lg px-4 py-2
                bg-sky-600 text-on-accent hover:bg-sky-500
                border border-sky-400/30 shadow-lg shadow-sky-600/20
                disabled:opacity-60
              "
            >
              {addOverrideMutation.isLoading ? (
                "Menyimpan…"
              ) : (
                <>
                  <Save className="h-4 w-4" /> Tambah
                </>
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  );
}
