import { CalendarClock } from "lucide-react";

import { Card } from "./ui/Card";
import { Badge } from "./ui/Badge";
import { Skeleton } from "./ui/Skeleton";
import { DataPlaceholder } from "./ui/DataPlaceholder";
import { formatAppDate } from "../lib/dateFormatter";

function mapTzLabel(tz) {
  const map = {
    "Asia/Makassar": "WITA",
    "Asia/Jakarta": "WIB",
    "Asia/Jayapura": "WIT",
  };
  const abbr = map[tz];
  return abbr ? `${abbr} (${tz})` : tz || "";
}

export function NextRunCard({ nextRun, loading }) {
  if (loading) {
    return (
      <Card className="space-y-6 border-white/10 bg-slate-900/65">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-500/10 text-primary-400">
            <CalendarClock size={20} />
          </div>
          <div className="flex flex-col gap-2">
            <div className="h-5 w-40 animate-pulse rounded-full bg-slate-800/70" />
            <div className="h-4 w-72 animate-pulse rounded-full bg-slate-800/70" />
          </div>
        </div>
        <Skeleton className="h-32" />
      </Card>
    );
  }

  if (!nextRun || !nextRun.nextRun?.timestamp) {
    return (
      <Card className="space-y-6 border-white/10 bg-slate-900/65">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-500/10 text-primary-400">
            <CalendarClock size={20} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Pengiriman Berikutnya</h2>
            <p className="text-sm text-slate-400">Informasi jadwal terdekat yang akan dieksekusi oleh sistem pengingat.</p>
          </div>
        </div>
        <DataPlaceholder icon={null} title="Belum ada jadwal berikutnya" description="Hubungi administrator untuk menentukan jadwal pengiriman yang baru." />
      </Card>
    );
  }

  const details = nextRun.nextRun;
  const tzLabel = mapTzLabel(details.timezone);

  return (
    <Card className="flex flex-col gap-5 border-white/10 bg-slate-900/65">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-500/10 text-primary-400">
          <CalendarClock size={20} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Pengiriman Berikutnya</h2>
          <p className="text-sm text-slate-400">Informasi jadwal terdekat yang akan dieksekusi oleh sistem pengingat.</p>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/70 p-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Waktu pengiriman</p>
          <p className="mt-1 text-2xl font-semibold text-white">{details.formatted}</p>
          <p className="text-sm text-slate-400">{tzLabel}</p>
        </div>
        {details.override ? (
          <div className="rounded-xl border border-amber-400/30 bg-amber-500/15 p-4 text-sm text-amber-100">
            <p className="font-semibold">Override manual aktif</p>
            <p>
              {formatAppDate(details.override.date)} pukul {details.override.time}
              {details.override.note ? ` – ${details.override.note}` : null}
            </p>
          </div>
        ) : (
          <Badge variant="info" className="w-fit uppercase tracking-wide">Mengikuti jadwal default</Badge>
        )}
      </div>
    </Card>
  );
}
