import { Badge } from "./ui/Badge";
import clsx from "clsx";
import { toneDotColor } from "../lib/toneVariants";
import { toneFromStatus } from "../lib/statusVariantMap";

const PHASE_CONFIG = {
  idle: { label: 'Bot belum berjalan', variant: 'default' },
  starting: { label: 'Menyalakan bot...', variant: 'warning' },
  'waiting-qr': { label: 'Menunggu scan QR admin', variant: 'warning' },
  authenticated: { label: 'QR terscan, menunggu siap', variant: 'warning' },
  restarting: { label: 'Bot sedang restart', variant: 'warning' },
  ready: { label: 'Bot aktif', variant: 'success' },
  stopped: { label: 'Bot dihentikan', variant: 'default' },
  error: { label: 'Terjadi kesalahan autentikasi', variant: 'danger' },
};

export function StatusPill({
  active,
  phase,
  labelActive = 'Bot Aktif',
  labelInactive = 'Bot Nonaktif',
}) {
  const dotBase = 'inline-flex h-2.5 w-2.5 rounded-full';
  const phaseKey = typeof phase === 'string' ? phase : undefined;

  const fallback = active
    ? { label: labelActive, variant: 'success' }
    : { label: labelInactive, variant: 'danger' };

  const phaseConfig = phaseKey ? PHASE_CONFIG[phaseKey] : undefined;
  const variant = toneFromStatus(
    phaseConfig?.variant ?? phaseKey ?? fallback.variant,
    fallback.variant
  );
  const dotColor = toneDotColor(variant);

  let displayLabel = phaseConfig?.label ?? fallback.label;
  if (phaseKey === 'ready') {
    displayLabel = labelActive;
  } else if (!phaseConfig) {
    displayLabel = fallback.label;
  }

  return (
    <Badge variant={variant} className="flex items-center gap-2" data-phase={phaseKey}>
      <span className={clsx(dotBase)} style={{ backgroundColor: dotColor }} />
      {displayLabel}
    </Badge>
  );
}
