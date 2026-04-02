import { useMemo, useRef, useState } from "react";
import { useSession } from "../queries/auth";
import {
  useAdminSchedule,
  useAddManualAnnouncement,
  useRemoveManualAnnouncement,
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
  parseAppDate,
} from "../lib/dateFormatter";
import {
  Plus,
  Info,
  X,
  Save,
  MessageSquare,
  FileText,
  Calendar as CalendarIcon,
  CheckCircle2,
} from "lucide-react";
import { useDocumentTitle } from "../utils/useDocumentTitle.js";

function toDateKey(item) {
  return typeof item === "string" ? item : item?.date || "";
}

function sanitizeDateInput(value) {
  const raw = typeof value === "string" ? value : "";
  const digits = raw.replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 8)}`;
}

function appDateToIso(value) {
  const normalized = normalizeAppDate(value);
  if (!normalized) {
    return "";
  }

  const [day, month, year] = normalized.split("-");
  return `${year}-${month}-${day}`;
}

const NOTE_MAX_LENGTH = 255;
const CUSTOM_MESSAGE_MAX_LENGTH = 4000;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function getTodayInputValue() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

function getActiveAnnouncements(schedule) {
  const list = schedule?.manualOverrides ?? [];
  return list.filter((item) => !item?.consumedAt);
}

export default function AdminOverridesPage() {
  const { add: addToast } = useToast();
  const { confirm } = useConfirm();
  const { data: session, isLoading: sessionLoading } = useSession();
  const { data: scheduleResponse, isFetching } = useAdminSchedule();
  const addAnnouncementMutation = useAddManualAnnouncement();
  const removeAnnouncementMutation = useRemoveManualAnnouncement();

  const schedule = scheduleResponse?.schedule;

  useDocumentTitle("Pengumuman Terjadwal");

  const [addOpen, setAddOpen] = useState(false);
  const [formError, setFormError] = useState("");

  const [announcementForm, setAnnouncementForm] = useState({
    date: "",
    time: "",
    note: "",
    messageMode: "default-template",
    customMessage: "",
  });

  const dateRef = useRef(null);
  const datePickerRef = useRef(null);

  const announcements = useMemo(() => getActiveAnnouncements(schedule), [schedule]);

  const existingSlots = useMemo(() => {
    return new Set(
      announcements
        .map((item) => {
          const normalizedDate = normalizeAppDate(toDateKey(item));
          const normalizedTime = typeof item?.time === "string" ? item.time : "";
          if (!normalizedDate || !normalizedTime) {
            return "";
          }
          return `${normalizedDate}|${normalizedTime}`;
        })
        .filter(Boolean)
    );
  }, [announcements]);

  const normalizedDate = normalizeAppDate(announcementForm.date);
  const normalizedTime = announcementForm.time;
  const trimmedNote = announcementForm.note.trim();
  const trimmedCustomMessage = announcementForm.customMessage.trim();
  const todayInputValue = getTodayInputValue();
  const parsedSelectedDate = parseAppDate(normalizedDate);
  const parsedToday = parseAppDate(todayInputValue);
  const isPastDate = Boolean(
    parsedSelectedDate &&
      parsedToday &&
      parsedSelectedDate.getTime() < parsedToday.getTime()
  );
  const hasInvalidTimeFormat = Boolean(normalizedTime) && !TIME_PATTERN.test(normalizedTime);
  const noteTooLong = trimmedNote.length > NOTE_MAX_LENGTH;
  const customMessageTooLong =
    trimmedCustomMessage.length > CUSTOM_MESSAGE_MAX_LENGTH;
  const duplicateSlotKey =
    normalizedDate && normalizedTime ? `${normalizedDate}|${normalizedTime}` : "";
  const isDuplicate = !!duplicateSlotKey && existingSlots.has(duplicateSlotKey);
  const isDefaultModeSelected = announcementForm.messageMode === "default-template";
  const isCustomModeSelected = announcementForm.messageMode === "custom-message";
  const customMessageRequired = announcementForm.messageMode === "custom-message";
  const customMessageEmpty = !trimmedCustomMessage;
  const hasDraftChanges = Boolean(
    announcementForm.date ||
      announcementForm.time ||
      trimmedNote ||
      trimmedCustomMessage ||
      announcementForm.messageMode !== "default-template"
  );
  const isInvalid =
    !normalizedDate ||
    isPastDate ||
    !normalizedTime ||
    hasInvalidTimeFormat ||
    noteTooLong ||
    customMessageTooLong ||
    (customMessageRequired && customMessageEmpty);

  const clearForm = () => {
    setAnnouncementForm({
      date: "",
      time: "",
      note: "",
      messageMode: "default-template",
      customMessage: "",
    });
    setFormError("");
    setTimeout(() => dateRef.current?.focus(), 0);
  };

  const openCalendarPicker = () => {
    const picker = datePickerRef.current;
    if (!picker) return;
    if (typeof picker.showPicker === "function") {
      picker.showPicker();
      return;
    }
    picker.focus();
    picker.click();
  };

  const handleRemove = async (identifier) => {
    const target = announcements.find(
      (item) => item?.id === identifier || item?.date === normalizeAppDate(identifier)
    );

    const targetDate = target?.date || normalizeAppDate(identifier) || identifier;
    const formattedDate = formatAppDate(targetDate);
    const formattedTime = target?.time ? ` pukul ${target.time}` : "";

    const ok = await confirm({
      title: "Hapus pengumuman?",
      message: `Pengumuman pada tanggal ${formattedDate}${formattedTime} akan dihapus.`,
      confirmText: "Hapus",
      variant: "danger",
    });
    if (!ok) return;

    removeAnnouncementMutation.mutate(identifier, {
      onSuccess: () => addToast("Pengumuman terjadwal dihapus.", { type: "success" }),
      onError: (err) =>
        addToast(err?.message || "Gagal menghapus pengumuman terjadwal.", {
          type: "error",
        }),
    });
  };

  const handleOpenAdd = () => {
    setFormError("");
    clearForm();
    setAddOpen(true);
  };

  const handleCancelAdd = async () => {
    if (addAnnouncementMutation.isLoading) return;

    if (hasDraftChanges) {
      const ok = await confirm({
        title: "Batalkan penambahan?",
        message: "Perubahan yang belum disimpan akan hilang.",
        confirmText: "Ya, batalkan",
        variant: "warning",
      });
      if (!ok) return;
    }

    setAddOpen(false);
    clearForm();
  };

  const handleSubmitAdd = (e) => {
    e?.preventDefault?.();
    setFormError("");

    if (!normalizedDate || !isValidAppDate(announcementForm.date)) {
      setFormError("Format tanggal harus DD-MM-YYYY.");
      return;
    }
    if (isPastDate) {
      setFormError("Tanggal pengumuman tidak boleh di masa lalu.");
      return;
    }
    if (!normalizedTime) {
      setFormError("Waktu wajib diisi.");
      return;
    }
    if (hasInvalidTimeFormat) {
      setFormError("Format waktu harus HH:mm.");
      return;
    }
    if (noteTooLong) {
      setFormError(`Catatan maksimal ${NOTE_MAX_LENGTH} karakter.`);
      return;
    }
    if (customMessageTooLong) {
      setFormError(
        `Pesan custom maksimal ${CUSTOM_MESSAGE_MAX_LENGTH} karakter.`
      );
      return;
    }

    if (isDuplicate) {
      setFormError(
        "Pengumuman pada tanggal dan waktu tersebut sudah ada. Gunakan jam lain atau hapus data lama."
      );
      return;
    }

    if (customMessageRequired && customMessageEmpty) {
      setFormError("Pesan custom wajib diisi.");
      return;
    }

    if (isInvalid) return;

    addAnnouncementMutation.mutate(
      {
        date: normalizedDate,
        time: announcementForm.time,
        note: trimmedNote || null,
        messageMode: announcementForm.messageMode,
        customMessage: customMessageRequired
          ? trimmedCustomMessage
          : null,
      },
      {
        onSuccess: () => {
          addToast("Pengumuman terjadwal ditambahkan.", { type: "success" });
          setAddOpen(false);
          clearForm();
        },
        onError: (err) => {
          setFormError(err?.message || "Gagal menambahkan pengumuman terjadwal.");
        },
      }
    );
  };

  const announcementsCount = announcements.length || 0;

  return (
    <AdminLayout username={session?.user?.username} loading={sessionLoading}>
      <div className="ds-page-stack">
        <Card className="ds-surface-card ds-panel-stack">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h1 className="ds-page-title">Manajemen Pengumuman</h1>
              <p className="ds-body">
                Halaman untuk mengirimkan pengumuman atau pesan tambahan.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/35 px-3 py-1 text-xs font-semibold tracking-wide text-foreground">
                <Info className="h-3.5 w-3.5" />
                {announcementsCount} pesan
              </span>

              <Button
                onClick={handleOpenAdd}
                variant="primary"
                className="!border-sky-700 !bg-sky-600 !text-white hover:!bg-sky-700"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Tambah</span>
                <span className="sm:hidden">Tambah</span>
              </Button>
            </div>
          </div>

          <OverrideTable
            announcements={announcements}
            timezone={schedule?.timezone}
            onRemove={async (identifier) => handleRemove(identifier)}
          />

          {isFetching && (
            <p className="text-xs text-muted-foreground">Menyinkronkan jadwal...</p>
          )}
        </Card>
      </div>

      <Modal
        open={addOpen}
        onClose={handleCancelAdd}
        title="Tambah Pengumuman Terjadwal"
      >
        <form onSubmit={handleSubmitAdd} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="announcement-date">Tanggal</Label>
            <div className="relative">
              <Input
                id="announcement-date"
                ref={dateRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]{2}-[0-9]{2}-[0-9]{4}"
                title="Format tanggal: dd-mm-yyyy"
                placeholder="dd-mm-yyyy"
                maxLength={10}
                value={announcementForm.date}
                onChange={(e) =>
                  setAnnouncementForm((p) => ({
                    ...p,
                    date: sanitizeDateInput(e.target.value),
                  }))
                }
                required
                className="w-full rounded-lg border-border/70 bg-muted/35 pr-10"
              />
              <input
                ref={datePickerRef}
                type="date"
                tabIndex={-1}
                aria-hidden="true"
                min={todayInputValue}
                value={appDateToIso(announcementForm.date)}
                onChange={(e) =>
                  setAnnouncementForm((p) => ({
                    ...p,
                    date: normalizeAppDate(e.target.value),
                  }))
                }
                className="pointer-events-none absolute h-0 w-0 opacity-0"
              />
              <button
                type="button"
                onClick={openCalendarPicker}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted/40"
                aria-label="Pilih tanggal dari kalender"
                title="Pilih tanggal"
              >
                <CalendarIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="announcement-time">Waktu</Label>
            <Input
              id="announcement-time"
              type="time"
              value={announcementForm.time}
              onChange={(e) =>
                setAnnouncementForm((p) => ({ ...p, time: e.target.value }))
              }
              required
              className="w-full rounded-lg border-border/70 bg-muted/35"
            />
            {announcementForm.date && announcementForm.time && isDuplicate ? (
              <p className="text-xs text-destructive">
                Slot tanggal dan waktu tersebut sudah terpakai.
              </p>
            ) : null}
            {announcementForm.date && isPastDate ? (
              <p className="text-xs text-destructive">
                Tanggal tidak boleh di masa lalu.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Jenis Pesan</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                aria-pressed={isDefaultModeSelected}
                onClick={() =>
                  setAnnouncementForm((p) => ({ ...p, messageMode: "default-template" }))
                }
                className={`rounded-xl border px-3 py-3 text-left text-sm transition ${
                  isDefaultModeSelected
                    ? "border-primary/60 bg-primary/15 text-foreground ring-2 ring-primary/30"
                    : "border-border/70 bg-muted/30 text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="inline-flex items-center gap-2 font-semibold">
                  <FileText className="h-4 w-4" /> Templat bawaan
                </span>
                <p className="mt-1 text-xs opacity-80">
                  Menggunakan templat dari menu Templat.
                </p>
                {isDefaultModeSelected ? (
                  <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Aktif
                  </span>
                ) : null}
              </button>

              <button
                type="button"
                aria-pressed={isCustomModeSelected}
                onClick={() =>
                  setAnnouncementForm((p) => ({ ...p, messageMode: "custom-message" }))
                }
                className={`rounded-xl border px-3 py-3 text-left text-sm transition ${
                  isCustomModeSelected
                    ? "border-primary/60 bg-primary/15 text-foreground ring-2 ring-primary/30"
                    : "border-border/70 bg-muted/30 text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="inline-flex items-center gap-2 font-semibold">
                  <MessageSquare className="h-4 w-4" /> Pesan custom
                </span>
                <p className="mt-1 text-xs opacity-80">
                  Tulis pengumuman khusus untuk kejadian mendadak.
                </p>
                {isCustomModeSelected ? (
                  <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Aktif
                  </span>
                ) : null}
              </button>
            </div>
          </div>

          {announcementForm.messageMode === "custom-message" ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="announcement-custom-message">Pesan Custom</Label>
                {announcementForm.customMessage ? (
                  <button
                    type="button"
                    onClick={() =>
                      setAnnouncementForm((p) => ({ ...p, customMessage: "" }))
                    }
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted/35"
                    aria-label="Bersihkan pesan custom"
                  >
                    <X className="h-3.5 w-3.5" /> Bersihkan
                  </button>
                ) : null}
              </div>
              <textarea
                id="announcement-custom-message"
                value={announcementForm.customMessage}
                onChange={(e) =>
                  setAnnouncementForm((p) => ({
                    ...p,
                    customMessage: e.target.value,
                  }))
                }
                placeholder="Contoh: Halo {name}, hari ini ada rapat koordinasi pukul 14:00 di ruang rapat utama."
                className="min-h-[120px] w-full rounded-lg border border-border/70 bg-muted/35 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                required
              />
              <p className="text-xs text-muted-foreground">
                Anda bisa pakai placeholder <code>{"{name}"}</code> dan <code>{"{quote}"}</code>.
              </p>
              <p
                className={`text-xs ${
                  customMessageTooLong ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                {trimmedCustomMessage.length}/{CUSTOM_MESSAGE_MAX_LENGTH} karakter
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="announcement-note">Catatan (opsional)</Label>
              {announcementForm.note && (
                <button
                  type="button"
                  onClick={() => setAnnouncementForm((p) => ({ ...p, note: "" }))}
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted/35"
                  aria-label="Bersihkan catatan"
                >
                  <X className="h-3.5 w-3.5" /> Bersihkan
                </button>
              )}
            </div>
            <Input
              id="announcement-note"
              placeholder="Misal: Rapat koordinasi mendadak"
              value={announcementForm.note}
              onChange={(e) =>
                setAnnouncementForm((p) => ({ ...p, note: e.target.value }))
              }
              className="rounded-lg border-border/70 bg-muted/35"
            />
            <p
              className={`text-xs ${
                noteTooLong ? "text-destructive" : "text-muted-foreground"
              }`}
            >
              {trimmedNote.length}/{NOTE_MAX_LENGTH} karakter
            </p>
          </div>

          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

          <div className="mt-2 flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              outline
              onClick={handleCancelAdd}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="!border-sky-700 !bg-sky-600 !text-white hover:!bg-sky-700"
              loading={addAnnouncementMutation.isLoading}
              loadingText="Menyimpan..."
              disabled={
                isInvalid || isDuplicate || addAnnouncementMutation.isLoading
              }
            >
              {addAnnouncementMutation.isLoading ? null : (
                <>
                  <Plus className="h-4 w-4" /> Tambah
                </>
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  );
}
