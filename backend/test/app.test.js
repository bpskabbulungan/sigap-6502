const { test } = require('node:test');
const assert = require('assert');
const http = require('http');

function setupTestEnv() {
  process.env.NODE_ENV = 'test';
  process.env.SESSION_SECRET = 'test-session-secret-1234';
  process.env.ADMIN_USERNAME = 'admin';
  process.env.ADMIN_PASSWORD = 'change_me_123456';
  process.env.ADMIN_PASSWORD_HASH = '';
  process.env.WEB_APP_URL = 'http://localhost:5174/';
}

setupTestEnv();

const { createApp, buildAllowedOrigins } = require('../src/app');
const config = require('../src/config/env');
const { addLog, LOG_AUDIENCES } = require('../src/controllers/logController');

test('CORS allowed origins exclude wildcard by default', () => {
  const allowed = buildAllowedOrigins();
  assert.ok(!allowed.has('*'), 'Allowed origins should not include wildcard');
  assert.ok(allowed.has(new URL(config.webAppUrl).origin), 'Default webAppUrl should be allowed for CORS');
  assert.ok(allowed.has('http://127.0.0.1:5174'), '127.0.0.1 alias should be allowed for localhost webAppUrl');
});

test('public system endpoints can be accessed without admin login', async () => {
  const app = createApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const marker = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const publicLine = `[Test Public] marker ${marker}`;
  const adminLine = `[Test Admin] marker ${marker}`;

  addLog(publicLine, { audience: LOG_AUDIENCES.PUBLIC, skipPersist: true });
  addLog(adminLine, { audience: LOG_AUDIENCES.ADMIN, skipPersist: true });

  try {
    const publicLogsResponse = await fetch(
      `${baseUrl}/api/system/logs?limit=100&audience=${LOG_AUDIENCES.PUBLIC}`
    );
    assert.equal(publicLogsResponse.status, 200);

    const publicLogsBody = await publicLogsResponse.json();
    assert.ok(Array.isArray(publicLogsBody.logs), 'Public logs payload should contain logs array');
    assert.ok(publicLogsBody.logs.some((line) => line.includes(publicLine)));
    assert.ok(!publicLogsBody.logs.some((line) => line.includes(adminLine)));

    const adminLogsResponse = await fetch(
      `${baseUrl}/api/system/logs?limit=100&audience=${LOG_AUDIENCES.ADMIN}`
    );
    assert.equal(adminLogsResponse.status, 401);

    const adminLogsBody = await adminLogsResponse.json();
    assert.match(adminLogsBody.message, /login admin/i);

    const statsResponse = await fetch(`${baseUrl}/api/system/stats`);
    assert.equal(statsResponse.status, 200);

    const statsBody = await statsResponse.json();
    assert.ok(statsBody && typeof statsBody === 'object');
    assert.ok(statsBody.messagesPerDay && typeof statsBody.messagesPerDay === 'object');
    assert.ok(statsBody.errorsPerDay && typeof statsBody.errorsPerDay === 'object');
    assert.ok(statsBody.uptimePerDay && typeof statsBody.uptimePerDay === 'object');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('schedule API rejects invalid timezone with HTTP 400 and accepts Asia/Makassar', async () => {
  const app = createApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  let sessionCookie = '';
  let originalTimezone = null;

  try {
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: process.env.ADMIN_USERNAME,
        password: process.env.ADMIN_PASSWORD,
        remember: false,
      }),
    });

    assert.equal(loginResponse.status, 200);
    const setCookie = loginResponse.headers.get('set-cookie');
    assert.ok(setCookie, 'Session cookie should exist after login');
    sessionCookie = setCookie.split(';')[0];

    const scheduleBeforeResponse = await fetch(`${baseUrl}/api/admin/schedule`, {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(scheduleBeforeResponse.status, 200);
    const scheduleBefore = await scheduleBeforeResponse.json();
    originalTimezone = scheduleBefore?.schedule?.timezone || null;

    const invalidTimezoneResponse = await fetch(`${baseUrl}/api/admin/schedule`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({ timezone: 'Mars/OlympusMons' }),
    });

    assert.equal(invalidTimezoneResponse.status, 400);
    const invalidTimezoneBody = await invalidTimezoneResponse.json();
    assert.match(invalidTimezoneBody.message, /timezone/i);

    const validTimezoneResponse = await fetch(`${baseUrl}/api/admin/schedule`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({ timezone: 'Asia/Makassar' }),
    });

    assert.equal(validTimezoneResponse.status, 200);
    const validTimezoneBody = await validTimezoneResponse.json();
    assert.equal(validTimezoneBody.schedule.timezone, 'Asia/Makassar');
  } finally {
    if (sessionCookie && originalTimezone && originalTimezone !== 'Asia/Makassar') {
      await fetch(`${baseUrl}/api/admin/schedule`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({ timezone: originalTimezone }),
      });
    }

    if (sessionCookie) {
      await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { Cookie: sessionCookie },
      });
    }

    await new Promise((resolve) => server.close(resolve));
  }
});
