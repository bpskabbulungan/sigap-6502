import { CalendarDays } from "lucide-react";
import { ScheduleGrid } from "./ScheduleGrid";
import { Card } from "./ui/Card";
import { DataPlaceholder } from "./ui/DataPlaceholder";
import { ToneSurface } from "./ui/ToneSurface";

export function ScheduleOverview({ schedule, loading }) {
  if (loading) {
    return (
      <Card className="space-y-6 border-border/70 bg-card">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CalendarDays size={20} />
          </div>
          <div className="flex flex-col gap-2">
            <div className="h-6 w-44 animate-pulse rounded-full bg-muted/80" />
            <div className="h-4 w-72 animate-pulse rounded-full bg-muted/80" />
          </div>
        </div>
        <ScheduleGrid loading readOnly values={null} />
      </Card>
    );
  }

  if (!schedule) {
    return (
      <Card className="space-y-6 border-border/70 bg-card">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CalendarDays size={20} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Jadwal Otomatis</h2>
            <p className="text-sm text-muted-foreground">
              Jadwal pengiriman pesan yang diterapkan secara berkala. Anda bisa
              mengubahnya melalui dashboard admin.
            </p>
          </div>
        </div>
        <DataPlaceholder
          icon={<CalendarDays size={24} />}
          title="Belum ada jadwal"
          description="Sistem belum memiliki pengaturan jam pengiriman harian. Masuk sebagai admin untuk mengatur jadwal."
        />
      </Card>
    );
  }

  return (
    <Card className="space-y-6 border-border/70 bg-card">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CalendarDays size={20} />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Jadwal Otomatis</h2>
          <p className="text-sm text-muted-foreground">
            Jadwal pengiriman pesan yang diterapkan secara berkala. Anda bisa
            mengubahnya melalui dashboard admin.
          </p>
        </div>
      </div>

      <ScheduleGrid readOnly values={schedule.dailyTimes} />

      {schedule.paused ? (
        <ToneSurface tone="warning" size="md" className="text-sm">
          Penjadwalan otomatis sementara dijeda. Pengumuman terjadwal tetap berjalan.
        </ToneSurface>
      ) : null}
    </Card>
  );
}
