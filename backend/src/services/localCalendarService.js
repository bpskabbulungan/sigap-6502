const fs = require('fs');
const path = require('path');
const {
  normalizeAppDate,
  APP_DATE_REGEX,
  compareAppDates,
} = require('../utils/dateFormatter');

const STORAGE_PATH = path.join(__dirname, '..', '..', 'storage', 'calendar_local.json');
const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'calendar_local.json');

let localCalendar = null;
const listeners = new Set();

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

function loadCalendarFromDisk() {
  ensureStorageFile();

  try {
    const raw = fs.readFileSync(STORAGE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return normalizeCalendar(parsed);
  } catch (err) {
    console.error('[CalendarService] Gagal membaca calendar_local.json:', err.message);
    try {
      const fallback = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
      const parsed = JSON.parse(fallback);
      const normalized = normalizeCalendar(parsed);
      fs.writeFileSync(STORAGE_PATH, JSON.stringify(normalized, null, 2));
      console.log('[CalendarService] Storage diperbarui menggunakan template.');
      return normalized;
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
  return {
    LIBURAN: [...localCalendar.LIBURAN],
    CUTI_BERSAMA: [...localCalendar.CUTI_BERSAMA],
  };
}

function notifyListeners() {
  const snapshot = getLocalCalendar();
  listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (err) {
      console.error('[CalendarService] Listener gagal dipanggil:', err.message);
    }
  });
}

function setLocalCalendar(data) {
  const normalized = normalizeCalendar(data);
  try {
    fs.writeFileSync(STORAGE_PATH, JSON.stringify(normalized, null, 2));
    localCalendar = normalized;
    notifyListeners();
    return getLocalCalendar();
  } catch (err) {
    console.error('[CalendarService] Gagal menulis calendar_local.json:', err.message);
    const error = new Error('Gagal menyimpan data kalender lokal.');
    error.status = 500;
    throw error;
  }
}

function onLocalCalendarChange(listener) {
  listeners.add(listener);
  try {
    listener(getLocalCalendar());
  } catch (err) {
    console.error('[CalendarService] Listener gagal saat inisialisasi:', err.message);
  }
  return () => listeners.delete(listener);
}

ensureStorageFile();
localCalendar = loadCalendarFromDisk();

module.exports = {
  getLocalCalendar,
  setLocalCalendar,
  onLocalCalendarChange,
};
