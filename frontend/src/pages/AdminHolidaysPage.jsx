import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import {
  Calendar as CalendarIcon,
  CalendarDays,
  CalendarX,
  ChevronLeft,
  ChevronRight,
  Flag,
  Briefcase,
  Plus,
  Save,
} from "lucide-react";
import { useSession } from "../queries/auth";
import { useAdminCalendar, useUpdateAdminCalendar } from "../queries/calendar";
import { AdminLayout } from "../components/layout/AdminLayout";
import { QueryErrorNotice } from "../components/error/QueryErrorNotice";
import { Card } from "../components/ui/Card";
import { Label } from "../components/ui/Label";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";
import { Modal } from "../components/ui/Modal";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { Trash } from "../components/ui/icons";
import { useToast } from "../components/ui/ToastProvider.jsx";
import { useConfirm } from "../components/ui/ConfirmProvider.jsx";
import { useDocumentTitle } from "../utils/useDocumentTitle.js";
import {
  compareAppDates,
  isValidAppDate,
  normalizeAppDate,
  parseAppDate,
} from "../lib/dateFormatter";

const DAY_MS = 86_400_000;
const MONTH_FMT = new Intl.DateTimeFormat("id-ID", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const SHORT_DATE_FMT = new Intl.DateTimeFormat("id-ID", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const FULL_DATE_FMT = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const SHORT_WEEKDAY_FMT = new Intl.DateTimeFormat("id-ID", {
  weekday: "short",
  timeZone: "UTC",
});
const WEEKDAY_LABELS = Array.from({ length: 7 }, (_, index) =>
  SHORT_WEEKDAY_FMT.format(new Date(Date.UTC(2024, 0, index + 1)))
);

const EVENT_META = {
  holiday: {
    label: "Hari Libur Nasional",
    shortLabel: "Libur",
    dotClass: "bg-rose-500/90",
    chipClass:
      "border-rose-200/90 bg-rose-50 text-foreground dark:border-rose-500/35 dark:bg-rose-500/16 dark:text-rose-200",
    cellClass:
      "border-rose-200/80 bg-rose-50/80 dark:border-rose-500/35 dark:bg-rose-500/12",
  },
  joint: {
    label: "Cuti Bersama",
    shortLabel: "Cuti",
    dotClass: "bg-indigo-500/90",
    chipClass:
      "border-indigo-200/90 bg-indigo-50 text-foreground dark:border-indigo-500/35 dark:bg-indigo-500/16 dark:text-indigo-200",
    cellClass:
      "border-indigo-200/80 bg-indigo-50/80 dark:border-indigo-500/35 dark:bg-indigo-500/12",
  },
  other: {
    label: "Akhir Pekan",
    shortLabel: "Akhir pekan",
    dotClass: "bg-slate-500/85",
    chipClass:
      "border-slate-300/90 bg-slate-100 text-slate-900 dark:border-slate-500/35 dark:bg-slate-500/14 dark:text-slate-200",
    cellClass: "",
  },
};

const CALENDAR_SUBTLE_TEXT = "text-foreground/85 dark:text-slate-200";
const CALENDAR_MUTED_TEXT = "text-foreground/75 dark:text-slate-300";
const CALENDAR_TEXT_STRONG_STYLE = { color: "hsl(var(--foreground))" };
const CALENDAR_TEXT_SOFT_STYLE = { color: "hsl(var(--foreground) / 0.9)" };
const CALENDAR_TEXT_MUTED_STYLE = { color: "hsl(var(--foreground) / 0.84)" };
const ADD_BUTTON_BLUE_CLASS =
  "!border-sky-700 !bg-sky-600 !text-white hover:!bg-sky-700 [&_svg]:!text-white";
const DELETE_BUTTON_RED_CLASS =
  "!border-red-700 !bg-red-600 !text-white hover:!bg-red-700 [&_svg]:!text-white";

function capitalizeLabel(value = "") {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
}

function formatShortDate(appDate) {
  const parsed = parseAppDate(appDate);
  if (!parsed) return appDate;
  return capitalizeLabel(SHORT_DATE_FMT.format(parsed));
}

function formatFullDate(appDate) {
  const parsed = parseAppDate(appDate);
  if (!parsed) return appDate;
  return capitalizeLabel(FULL_DATE_FMT.format(parsed));
}

function toIsoDate(appDate) {
  const parsed = parseAppDate(appDate);
  if (!parsed) return "";
  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const day = String(parsed.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfUtcDay(date = new Date()) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

function startOfUtcMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addUtcDays(date, amount) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + amount)
  );
}

function addUtcMonths(date, amount) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1));
}

function toAppDate(date) {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = String(date.getUTCFullYear());
  return `${day}-${month}-${year}`;
}

function relativeLabel(appDate) {
  const parsed = parseAppDate(appDate);
  if (!parsed) return "";
  const today = startOfUtcDay();
  const diff = Math.round((parsed.getTime() - today.getTime()) / DAY_MS);
  if (diff === 0) return "Hari ini";
  if (diff === 1) return "Besok";
  if (diff === -1) return "Kemarin";
  if (diff > 1) return `${diff} hari lagi`;
  return `${Math.abs(diff)} hari lalu`;
}

function buildMonthCells(visibleMonth) {
  const monthStart = startOfUtcMonth(visibleMonth);
  const monthIndex = monthStart.getUTCMonth();
  const year = monthStart.getUTCFullYear();
  const offsetFromMonday = (monthStart.getUTCDay() + 6) % 7;
  const gridStart = addUtcDays(monthStart, -offsetFromMonday);

  return Array.from({ length: 42 }, (_, index) => {
    const currentDate = addUtcDays(gridStart, index);
    const currentKey = toAppDate(currentDate);
    return {
      dateKey: currentKey,
      dayNumber: currentDate.getUTCDate(),
      inMonth:
        currentDate.getUTCMonth() === monthIndex &&
        currentDate.getUTCFullYear() === year,
    };
  });
}

function isWeekend(appDate) {
  const parsed = parseAppDate(appDate);
  if (!parsed) return false;
  const day = parsed.getUTCDay();
  return day === 0 || day === 6;
}

function getDateEvents(appDate, holidaySet, jointSet) {
  const events = [];
  if (holidaySet.has(appDate)) events.push({ type: "holiday" });
  if (jointSet.has(appDate)) events.push({ type: "joint" });
  if (!events.length && isWeekend(appDate)) events.push({ type: "other" });
  return events;
}

function resolveCellTone(events) {
  if (events.some((event) => event.type === "holiday")) {
    return EVENT_META.holiday.cellClass;
  }
  if (events.some((event) => event.type === "joint")) {
    return EVENT_META.joint.cellClass;
  }
  return "";
}

function EventBadge({ type, compact = false }) {
  const meta = EVENT_META[type];
  if (!meta) return null;

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border font-medium",
        compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        meta.chipClass
      )}
      style={CALENDAR_TEXT_SOFT_STYLE}
    >
      <span className={clsx("h-1.5 w-1.5 rounded-full", meta.dotClass)} aria-hidden />
      {compact ? meta.shortLabel : meta.label}
    </span>
  );
}

function ListSection({
  title,
  subtitle,
  icon,
  dates,
  badgeType,
  selectedDate,
  onSelectDate,
  onRemoveDate,
  busy,
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground sm:text-base">{title}</h3>
          <p className={clsx("text-xs", CALENDAR_SUBTLE_TEXT)} style={CALENDAR_TEXT_SOFT_STYLE}>
            {subtitle}
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/35 px-3 py-1 text-xs font-semibold text-foreground">
          {icon}
          {dates.length}
        </span>
      </div>

      {dates.length === 0 ? (
        <EmptyState
          title="Belum ada data"
          description="Tambahkan tanggal baru agar kalender lebih informatif."
          icon={icon}
          size="sm"
          className="px-4 py-8"
        />
      ) : (
        <ul className="max-h-[22rem] space-y-2 overflow-auto pr-1">
          {dates.map((date) => {
            const rel = relativeLabel(date);
            const active = selectedDate === date;
            return (
              <li
                key={date}
                className={clsx(
                  "group flex items-center gap-2 rounded-xl border p-2 transition-colors",
                  active
                    ? "border-primary/45 bg-primary/8"
                    : "border-border/70 bg-muted/25 hover:border-primary/35 hover:bg-muted/45"
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelectDate(date)}
                  className="min-w-0 flex-1 text-left"
                  title="Lihat di kalender"
                >
                  <p className="truncate text-sm font-medium text-foreground">
                    {formatShortDate(date)}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <EventBadge type={badgeType} compact />
                    {rel ? (
                      <span
                        className={clsx(
                          "rounded-full border border-border/70 bg-muted/35 px-2 py-0.5 text-[11px]",
                          CALENDAR_MUTED_TEXT
                        )}
                        style={CALENDAR_TEXT_MUTED_STYLE}
                      >
                        {rel}
                      </span>
                    ) : null}
                  </div>
                </button>

                <Button
                  type="button"
                  variant="destructive"
                  iconOnly
                  size="sm"
                  onClick={() => onRemoveDate(date)}
                  disabled={busy}
                  aria-label={`Hapus ${title.toLowerCase()}`}
                  title="Hapus"
                  className="shrink-0"
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default function AdminHolidaysPage() {
  const { add: addToast } = useToast();
  const { confirm } = useConfirm();
  const { data: session, isLoading: sessionLoading } = useSession();

  const {
    data: calendarResponse,
    isLoading: calendarLoading,
    isFetching: calendarFetching,
    error: calendarError,
    refetch,
  } = useAdminCalendar();
  const updateMutation = useUpdateAdminCalendar();

  useDocumentTitle("Kalender Libur");

  const todayAppDate = useMemo(() => toAppDate(startOfUtcDay()), []);
  const [holidays, setHolidays] = useState([]);
  const [jointLeaves, setJointLeaves] = useState([]);
  const [selectedDate, setSelectedDate] = useState(todayAppDate);
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfUtcMonth(startOfUtcDay())
  );
  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState("holiday"); // holiday | joint
  const [addDateInput, setAddDateInput] = useState("");
  const [formError, setFormError] = useState("");
  const addInputRef = useRef(null);

  useEffect(() => {
    const calendar = calendarResponse?.calendar;
    if (!calendar) return;
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
    setFormError("");
    setAddDateInput("");
    updateMutation.reset();
  }, [calendarResponse?.calendar]); // eslint-disable-line react-hooks/exhaustive-deps

  const holidaySet = useMemo(() => new Set(holidays), [holidays]);
  const jointSet = useMemo(() => new Set(jointLeaves), [jointLeaves]);
  const monthCells = useMemo(() => buildMonthCells(visibleMonth), [visibleMonth]);
  const selectedEvents = useMemo(
    () => getDateEvents(selectedDate, holidaySet, jointSet),
    [selectedDate, holidaySet, jointSet]
  );
  const monthAgenda = useMemo(() => {
    return monthCells
      .filter((cell) => cell.inMonth)
      .map((cell) => ({
        date: cell.dateKey,
        events: getDateEvents(cell.dateKey, holidaySet, jointSet),
      }))
      .filter((entry) => entry.events.length > 0);
  }, [monthCells, holidaySet, jointSet]);

  const monthLabel = MONTH_FMT.format(visibleMonth);
  const isCalendarPending = calendarLoading && !calendarResponse?.calendar;
  const isMutating = updateMutation.isLoading;
  const selectedIsHoliday = holidaySet.has(selectedDate);
  const selectedIsJoint = jointSet.has(selectedDate);

  const nextSpecialEvent = useMemo(() => {
    const merged = [
      ...holidays.map((date) => ({ date, type: "holiday" })),
      ...jointLeaves.map((date) => ({ date, type: "joint" })),
    ].sort((a, b) => compareAppDates(a.date, b.date));

    const today = parseAppDate(todayAppDate);
    if (!today) return merged[0] ?? null;

    return (
      merged.find((item) => {
        const parsed = parseAppDate(item.date);
        return parsed ? parsed.getTime() >= today.getTime() : false;
      }) ??
      merged[merged.length - 1] ??
      null
    );
  }, [holidays, jointLeaves, todayAppDate]);

  const monthSpecialCount = useMemo(() => {
    const monthStart = startOfUtcMonth(visibleMonth);
    const month = monthStart.getUTCMonth();
    const year = monthStart.getUTCFullYear();

    const countInMonth = (arr) =>
      arr.reduce((acc, date) => {
        const parsed = parseAppDate(date);
        if (!parsed) return acc;
        if (
          parsed.getUTCFullYear() === year &&
          parsed.getUTCMonth() === month
        ) {
          return acc + 1;
        }
        return acc;
      }, 0);

    return {
      holiday: countInMonth(holidays),
      joint: countInMonth(jointLeaves),
      all: countInMonth(holidays) + countInMonth(jointLeaves),
    };
  }, [visibleMonth, holidays, jointLeaves]);

  const openAddModal = (type = "holiday", seedDate = selectedDate) => {
    const normalizedSeed = normalizeAppDate(seedDate) || todayAppDate;
    setAddType(type);
    setAddDateInput(normalizedSeed);
    setFormError("");
    setAddOpen(true);
    setTimeout(() => addInputRef.current?.focus(), 0);
  };

  const focusDate = (date) => {
    const normalized = normalizeAppDate(date);
    if (!normalized) return;
    setSelectedDate(normalized);
    const parsed = parseAppDate(normalized);
    if (parsed) setVisibleMonth(startOfUtcMonth(parsed));
  };

  const persistCalendar = (
    nextHolidays,
    nextJointLeaves,
    rollbackState,
    successMessage
  ) => {
    setFormError("");
    updateMutation.reset();
    setHolidays(nextHolidays);
    setJointLeaves(nextJointLeaves);

    updateMutation.mutate(
      { LIBURAN: [...nextHolidays], CUTI_BERSAMA: [...nextJointLeaves] },
      {
        onSuccess: () => {
          if (successMessage) addToast(successMessage, { type: "success" });
        },
        onError: (err) => {
          setHolidays(rollbackState.holidays);
          setJointLeaves(rollbackState.jointLeaves);
          const message = err?.message || "Gagal menyimpan kalender.";
          setFormError(message);
          addToast(message, { type: "error" });
        },
      }
    );
  };

  const addDateToCalendar = (type, rawDate, successMessage) => {
    const normalized = normalizeAppDate(rawDate);
    if (!normalized || !isValidAppDate(normalized)) {
      setFormError("Format tanggal tidak valid. Gunakan DD-MM-YYYY.");
      return false;
    }

    const rollback = {
      holidays: [...holidays],
      jointLeaves: [...jointLeaves],
    };

    if (type === "holiday") {
      if (holidaySet.has(normalized)) {
        setFormError("Tanggal tersebut sudah ada di daftar hari libur.");
        return false;
      }
      if (jointSet.has(normalized)) {
        setFormError("Tanggal tersebut sudah terdaftar sebagai cuti bersama.");
        return false;
      }
      const nextHolidays = [...holidays, normalized].sort(compareAppDates);
      persistCalendar(nextHolidays, jointLeaves, rollback, successMessage);
    } else {
      if (jointSet.has(normalized)) {
        setFormError("Tanggal tersebut sudah ada di daftar cuti bersama.");
        return false;
      }
      if (holidaySet.has(normalized)) {
        setFormError("Tanggal tersebut sudah terdaftar sebagai hari libur.");
        return false;
      }
      const nextJointLeaves = [...jointLeaves, normalized].sort(compareAppDates);
      persistCalendar(holidays, nextJointLeaves, rollback, successMessage);
    }

    focusDate(normalized);
    return true;
  };

  const handleRemoveDate = async (type, date) => {
    const isHoliday = type === "holiday";
    const ok = await confirm({
      title: isHoliday ? "Hapus hari libur?" : "Hapus cuti bersama?",
      message: `Tanggal ${formatShortDate(date)} akan dihapus.`,
      confirmText: "Hapus",
      variant: "danger",
    });
    if (!ok) return;

    const rollback = {
      holidays: [...holidays],
      jointLeaves: [...jointLeaves],
    };
    const nextHolidays = isHoliday
      ? holidays.filter((entry) => entry !== date)
      : holidays;
    const nextJointLeaves = isHoliday
      ? jointLeaves
      : jointLeaves.filter((entry) => entry !== date);

    persistCalendar(
      nextHolidays,
      nextJointLeaves,
      rollback,
      isHoliday
        ? "Tanggal libur dihapus dari daftar."
        : "Tanggal cuti bersama dihapus dari daftar."
    );
  };

  const handleCancelAdd = async () => {
    const hasUnsaved = addDateInput && addDateInput !== selectedDate;
    if (!hasUnsaved) {
      setAddOpen(false);
      return;
    }

    const ok = await confirm({
      title: "Tutup formulir?",
      message: "Perubahan tanggal yang belum disimpan akan hilang.",
      confirmText: "Tutup",
      variant: "warning",
    });
    if (!ok) return;
    setAddOpen(false);
  };

  const handleSubmitAdd = () => {
    const successMessage =
      addType === "holiday"
        ? "Tanggal libur ditambahkan."
        : "Tanggal cuti bersama ditambahkan.";
    const ok = addDateToCalendar(addType, addDateInput, successMessage);
    if (!ok) return;
    setAddOpen(false);
    setAddDateInput("");
  };

  const moveMonth = (delta) => {
    setVisibleMonth((current) => {
      const next = addUtcMonths(current, delta);
      setSelectedDate((currentSelected) => {
        const parsed = parseAppDate(currentSelected);
        if (!parsed) return toAppDate(next);
        if (
          parsed.getUTCFullYear() === next.getUTCFullYear() &&
          parsed.getUTCMonth() === next.getUTCMonth()
        ) {
          return currentSelected;
        }
        return toAppDate(next);
      });
      return next;
    });
  };

  const jumpToToday = () => {
    const parsedToday = parseAppDate(todayAppDate);
    if (!parsedToday) return;
    setVisibleMonth(startOfUtcMonth(parsedToday));
    setSelectedDate(todayAppDate);
  };

  return (
    <AdminLayout username={session?.user?.username} loading={sessionLoading}>
      <div className="ds-page-stack">
        <Card
          className="relative border-border/70 bg-card p-0"
          header={
            <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 sm:px-6">
              <div className="space-y-1">
                <h1 className="ds-page-title">Manajemen Kalender</h1>
                <p className="text-sm leading-6" style={CALENDAR_TEXT_SOFT_STYLE}>
                  Halaman kelola tanggal cuti, hari libur, dan event lainnya.
                </p>
              </div>

              <Button
                variant="primary"
                onClick={() => openAddModal("holiday", selectedDate)}
                className={clsx(
                  "inline-flex items-center gap-2 rounded-lg px-3 shadow-sm",
                  ADD_BUTTON_BLUE_CLASS
                )}
              >
                <Plus className="h-4 w-4" />
                Tambah
              </Button>
            </div>
          }
        >
          {calendarFetching && !isCalendarPending && (
            <div className="pointer-events-none absolute right-5 top-[4.5rem] z-10 sm:right-6 sm:top-[4.75rem]">
              <div
                className={clsx(
                  "inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/95 px-3 py-1.5 text-xs shadow-sm",
                  CALENDAR_SUBTLE_TEXT
                )}
              >
                <Spinner size="sm" />
                Menyegarkan data kalender...
              </div>
            </div>
          )}

          {isCalendarPending ? (
            <div className="space-y-6 px-5 pb-6 sm:px-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
              <Skeleton className="h-[28rem] w-full" />
              <div className="grid gap-4 lg:grid-cols-2">
                <Skeleton className="h-72 w-full" />
                <Skeleton className="h-72 w-full" />
              </div>
            </div>
          ) : calendarError ? (
            <div className="px-5 pb-6 sm:px-6">
              <QueryErrorNotice
                error={calendarError}
                fallbackMessage="Data kalender belum dapat dimuat dari server."
                onRetry={() => refetch()}
                retryLabel="Muat ulang kalender"
              />
            </div>
          ) : (
            <div className="space-y-6 px-5 pb-6 sm:px-6">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-rose-200/70 bg-rose-50/65 p-4 dark:border-rose-500/35 dark:bg-rose-500/12">
                  <p
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={CALENDAR_TEXT_STRONG_STYLE}
                  >
                    Total Hari Libur
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-foreground">
                    {holidays.length}
                  </p>
                  <p className={clsx("mt-1 text-xs")} style={CALENDAR_TEXT_SOFT_STYLE}>
                    Bulan ini: {monthSpecialCount.holiday}
                  </p>
                </div>
                <div className="rounded-2xl border border-indigo-200/70 bg-indigo-50/65 p-4 dark:border-indigo-500/35 dark:bg-indigo-500/12">
                  <p
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={CALENDAR_TEXT_STRONG_STYLE}
                  >
                    Total Cuti Bersama
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-foreground">
                    {jointLeaves.length}
                  </p>
                  <p className={clsx("mt-1 text-xs")} style={CALENDAR_TEXT_SOFT_STYLE}>
                    Bulan ini: {monthSpecialCount.joint}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                  <p
                    className={clsx("text-xs uppercase tracking-wide")}
                    style={CALENDAR_TEXT_SOFT_STYLE}
                  >
                    Event Berikutnya
                  </p>
                  {nextSpecialEvent ? (
                    <>
                      <p className="mt-1 line-clamp-1 text-sm font-semibold text-foreground">
                        {formatShortDate(nextSpecialEvent.date)}
                      </p>
                      <p className={clsx("mt-1 text-xs")} style={CALENDAR_TEXT_SOFT_STYLE}>
                        {EVENT_META[nextSpecialEvent.type].label} -{" "}
                        {relativeLabel(nextSpecialEvent.date)}
                      </p>
                    </>
                  ) : (
                    <p className={clsx("mt-2 text-xs")} style={CALENDAR_TEXT_SOFT_STYLE}>
                      Belum ada event khusus.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
                <section className="space-y-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-foreground sm:text-lg">
                        Kalender Bulanan
                      </h2>
                      <p className="text-xs" style={CALENDAR_TEXT_SOFT_STYLE}>
                        {capitalizeLabel(monthLabel)} -{" "}
                        {monthSpecialCount.all} event khusus
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        iconOnly
                        onClick={() => moveMonth(-1)}
                        aria-label="Bulan sebelumnya"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={jumpToToday}
                        className="px-3"
                      >
                        Hari ini
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        iconOnly
                        onClick={() => moveMonth(1)}
                        aria-label="Bulan berikutnya"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <EventBadge type="holiday" />
                    <EventBadge type="joint" />
                    <EventBadge type="other" />
                  </div>

                  <div className="hidden space-y-2 md:block">
                    <div className="grid grid-cols-7 gap-2">
                      {WEEKDAY_LABELS.map((label) => (
                        <div
                          key={label}
                          className={clsx(
                            "rounded-lg border border-border/60 bg-muted/30 py-2 text-center text-[11px] font-semibold uppercase tracking-wide",
                            CALENDAR_SUBTLE_TEXT
                          )}
                          style={CALENDAR_TEXT_MUTED_STYLE}
                        >
                          {label}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-2">
                      {monthCells.map((cell) => {
                        const events = getDateEvents(
                          cell.dateKey,
                          holidaySet,
                          jointSet
                        );
                        const isSelected = selectedDate === cell.dateKey;
                        const isToday = cell.dateKey === todayAppDate;
                        const toneClass = resolveCellTone(events);
                        const ariaLabel = `${formatFullDate(cell.dateKey)}${
                          events.length
                            ? `, ${events
                                .map((event) => EVENT_META[event.type].label)
                                .join(", ")}`
                            : ", tidak ada event"
                        }`;

                        return (
                          <button
                            key={cell.dateKey}
                            type="button"
                            aria-pressed={isSelected}
                            aria-label={ariaLabel}
                            onClick={() => setSelectedDate(cell.dateKey)}
                            title={ariaLabel}
                            className={clsx(
                              "group relative flex min-h-[102px] flex-col gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors",
                              cell.inMonth
                                ? "text-foreground"
                                : "bg-muted/15 text-foreground/75 dark:text-slate-400",
                              toneClass || "bg-card/70",
                              isSelected
                                ? "border-primary/55 ring-2 ring-primary/30 shadow-sm"
                                : "border-border/70 hover:border-primary/35 hover:bg-muted/35",
                              isToday &&
                                "after:pointer-events-none after:absolute after:inset-1 after:rounded-lg after:ring-1 after:ring-foreground/25"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span
                                className={clsx(
                                  "inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold",
                                  isToday
                                    ? "bg-foreground text-background"
                                    : "bg-muted/45 text-foreground"
                                )}
                              >
                                {cell.dayNumber}
                              </span>
                              {events.length ? (
                                <span
                                className={clsx(
                                    "rounded-full border border-border/60 bg-background/80 px-1.5 py-0.5 text-[10px] font-semibold",
                                    CALENDAR_MUTED_TEXT
                                  )}
                                  style={CALENDAR_TEXT_MUTED_STYLE}
                                >
                                  {events.length}
                                </span>
                              ) : null}
                            </div>

                            <div className="space-y-1">
                              {events.slice(0, 2).map((event) => (
                                <span
                                  key={`${cell.dateKey}-${event.type}`}
                                  className={clsx(
                                    "block truncate rounded-full border px-2 py-0.5 text-center text-[10px] font-medium",
                                    EVENT_META[event.type].chipClass
                                  )}
                                  style={CALENDAR_TEXT_MUTED_STYLE}
                                >
                                  {EVENT_META[event.type].shortLabel}
                                </span>
                              ))}
                              {events.length > 2 ? (
                                <span
                                  className={clsx("block px-1 text-[10px]", CALENDAR_MUTED_TEXT)}
                                  style={CALENDAR_TEXT_MUTED_STYLE}
                                >
                                  +{events.length - 2} event lain
                                </span>
                              ) : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2 md:hidden">
                    <p className={clsx("text-xs font-medium", CALENDAR_SUBTLE_TEXT)}>
                      Ringkasan event bulan ini
                    </p>
                    {monthAgenda.length === 0 ? (
                      <div
                        className={clsx(
                          "rounded-xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm",
                          CALENDAR_SUBTLE_TEXT
                        )}
                      >
                        Belum ada event di bulan ini.
                      </div>
                    ) : (
                      <ul className="max-h-[20rem] space-y-2 overflow-auto pr-1">
                        {monthAgenda.map((entry) => {
                          const active = selectedDate === entry.date;
                          return (
                            <li key={entry.date}>
                              <button
                                type="button"
                                onClick={() => setSelectedDate(entry.date)}
                                className={clsx(
                                  "w-full rounded-xl border p-3 text-left transition-colors",
                                  active
                                    ? "border-primary/50 bg-primary/8"
                                    : "border-border/70 bg-muted/20 hover:border-primary/35 hover:bg-muted/45"
                                )}
                              >
                                <p className="text-sm font-semibold text-foreground">
                                  {formatShortDate(entry.date)}
                                </p>
                                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                  {entry.events.map((event) => (
                                    <EventBadge
                                      key={`${entry.date}-${event.type}`}
                                      type={event.type}
                                      compact
                                    />
                                  ))}
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </section>

                <section className="space-y-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
                  <div className="space-y-1">
                    <p
                      className={clsx("text-xs uppercase tracking-wide", CALENDAR_SUBTLE_TEXT)}
                      style={CALENDAR_TEXT_SOFT_STYLE}
                    >
                      Detail tanggal aktif
                    </p>
                    <h2 className="text-base font-semibold text-foreground sm:text-lg">
                      {formatFullDate(selectedDate)}
                    </h2>
                    <p className={clsx("text-xs", CALENDAR_SUBTLE_TEXT)} style={CALENDAR_TEXT_SOFT_STYLE}>
                      {relativeLabel(selectedDate) || "Pilih tanggal pada kalender"}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {selectedEvents.length ? (
                      selectedEvents.map((event) => (
                        <EventBadge
                          key={`${selectedDate}-${event.type}`}
                          type={event.type}
                        />
                      ))
                    ) : (
                      <span
                        className="rounded-full border border-dashed border-border/70 bg-muted/20 px-3 py-1 text-xs font-medium"
                        style={CALENDAR_TEXT_SOFT_STYLE}
                      >
                        Tidak ada event pada tanggal ini
                      </span>
                    )}
                  </div>

                  <div className="grid gap-2">
                    {selectedIsHoliday ? (
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => handleRemoveDate("holiday", selectedDate)}
                        disabled={isMutating}
                        className={DELETE_BUTTON_RED_CLASS}
                      >
                        <Trash className="h-4 w-4" />
                        Hapus dari Hari Libur
                      </Button>
                    ) : selectedIsJoint ? (
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => handleRemoveDate("joint", selectedDate)}
                        disabled={isMutating}
                        className={DELETE_BUTTON_RED_CLASS}
                      >
                        <Trash className="h-4 w-4" />
                        Hapus dari Cuti Bersama
                      </Button>
                    ) : (
                      <>
                        <Button
                          type="button"
                          variant="secondary"
                          outline
                          onClick={() =>
                            addDateToCalendar(
                              "holiday",
                              selectedDate,
                              "Tanggal dipilih ditambahkan sebagai hari libur."
                            )
                          }
                          disabled={isMutating}
                        >
                          <Flag className="h-4 w-4" />
                          Tandai sebagai Hari Libur
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          outline
                          onClick={() =>
                            addDateToCalendar(
                              "joint",
                              selectedDate,
                              "Tanggal dipilih ditambahkan sebagai cuti bersama."
                            )
                          }
                          disabled={isMutating}
                        >
                          <Briefcase className="h-4 w-4" />
                          Tandai sebagai Cuti Bersama
                        </Button>
                      </>
                    )}
                  </div>
                </section>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <ListSection
                  title="Daftar Hari Libur"
                  subtitle="Tanggal resmi yang ditandai sebagai libur."
                  icon={<CalendarDays className="h-4 w-4 text-rose-600 dark:text-rose-300" />}
                  dates={holidays}
                  badgeType="holiday"
                  selectedDate={selectedDate}
                  onSelectDate={focusDate}
                  onRemoveDate={(date) => handleRemoveDate("holiday", date)}
                  busy={isMutating}
                />

                <ListSection
                  title="Daftar Cuti Bersama"
                  subtitle="Tanggal cuti bersama di luar hari libur nasional."
                  icon={<CalendarX className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />}
                  dates={jointLeaves}
                  badgeType="joint"
                  selectedDate={selectedDate}
                  onSelectDate={focusDate}
                  onRemoveDate={(date) => handleRemoveDate("joint", date)}
                  busy={isMutating}
                />
              </div>

              {(formError || updateMutation.error) && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {formError || updateMutation.error?.message}
                </div>
              )}
            </div>
          )}
        </Card>

        <Modal
          open={addOpen}
          onClose={handleCancelAdd}
          title="Tambah Event Kalender"
          footer={
            <>
              <Button variant="secondary" outline onClick={handleCancelAdd}>
                Batal
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmitAdd}
                disabled={!addDateInput || isMutating}
                loading={isMutating}
                loadingText="Menyimpan..."
                className={ADD_BUTTON_BLUE_CLASS}
              >
                <Plus className="h-4 w-4" />
                Tambah
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Kategori</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAddType("holiday")}
                  className={clsx(
                    "rounded-xl border px-3 py-2 text-left text-sm font-medium transition-colors",
                    addType === "holiday"
                      ? "border-rose-300 bg-rose-100/85 text-foreground dark:border-rose-500/40 dark:bg-rose-500/14 dark:text-rose-200"
                      : "border-border/70 bg-muted/20 text-foreground hover:border-border hover:bg-muted/35"
                  )}
                  style={addType === "holiday" ? CALENDAR_TEXT_STRONG_STYLE : CALENDAR_TEXT_SOFT_STYLE}
                >
                  <span className="inline-flex items-center gap-2">
                    <Flag className="h-4 w-4" />
                    Hari Libur
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setAddType("joint")}
                  className={clsx(
                    "rounded-xl border px-3 py-2 text-left text-sm font-medium transition-colors",
                    addType === "joint"
                      ? "border-indigo-300 bg-indigo-100/80 text-foreground dark:border-indigo-500/40 dark:bg-indigo-500/14 dark:text-indigo-200"
                      : "border-border/70 bg-muted/20 text-foreground hover:border-border hover:bg-muted/35"
                  )}
                  style={addType === "joint" ? CALENDAR_TEXT_STRONG_STYLE : CALENDAR_TEXT_SOFT_STYLE}
                >
                  <span className="inline-flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Cuti Bersama
                  </span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="calendar-date-input">Tanggal</Label>
              <Input
                id="calendar-date-input"
                ref={addInputRef}
                type="date"
                value={toIsoDate(addDateInput)}
                onChange={(event) => {
                  setFormError("");
                  setAddDateInput(normalizeAppDate(event.target.value));
                }}
                required
              />
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span
                  className="rounded-full border border-border/70 bg-muted/25 px-2.5 py-1"
                  style={CALENDAR_TEXT_MUTED_STYLE}
                >
                  Format simpan: {addDateInput || "DD-MM-YYYY"}
                </span>
                <button
                  type="button"
                  onClick={() => setAddDateInput(selectedDate)}
                  className="rounded-full border border-border/70 bg-background px-2.5 py-1 transition-colors hover:bg-muted/35"
                  style={CALENDAR_TEXT_SOFT_STYLE}
                >
                  Gunakan tanggal aktif
                </button>
              </div>
            </div>

            <div
              className={clsx(
                "rounded-xl border border-border/70 bg-muted/20 p-3 text-xs",
                CALENDAR_SUBTLE_TEXT
              )}
              style={CALENDAR_TEXT_MUTED_STYLE}
            >
              Sistem akan menolak tanggal yang sama di dua kategori sekaligus,
              agar data kalender tetap konsisten.
            </div>
          </div>
        </Modal>
      </div>
    </AdminLayout>
  );
}
