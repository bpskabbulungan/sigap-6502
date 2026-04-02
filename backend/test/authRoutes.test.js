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

const { createApp } = require('../src/app');

async function startServer() {
  const app = createApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  return { server, baseUrl };
}

async function stopServer(server) {
  await new Promise((resolve) => server.close(resolve));
}

test('auth login rejects whitespace-only password with 400', async () => {
  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: '   ',
        remember: false,
      }),
    });

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload.message, 'Periksa username dan password.');
    assert.match(payload?.errors?.password || '', /password wajib diisi/i);
  } finally {
    await stopServer(server);
  }
});

test('auth login invalid credentials return generic 401 message', async () => {
  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'adminx',
        password: 'change_me_123456',
        remember: false,
      }),
    });

    assert.equal(response.status, 401);
    const payload = await response.json();
    assert.equal(payload.message, 'Kredensial tidak valid.');
  } finally {
    await stopServer(server);
  }
});

test('auth login remember=false keeps session cookie non-persistent', async () => {
  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'change_me_123456',
        remember: false,
      }),
    });

    assert.equal(response.status, 200);
    const setCookie = response.headers.get('set-cookie');
    assert.ok(setCookie, 'Session cookie harus tersedia setelah login.');
    assert.ok(!/Expires=/i.test(setCookie), 'Cookie non-remember seharusnya tidak persistent.');
  } finally {
    await stopServer(server);
  }
});

test('auth login accepts remember value from legacy form payload', async () => {
  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'username=admin&password=change_me_123456&remember=on',
    });

    assert.equal(response.status, 200);
    const setCookie = response.headers.get('set-cookie');
    assert.ok(setCookie, 'Session cookie harus tersedia setelah login.');
    assert.ok(/Expires=/i.test(setCookie), 'Cookie remember=true harus persistent.');
  } finally {
    await stopServer(server);
  }
});
