const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');
const config = require('../config/env');
const {
  normalizeAppDate,
  APP_DATE_REGEX,
  compareAppDates,
  parseAppDate,
} = require('../utils/dateFormatter');

const STORAGE_PATH = path.join(__dirname, '..', '..', 'storage', 'calendar_local.json');
const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'calendar_local.json');
const CALENDAR_RETENTION_DAYS = 7;

let localCalendar = null;
const listeners = new Set();
let calendarWriteLocked = false;

function withCalendarWriteLock(task) {
  if (calendarWriteLocked) {
    const error = new Error('Kalender lokal sedang diperbarui. Coba lagi.');
    error.status = 503;
    throw error;
  }

  calendarWriteLocked = true;
  try {
    return task();
  } finally {
    calendarWriteLocked = false;
  }
}

function ensureStorageFile() {
  fs.mkdirSync(path.dirname(STORAGE_PATH), { recursive: true });

  if (!fs.existsSync(STORAGE_PATH)) {
    try {
      const template = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
      fs.writeFileSync(STORAGE_PATH, template);
      console.log('[CalendarService] Storage calendar_local.json dibuat dari template.');
    } catch (err) {
      console.error('[CalendarService] Gagal menyiapkan calendar_local.json:', err.message);
    }
  }
}

function normalizeCalendar(data = {}) {
  const liburan = Array.isArray(data.LIBURAN) ? data.LIBURAN : [];
  const cutiBersama = Array.isArray(data.CUTI_BERSAMA) ? data.CUTI_BERSAMA : [];

  const normalizeList = (list) =>
    Array.from(
      new Set(
        list
          .map(normalizeAppDate)
          .filter((item) => APP_DATE_REGEX.test(item))
      )
    ).sort(compareAppDates);

  return {
    LIBURAN: normalizeList(liburan),
    CUTI_BERSAMA: normalizeList(cutiBersama),
  };
}

function createSnapshot(source = localCalendar) {
  const safeSource = source || { LIBURAN: [], CUTI_BERSAMA: [] };
  return {
    LIBURAN: [...safeSource.LIBURAN],
    CUTI_BERSAMA: [...safeSource.CUTI_BERSAMA],
  };
}

function pruneExpiredCalendar(calendarData) {
  const cutoff = moment
    .tz(config.timezone)
    .startOf('day')
    .subtract(CALENDAR_RETENTION_DAYS, 'days');

  const pruneList = (list) => {
    const kept = [];
    const removed = [];

    list.forEach((date) => {
      const parsed = parseAppDate(date, config.timezone);
      if (!parsed) {
        removed.push(date);
        return;
      }

      if (parsed.isBefore(cutoff, 'day')) {
        removed.push(date);
        return;
      }

      kept.push(date);
    });

    return { kept, removed };
  };

  const liburan = pruneList(calendarData.LIBURAN);
  const cutiBersama = pruneList(calendarData.CUTI_BERSAMA);

  return {
    calendar: {
      LIBURAN: liburan.kept,
      CUTI_BERSAMA: cutiBersama.kept,
    },
    removed: {
      LIBURAN: liburan.removed,
      CUTI_BERSAMA: cutiBersama.removed,
    },
    hasChanges: liburan.removed.length > 0 || cutiBersama.removed.length > 0,
  };
}

function loadCalendarFromDisk() {
  ensureStorageFile();

  try {
    const raw = fs.readFileSync(STORAGE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    const normalized = normalizeCalendar(parsed);
    const { calendar: pruned, removed, hasChanges } = pruneExpiredCalendar(normalized);

    if (hasChanges) {
      fs.writeFileSync(STORAGE_PATH, JSON.stringify(pruned, null, 2));
      console.log(
        `[CalendarService] Auto-cleanup menghapus ${removed.LIBURAN.length} libur dan ${removed.CUTI_BERSAMA.length} cuti bersama (lebih dari ${CALENDAR_RETENTION_DAYS} hari lalu).`
      );
    }

    return pruned;
  } catch (err) {
    console.error('[CalendarService] Gagal membaca calendar_local.json:', err.message);
    try {
      const fallback = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
      const parsed = JSON.parse(fallback);
      const normalized = normalizeCalendar(parsed);
      const { calendar: pruned } = pruneExpiredCalendar(normalized);
      fs.writeFileSync(STORAGE_PATH, JSON.stringify(pruned, null, 2));
      console.log('[CalendarService] Storage diperbarui menggunakan template.');
      return pruned;
    } catch (fallbackErr) {
      console.error('[CalendarService] Gagal memuat template kalender:', fallbackErr.message);
      return { LIBURAN: [], CUTI_BERSAMA: [] };
    }
  }
}

function getLocalCalendar() {
  if (!localCalendar) {
    localCalendar = loadCalendarFromDisk();
  }

  const { calendar: pruned, removed, hasChanges } = pruneExpiredCalendar(localCalendar);
  if (hasChanges) {
    withCalendarWriteLock(() => {
      fs.writeFileSync(STORAGE_PATH, JSON.stringify(pruned, null, 2));
      localCalendar = pruned;
    });
    console.log(
      `[CalendarService] Auto-cleanup menghapus ${removed.LIBURAN.length} libur dan ${removed.CUTI_BERSAMA.length} cuti bersama (lebih dari ${CALENDAR_RETENTION_DAYS} hari lalu).`
    );
    notifyListeners(createSnapshot(pruned));
  }

  return createSnapshot();
}

function notifyListeners(snapshot = createSnapshot()) {
  listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (err) {
      console.error('[CalendarService] Listener gagal dipanggil:', err.message);
    }
  });
}

function setLocalCalendar(data) {
  return withCalendarWriteLock(() => {
    const normalized = normalizeCalendar(data);
    const { calendar: pruned, removed } = pruneExpiredCalendar(normalized);
    try {
      fs.writeFileSync(STORAGE_PATH, JSON.stringify(pruned, null, 2));
      localCalendar = pruned;

      if (removed.LIBURAN.length > 0 || removed.CUTI_BERSAMA.length > 0) {
        console.log(
          `[CalendarService] Auto-cleanup menghapus ${removed.LIBURAN.length} libur dan ${removed.CUTI_BERSAMA.length} cuti bersama (lebih dari ${CALENDAR_RETENTION_DAYS} hari lalu).`
        );
      }

      const snapshot = createSnapshot(pruned);
      notifyListeners(snapshot);
      return snapshot;
    } catch (err) {
      console.error('[CalendarService] Gagal menulis calendar_local.json:', err.message);
      const error = new Error('Gagal menyimpan data kalender lokal.');
      error.status = 500;
      throw error;
    }
  });
}

function onLocalCalendarChange(listener) {
  try {
    listener(getLocalCalendar());
  } catch (err) {
    console.error('[CalendarService] Listener gagal saat inisialisasi:', err.message);
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}

ensureStorageFile();
localCalendar = loadCalendarFromDisk();

module.exports = {
  getLocalCalendar,
  setLocalCalendar,
  onLocalCalendarChange,
};
