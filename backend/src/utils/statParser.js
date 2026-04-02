const fs = require('fs');
const path = require('path');
const readline = require('readline');
const moment = require('moment-timezone');

const config = require('../config/env');
const { LOG_TIMESTAMP_FORMAT } = require('./time');
const {
  APP_DATE_FORMAT,
  LEGACY_ISO_DATE_FORMAT,
  normalizeAppDate,
} = require('./dateFormatter');

const LEGACY_LOG_TIMESTAMP_FORMAT = 'DD/MM HH:mm:ss';
const LOG_LINE_REGEX = /^\[(.+?)\]\s+([A-Z]+)\s*-\s*(.*)$/;
const MESSAGE_SENT_REGEX = /\bPesan berhasil dikirim\b/i;
const ERROR_HINT_REGEX =
  /\b(gagal|error|exception|timeout|disconnect|terputus|failed?)\b/i;
const BOT_ACTIVE_PATTERNS = [
  /\bwhatsapp client is ready\b/i,
  /\bstatus bot\s*:\s*aktif\b/i,
  /\bbot aktif\b/i,
];
const BOT_INACTIVE_PATTERNS = [
  /\bbot dinonaktifkan\b/i,
  /\bbot dihentikan\b/i,
  /\bstatus bot\s*:\s*(nonaktif|stopped?)\b/i,
];

function getFileDateContext(logFilePath) {
  const fileName = path.basename(logFilePath);
  const appMatch = fileName.match(/(\d{2})-(\d{2})-(\d{4})/);
  if (appMatch) {
    const [, day, month, year] = appMatch;
    return moment.tz(
      `${day}-${month}-${year}`,
      APP_DATE_FORMAT,
      true,
      config.timezone
    );
  }

  const legacyMatch = fileName.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!legacyMatch) {
    return null;
  }

  const [, year, month, day] = legacyMatch;
  return moment.tz(
    `${year}-${month}-${day}`,
    LEGACY_ISO_DATE_FORMAT,
    true,
    config.timezone
  );
}

function normalizeYear(parsedMoment, contextMoment) {
  if (!contextMoment) {
    return parsedMoment;
  }

  const updated = parsedMoment.year(contextMoment.year());

  const contextMonth = contextMoment.month();
  const parsedMonth = updated.month();

  if (contextMonth === 11 && parsedMonth === 0) {
    return updated.add(1, 'year');
  }

  if (contextMonth === 0 && parsedMonth === 11) {
    return updated.subtract(1, 'year');
  }

  return updated;
}

function parseLogLine(line, contextMoment) {
  const match = line.match(LOG_LINE_REGEX);
  if (!match) {
    return null;
  }

  const [, timestampPart, rawLevel, rawMessage] = match;

  const candidates = [
    { format: LOG_TIMESTAMP_FORMAT, needsContext: false },
    { format: LEGACY_LOG_TIMESTAMP_FORMAT, needsContext: true },
  ];

  let parsedMoment = null;
  let needsContext = false;

  for (const { format, needsContext: requireContext } of candidates) {
    const attempt = moment.tz(timestampPart, format, true, config.timezone);
    if (attempt.isValid()) {
      parsedMoment = attempt;
      needsContext = requireContext;
      break;
    }
  }

  if (!parsedMoment) {
    return null;
  }

  if (needsContext) {
    parsedMoment = normalizeYear(parsedMoment, contextMoment);
  }

  if (!parsedMoment.isValid()) {
    return null;
  }

  return {
    date: parsedMoment.toDate(),
    level: rawLevel.toLowerCase(),
    message: rawMessage.trim(),
  };
}

function getDateKey(date) {
  const normalized = normalizeAppDate(
    moment.tz(date, config.timezone).format(APP_DATE_FORMAT)
  );
  return normalized || moment.tz(date, config.timezone).format(APP_DATE_FORMAT);
}

function matchesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function isMessageDelivered(message) {
  return MESSAGE_SENT_REGEX.test(message);
}

function isErrorLog(level, message) {
  if (level === 'error') {
    return true;
  }

  if (level === 'warn' && ERROR_HINT_REGEX.test(message)) {
    return true;
  }

  return false;
}

function isBotActivatedLog(message) {
  const normalized = message.toLowerCase();
  if (normalized.includes('belum aktif')) {
    return false;
  }
  return matchesAny(message, BOT_ACTIVE_PATTERNS);
}

function isBotDeactivatedLog(message) {
  return matchesAny(message, BOT_INACTIVE_PATTERNS);
}

function addUptimeDuration(uptimePerDay, startDate, endDate) {
  if (!startDate || !endDate) {
    return;
  }

  const durationHours = (endDate - startDate) / (1000 * 60 * 60);
  if (!Number.isFinite(durationHours) || durationHours <= 0) {
    return;
  }

  const key = getDateKey(startDate);
  uptimePerDay[key] = (uptimePerDay[key] || 0) + durationHours;
}

async function parseLogFilePerDay(logFilePath) {
  const fileStream = fs.createReadStream(logFilePath);
  const rl = readline.createInterface({ input: fileStream });
  const contextMoment = getFileDateContext(logFilePath);

  const messagesPerDay = {};
  const errorsPerDay = {};
  const uptimePerDay = {};

  let currentUptimeStart = null;
  let lastParsedDate = null;

  for await (const line of rl) {
    const parsed = parseLogLine(line, contextMoment);

    if (!parsed) {
      continue;
    }

    const { date, level, message } = parsed;
    const dayKey = getDateKey(date);
    lastParsedDate = date;

    if (isMessageDelivered(message)) {
      messagesPerDay[dayKey] = (messagesPerDay[dayKey] || 0) + 1;
    }

    if (isErrorLog(level, message)) {
      errorsPerDay[dayKey] = (errorsPerDay[dayKey] || 0) + 1;
    }

    if (isBotActivatedLog(message)) {
      currentUptimeStart = date;
    }

    if (isBotDeactivatedLog(message) && currentUptimeStart) {
      addUptimeDuration(uptimePerDay, currentUptimeStart, date);
      currentUptimeStart = null;
    }
  }

  if (currentUptimeStart && lastParsedDate) {
    addUptimeDuration(uptimePerDay, currentUptimeStart, lastParsedDate);
  }

  return { messagesPerDay, errorsPerDay, uptimePerDay };
}

module.exports = { parseLogFilePerDay };
