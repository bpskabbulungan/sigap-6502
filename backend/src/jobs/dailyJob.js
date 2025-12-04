const moment = require('moment-timezone');
require('moment/locale/id');
const {
  isWorkDayHybrid,
  TIMEZONE,
} = require('../utils/calendar');
const { sendMessagesToAll } = require('../controllers/messageController');
const {
  getNextRun,
  consumeManualOverride,
} = require('../services/scheduleService');
const config = require('../config/env');
const { LOG_AUDIENCES } = require('../controllers/logController');
const { APP_DATE_FORMAT } = require('../utils/dateFormatter');

moment.locale('id');

let jobTimer = null;
let cachedClient = null;
let logger = console.log;
let schedulerPrimed = false;

// Tidak boleh kirim lebih awal; 0ms grace memastikan kita menunggu tepat waktunya.
const EARLY_TRIGGER_GRACE_MS = 0;
// Boleh terlambat sampai 5 menit dan tetap kirim.
const LATE_TRIGGER_GRACE_MS = 5 * 60 * 1000;
const DATE_TIME_FORMAT = `${APP_DATE_FORMAT} HH:mm`;
const DATE_TIME_FORMAT_WITH_SECONDS = `${DATE_TIME_FORMAT}:ss`;

function setTimer(delay, handler) {
  if (jobTimer) {
    clearTimeout(jobTimer);
  }
  jobTimer = setTimeout(handler, delay);
}

async function planNextRun({ referenceMoment, reason = 'auto' } = {}) {
  if (!cachedClient) {
    logger('[Scheduler] WhatsApp client belum tersedia untuk menjadwalkan ulang.', {
      audience: LOG_AUDIENCES.PUBLIC,
    });
    return;
  }

  const rawNow = moment();
  const referenceForQuery = referenceMoment
    ? referenceMoment.clone()
    : rawNow.clone().tz(TIMEZONE);

  try {
    logger(`[Sistem] ✅ Mengecek Jadwal Pengiriman (reason=${reason})`, {
      audience: LOG_AUDIENCES.PUBLIC,
    });
    const nextRun = await getNextRun({ referenceMoment: referenceForQuery });
    const scheduleTimezone = nextRun?.schedule?.timezone || TIMEZONE;
    const scheduleNow = rawNow.clone().tz(scheduleTimezone);
    const baseMoment = referenceMoment
      ? referenceMoment.clone().tz(scheduleTimezone)
      : scheduleNow.clone();
    logger(
      `[Sistem] Hari ini adalah hari ${baseMoment
        .clone()
        .locale('id')
        .format('dddd')}`,
      {
        audience: LOG_AUDIENCES.PUBLIC,
      }
    );

    if (!nextRun || !nextRun.targetMoment) {
      logger('[Scheduler] Tidak ada jadwal aktif. Cek ulang dalam 1 jam.', {
        audience: LOG_AUDIENCES.PUBLIC,
      });
      logger('[Sistem] Tidak ada jadwal aktif, scheduler menunggu ...', {
        audience: LOG_AUDIENCES.PUBLIC,
      });
      setTimer(60 * 60 * 1000, () => planNextRun({ reason: 'idle-check' }));
      return;
    }

    const targetLocal = nextRun.targetMoment.clone().tz(TIMEZONE);
    const baseLocal = baseMoment.clone().tz(TIMEZONE);
    const isSameDay = targetLocal.isSame(baseLocal, 'day');
    const isNextDay = targetLocal.isSame(baseLocal.clone().add(1, 'day'), 'day');
    let dayNote = 'hari lain setelah hari ini';
    if (isSameDay) {
      dayNote = 'hari yang sama dengan hari ini';
    } else if (isNextDay) {
      dayNote = 'tanggal berikutnya dari hari ini';
    }
    const sourceNote = nextRun.override
      ? `Sumber manual override (${nextRun.override.date} ${nextRun.override.time})`
      : 'Sumber jadwal rutin';
    logger(
      `[Sistem] Pengiriman akan dilakukan pada ${targetLocal.format(
        `dddd, ${DATE_TIME_FORMAT} z`
      )} (${dayNote}). ${sourceNote}.`,
      {
        audience: LOG_AUDIENCES.PUBLIC,
      }
    );

    const scheduleTargetMoment = nextRun.targetMoment
      .clone()
      .tz(scheduleTimezone);
    const delayMs = Math.max(scheduleTargetMoment.diff(scheduleNow), 0);
    logger(
      `[Scheduler] Menjadwalkan job berikutnya pada ${nextRun.targetMoment.format(
        DATE_TIME_FORMAT_WITH_SECONDS
      )} (reason=${reason}, delay=${delayMs}ms)`,
      {
        audience: LOG_AUDIENCES.PUBLIC,
      }
    );

    setTimer(delayMs, () => executeRun(nextRun));
  } catch (err) {
    logger(`[Scheduler] Gagal mendapatkan jadwal berikutnya: ${err.message}`, {
      audience: LOG_AUDIENCES.PUBLIC,
    });
    setTimer(config.scheduler.retryIntervalMs, () =>
      planNextRun({ reason: 'schedule-retry' })
    );
  }
}

async function executeRun(nextRun) {
  const client = cachedClient;
  if (!client) {
    logger('[Scheduler] WhatsApp client tidak tersedia saat eksekusi.', {
      audience: LOG_AUDIENCES.PUBLIC,
    });
    return;
  }

  const scheduleTimezone = nextRun?.schedule?.timezone || TIMEZONE;
  const nowTz = moment().tz(scheduleTimezone);

  let runData = nextRun;
  try {
    const verification = await getNextRun({
      referenceMoment: nowTz.clone(),
      graceMs: LATE_TRIGGER_GRACE_MS,
    });

    if (!verification || !verification.targetMoment) {
      logger(
        '[Scheduler] Tidak menemukan jadwal aktif saat verifikasi eksekusi. Menjadwalkan ulang.',
        { audience: LOG_AUDIENCES.PUBLIC }
      );
      await planNextRun({ reason: 'verification-missing' });
      return;
    }

    const verifiedTargetTz = verification.targetMoment.clone().tz(scheduleTimezone);
    const originalTargetTz = nextRun.targetMoment.clone().tz(scheduleTimezone);
    const driftFromOriginal = verifiedTargetTz.diff(originalTargetTz);

      if (Math.abs(driftFromOriginal) > EARLY_TRIGGER_GRACE_MS) {
        const rescheduleDelay = verifiedTargetTz.diff(nowTz);
        if (rescheduleDelay > EARLY_TRIGGER_GRACE_MS) {
          logger(
            `[Scheduler] Jadwal berubah saat eksekusi. Mengikuti jadwal baru ${verifiedTargetTz.format(
              `${DATE_TIME_FORMAT} z`
            )} (delay ${rescheduleDelay}ms).`,
            { audience: LOG_AUDIENCES.PUBLIC }
          );
          setTimer(rescheduleDelay, () => executeRun(verification));
          return;
      }
    }

    runData = verification;
  } catch (err) {
    logger(
      `[Scheduler] Gagal verifikasi jadwal saat eksekusi: ${err.message}`,
      { audience: LOG_AUDIENCES.PUBLIC }
    );
  }

  const targetMomentTz = runData.targetMoment.clone().tz(scheduleTimezone);
  const diffMs = targetMomentTz.diff(nowTz);

  if (diffMs > EARLY_TRIGGER_GRACE_MS) {
    logger(
      `[Scheduler] Belum waktunya kirim (lebih awal ${diffMs}ms; target ${targetMomentTz.format(
        `${DATE_TIME_FORMAT} z`
      )}). Menunggu hingga waktunya dan menjadwalkan ulang.`,
      {
        audience: LOG_AUDIENCES.PUBLIC,
      }
    );
    setTimer(diffMs, () => executeRun(runData));
    return;
  }

  if (diffMs < -LATE_TRIGGER_GRACE_MS) {
    logger(
      `[Scheduler] Job tertunda ${Math.abs(diffMs)}ms dari jadwal ${targetMomentTz.format(
        `${DATE_TIME_FORMAT} z`
      )}. Mencari jadwal baru.`,
      {
        audience: LOG_AUDIENCES.PUBLIC,
      }
    );
    await planNextRun({
      referenceMoment: nowTz.clone(),
      reason: 'late-drift',
    });
    return;
  }

  const targetMoment = runData.targetMoment.clone();

  try {
    if (!runData.override) {
      const workday = await isWorkDayHybrid(logger, targetMoment);
      if (!workday) {
        logger(
          `[Scheduler] ${targetMoment.format(APP_DATE_FORMAT)} bukan hari kerja. Skip pengiriman.`,
          {
            audience: LOG_AUDIENCES.PUBLIC,
          }
        );
        await planNextRun({
          referenceMoment: targetMoment.add(1, 'day'),
          reason: 'non-workday',
        });
        return;
      }
    }

    let attempts = 0;
    let state = null;
    while (attempts < config.scheduler.maxRetries) {
      state = await client.getState().catch((err) => {
        logger(
          `[Bot] Gagal cek client state (percobaan ${attempts + 1}): ${err.message}`
        );
        return null;
      });

      if (state === 'CONNECTED') {
        break;
      }

      attempts += 1;
      logger(
        `[Bot] Client tidak siap (state: ${state}). Ulangi dalam ${Math.round(
          config.scheduler.retryIntervalMs / 1000
        )} detik...`
      );
      await new Promise((res) => setTimeout(res, config.scheduler.retryIntervalMs));
    }

    if (state !== 'CONNECTED') {
      logger(
        `[Bot] Gagal menghubungi client setelah ${config.scheduler.maxRetries} percobaan. Menjadwalkan ulang.`
      );
      await planNextRun({
        referenceMoment: targetMoment.add(1, 'minute'),
        reason: 'client-disconnected',
      });
      return;
    }

    await sendMessagesToAll(client, logger);

    if (runData.override) {
      await consumeManualOverride(runData.override.date);
    }

    await planNextRun({
      referenceMoment: targetMoment.add(1, 'minute'),
      reason: 'completed',
    });
  } catch (err) {
    logger(`[Bot] Error saat menjalankan job: ${err.message}`);
    await planNextRun({
      referenceMoment: moment().tz(TIMEZONE).add(15, 'minutes'),
      reason: 'error',
    });
  }
}

async function runDailyJob(client, addLog = console.log, options = {}) {
  cachedClient = client;
  logger = addLog;

  if (!cachedClient) {
    logger('[Bot] WhatsApp client tidak tersedia. Menunggu hingga siap.');
    return;
  }

  const { bootstrap = false } = options;
  const shouldPlan = bootstrap || !schedulerPrimed || !jobTimer;

  schedulerPrimed = schedulerPrimed || bootstrap;

  if (!shouldPlan) {
    logger(
      '[Scheduler] Scheduler sudah aktif. Referensi client diperbarui tanpa penjadwalan ulang.',
      {
        audience: LOG_AUDIENCES.PUBLIC,
      }
    );
    return;
  }

  schedulerPrimed = true;
  const reason = bootstrap ? 'initial' : 'resume';
  await planNextRun({ reason });
}

function cancelJob() {
  if (jobTimer) {
    clearTimeout(jobTimer);
    jobTimer = null;
  }
}

async function forceReschedule(reason = 'manual') {
  cancelJob();
  await planNextRun({ reason });
}

module.exports = {
  runDailyJob,
  forceReschedule,
  cancelJob,
};
