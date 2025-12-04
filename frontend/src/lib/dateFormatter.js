const weekdayFormatter = new Intl.DateTimeFormat("id-ID", { weekday: "long" });

export const APP_DATE_REGEX = /^\d{2}-\d{2}-\d{4}$/;

function normalizeWeekday(label) {
  if (!label) return "";
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function toParts(value) {
  if (typeof value !== "string") return null;
  const sanitized = value.trim().replace(/[/.]/g, "-");
  if (!sanitized) return null;

  const ddmmyyyy = sanitized.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    return {
      day: Number(day),
      month: Number(month),
      year: Number(year),
    };
  }

  const iso = sanitized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const [, year, month, day] = iso;
    return {
      day: Number(day),
      month: Number(month),
      year: Number(year),
    };
  }

  return null;
}

function isRealDate(day, month, year) {
  if (!day || !month || !year) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function normalizeAppDate(rawValue) {
  const parts = toParts(rawValue);
  if (!parts) return "";
  const { day, month, year } = parts;
  if (!isRealDate(day, month, year)) return "";

  return `${String(day).padStart(2, "0")}-${String(month).padStart(2, "0")}-${String(
    year
  ).padStart(4, "0")}`;
}

export function isValidAppDate(value) {
  return Boolean(normalizeAppDate(value));
}

export function parseAppDate(value) {
  const normalized = normalizeAppDate(value);
  if (!normalized) return null;
  const [day, month, year] = normalized.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function compareAppDates(a, b) {
  const da = parseAppDate(a);
  const db = parseAppDate(b);
  if (!da && !db) return 0;
  if (!da) return 1;
  if (!db) return -1;
  if (da.getTime() === db.getTime()) return 0;
  return da.getTime() < db.getTime() ? -1 : 1;
}

export function formatAppDate(dateString, { withWeekday = false } = {}) {
  const normalized = normalizeAppDate(dateString);
  if (!normalized) {
    return dateString ?? "";
  }

  if (!withWeekday) {
    return normalized;
  }

  const date = parseAppDate(normalized);
  if (!date) {
    return normalized;
  }

  const weekday = normalizeWeekday(weekdayFormatter.format(date));
  return weekday ? `${weekday}, ${normalized}` : normalized;
}

export const formatIsoDateId = formatAppDate;
