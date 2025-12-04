const { z } = require('zod');
const { getLocalCalendar, setLocalCalendar } = require('../services/localCalendarService');
const { APP_DATE_REGEX } = require('../utils/dateFormatter');

function findDuplicates(values = []) {
  const seen = new Set();
  const duplicates = new Set();
  values.forEach((value) => {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  });
  return Array.from(duplicates);
}

const uniqueDateArraySchema = z
  .array(z.string().trim().regex(APP_DATE_REGEX, 'Format tanggal harus DD-MM-YYYY'))
  .superRefine((value, ctx) => {
    const duplicates = findDuplicates(value);
    if (duplicates.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Tanggal duplikat: ${duplicates.join(', ')}`,
      });
    }
  });

const calendarUpdateSchema = z.object({
  LIBURAN: uniqueDateArraySchema,
  CUTI_BERSAMA: uniqueDateArraySchema,
});

function handleGetLocalCalendar(req, res, next) {
  try {
    const calendar = getLocalCalendar();
    res.json({ calendar });
  } catch (err) {
    next(err);
  }
}

function handleUpdateLocalCalendar(req, res, next) {
  try {
    const payload = calendarUpdateSchema.parse(req.body);

    const cutiSet = new Set(payload.CUTI_BERSAMA);
    const overlap = payload.LIBURAN.filter((date) => cutiSet.has(date));

    if (overlap.length > 0) {
      const error = new Error(
        `Tanggal tidak boleh berada di kedua daftar: ${overlap.join(', ')}`
      );
      error.status = 400;
      throw error;
    }

    const updated = setLocalCalendar(payload);
    res.json({
      calendar: updated,
      message: 'Kalender lokal berhasil diperbarui.',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  handleGetLocalCalendar,
  handleUpdateLocalCalendar,
};
