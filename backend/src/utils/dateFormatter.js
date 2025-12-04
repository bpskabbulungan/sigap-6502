const moment = require('moment-timezone');
require('moment/locale/id');

moment.locale('id');

const APP_DATE_FORMAT = 'DD-MM-YYYY';
const LEGACY_ISO_DATE_FORMAT = 'YYYY-MM-DD';
const APP_DATE_REGEX = /^\d{2}-\d{2}-\d{4}$/;

function capitalize(label) {
  if (!label) {
    return '';
  }
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const TIMEZONE_ABBREVIATIONS = {
  'Asia/Jakarta': 'WIB',
  'Asia/Pontianak': 'WIB',
  'Asia/Makassar': 'WITA',
  'Asia/Ujung_Pandang': 'WITA',
  'Asia/Jayapura': 'WIT',
};

function resolveTimezoneAbbreviation(zonedMoment, timezone) {
  const directAbbreviation = zonedMoment.format('z');
  if (directAbbreviation && /[A-Za-z]{2,}/.test(directAbbreviation) && directAbbreviation !== 'GMT') {
    return directAbbreviation;
  }

  if (TIMEZONE_ABBREVIATIONS[timezone]) {
    return TIMEZONE_ABBREVIATIONS[timezone];
  }

  return zonedMoment.format('Z');
}

function normalizeAppDate(value) {
  if (typeof value !== 'string') {
    return '';
  }

  const sanitized = value.trim().replace(/[/.]/g, '-');
  if (!sanitized) {
    return '';
  }

  const formats = [APP_DATE_FORMAT, LEGACY_ISO_DATE_FORMAT];
  for (const fmt of formats) {
    const parsed = moment(sanitized, fmt, true);
    if (parsed.isValid()) {
      return parsed.format(APP_DATE_FORMAT);
    }
  }

  return '';
}

function parseAppDate(dateString, timezone) {
  const normalized = normalizeAppDate(dateString);
  if (!normalized) return null;
  const parsed = timezone
    ? moment.tz(normalized, APP_DATE_FORMAT, true, timezone)
    : moment(normalized, APP_DATE_FORMAT, true);
  return parsed.isValid() ? parsed : null;
}

function parseAppDateTime(dateString, timeString, timezone) {
  const normalized = normalizeAppDate(dateString);
  if (!normalized) return null;
  const format = `${APP_DATE_FORMAT} HH:mm`;
  const parsed = timezone
    ? moment.tz(`${normalized} ${timeString}`, format, true, timezone)
    : moment(`${normalized} ${timeString}`, format, true);
  return parsed.isValid() ? parsed : null;
}

function compareAppDates(a, b) {
  const left = parseAppDate(a);
  const right = parseAppDate(b);
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  if (left.isBefore(right, 'day')) return -1;
  if (left.isAfter(right, 'day')) return 1;
  return 0;
}

function formatDateLabels(momentInstance, timezone) {
  if (!momentInstance || typeof momentInstance.clone !== 'function') {
    throw new TypeError('A valid moment instance is required');
  }

  if (!timezone || typeof timezone !== 'string') {
    throw new TypeError('A valid timezone string is required');
  }

  const zonedMoment = momentInstance.clone().tz(timezone).locale('id');
  const abbreviation = resolveTimezoneAbbreviation(zonedMoment, timezone);
  const baseFormat = `${APP_DATE_FORMAT} [Pukul] HH:mm:ss`;

  return {
    adminLabel: `${zonedMoment.format(baseFormat)} ${abbreviation}`.trim(),
    publicLabel: `${zonedMoment.format(`dddd, ${baseFormat}`)} ${abbreviation}`.trim(),
  };
}

function formatAppDate(dateString, { withWeekday = false } = {}) {
  const parsed = parseAppDate(dateString);
  if (!parsed) {
    return dateString ?? '';
  }

  const base = parsed.format(APP_DATE_FORMAT);
  if (!withWeekday) {
    return base;
  }

  const weekday = capitalize(parsed.format('dddd'));
  return weekday ? `${weekday}, ${base}` : base;
}

module.exports = {
  APP_DATE_FORMAT,
  APP_DATE_REGEX,
  LEGACY_ISO_DATE_FORMAT,
  compareAppDates,
  formatAppDate,
  formatDateLabels,
  formatIsoDateId: formatAppDate,
  normalizeAppDate,
  parseAppDate,
  parseAppDateTime,
};
