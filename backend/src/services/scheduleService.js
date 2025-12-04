const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const moment = require('moment-timezone');
const { v4: uuid } = require('uuid');

const config = require('../config/env');
const { setupLogger } = require('../utils/logger');
const {
  APP_DATE_FORMAT,
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

const DEFAULT_SCHEDULE = {
  timezone: config.scheduler.defaultSchedule.timezone,
  dailyTimes: { ...config.scheduler.defaultSchedule.dailyTimes },
  manualOverrides: [],
  paused: false,
  lastUpdatedAt: new Date(0).toISOString(),
  updatedBy: 'system',
  defaultVersion: config.scheduler.defaultSchedule.defaultVersion || 'v1',
};

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

function sanitizeSchedule(raw) {
  const schedule = {
    ...DEFAULT_SCHEDULE,
    ...raw,
    dailyTimes: {
      ...DEFAULT_SCHEDULE.dailyTimes,
      ...(raw?.dailyTimes || {}),
    },
    manualOverrides: Array.isArray(raw?.manualOverrides)
      ? raw.manualOverrides
      : [],
  };

  const providedVersion = raw?.defaultVersion;
  schedule.defaultVersion =
    providedVersion || LEGACY_DEFAULT_VERSION;

  schedule.manualOverrides = schedule.manualOverrides
    .map((item) => {
      const normalizedDate = normalizeAppDate(item.date);
      return {
        id: item.id || uuid(),
        date: normalizedDate,
        time: item.time,
        note: item.note || null,
        createdAt: item.createdAt || new Date().toISOString(),
        createdBy: item.createdBy || 'unknown',
        consumedAt: item.consumedAt || null,
      };
    })
    .filter(
      (item) =>
        APP_DATE_REGEX.test(item.date) &&
        TIME_PATTERN.test(item.time) &&
        parseAppDate(item.date, schedule.timezone)
    )
    .sort((a, b) => compareAppDates(a.date, b.date));

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

function findActiveOverride(schedule, dateKey) {
  return schedule.manualOverrides.find(
    (item) => item.date === dateKey && !item.consumedAt
  );
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

async function getSchedule() {
  const schedule = await readSchedule();
  pruneOverrides(schedule, moment().tz(schedule.timezone));
  return schedule;
}

async function setSchedule(payload, options = {}) {
  const schedule = await getSchedule();

  if (typeof payload.paused === 'boolean') {
    schedule.paused = payload.paused;
  }

  if (payload.timezone) {
    schedule.timezone = payload.timezone;
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
}

async function addManualOverride({ date, time, note }, options = {}) {
  const normalizedDate = normalizeAppDate(date);

  if (!normalizedDate || !APP_DATE_REGEX.test(normalizedDate)) {
    throw new Error('Format tanggal harus DD-MM-YYYY');
  }
  if (!TIME_PATTERN.test(time)) {
    throw new Error('Format waktu harus HH:mm');
  }

  const schedule = await getSchedule();
  const timezone = schedule.timezone;
  const targetMoment = parseAppDateTime(normalizedDate, time, timezone);

  if (!targetMoment) {
    throw new Error('Tanggal atau waktu tidak valid');
  }

  const existing = findActiveOverride(schedule, normalizedDate);
  if (existing) {
    existing.time = time;
    existing.note = note || existing.note;
    existing.createdBy = options.updatedBy || existing.createdBy;
    existing.createdAt = existing.createdAt || new Date().toISOString();
  } else {
    schedule.manualOverrides.push({
      id: uuid(),
      date: normalizedDate,
      time,
      note: note || null,
      createdAt: new Date().toISOString(),
      createdBy: options.updatedBy || 'admin',
      consumedAt: null,
    });
  }

  schedule.manualOverrides.sort((a, b) => compareAppDates(a.date, b.date));
  schedule.updatedBy = options.updatedBy || schedule.updatedBy;

  return writeSchedule(schedule);
}

async function removeManualOverride(date) {
  const schedule = await getSchedule();
  const normalizedDate = normalizeAppDate(date);
  schedule.manualOverrides = schedule.manualOverrides.filter(
    (item) => item.date !== normalizedDate
  );
  return writeSchedule(schedule);
}

async function consumeManualOverride(date) {
  const schedule = await getSchedule();
  const normalizedDate = normalizeAppDate(date);
  const override = findActiveOverride(schedule, normalizedDate);
  if (override) {
    override.consumedAt = new Date().toISOString();
    await writeSchedule(schedule);
  }
}

async function getNextRun({
  referenceMoment = moment().tz(config.timezone),
  includeDetails = false,
  graceMs = 0,
} = {}) {
  const schedule = await getSchedule();
  const tzReference = referenceMoment.clone().tz(schedule.timezone);

  if (schedule.paused) {
    const override = schedule.manualOverrides.find((item) => {
      const target = parseAppDateTime(item.date, item.time, schedule.timezone);
      return isUpcoming(target, tzReference, graceMs) && !item.consumedAt;
    });

    if (!override) {
      return null;
    }

    const dateMoment = parseAppDate(override.date, schedule.timezone);
    const targetMoment = parseTimeToMoment(dateMoment, override.time);

    return {
      schedule,
      override,
      targetMoment,
    };
  }

  let cursor = tzReference.clone();
  for (let i = 0; i < 21; i += 1) {
    const dateKey = cursor.format(APP_DATE_FORMAT);
    const override = findActiveOverride(schedule, dateKey);

    if (override) {
      const targetMoment = parseTimeToMoment(cursor, override.time);
      if (isUpcoming(targetMoment, tzReference, graceMs)) {
        return {
          schedule,
          override,
          targetMoment,
        };
      }
      cursor = cursor.add(1, 'day').startOf('day');
      continue;
    }

    const weekday = cursor.isoWeekday();
    const defaultTime = resolveDailyTime(schedule, weekday);
    if (!defaultTime) {
      cursor = cursor.add(1, 'day').startOf('day');
      continue;
    }

    const targetMoment = parseTimeToMoment(cursor, defaultTime);
    if (isUpcoming(targetMoment, tzReference, graceMs)) {
      return {
        schedule,
        override: null,
        targetMoment,
      };
    }

    cursor = cursor.add(1, 'day').startOf('day');
  }

  return includeDetails ? { schedule, override: null, targetMoment: null } : null;
}

module.exports = {
  getSchedule,
  setSchedule,
  addManualOverride,
  removeManualOverride,
  consumeManualOverride,
  getNextRun,
};
