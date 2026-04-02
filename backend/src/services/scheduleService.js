const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const moment = require('moment-timezone');
const { v4: uuid } = require('uuid');

const config = require('../config/env');
const { setupLogger } = require('../utils/logger');
const { withFileLock } = require('../utils/fileMutex');
const {
  APP_DATE_REGEX,
  compareAppDates,
  normalizeAppDate,
  parseAppDate,
  parseAppDateTime,
} = require('../utils/dateFormatter');

const logger = setupLogger('scheduler');

const STORAGE_DIR = path.resolve(__dirname, '..', '..', 'storage');
const CONFIG_FILENAME = 'schedule-config.json';
const CONFIG_PATH = path.join(STORAGE_DIR, CONFIG_FILENAME);
const TIME_PATTERN = /^([01]?\d|2[0-3]):[0-5]\d$/;

const LEGACY_DEFAULT_VERSION = 'legacy';
const TIMEZONE_VALIDATION_MESSAGE =
  'Timezone tidak valid. Gunakan timezone IANA, misalnya Asia/Makassar.';
const DEFAULT_MESSAGE_MODE = 'default-template';
const CUSTOM_MESSAGE_MODE = 'custom-message';
const CUSTOM_MESSAGE_MAX_LENGTH = 4000;

const DEFAULT_SCHEDULE = {
  timezone: config.scheduler.defaultSchedule.timezone,
  dailyTimes: { ...config.scheduler.defaultSchedule.dailyTimes },
  manualOverrides: [],
  paused: false,
  lastUpdatedAt: new Date(0).toISOString(),
  updatedBy: 'system',
  defaultVersion: config.scheduler.defaultSchedule.defaultVersion || 'v1',
};

function withScheduleLock(task) {
  return withFileLock(CONFIG_PATH, task);
}

function createValidationError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function isValidIanaTimezone(value) {
  if (typeof value !== 'string') {
    return false;
  }

  const timezone = value.trim();
  if (!timezone) {
    return false;
  }

  return Boolean(moment.tz.zone(timezone));
}

function normalizeDailyTimes(dailyTimes = {}) {
  return Object.entries(dailyTimes).reduce((acc, [key, value]) => {
    acc[String(key)] = value ?? null;
    return acc;
  }, {});
}

function dailyTimesMatch(current = {}, reference = {}) {
  const normalizedCurrent = normalizeDailyTimes(current);
  const normalizedReference = normalizeDailyTimes(reference);
  const keys = new Set([
    ...Object.keys(normalizedCurrent),
    ...Object.keys(normalizedReference),
  ]);

  for (const key of keys) {
    if (normalizedCurrent[key] !== normalizedReference[key]) {
      return false;
    }
  }

  return true;
}

function getAutoUpgradeReason(schedule) {
  const managedBySystem = !schedule.updatedBy || schedule.updatedBy === 'system';
  if (!managedBySystem) {
    return null;
  }

  if (schedule.manualOverrides.length > 0) {
    return null;
  }

  const versionMatches =
    schedule.defaultVersion === DEFAULT_SCHEDULE.defaultVersion;
  if (!versionMatches) {
    return 'version-mismatch';
  }

  if (!dailyTimesMatch(schedule.dailyTimes, DEFAULT_SCHEDULE.dailyTimes)) {
    return 'legacy-times';
  }

  return null;
}

function normalizeMessageMode(rawMode, rawCustomMessage) {
  if (rawMode === CUSTOM_MESSAGE_MODE) {
    return CUSTOM_MESSAGE_MODE;
  }

  if (typeof rawCustomMessage === 'string' && rawCustomMessage.trim()) {
    return CUSTOM_MESSAGE_MODE;
  }

  return DEFAULT_MESSAGE_MODE;
}

function sanitizeCustomMessage(rawMessage, mode) {
  if (mode !== CUSTOM_MESSAGE_MODE) {
    return null;
  }

  if (typeof rawMessage !== 'string') {
    return null;
  }

  const trimmed = rawMessage.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, CUSTOM_MESSAGE_MAX_LENGTH);
}

function compareManualOverrides(a, b) {
  const byDate = compareAppDates(a.date, b.date);
  if (byDate !== 0) {
    return byDate;
  }

  if (a.time < b.time) {
    return -1;
  }

  if (a.time > b.time) {
    return 1;
  }

  return 0;
}

function sanitizeSchedule(raw) {
  const sourceManualOverrides = Array.isArray(raw?.manualOverrides)
    ? raw.manualOverrides
    : Array.isArray(raw?.manualAnnouncements)
    ? raw.manualAnnouncements
    : [];

  const schedule = {
    ...DEFAULT_SCHEDULE,
    ...raw,
    dailyTimes: {
      ...DEFAULT_SCHEDULE.dailyTimes,
      ...(raw?.dailyTimes || {}),
    },
    manualOverrides: sourceManualOverrides,
  };

  const configuredTimezone =
    typeof schedule.timezone === 'string' ? schedule.timezone.trim() : '';
  schedule.timezone = isValidIanaTimezone(configuredTimezone)
    ? configuredTimezone
    : DEFAULT_SCHEDULE.timezone;

  const providedVersion = raw?.defaultVersion;
  schedule.defaultVersion =
    providedVersion || LEGACY_DEFAULT_VERSION;

  schedule.manualOverrides = schedule.manualOverrides
    .map((item) => {
      const normalizedDate = normalizeAppDate(item.date);
      const messageMode = normalizeMessageMode(item.messageMode, item.customMessage);
      const customMessage = sanitizeCustomMessage(item.customMessage, messageMode);

      return {
        id: item.id || uuid(),
        date: normalizedDate,
        time: item.time,
        note: item.note || null,
        messageMode,
        customMessage,
        createdAt: item.createdAt || new Date().toISOString(),
        createdBy: item.createdBy || 'unknown',
        consumedAt: item.consumedAt || null,
      };
    })
    .filter(
      (item) =>
        APP_DATE_REGEX.test(item.date) &&
        TIME_PATTERN.test(item.time) &&
        parseAppDate(item.date, schedule.timezone) &&
        (item.messageMode !== CUSTOM_MESSAGE_MODE ||
          (typeof item.customMessage === 'string' && item.customMessage.trim()))
    )
    .sort(compareManualOverrides);

  const autoUpgradeReason = getAutoUpgradeReason(schedule);

  if (autoUpgradeReason) {
    schedule.timezone = DEFAULT_SCHEDULE.timezone;
    schedule.dailyTimes = { ...DEFAULT_SCHEDULE.dailyTimes };
    schedule.defaultVersion = DEFAULT_SCHEDULE.defaultVersion;
    schedule.updatedBy = DEFAULT_SCHEDULE.updatedBy;
    schedule.__autoUpgraded = true;
    schedule.__autoUpgradeReason = autoUpgradeReason;
  }

  return schedule;
}

function buildScheduleDocument(schedule, { lastUpdatedAt } = {}) {
  const sanitized = sanitizeSchedule(schedule);
  return {
    ...sanitized,
    lastUpdatedAt: lastUpdatedAt ?? new Date().toISOString(),
  };
}

async function writeScheduleFile(scheduleDocument) {
  await fsp.writeFile(
    CONFIG_PATH,
    `${JSON.stringify(scheduleDocument, null, 2)}\n`,
    'utf-8'
  );
}

async function ensureStorage() {
  await fsp.mkdir(STORAGE_DIR, { recursive: true });
  if (!fs.existsSync(CONFIG_PATH)) {
    const initialSchedule = buildScheduleDocument(DEFAULT_SCHEDULE);
    await writeScheduleFile(initialSchedule);
  }
}

async function readSchedule() {
  await ensureStorage();
  const raw = await fsp.readFile(CONFIG_PATH, 'utf-8');
  const parsed = JSON.parse(raw);
  const schedule = sanitizeSchedule(parsed);

  if (schedule.__autoUpgraded) {
    const persistable = { ...schedule };
    delete persistable.__autoUpgraded;
    const autoUpgradeReason = persistable.__autoUpgradeReason;
    delete persistable.__autoUpgradeReason;

    logger.info(
      `[Scheduler] Default schedule auto-upgraded to ${persistable.defaultVersion} (reason=${autoUpgradeReason || 'unknown'})`
    );

    await writeSchedule(persistable);
    return persistable;
  }

  return schedule;
}

async function writeSchedule(schedule) {
  const enriched = buildScheduleDocument(schedule);

  await fsp.mkdir(STORAGE_DIR, { recursive: true });
  await writeScheduleFile(enriched);
  return enriched;
}

function parseTimeToMoment(momentRef, timeString) {
  if (!TIME_PATTERN.test(timeString)) {
    throw new Error('Format waktu tidak valid. Gunakan HH:mm');
  }
  const [hour, minute] = timeString.split(':').map(Number);
  return momentRef
    .clone()
    .hour(hour)
    .minute(minute)
    .second(0)
    .millisecond(0);
}

function resolveDailyTime(schedule, weekday) {
  return schedule.dailyTimes[String(weekday)] ?? schedule.dailyTimes[weekday] ?? null;
}

function pruneOverrides(schedule, referenceMoment) {
  const keepThreshold = referenceMoment.clone().subtract(3, 'days').startOf('day');

  schedule.manualOverrides = schedule.manualOverrides.filter((item) => {
    const dateMoment = parseAppDate(item.date, schedule.timezone);
    if (!dateMoment) return false;
    if (dateMoment.isBefore(keepThreshold)) return false;
    return true;
  });
}

function isUpcoming(targetMoment, referenceMoment, graceMs = 0) {
  const positiveGrace = Math.max(graceMs, 0);
  return targetMoment.diff(referenceMoment) >= -positiveGrace;
}

async function getScheduleUnsafe() {
  const schedule = await readSchedule();
  pruneOverrides(schedule, moment().tz(schedule.timezone));
  return schedule;
}

async function getSchedule() {
  return withScheduleLock(() => getScheduleUnsafe());
}

async function setSchedule(payload, options = {}) {
  return withScheduleLock(async () => {
    const schedule = await getScheduleUnsafe();

    if (typeof payload.paused === 'boolean') {
      schedule.paused = payload.paused;
    }

    if (typeof payload.timezone !== 'undefined') {
      const timezone =
        typeof payload.timezone === 'string' ? payload.timezone.trim() : '';

      if (!isValidIanaTimezone(timezone)) {
        throw createValidationError(TIMEZONE_VALIDATION_MESSAGE);
      }

      schedule.timezone = timezone;
    }

    if (payload.dailyTimes) {
      Object.entries(payload.dailyTimes).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') {
          schedule.dailyTimes[key] = null;
          return;
        }

        if (!TIME_PATTERN.test(value)) {
          throw new Error(`Format waktu untuk hari ${key} tidak valid.`);
        }

        schedule.dailyTimes[key] = value;
      });
    }

    if (options.updatedBy) {
      schedule.updatedBy = options.updatedBy;
    }

    return writeSchedule(schedule);
  });
}

async function addManualOverride(
  { date, time, note, messageMode, customMessage },
  options = {}
) {
  return withScheduleLock(async () => {
    const normalizedDate = normalizeAppDate(date);

    if (!normalizedDate || !APP_DATE_REGEX.test(normalizedDate)) {
      throw new Error('Format tanggal harus DD-MM-YYYY');
    }
    if (!TIME_PATTERN.test(time)) {
      throw new Error('Format waktu harus HH:mm');
    }

    const schedule = await getScheduleUnsafe();
    const timezone = schedule.timezone;
    const targetMoment = parseAppDateTime(normalizedDate, time, timezone);

    if (!targetMoment) {
      throw new Error('Tanggal atau waktu tidak valid');
    }

    const defaultTimeForDay = resolveDailyTime(
      schedule,
      targetMoment.isoWeekday()
    );
    if (!schedule.paused && defaultTimeForDay && defaultTimeForDay === time) {
      throw new Error(
        'Waktu pengumuman bentrok dengan jadwal otomatis. Gunakan jam lain agar keduanya terkirim.'
      );
    }

    const resolvedMode = normalizeMessageMode(messageMode, customMessage);
    const sanitizedCustomMessage = sanitizeCustomMessage(
      customMessage,
      resolvedMode
    );

    if (resolvedMode === CUSTOM_MESSAGE_MODE && !sanitizedCustomMessage) {
      throw new Error('Pesan custom wajib diisi untuk mode pesan custom.');
    }

    const existing = schedule.manualOverrides.find(
      (item) =>
        item.date === normalizedDate &&
        item.time === time &&
        !item.consumedAt
    );

    if (existing) {
      throw new Error(
        'Pengumuman terjadwal pada tanggal dan waktu tersebut sudah ada.'
      );
    }

    schedule.manualOverrides.push({
      id: uuid(),
      date: normalizedDate,
      time,
      note: note || null,
      messageMode: resolvedMode,
      customMessage: sanitizedCustomMessage,
      createdAt: new Date().toISOString(),
      createdBy: options.updatedBy || 'admin',
      consumedAt: null,
    });

    schedule.manualOverrides.sort(compareManualOverrides);
    schedule.updatedBy = options.updatedBy || schedule.updatedBy;

    return writeSchedule(schedule);
  });
}

async function removeManualOverride(identifier) {
  return withScheduleLock(async () => {
    const schedule = await getScheduleUnsafe();
    const normalizedDate = normalizeAppDate(identifier);
    schedule.manualOverrides = schedule.manualOverrides.filter((item) => {
      if (normalizedDate) {
        return item.date !== normalizedDate;
      }

      return item.id !== identifier;
    });
    return writeSchedule(schedule);
  });
}

function findActiveOverrideByIdentifier(schedule, identifier) {
  if (!identifier) {
    return null;
  }

  const normalizedDate = normalizeAppDate(identifier);
  if (normalizedDate) {
    return schedule.manualOverrides.find(
      (item) => item.date === normalizedDate && !item.consumedAt
    );
  }

  return schedule.manualOverrides.find(
    (item) => item.id === identifier && !item.consumedAt
  );
}

async function consumeManualOverride(identifier) {
  return withScheduleLock(async () => {
    const schedule = await getScheduleUnsafe();
    const override = findActiveOverrideByIdentifier(schedule, identifier);
    if (override) {
      override.consumedAt = new Date().toISOString();
      await writeSchedule(schedule);
    }
  });
}

function findNextManualRun(schedule, tzReference, graceMs) {
  let selected = null;

  for (const item of schedule.manualOverrides) {
    if (item.consumedAt) {
      continue;
    }

    const dateMoment = parseAppDate(item.date, schedule.timezone);
    if (!dateMoment) {
      continue;
    }

    const targetMoment = parseTimeToMoment(dateMoment, item.time);
    if (!isUpcoming(targetMoment, tzReference, graceMs)) {
      continue;
    }

    if (!selected || targetMoment.isBefore(selected.targetMoment)) {
      selected = {
        override: item,
        targetMoment,
      };
    }
  }

  return selected;
}

function findNextDefaultRun(schedule, tzReference, graceMs) {
  if (schedule.paused) {
    return null;
  }

  let cursor = tzReference.clone();
  for (let i = 0; i < 21; i += 1) {
    const weekday = cursor.isoWeekday();
    const defaultTime = resolveDailyTime(schedule, weekday);

    if (defaultTime) {
      const targetMoment = parseTimeToMoment(cursor, defaultTime);
      if (isUpcoming(targetMoment, tzReference, graceMs)) {
        return {
          override: null,
          targetMoment,
        };
      }
    }

    cursor = cursor.add(1, 'day').startOf('day');
  }

  return null;
}

async function getNextRun({
  referenceMoment = moment().tz(config.timezone),
  includeDetails = false,
  graceMs = 0,
} = {}) {
  return withScheduleLock(async () => {
    const schedule = await getScheduleUnsafe();
    const tzReference = referenceMoment.clone().tz(schedule.timezone);

    const nextManual = findNextManualRun(schedule, tzReference, graceMs);
    const nextDefault = findNextDefaultRun(schedule, tzReference, graceMs);

    let selected = nextDefault;
    if (
      nextManual &&
      (!selected || nextManual.targetMoment.isBefore(selected.targetMoment))
    ) {
      selected = nextManual;
    }

    if (!selected || !selected.targetMoment) {
      return includeDetails ? { schedule, override: null, targetMoment: null } : null;
    }

    return {
      schedule,
      override: selected.override,
      targetMoment: selected.targetMoment,
    };
  });
}

module.exports = {
  getSchedule,
  setSchedule,
  addManualOverride,
  removeManualOverride,
  consumeManualOverride,
  getNextRun,
};
