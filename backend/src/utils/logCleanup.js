const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');
const { normalizeAppDate, parseAppDate } = require('./dateFormatter');
const { TIMEZONE } = require('./calendar');

const LOG_DATE_PATTERN = /(\d{2}-\d{2}-\d{4}|\d{4}-\d{2}-\d{2})/;

function extractLogDate(fileName, timezone) {
  const match = fileName.match(LOG_DATE_PATTERN);
  if (!match) return null;
  const normalized = normalizeAppDate(match[1]);
  if (!normalized) return null;
  return parseAppDate(normalized, timezone);
}

async function cleanupOldLogs({
  logDir = path.join(__dirname, '..', '..', 'logs'),
  daysToKeep = 14,
  timezone = TIMEZONE,
} = {}) {
  await fs.promises.mkdir(logDir, { recursive: true });
  const files = (await fs.promises.readdir(logDir)).filter((file) => file.endsWith('.log'));
  const cutoff = moment.tz(timezone).startOf('day').subtract(daysToKeep, 'days');

  let removedCount = 0;
  const errors = [];

  for (const file of files) {
    const filePath = path.join(logDir, file);
    let fileMoment = extractLogDate(file, timezone);
    if (!fileMoment) {
      try {
        const stats = await fs.promises.stat(filePath);
        fileMoment = moment.tz(stats.mtime, timezone);
      } catch (err) {
        errors.push({ file, error: err });
        continue;
      }
    }

    if (fileMoment.isBefore(cutoff)) {
      try {
        await fs.promises.unlink(filePath);
        removedCount += 1;
      } catch (err) {
        errors.push({ file, error: err });
      }
    }
  }

  return { removedCount, checkedCount: files.length, errors };
}

function startLogCleanupScheduler(logFn, options = {}) {
  const {
    logDir,
    daysToKeep = 14,
    timezone = TIMEZONE,
    intervalMs = 24 * 60 * 60 * 1000,
  } = options;
  const safeLog = typeof logFn === 'function' ? logFn : () => {};

  const runCleanup = async () => {
    try {
      const result = await cleanupOldLogs({ logDir, daysToKeep, timezone });
      if (result.removedCount > 0) {
        safeLog(
          `[Sistem] Membersihkan ${result.removedCount} log lama (retensi ${daysToKeep} hari).`
        );
      }
      if (result.errors.length > 0) {
        safeLog(
          `[Sistem] Gagal menghapus ${result.errors.length} log lama.`,
          'warn'
        );
      }
    } catch (err) {
      safeLog(`[Sistem] Gagal menjalankan pembersihan log: ${err.message}`, 'warn');
    }
  };

  runCleanup();
  return setInterval(runCleanup, intervalMs);
}

module.exports = {
  cleanupOldLogs,
  startLogCleanupScheduler,
};
