const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const fssync = require('node:fs');
const path = require('node:path');
const moment = require('moment-timezone');

function setupTestEnv() {
  process.env.NODE_ENV = 'test';
  process.env.SESSION_SECRET = 'test-session-secret-1234';
  process.env.ADMIN_USERNAME = 'admin';
  process.env.ADMIN_PASSWORD = 'change_me_123456';
  process.env.ADMIN_PASSWORD_HASH = '';
}

setupTestEnv();

const {
  scheduler: { defaultSchedule: DEFAULT_SCHEDULE },
} = require('../src/config/env');
const { APP_DATE_FORMAT } = require('../src/utils/dateFormatter');

const STORAGE_DIR = path.resolve(__dirname, '..', 'storage');
const CONFIG_PATH = path.join(STORAGE_DIR, 'schedule-config.json');
const TIMEZONE = DEFAULT_SCHEDULE.timezone;
const DEFAULT_SCHEDULE_VERSION = DEFAULT_SCHEDULE.defaultVersion;

let originalSchedule = null;

async function readScheduleFile() {
  const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
  return JSON.parse(raw);
}

async function seedSchedule(scheduleDocument) {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
  await fs.writeFile(
    CONFIG_PATH,
    `${JSON.stringify(scheduleDocument, null, 2)}\n`,
    'utf-8'
  );
}

function loadService() {
  delete require.cache[require.resolve('../src/services/scheduleService')];
  // eslint-disable-next-line global-require
  return require('../src/services/scheduleService');
}

test.before(async () => {
  if (fssync.existsSync(CONFIG_PATH)) {
    originalSchedule = await fs.readFile(CONFIG_PATH, 'utf-8');
  }
});

test.after(async () => {
  if (originalSchedule !== null) {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
    await fs.writeFile(CONFIG_PATH, originalSchedule, 'utf-8');
  } else if (fssync.existsSync(CONFIG_PATH)) {
    await fs.unlink(CONFIG_PATH);
  }
});

function buildReference(dateString) {
  return moment.tz(`${dateString} 09:00`, `${APP_DATE_FORMAT} HH:mm`, true, TIMEZONE);
}

test('returns default run times for the latest schedule version', async (t) => {
  const scheduleDocument = {
    timezone: TIMEZONE,
    dailyTimes: { ...DEFAULT_SCHEDULE.dailyTimes },
    manualOverrides: [],
    paused: false,
    lastUpdatedAt: new Date('2024-05-01T00:00:00Z').toISOString(),
    updatedBy: 'system',
    defaultVersion: DEFAULT_SCHEDULE_VERSION,
  };

  await seedSchedule(scheduleDocument);
  const { getNextRun, getSchedule } = loadService();

  const weekdayCases = [
    { label: 'Monday', date: '01-07-2024', key: '1' },
    { label: 'Tuesday', date: '02-07-2024', key: '2' },
    { label: 'Wednesday', date: '03-07-2024', key: '3' },
    { label: 'Thursday', date: '04-07-2024', key: '4' },
    { label: 'Friday', date: '05-07-2024', key: '5' },
  ];

  for (const { label, date, key } of weekdayCases) {
    const expected = DEFAULT_SCHEDULE.dailyTimes[key];
    // eslint-disable-next-line no-await-in-loop
    await t.test(`maps ${label} to ${expected} WITA`, async () => {
      const referenceMoment = buildReference(date);
      const nextRun = await getNextRun({ referenceMoment });

      assert.ok(nextRun, `expected next run information for ${label}`);
      assert.equal(
        nextRun.targetMoment.clone().tz(TIMEZONE).format('HH:mm'),
        expected
      );
      assert.equal(nextRun.targetMoment.tz(TIMEZONE).isoWeekday(),
        moment.tz(date, APP_DATE_FORMAT, true, TIMEZONE).isoWeekday());
    });
  }

  const sanitized = await getSchedule();
  assert.equal(sanitized.dailyTimes['6'], null);
  assert.equal(sanitized.dailyTimes['7'], null);
});


test('auto-upgrades legacy schedules to the latest default times', async (t) => {
  const legacyDocument = {
    timezone: TIMEZONE,
    dailyTimes: {
      1: '15:45',
      2: '15:45',
      3: '15:45',
      4: '15:45',
      5: '16:00',
      6: null,
      7: null,
    },
    manualOverrides: [],
    paused: false,
    lastUpdatedAt: new Date('2024-01-01T00:00:00Z').toISOString(),
    updatedBy: 'system',
    // intentionally omit defaultVersion to mimic legacy files
  };

  await seedSchedule(legacyDocument);
  const { getNextRun, getSchedule } = loadService();

  const upgraded = await getSchedule();
  assert.equal(upgraded.defaultVersion, DEFAULT_SCHEDULE_VERSION);
  assert.deepEqual(upgraded.dailyTimes, DEFAULT_SCHEDULE.dailyTimes);

  const persisted = await readScheduleFile();
  assert.equal(persisted.defaultVersion, DEFAULT_SCHEDULE_VERSION);
  assert.deepEqual(persisted.dailyTimes, upgraded.dailyTimes);

  const mondayRun = await getNextRun({
    referenceMoment: buildReference('01-07-2024'),
  });
  assert.equal(
    mondayRun.targetMoment.clone().tz(TIMEZONE).format('HH:mm'),
    DEFAULT_SCHEDULE.dailyTimes['1']
  );

  const fridayRun = await getNextRun({
    referenceMoment: buildReference('05-07-2024'),
  });
  assert.equal(
    fridayRun.targetMoment.clone().tz(TIMEZONE).format('HH:mm'),
    DEFAULT_SCHEDULE.dailyTimes['5']
  );
});

test('keeps the current slot when the reference time is within the grace window', async () => {
  const scheduleDocument = {
    timezone: TIMEZONE,
    dailyTimes: { ...DEFAULT_SCHEDULE.dailyTimes },
    manualOverrides: [],
    paused: false,
    lastUpdatedAt: new Date('2024-06-01T00:00:00Z').toISOString(),
    updatedBy: 'system',
    defaultVersion: DEFAULT_SCHEDULE_VERSION,
  };

  await seedSchedule(scheduleDocument);
  const { getNextRun } = loadService();

  const referenceMoment = moment.tz(
    '02-07-2024 16:00:12',
    `${APP_DATE_FORMAT} HH:mm:ss`,
    TIMEZONE
  );

  const nextRun = await getNextRun({
    referenceMoment,
    graceMs: 5 * 60 * 1000,
  });

  assert.ok(nextRun, 'expected run information within the grace window');
  assert.equal(
    nextRun.targetMoment.clone().tz(TIMEZONE).format(`${APP_DATE_FORMAT} HH:mm`),
    '02-07-2024 16:00'
  );
});

test('setSchedule rejects invalid IANA timezone', async () => {
  const scheduleDocument = {
    timezone: TIMEZONE,
    dailyTimes: { ...DEFAULT_SCHEDULE.dailyTimes },
    manualOverrides: [],
    paused: false,
    lastUpdatedAt: new Date('2024-06-01T00:00:00Z').toISOString(),
    updatedBy: 'system',
    defaultVersion: DEFAULT_SCHEDULE_VERSION,
  };

  await seedSchedule(scheduleDocument);
  const { setSchedule, getSchedule } = loadService();

  await assert.rejects(
    () => setSchedule({ timezone: 'Mars/OlympusMons' }),
    (err) => {
      assert.equal(err.status, 400);
      assert.match(err.message, /Timezone tidak valid/i);
      return true;
    }
  );

  const current = await getSchedule();
  assert.equal(current.timezone, TIMEZONE);
});

test('setSchedule accepts valid IANA timezone (Asia/Makassar)', async () => {
  const scheduleDocument = {
    timezone: 'Asia/Jakarta',
    dailyTimes: { ...DEFAULT_SCHEDULE.dailyTimes },
    manualOverrides: [],
    paused: false,
    lastUpdatedAt: new Date('2024-06-01T00:00:00Z').toISOString(),
    updatedBy: 'system',
    defaultVersion: DEFAULT_SCHEDULE_VERSION,
  };

  await seedSchedule(scheduleDocument);
  const { setSchedule } = loadService();

  const updated = await setSchedule({ timezone: 'Asia/Makassar' });

  assert.equal(updated.timezone, 'Asia/Makassar');
});

test('parallel schedule mutations keep schedule-config JSON valid', async () => {
  const scheduleDocument = {
    timezone: TIMEZONE,
    dailyTimes: { ...DEFAULT_SCHEDULE.dailyTimes },
    manualOverrides: [],
    paused: false,
    lastUpdatedAt: new Date('2024-06-01T00:00:00Z').toISOString(),
    updatedBy: 'system',
    defaultVersion: DEFAULT_SCHEDULE_VERSION,
  };

  await seedSchedule(scheduleDocument);
  const { setSchedule, addManualOverride, removeManualOverride } = loadService();

  const baseDate = moment.tz('01-12-2030', APP_DATE_FORMAT, true, TIMEZONE);
  const operations = [];

  for (let i = 0; i < 40; i += 1) {
    const date = baseDate.clone().add(i, 'day').format(APP_DATE_FORMAT);
    const hour = String(i % 24).padStart(2, '0');

    operations.push(
      setSchedule(
        {
          dailyTimes: {
            1: `${hour}:00`,
          },
        },
        { updatedBy: `stress-${i}` }
      )
    );
    operations.push(
      addManualOverride(
        {
          date,
          time: '10:30',
          note: `stress-${i}`,
        },
        { updatedBy: 'stress-test' }
      )
    );
    operations.push(removeManualOverride(date));
  }

  await Promise.all(operations);

  const persisted = await readScheduleFile();
  assert.ok(persisted && typeof persisted === 'object');
  assert.ok(typeof persisted.timezone === 'string' && persisted.timezone.length > 0);
  assert.ok(persisted.dailyTimes && typeof persisted.dailyTimes === 'object');
  assert.ok(Array.isArray(persisted.manualOverrides));
});

test('manual announcement is additional and does not replace the default daily schedule', async () => {
  const scheduleDocument = {
    timezone: TIMEZONE,
    dailyTimes: { ...DEFAULT_SCHEDULE.dailyTimes },
    manualOverrides: [],
    paused: false,
    lastUpdatedAt: new Date('2024-06-01T00:00:00Z').toISOString(),
    updatedBy: 'system',
    defaultVersion: DEFAULT_SCHEDULE_VERSION,
  };

  await seedSchedule(scheduleDocument);
  const { addManualOverride, getNextRun } = loadService();

  await addManualOverride({
    date: '03-12-2030',
    time: '14:00',
    note: 'Rapat mendadak',
    messageMode: 'custom-message',
    customMessage: 'Halo {name}, rapat pukul 14:00.',
  });

  const manualRun = await getNextRun({
    referenceMoment: moment.tz(
      '03-12-2030 13:00',
      `${APP_DATE_FORMAT} HH:mm`,
      true,
      TIMEZONE
    ),
  });

  assert.ok(manualRun, 'expected manual announcement run');
  assert.ok(manualRun.override, 'expected manual announcement payload');
  assert.equal(
    manualRun.targetMoment.clone().tz(TIMEZONE).format(`${APP_DATE_FORMAT} HH:mm`),
    '03-12-2030 14:00'
  );

  const defaultRunAfterManual = await getNextRun({
    referenceMoment: moment.tz(
      '03-12-2030 14:01',
      `${APP_DATE_FORMAT} HH:mm`,
      true,
      TIMEZONE
    ),
  });

  assert.ok(defaultRunAfterManual, 'expected default run after manual announcement');
  assert.equal(defaultRunAfterManual.override, null);
  assert.equal(
    defaultRunAfterManual.targetMoment
      .clone()
      .tz(TIMEZONE)
      .format(`${APP_DATE_FORMAT} HH:mm`),
    '03-12-2030 16:00'
  );
});

test('manual announcement stores custom message mode and rejects collision with default time', async () => {
  const scheduleDocument = {
    timezone: TIMEZONE,
    dailyTimes: { ...DEFAULT_SCHEDULE.dailyTimes },
    manualOverrides: [],
    paused: false,
    lastUpdatedAt: new Date('2024-06-01T00:00:00Z').toISOString(),
    updatedBy: 'system',
    defaultVersion: DEFAULT_SCHEDULE_VERSION,
  };

  await seedSchedule(scheduleDocument);
  const { addManualOverride, getSchedule } = loadService();

  await addManualOverride({
    date: '04-12-2030',
    time: '13:15',
    note: 'Info koordinasi',
    messageMode: 'custom-message',
    customMessage: 'Halo {name}, ada pengumuman penting.',
  });

  const schedule = await getSchedule();
  const added = schedule.manualOverrides.find(
    (item) => item.date === '04-12-2030' && item.time === '13:15'
  );

  assert.ok(added, 'expected persisted manual announcement');
  assert.equal(added.messageMode, 'custom-message');
  assert.equal(added.customMessage, 'Halo {name}, ada pengumuman penting.');

  await assert.rejects(
    () =>
      addManualOverride({
        date: '04-12-2030',
        time: '16:00',
        note: 'Bentrok jadwal default',
        messageMode: 'default-template',
      }),
    /bentrok dengan jadwal otomatis/i
  );
});
