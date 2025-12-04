const moment = require('moment-timezone');
const { z } = require('zod');

const {
  getSchedule,
  setSchedule,
  addManualOverride,
  removeManualOverride,
  getNextRun,
} = require('../services/scheduleService');
const { forceReschedule } = require('../jobs/dailyJob');
const config = require('../config/env');
const { APP_DATE_REGEX, formatDateLabels } = require('../utils/dateFormatter');

const timeSchema = z
  .string()
  .trim()
  .regex(/^([01]?\d|2[0-3]):[0-5]\d$/, 'Format waktu HH:mm');

const dayKeySchema = z.enum(['1', '2', '3', '4', '5', '6', '7']);

const updateScheduleSchema = z
  .object({
    timezone: z.string().min(3).optional(),
    paused: z.boolean().optional(),
    dailyTimes: z
      .record(dayKeySchema, z.union([timeSchema, z.null()]))
      .optional(),
  })
  .strict();

const overrideSchema = z
  .object({
    date: z.string().trim().regex(APP_DATE_REGEX, 'Format tanggal DD-MM-YYYY'),
    time: timeSchema,
    note: z.string().max(255).nullable().optional(),
  })
  .strict();

function sanitizeScheduleForPublic(schedule) {
  return {
    timezone: schedule.timezone,
    dailyTimes: schedule.dailyTimes,
    paused: schedule.paused,
    nextOverride: schedule.manualOverrides.length
      ? {
          date: schedule.manualOverrides[0].date,
          time: schedule.manualOverrides[0].time,
          note: schedule.manualOverrides[0].note,
        }
      : null,
    overridesCount: schedule.manualOverrides.length,
    lastUpdatedAt: schedule.lastUpdatedAt,
  };
}

async function handleGetSchedule(req, res, next) {
  try {
    const schedule = await getSchedule();
    res.json({ schedule });
  } catch (err) {
    next(err);
  }
}

async function handleGetSchedulePublic(req, res, next) {
  try {
    const schedule = await getSchedule();
    res.json({ schedule: sanitizeScheduleForPublic(schedule) });
  } catch (err) {
    next(err);
  }
}

async function handleUpdateSchedule(req, res, next) {
  try {
    const payload = updateScheduleSchema.parse(req.body);
    const updated = await setSchedule(payload, {
      updatedBy: req.session?.username || 'admin',
    });

    await forceReschedule('schedule-updated');

    res.json({ schedule: updated });
  } catch (err) {
    next(err);
  }
}

async function handleAddOverride(req, res, next) {
  try {
    const payload = overrideSchema.parse(req.body);
    const updated = await addManualOverride(payload, {
      updatedBy: req.session?.username || 'admin',
    });

    await forceReschedule('override-added');

    res.status(201).json({ schedule: updated });
  } catch (err) {
    next(err);
  }
}

async function handleRemoveOverride(req, res, next) {
  try {
    const { date } = overrideSchema.pick({ date: true }).parse(req.params);
    const updated = await removeManualOverride(date);

    await forceReschedule('override-removed');

    res.json({ schedule: updated });
  } catch (err) {
    next(err);
  }
}

async function buildNextRun(reference) {
  const details = await getNextRun({
    referenceMoment: reference,
    includeDetails: true,
  });

  if (!details || !details.targetMoment) {
    return null;
  }

  const { adminLabel, publicLabel } = formatDateLabels(
    details.targetMoment,
    details.schedule.timezone,
  );

  return {
    timestamp: details.targetMoment.toISOString(),
    formatted: adminLabel,
    adminLabel,
    publicLabel,
    timezone: details.schedule.timezone,
    override: details.override
      ? {
          date: details.override.date,
          time: details.override.time,
          note: details.override.note,
        }
      : null,
  };
}

async function handleNextRunPreview(req, res, next) {
  try {
    const reference = req.query.reference
      ? moment.tz(req.query.reference, config.timezone)
      : moment().tz(config.timezone);

    const nextRun = await buildNextRun(reference);

    if (!nextRun) {
      res.json({
        nextRun: null,
        message: 'Belum ada jadwal aktif. Tambahkan jadwal terlebih dahulu.',
      });
      return;
    }

    res.json({ nextRun });
  } catch (err) {
    next(err);
  }
}

async function handleNextRunPreviewPublic(req, res, next) {
  try {
    const reference = moment().tz(config.timezone);
    const nextRun = await buildNextRun(reference);
    res.json({ nextRun });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  handleGetSchedule,
  handleGetSchedulePublic,
  handleUpdateSchedule,
  handleAddOverride,
  handleRemoveOverride,
  handleNextRunPreview,
  handleNextRunPreviewPublic,
};
