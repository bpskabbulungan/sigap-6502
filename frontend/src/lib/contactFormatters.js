export function normalizeWhatsappNumber(rawNumber) {
  if (rawNumber === null || rawNumber === undefined) return "";

  const digits = String(rawNumber).replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}

export function isValidWhatsappNumber(rawNumber) {
  const normalized = normalizeWhatsappNumber(rawNumber);
  return /^62\d{8,13}$/.test(normalized);
}

export function formatStatusLabel(status) {
  if (!status) return "";
  return String(status)
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatWhatsappDisplay(number) {
  const normalized = normalizeWhatsappNumber(number);
  if (!normalized) return "-";

  const country = normalized.slice(0, 2);
  const local = normalized.slice(2);
  if (!local) return `+${country}`;

  const grouped = local.replace(/(\d{3,4})(?=\d)/g, "$1 ");
  return `+${country} ${grouped}`.trim();
}

export function parseTimestamp(value) {
  if (!value) return 0;
  const parsed = new Date(value);
  const timestamp = parsed.getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function formatDateTime(value, locale = "id-ID") {
  const timestamp = parseTimestamp(value);
  if (!timestamp) return "-";

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}
