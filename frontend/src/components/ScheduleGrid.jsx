import { Label } from "./ui/Label";
import { Clock } from "./ui/icons";
import { Input } from "./ui/Input";
import { Skeleton } from "./ui/Skeleton";
import { DataPlaceholder } from "./ui/DataPlaceholder";

const dayLabels = {
  1: "Senin",
  2: "Selasa",
  3: "Rabu",
  4: "Kamis",
  5: "Jumat",
  6: "Sabtu",
  7: "Minggu",
};

export function ScheduleGrid({
  values,
  onChange,
  readOnly = false,
  loading = false,
  timeSuffix,
  invalidDays = [],
}) {
  const invalidDaySet = new Set((invalidDays || []).map(Number));

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-36 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!readOnly && !values) {
    return (
      <DataPlaceholder
        icon={<Clock size={24} />}
        title="Belum ada jadwal"
        description="Atur jadwal harian terlebih dahulu untuk mengaktifkan pengiriman otomatis."
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
      {Object.entries(dayLabels).map(([day, label]) => {
        const value = values?.[day] ?? "";
        const numericDay = Number(day);
        const isInvalid = !readOnly && invalidDaySet.has(numericDay);
        const isWeekend = numericDay >= 6;

        return (
          <div
            key={day}
            className={`flex flex-col gap-3 rounded-2xl border p-3 transition-[border-color,background-color,box-shadow] sm:p-4 ${
              isInvalid
                ? "border-destructive/55 bg-destructive/6 shadow-sm"
                : isWeekend
                ? "border-border/70 bg-[linear-gradient(160deg,hsl(var(--muted)/0.36),hsl(var(--warning)/0.06))] hover:border-warning/30"
                : "border-border/70 bg-[linear-gradient(160deg,hsl(var(--card)),hsl(var(--primary)/0.04))] hover:border-primary/30"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Clock
                  size={16}
                  className={isInvalid ? "text-destructive" : "text-primary"}
                />
                <Label htmlFor={readOnly ? undefined : `day-${day}`} size="sm">
                  {label}
                </Label>
              </div>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                  isWeekend
                    ? "border-warning/30 bg-warning/10 text-warning"
                    : "border-border/70 bg-background/75 text-muted-foreground"
                }`}
              >
                {isWeekend ? "Libur" : "Hari kerja"}
              </span>
            </div>

            {readOnly ? (
              <p className="text-base font-semibold text-foreground sm:text-lg">
                {value
                  ? `${value}${timeSuffix ? ` ${timeSuffix}` : ""}`
                  : isWeekend
                  ? "Libur"
                  : "Tidak dijadwalkan"}
              </p>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  id={`day-${day}`}
                  type="time"
                  size="sm"
                  variant={isInvalid ? "error" : "default"}
                  aria-invalid={isInvalid || undefined}
                  value={value || ""}
                  onChange={(event) =>
                    onChange({
                      ...values,
                      [day]: event.target.value || null,
                    })
                  }
                />
                {timeSuffix ? (
                  <span className="text-xs font-medium text-muted-foreground sm:text-sm">
                    {timeSuffix}
                  </span>
                ) : null}
              </div>
            )}

            {!readOnly && (
              <p
                className={`text-[11px] leading-5 sm:text-xs ${
                  isInvalid ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                {isInvalid
                  ? "Format waktu harus HH:MM (24 jam)."
                  : "Kosongkan jika tidak ingin menjadwalkan pengiriman pada hari ini."}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
