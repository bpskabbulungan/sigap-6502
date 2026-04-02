const STATUS_VARIANT_MAP = Object.freeze({
  // Generic
  default: "default",
  neutral: "default",
  info: "info",
  warning: "warning",
  success: "success",
  danger: "danger",
  error: "danger",
  failed: "danger",

  // Bot / system states
  idle: "default",
  stopped: "default",
  starting: "warning",
  restarting: "warning",
  authenticated: "warning",
  ready: "success",
  active: "success",
  aktif: "success",
  paused: "warning",

  // Contact states
  masuk: "success",
  izin: "warning",
  cuti: "warning",
  sakit: "warning",
  dinas: "warning",
  libur: "warning",
  nonaktif: "danger",
});

export function toneFromStatus(status, fallback = "default") {
  if (!status || typeof status !== "string") return fallback;
  const key = status.trim().toLowerCase();
  return STATUS_VARIANT_MAP[key] ?? fallback;
}

export { STATUS_VARIANT_MAP };
