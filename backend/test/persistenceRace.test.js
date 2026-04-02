const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const fssync = require('node:fs');
const path = require('node:path');
const http = require('node:http');
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
  createContact,
  updateContact,
  deleteContact,
} = require('../src/services/contactService');
const { setLocalCalendar } = require('../src/services/localCalendarService');
const config = require('../src/config/env');
const { APP_DATE_FORMAT } = require('../src/utils/dateFormatter');
const { createApp } = require('../src/app');

const CONTACTS_PATH = path.resolve(__dirname, '..', 'storage', 'contacts.json');
const CALENDAR_PATH = path.resolve(__dirname, '..', 'storage', 'calendar_local.json');
const QUOTES_PATH = path.resolve(__dirname, '..', 'src', 'templates', 'quotes.txt');

const snapshots = new Map();

async function backupFile(filePath) {
  if (fssync.existsSync(filePath)) {
    snapshots.set(filePath, {
      exists: true,
      content: await fs.readFile(filePath, 'utf8'),
    });
    return;
  }
  snapshots.set(filePath, { exists: false, content: '' });
}

async function restoreFile(filePath) {
  const snapshot = snapshots.get(filePath);
  if (!snapshot) {
    return;
  }

  if (snapshot.exists) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, snapshot.content, 'utf8');
    return;
  }

  if (fssync.existsSync(filePath)) {
    await fs.unlink(filePath);
  }
}

test.before(async () => {
  await Promise.all([
    backupFile(CONTACTS_PATH),
    backupFile(CALENDAR_PATH),
    backupFile(QUOTES_PATH),
  ]);
});

test.after(async () => {
  await restoreFile(CONTACTS_PATH);
  await restoreFile(CALENDAR_PATH);
  await restoreFile(QUOTES_PATH);
});

test('contact persistence survives rapid create/update/delete without JSON corruption', async () => {
  await fs.mkdir(path.dirname(CONTACTS_PATH), { recursive: true });
  await fs.writeFile(CONTACTS_PATH, '[]', 'utf8');

  const created = await Promise.all(
    Array.from({ length: 40 }, (_, index) =>
      createContact({
        name: `Stress Contact ${index}`,
        number: `08120000${String(index).padStart(4, '0')}`,
        status: 'masuk',
      })
    )
  );

  await Promise.all(
    created.slice(0, 20).map((contact, index) =>
      updateContact(contact.id, { name: `Updated Stress ${index}` })
    )
  );

  await Promise.all(
    created.slice(20, 30).map((contact) => deleteContact(contact.id))
  );

  const raw = await fs.readFile(CONTACTS_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  assert.ok(Array.isArray(parsed));
  assert.equal(parsed.length, 30);
  assert.ok(parsed.every((contact) => typeof contact.id === 'string' && contact.id.length > 0));
  assert.ok(parsed.every((contact) => /^62\d{8,13}$/.test(contact.number)));
  assert.equal(new Set(parsed.map((contact) => contact.number)).size, parsed.length);
});

test('local calendar rapid updates keep JSON file valid', async () => {
  const payloads = Array.from({ length: 32 }, (_, index) => {
    const day = String((index % 28) + 1).padStart(2, '0');
    return {
      LIBURAN: [`${day}-01-2031`],
      CUTI_BERSAMA: [`${day}-02-2031`],
    };
  });

  await Promise.all(
    payloads.map((payload) =>
      Promise.resolve().then(() => setLocalCalendar(payload))
    )
  );

  const raw = await fs.readFile(CALENDAR_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  assert.ok(parsed && typeof parsed === 'object');
  assert.ok(Array.isArray(parsed.LIBURAN));
  assert.ok(Array.isArray(parsed.CUTI_BERSAMA));
});

test('local calendar auto-removes entries older than 7 days', async () => {
  const now = moment.tz(config.timezone).startOf('day');

  const payload = {
    LIBURAN: [
      now.clone().subtract(8, 'days').format(APP_DATE_FORMAT),
      now.clone().subtract(7, 'days').format(APP_DATE_FORMAT),
      now.clone().add(4, 'days').format(APP_DATE_FORMAT),
    ],
    CUTI_BERSAMA: [
      now.clone().subtract(30, 'days').format(APP_DATE_FORMAT),
      now.clone().subtract(2, 'days').format(APP_DATE_FORMAT),
      now.clone().add(9, 'days').format(APP_DATE_FORMAT),
    ],
  };

  const updated = setLocalCalendar(payload);

  assert.deepEqual(updated.LIBURAN, [
    now.clone().subtract(7, 'days').format(APP_DATE_FORMAT),
    now.clone().add(4, 'days').format(APP_DATE_FORMAT),
  ]);
  assert.deepEqual(updated.CUTI_BERSAMA, [
    now.clone().subtract(2, 'days').format(APP_DATE_FORMAT),
    now.clone().add(9, 'days').format(APP_DATE_FORMAT),
  ]);

  const raw = await fs.readFile(CALENDAR_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  assert.deepEqual(parsed, updated);
});

test('admin endpoints remain functional under quote write bursts', async () => {
  const app = createApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: process.env.ADMIN_USERNAME,
        password: process.env.ADMIN_PASSWORD,
        remember: false,
      }),
    });
    assert.equal(loginRes.status, 200);
    const cookie = loginRes.headers.get('set-cookie')?.split(';')[0];
    assert.ok(cookie);

    const contactsRes = await fetch(`${baseUrl}/api/admin/contacts`, {
      headers: { Cookie: cookie },
    });
    assert.equal(contactsRes.status, 200);

    const calendarRes = await fetch(`${baseUrl}/api/admin/calendar`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      body: JSON.stringify({
        LIBURAN: ['01-03-2031'],
        CUTI_BERSAMA: ['02-03-2031'],
      }),
    });
    assert.equal(calendarRes.status, 200);

    const prefix = `stress-quote-${Date.now()}`;
    const createResponses = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        fetch(`${baseUrl}/api/quotes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: cookie,
          },
          body: JSON.stringify({ content: `${prefix}-${index}` }),
        })
      )
    );

    createResponses.forEach((response) => {
      assert.equal(response.status, 201);
    });

    const listResponse = await fetch(`${baseUrl}/api/quotes`, {
      headers: { Cookie: cookie },
    });
    assert.equal(listResponse.status, 200);
    const listBody = await listResponse.json();
    const createdQuotes = listBody.quotes.filter((item) =>
      item.content.startsWith(prefix)
    );
    assert.equal(createdQuotes.length, 20);

    const updateResponses = await Promise.all(
      createdQuotes.slice(0, 10).map((quote, index) =>
        fetch(`${baseUrl}/api/quotes/${quote.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Cookie: cookie,
          },
          body: JSON.stringify({ content: `${prefix}-updated-${index}` }),
        })
      )
    );
    updateResponses.forEach((response) => {
      assert.equal(response.status, 200);
    });

    const deleteTargets = createdQuotes
      .slice(10, 15)
      .map((quote) => quote.id)
      .sort((a, b) => b - a);

    const deleteResponses = await Promise.all(
      deleteTargets.map((id) =>
        fetch(`${baseUrl}/api/quotes/${id}`, {
          method: 'DELETE',
          headers: { Cookie: cookie },
        })
      )
    );
    deleteResponses.forEach((response) => {
      assert.equal(response.status, 204);
    });

    const finalQuotesRes = await fetch(`${baseUrl}/api/quotes`, {
      headers: { Cookie: cookie },
    });
    assert.equal(finalQuotesRes.status, 200);
    const finalQuotesBody = await finalQuotesRes.json();
    assert.ok(Array.isArray(finalQuotesBody.quotes));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
