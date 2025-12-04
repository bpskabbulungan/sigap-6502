import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../queries/auth";
import { useAdminCalendar, useUpdateAdminCalendar } from "../queries/calendar";
import { AdminLayout } from "../components/layout/AdminLayout";
import { Card } from "../components/ui/Card";
import { Label } from "../components/ui/Label";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";
import { Modal } from "../components/ui/Modal";
import { Trash } from "../components/ui/icons";
import { useToast } from "../components/ui/ToastProvider.jsx";
import { useConfirm } from "../components/ui/ConfirmProvider.jsx";
import {
  Plus,
  CalendarDays,
  CalendarX,
  Calendar as CalendarIcon,
} from "lucide-react";
import clsx from "clsx";
import { useDocumentTitle } from "../utils/useDocumentTitle.js";
import {
  compareAppDates,
  isValidAppDate,
  normalizeAppDate,
  parseAppDate,
} from "../lib/dateFormatter";

const ID_FMT = new Intl.DateTimeFormat("id-ID", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const accentActionButtonClasses = clsx(
  "inline-flex items-center gap-2 rounded-lg px-4 py-2",
  "bg-sky-600 text-on-accent hover:bg-sky-500",
  "border border-sky-400/30 shadow-lg shadow-sky-600/20",
  "disabled:opacity-60"
);

function sanitizeInput(value) {
  return value.replace(/[/.]/g, "-").slice(0, 10);
}

function formatID(d) {
  try {
    const parsed = parseAppDate(d);
    return parsed ? ID_FMT.format(parsed) : d;
  } catch {
    return d;
  }
}
function relativeLabel(d) {
  try {
    const dt = parseAppDate(d);
    if (!dt) return "";
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const diff = Math.round((dt.getTime() - today.getTime()) / 86400000); // hari
    if (diff === 0) return "Hari ini";
    if (diff === 1) return "Besok";
    if (diff === -1) return "Kemarin";
    if (diff > 1) return `${diff} hari lagi`;
    return `${Math.abs(diff)} hari lalu`;
  } catch {
    return "";
  }
}

export default function AdminHolidaysPage() {
  const { add: addToast } = useToast();
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  const { data: session, isLoading: sessionLoading } = useSession();

  const {
    data: calendarResponse,
    isLoading: calendarLoading,
    isFetching: calendarFetching,
  } = useAdminCalendar();
  const updateMutation = useUpdateAdminCalendar();

  useDocumentTitle("Kalender Libur");

  const calendar = calendarResponse?.calendar;

  const [holidays, setHolidays] = useState([]);
  const [jointLeaves, setJointLeaves] = useState([]);
  const [holidayInput, setHolidayInput] = useState("");
  const [jointLeaveInput, setJointLeaveInput] = useState("");
  const [formError, setFormError] = useState("");
  const [activeTab, setActiveTab] = useState("holidays"); // 'holidays' | 'joint'
  const [addOpen, setAddOpen] = useState(false);
  const [holidaysPage, setHolidaysPage] = useState(1);
  const [jointPage, setJointPage] = useState(1);
  const pageSize = 10;

  const addInputRef = useRef(null);

  useEffect(() => {
    if (!sessionLoading && !session?.authenticated) {
      navigate("/admin/login", { replace: true });
    }
  }, [session, sessionLoading, navigate]);

  useEffect(() => {
    if (calendar) {
      const normalizedHolidays = (calendar.LIBURAN ?? [])
        .map(normalizeAppDate)
        .filter(Boolean)
        .sort(compareAppDates);
      const normalizedJoint = (calendar.CUTI_BERSAMA ?? [])
        .map(normalizeAppDate)
        .filter(Boolean)
        .sort(compareAppDates);
      setHolidays(normalizedHolidays);
      setJointLeaves(normalizedJoint);
      setHolidayInput("");
      setJointLeaveInput("");
      setFormError("");
      updateMutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarResponse?.calendar]);

  const pushSortedUnique = (list, setter, value) => {
    const normalized = normalizeAppDate(value);
    if (!normalized || !isValidAppDate(normalized)) {
      setFormError("Format tanggal tidak valid. Gunakan DD-MM-YYYY.");
      return null;
    }
    if (list.includes(normalized)) {
      setFormError("Tanggal tersebut sudah ada di daftar.");
      return null;
    }
    const next = [...list, normalized].sort(compareAppDates);
    setter(next);
    setFormError("");
    return next;
  };

  const persistCalendar = (nextHolidays, nextJointLeaves, successMessage) => {
    setFormError("");
    updateMutation.reset();
    updateMutation.mutate(
      { LIBURAN: [...nextHolidays], CUTI_BERSAMA: [...nextJointLeaves] },
      {
        onSuccess: () => {
          if (successMessage) {
            addToast(successMessage, { type: "success" });
          }
        },
        onError: (err) => {
          const message = err?.message || "Gagal menyimpan kalender.";
          addToast(message, { type: "error" });
        },
      }
    );
  };

  const handleAddHoliday = () => {
    const next = pushSortedUnique(holidays, setHolidays, holidayInput);
    if (!next) return false;
    setHolidayInput("");
    persistCalendar(next, jointLeaves, "Tanggal libur ditambahkan.");
    return true;
  };

  const handleAddJointLeave = () => {
    const next = pushSortedUnique(jointLeaves, setJointLeaves, jointLeaveInput);
    if (!next) return false;
    setJointLeaveInput("");
    persistCalendar(holidays, next, "Tanggal cuti bersama ditambahkan.");
    return true;
  };

  const handleRemoveHoliday = async (date) => {
    const ok = await confirm({
      title: "Hapus hari libur?",
      message: `Tanggal ${formatID(date)} akan dihapus.`,
      confirmText: "Hapus",
      variant: "danger",
    });
    if (!ok) return;
    setFormError("");
    const next = holidays.filter((d) => d !== date);
    setHolidays(next);
    persistCalendar(next, jointLeaves, "Tanggal libur dihapus dari daftar.");
  };

  const handleRemoveJointLeave = async (date) => {
    const ok = await confirm({
      title: "Hapus cuti bersama?",
      message: `Tanggal ${formatID(date)} akan dihapus.`,
      confirmText: "Hapus",
      variant: "danger",
    });
    if (!ok) return;
    setFormError("");
    const next = jointLeaves.filter((d) => d !== date);
    setJointLeaves(next);
    persistCalendar(holidays, next, "Tanggal cuti bersama dihapus dari daftar.");
  };

  const handleCancelAdd = async () => {
    const ok = await confirm({
      title: "Tutup formulir?",
      message: "Perubahan yang belum disimpan akan hilang.",
      confirmText: "Tutup",
      variant: "warning",
    });
    if (!ok) return;
    setAddOpen(false);
    setHolidayInput("");
    setJointLeaveInput("");
  };

  const isCalendarPending = calendarLoading && !calendar;

  // pagination helpers
  const paginate = (arr, page, size) =>
    arr.slice((page - 1) * size, (page - 1) * size + size);
  const holidaysPageCount = Math.max(1, Math.ceil(holidays.length / pageSize));
  const jointPageCount = Math.max(1, Math.ceil(jointLeaves.length / pageSize));

  return (
    <AdminLayout username={session?.user?.username} loading={sessionLoading}>
      <div className="space-y-8">
        <Card
          className="relative space-y-6 border-white/10 bg-gradient-to-br from-slate-900/70 to-slate-800/70 p-0 backdrop-blur-xl"
          header={
            <div className="flex items-center justify-between px-6 py-4">
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold text-white">
                  Pengaturan Kalender
                </h1>
                <p className="text-sm text-slate-400">
                  Kelola tanggal Hari Libur dan Cuti Bersama.
                </p>
              </div>

              <Button
                onClick={() => {
                  setAddOpen(true);
                  setTimeout(() => addInputRef.current?.focus(), 0);
                }}
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
          }
        >
          {/* fetching overlay saat refetch */}
          {calendarFetching && (
            <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-2xl bg-slate-900/30 backdrop-blur-[1px]">
              <Spinner />
            </div>
          )}

          {isCalendarPending ? (
            <div className="flex items-center gap-3 px-6 pb-6 text-slate-300">
              <Spinner /> Memuat data kalender...
            </div>
          ) : (
            <div className="space-y-8 px-6 pb-6">
              {/* Tabs */}
              <div className="inline-flex w-full items-center gap-1 rounded-xl border border-white/10 bg-slate-950/60 p-1 text-sm">
                <button
                  type="button"
                  onClick={() => setActiveTab("holidays")}
                  className={`flex-1 rounded-lg px-4 py-2 ${
                    activeTab === "holidays"
                      ? "bg-primary-500/20 font-semibold text-white shadow-inner shadow-primary-500/20 [.theme-light_&]:bg-primary-500/15 [.theme-light_&]:text-slate-900"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    Hari Libur
                    <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[10px] [.theme-light_&]:text-slate-900">
                      {holidays.length}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("joint")}
                  className={`flex-1 rounded-lg px-4 py-2 ${
                    activeTab === "joint"
                      ? "bg-primary-500/20 font-semibold text-white shadow-inner shadow-primary-500/20 [.theme-light_&]:bg-primary-500/15 [.theme-light_&]:text-slate-900"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <CalendarX className="h-4 w-4" />
                    Cuti Bersama
                    <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[10px] [.theme-light_&]:text-slate-900">
                      {jointLeaves.length}
                    </span>
                  </span>
                </button>
              </div>

              {/* Lists */}
              {activeTab === "holidays" ? (
                <div className="space-y-3">
                  <Label>Daftar Hari Libur</Label>
                  <ul className="space-y-2">
                    {holidays.length === 0 ? (
                      <li className="rounded-xl border border-dashed border-white/10 bg-slate-950/40 p-4 text-sm text-slate-400">
                        Belum ada tanggal yang terdaftar.
                      </li>
                    ) : (
                      paginate(holidays, holidaysPage, pageSize).map((date) => {
                        const rel = relativeLabel(date);
                        const isToday = rel === "Hari ini";
                        const isFuture = !isToday && rel.endsWith("lagi");
                        return (
                          <li
                            key={date}
                            className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm"
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-medium text-slate-100">
                                {formatID(date)}
                              </span>
                              <span
                                className={clsx(
                                  "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide border",
                                  isToday
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 [.theme-dark_&]:bg-emerald-500/15 [.theme-dark_&]:text-emerald-200 [.theme-dark_&]:border-emerald-400/30"
                                    : isFuture
                                    ? "bg-sky-50 text-sky-700 border-sky-200 [.theme-dark_&]:bg-sky-500/15 [.theme-dark_&]:text-sky-200 [.theme-dark_&]:border-sky-400/30"
                                    : "bg-slate-100 text-slate-700 border-slate-200 [.theme-dark_&]:bg-slate-500/15 [.theme-dark_&]:text-slate-200 [.theme-dark_&]:border-slate-400/30"
                                )}
                              >
                                {rel}
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="danger"
                              outline
                              iconOnly
                              onClick={() => handleRemoveHoliday(date)}
                              aria-label="Hapus hari libur"
                              title="Hapus"
                              className="
    hover:bg-rose-500/10
    focus-visible:ring-2 focus-visible:ring-rose-300/60
    focus-visible:ring-offset-2 focus-visible:ring-offset-white
    [.theme-dark_&]:focus-visible:ring-offset-slate-900
  "
                            >
                              <Trash className="h-5 w-5 text-rose-600 [.theme-dark_&]:text-rose-300" />
                              <span className="sr-only">Hapus hari libur</span>
                            </Button>
                          </li>
                        );
                      })
                    )}
                  </ul>

                  {holidays.length > pageSize && (
                    <div className="flex items-center justify-between pt-2 text-xs text-slate-400">
                      <span>
                        Menampilkan{" "}
                        {Math.min(
                          (holidaysPage - 1) * pageSize + 1,
                          holidays.length
                        )}
                        –{Math.min(holidaysPage * pageSize, holidays.length)}{" "}
                        dari {holidays.length}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setHolidaysPage(1)}
                          disabled={holidaysPage <= 1}
                        >
                          « Awal
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            setHolidaysPage((p) => Math.max(1, p - 1))
                          }
                          disabled={holidaysPage <= 1}
                        >
                          Sebelumnya
                        </Button>
                        <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1">
                          Hal {holidaysPage} / {holidaysPageCount}
                        </span>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            setHolidaysPage((p) =>
                              Math.min(holidaysPageCount, p + 1)
                            )
                          }
                          disabled={holidaysPage >= holidaysPageCount}
                        >
                          Berikutnya
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setHolidaysPage(holidaysPageCount)}
                          disabled={holidaysPage >= holidaysPageCount}
                        >
                          Akhir »
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <Label>Daftar Cuti Bersama</Label>
                  <ul className="space-y-2">
                    {jointLeaves.length === 0 ? (
                      <li className="rounded-xl border border-dashed border-white/10 bg-slate-950/40 p-4 text-sm text-slate-400">
                        Belum ada tanggal yang terdaftar.
                      </li>
                    ) : (
                      paginate(jointLeaves, jointPage, pageSize).map((date) => {
                        const rel = relativeLabel(date);
                        const isToday = rel === "Hari ini";
                        const isFuture = !isToday && rel.endsWith("lagi");
                        return (
                          <li
                            key={date}
                            className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm"
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-medium text-slate-100">
                                {formatID(date)}
                              </span>
                              <span
                                className={clsx(
                                  "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide border",
                                  isToday
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 [.theme-dark_&]:bg-emerald-500/15 [.theme-dark_&]:text-emerald-200 [.theme-dark_&]:border-emerald-400/30"
                                    : isFuture
                                    ? "bg-sky-50 text-sky-700 border-sky-200 [.theme-dark_&]:bg-sky-500/15 [.theme-dark_&]:text-sky-200 [.theme-dark_&]:border-sky-400/30"
                                    : "bg-slate-100 text-slate-700 border-slate-200 [.theme-dark_&]:bg-slate-500/15 [.theme-dark_&]:text-slate-200 [.theme-dark_&]:border-slate-400/30"
                                )}
                              >
                                {rel}
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="danger"
                              outline
                              iconOnly
                              onClick={() => handleRemoveJointLeave(date)}
                              aria-label="Hapus cuti bersama"
                              title="Hapus"
                              className="
    hover:bg-rose-500/10
    focus-visible:ring-2 focus-visible:ring-rose-300/60
    focus-visible:ring-offset-2 focus-visible:ring-offset-white
    [.theme-dark_&]:focus-visible:ring-offset-slate-900
  "
                            >
                              <Trash className="h-5 w-5 text-rose-600 [.theme-dark_&]:text-rose-300" />
                              <span className="sr-only">
                                Hapus cuti bersama
                              </span>
                            </Button>
                          </li>
                        );
                      })
                    )}
                  </ul>

                  {jointLeaves.length > pageSize && (
                    <div className="flex items-center justify-between pt-2 text-xs text-slate-400">
                      <span>
                        Menampilkan{" "}
                        {Math.min(
                          (jointPage - 1) * pageSize + 1,
                          jointLeaves.length
                        )}
                        –{Math.min(jointPage * pageSize, jointLeaves.length)}{" "}
                        dari {jointLeaves.length}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setJointPage(1)}
                          disabled={jointPage <= 1}
                        >
                          « Awal
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            setJointPage((p) => Math.max(1, p - 1))
                          }
                          disabled={jointPage <= 1}
                        >
                          Sebelumnya
                        </Button>
                        <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1">
                          Hal {jointPage} / {jointPageCount}
                        </span>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            setJointPage((p) => Math.min(jointPageCount, p + 1))
                          }
                          disabled={jointPage >= jointPageCount}
                        >
                          Berikutnya
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setJointPage(jointPageCount)}
                          disabled={jointPage >= jointPageCount}
                        >
                          Akhir »
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Pesan validasi */}
              <div className="space-y-3">
                {formError ? (
                  <p className="text-sm text-rose-300">{formError}</p>
                ) : null}
                {updateMutation.error ? (
                  <p className="text-sm text-rose-300">
                    {updateMutation.error.message}
                  </p>
                ) : null}
              </div>
            </div>
          )}
        </Card>

        {/* Modal tambah tanggal */}
        <Modal
          open={addOpen}
          onClose={handleCancelAdd}
          title={
            activeTab === "holidays"
              ? "Tambah Hari Libur"
              : "Tambah Cuti Bersama"
          }
          footer={
            <>
              <Button variant="danger" outline onClick={handleCancelAdd}>
                Batal
              </Button>
              <Button
                onClick={() => {
                  const ok =
                    activeTab === "holidays"
                      ? handleAddHoliday()
                      : handleAddJointLeave();
                  if (ok) setAddOpen(false);
                }}
                disabled={
                  (activeTab === "holidays"
                    ? !holidayInput
                    : !jointLeaveInput) || updateMutation.isLoading
                }
                className={accentActionButtonClasses}
              >
                <Plus className="h-4 w-4" />
                Tambah
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Label htmlFor="date-input">Tanggal</Label>

            {/* input + tombol pemilih kalender */}
            <div className="relative">
              <Input
                id="date-input"
                ref={addInputRef}
                type="text"
                inputMode="numeric"
                pattern="\\d{2}-\\d{2}-\\d{4}"
                placeholder="dd-mm-yyyy"
                maxLength={10}
                value={
                  activeTab === "holidays" ? holidayInput : jointLeaveInput
                }
                onChange={(e) =>
                  activeTab === "holidays"
                    ? setHolidayInput(sanitizeInput(e.target.value))
                    : setJointLeaveInput(sanitizeInput(e.target.value))
                }
                required
                className="hide-native-date-icon rounded-lg border-slate-700 bg-slate-900/60 pr-10"
              />
              <button
                type="button"
                aria-label="Pilih tanggal dari kalender"
                title="Pilih tanggal"
                onClick={() => {
                  const el = addInputRef.current;
                  if (el?.showPicker) el.showPicker();
                  else el?.focus();
                }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5
                   text-slate-600 hover:bg-slate-900/5
                   [.theme-dark_&]:text-slate-200 [.theme-dark_&]:hover:bg-white/10"
              >
                <CalendarIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </AdminLayout>
  );
}
