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

const MANUAL_MESSAGE_MODES = ['default-template', 'custom-message'];
const CUSTOM_MESSAGE_MAX_LENGTH = 4000;

const timeSchema = z
  .string()
  .trim()
  .regex(/^([01]?\d|2[0-3]):[0-5]\d$/, 'Format waktu HH:mm');

const dayKeySchema = z.enum(['1', '2', '3', '4', '5', '6', '7']);

const timezoneSchema = z
  .string()
  .trim()
  .min(3)
  .refine((value) => Boolean(moment.tz.zone(value)), {
    message: 'Timezone tidak valid. Gunakan timezone IANA, misalnya Asia/Makassar.',
  });

const updateScheduleSchema = z
  .object({
    timezone: timezoneSchema.optional(),
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
    messageMode: z.enum(MANUAL_MESSAGE_MODES).optional(),
    customMessage: z
      .string()
      .max(
        CUSTOM_MESSAGE_MAX_LENGTH,
        `Pesan custom maksimal ${CUSTOM_MESSAGE_MAX_LENGTH} karakter.`
      )
      .nullable()
      .optional(),
  })
  .strict()
  .superRefine((payload, ctx) => {
    if (payload.messageMode !== 'custom-message') {
      return;
    }

    if (!payload.customMessage || !payload.customMessage.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['customMessage'],
        message: 'Pesan custom wajib diisi untuk mode pesan custom.',
      });
    }
  });

const removeOverrideParamsSchema = z
  .object({
    identifier: z.string().trim().min(1, 'Identifier wajib diisi.'),
  })
  .strict();

function toHttpValidationError(err, fallbackMessage) {
  if (!(err instanceof z.ZodError)) {
    return err;
  }

  const message = err.issues?.[0]?.message || fallbackMessage;
  const validationError = new Error(message);
  validationError.status = 400;
  return validationError;
}

function getActiveManualItems(schedule) {
  return (schedule?.manualOverrides || [])
    .filter((item) => !item.consumedAt)
    .sort((a, b) => {
      if (a.date === b.date) {
        if (a.time < b.time) return -1;
        if (a.time > b.time) return 1;
        return 0;
      }

      const left = moment(a.date, 'DD-MM-YYYY', true);
      const right = moment(b.date, 'DD-MM-YYYY', true);
      if (left.isBefore(right, 'day')) return -1;
      if (left.isAfter(right, 'day')) return 1;
      return 0;
    });
}

function sanitizeScheduleForPublic(schedule) {
  const activeManualItems = getActiveManualItems(schedule);
  const nextAnnouncement = activeManualItems.length
    ? {
        date: activeManualItems[0].date,
        time: activeManualItems[0].time,
        note: activeManualItems[0].note,
      }
    : null;

  return {
    timezone: schedule.timezone,
    dailyTimes: schedule.dailyTimes,
    paused: schedule.paused,
    nextAnnouncement,
    announcementsCount: activeManualItems.length,
    // Backward compatibility for older frontend/clients.
    nextOverride: nextAnnouncement,
    overridesCount: activeManualItems.length,
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
    next(toHttpValidationError(err, 'Payload jadwal tidak valid.'));
  }
}

async function handleAddOverride(req, res, next) {
  try {
    const payload = overrideSchema.parse(req.body);
    const updated = await addManualOverride(payload, {
      updatedBy: req.session?.username || 'admin',
    });

    await forceReschedule('manual-announcement-added');

    res.status(201).json({ schedule: updated });
  } catch (err) {
    next(toHttpValidationError(err, 'Payload pengumuman tidak valid.'));
  }
}

async function handleRemoveOverride(req, res, next) {
  try {
    const identifier =
      req.params?.identifier || req.params?.date || req.params?.id || '';
    const parsedParams = removeOverrideParamsSchema.parse({ identifier });
    const updated = await removeManualOverride(parsedParams.identifier);

    await forceReschedule('manual-announcement-removed');

    res.json({ schedule: updated });
  } catch (err) {
    next(toHttpValidationError(err, 'Parameter penghapusan tidak valid.'));
  }
}

function sanitizeNextRunManualEvent(override) {
  if (!override) {
    return null;
  }

  return {
    id: override.id,
    date: override.date,
    time: override.time,
    note: override.note,
    messageMode: override.messageMode || 'default-template',
  };
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

  const manualEvent = sanitizeNextRunManualEvent(details.override);

  return {
    timestamp: details.targetMoment.toISOString(),
    formatted: adminLabel,
    adminLabel,
    publicLabel,
    timezone: details.schedule.timezone,
    source: manualEvent ? 'manual-announcement' : 'default-schedule',
    manualEvent,
    // Backward compatibility for older frontend/clients.
    override: manualEvent,
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
