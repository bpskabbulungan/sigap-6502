import { Trash2 } from "lucide-react";
import { Button } from "./ui/Button";
import { EmptyState } from "./ui/EmptyState";
import { compareAppDates, formatAppDate } from "../lib/dateFormatter";

const TZ_LABEL = {
  "Asia/Jakarta": "WIB",
  "Asia/Pontianak": "WIB",
  "Asia/Makassar": "WITA",
  "Asia/Ujung_Pandang": "WITA",
  "Asia/Jayapura": "WIT",
};

function compareByDateTime(a, b) {
  const byDate = compareAppDates(a.date, b.date);
  if (byDate !== 0) return byDate;

  const left = a.time || "";
  const right = b.time || "";
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function truncate(value, max = 72) {
  if (!value) return "-";
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3)}...`;
}

function getMessageLabel(item) {
  if (item?.messageMode === "custom-message") {
    return "Pesan custom";
  }
  return "Templat bawaan";
}

function getMessagePreview(item) {
  if (item?.messageMode === "custom-message") {
    return truncate(item?.customMessage || "-");
  }

  return "Mengikuti templat bawaan di menu Templat.";
}

function formatTimeWithZone(time, timezone) {
  if (!time) return "-";
  const normalizedTime = String(time).replace(":", ".");
  const suffix = TZ_LABEL[timezone] || "";
  return suffix ? `${normalizedTime} ${suffix}` : normalizedTime;
}

export function OverrideTable({
  announcements = [],
  overrides = [],
  timezone = "Asia/Makassar",
  onRemove,
}) {
  const rows = Array.isArray(announcements) && announcements.length ? announcements : overrides;

  if (!rows.length) {
    return (
      <EmptyState
        title="Belum ada pengumuman terjadwal"
        description="Tambahkan jadwal pengumuman tambahan tanpa mengubah jadwal otomatis."
      />
    );
  }

  const sorted = [...rows].sort(compareByDateTime);

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70">
      <div className="max-h-80 overflow-auto">
        <table className="min-w-full divide-y divide-border/70 text-sm">
          <thead className="bg-card text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-center">Tanggal</th>
              <th className="px-4 py-3 text-center">Waktu</th>
              <th className="px-4 py-3 text-center">Mode Pesan</th>
              <th className="px-4 py-3 text-center">Isi/Info</th>
              <th className="px-4 py-3 text-center">Catatan</th>
              <th className="px-4 py-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {sorted.map((item) => (
              <tr
                key={item.id || `${item.date}-${item.time}`}
                className="group bg-card text-foreground transition hover:bg-background"
              >
                <td className="px-4 py-3 text-center font-medium text-primary">
                  {formatAppDate(item.date, { withWeekday: true })}
                </td>
                <td className="px-4 py-3 text-center">
                  {formatTimeWithZone(item.time, timezone)}
                </td>
                <td className="px-4 py-3 text-center text-muted-foreground">{getMessageLabel(item)}</td>
                <td
                  className="px-4 py-3 text-center text-muted-foreground"
                  title={item?.customMessage || ""}
                >
                  {getMessagePreview(item)}
                </td>
                <td className="px-4 py-3 text-center text-muted-foreground">{item.note || "-"}</td>
                <td className="px-4 py-3 text-center">
                  <Button
                    variant="destructive"
                    iconOnly
                    size="sm"
                    className="mx-auto"
                    aria-label="Hapus pengumuman"
                    title="Hapus"
                    onClick={() => onRemove?.(item.id || item.date)}
                  >
                    <Trash2 size={14} className="text-current" />
                    <span className="sr-only">Hapus</span>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
