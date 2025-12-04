const moment = require('moment-timezone');
const config = require('../config/env');
const {
  getLocalCalendar,
  onLocalCalendarChange,
} = require('../services/localCalendarService');
const { APP_DATE_FORMAT } = require('./dateFormatter');

const TIMEZONE = config.timezone;

let LIBURAN = new Set();
let CUTI_BERSAMA = new Set();

function applyLocalCalendar(data = {}) {
  LIBURAN = new Set(Array.isArray(data.LIBURAN) ? data.LIBURAN : []);
  CUTI_BERSAMA = new Set(Array.isArray(data.CUTI_BERSAMA) ? data.CUTI_BERSAMA : []);
}

const workdayCache = {};

function clearCalendarCache() {
  Object.keys(workdayCache).forEach((key) => delete workdayCache[key]);
  console.log('[Calendar] Cache kalender telah direset.');
}

applyLocalCalendar(getLocalCalendar());

onLocalCalendarChange((data) => {
  applyLocalCalendar(data);
  clearCalendarCache();
});

function isWorkDay(date = moment().tz(TIMEZONE), addLog = () => {}) {
  const todayStr = date.format(APP_DATE_FORMAT);
  const weekday = date.weekday();

  if (weekday === 0 || weekday === 6) {
    addLog(`[Calendar] ${todayStr} adalah weekend.`);
    return false;
  }

  if (LIBURAN.has(todayStr) || CUTI_BERSAMA.has(todayStr)) {
    addLog(`[Calendar] ${todayStr} adalah hari libur/cuti bersama (lokal).`);
    return false;
  }

  addLog(`[Calendar] ${todayStr} adalah hari kerja (lokal).`);
  return true;
}

function isWeekend(date) {
  const day = date.isoWeekday();
  return day === 6 || day === 7;
}

async function isWorkDayHybrid(addLog = () => {}, date = moment().tz(TIMEZONE)) {
  const todayStr = date.format(APP_DATE_FORMAT);

  if (todayStr in workdayCache) {
    addLog(`[Calendar] Menggunakan cache untuk ${todayStr}`);
    return workdayCache[todayStr];
  }

  if (isWeekend(date)) {
    addLog(`[Calendar] ${todayStr} adalah akhir pekan (Sabtu/Minggu).`);
    workdayCache[todayStr] = false;
    return false;
  }

  const localResult = isWorkDay(date, addLog);
  workdayCache[todayStr] = localResult;
  return localResult;
}

async function getNextWorkDay(startDate = moment().tz(TIMEZONE), addLog = () => {}) {
  let date = startDate.clone().add(1, 'day');

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (isWeekend(date)) {
      addLog(`[Calendar] ${date.format(APP_DATE_FORMAT)} adalah akhir pekan. Lewati.`);
      date.add(1, 'day');
      continue;
    }

    const tempLog = [];
    const isWork = await isWorkDayHybrid((msg) => tempLog.push(msg), date);

    if (isWork) {
      tempLog.forEach(addLog);
      addLog(`[Calendar] Hari kerja berikutnya: ${date.format(APP_DATE_FORMAT)}`);
      return date;
    }

    date.add(1, 'day');
  }
}

module.exports = {
  isWorkDay,
  isWorkDayHybrid,
  getNextWorkDay,
  clearCalendarCache,
  TIMEZONE,
};
