import { Trash2 } from "lucide-react";
import { Button } from "./ui/Button";
import { EmptyState } from "./ui/EmptyState";
import { compareAppDates, formatAppDate } from "../lib/dateFormatter";

export function OverrideTable({ overrides = [], onRemove }) {
  if (!overrides.length) {
    return (
      <EmptyState
        title="Belum ada override manual"
        description="Tambahkan jadwal khusus untuk mengganti jadwal otomatis pada tanggal tertentu."
      />
    );
  }

  const sorted = [...overrides].sort((a, b) =>
    compareAppDates(a.date, b.date)
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <div className="max-h-72 overflow-auto">
        <table className="min-w-full divide-y divide-white/10 text-sm">
          <thead className="bg-slate-900/80 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">Waktu</th>
              <th className="px-4 py-3">Catatan</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {sorted.map((item) => (
              <tr
                key={item.id || `${item.date}-${item.time}`}
                className="group bg-slate-900/50 text-slate-200 transition hover:bg-slate-900/70"
              >
                <td className="px-4 py-3 font-medium text-primary-300">
                  {formatAppDate(item.date)}
                </td>
                <td className="px-4 py-3">{item.time}</td>
                <td className="px-4 py-3 text-slate-300">{item.note || "-"}</td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    className="inline-flex items-center gap-1 text-sm text-rose-300 hover:text-rose-200"
                    onClick={() => onRemove?.(item.date)}
                  >
                    <Trash2 size={14} />
                    <span className="hidden sm:inline">Hapus</span>
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

