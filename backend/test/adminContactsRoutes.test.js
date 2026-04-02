const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const fssync = require('node:fs');
const path = require('node:path');
const http = require('node:http');

function setupTestEnv() {
  process.env.NODE_ENV = 'test';
  process.env.SESSION_SECRET = 'test-session-secret-1234';
  process.env.ADMIN_USERNAME = 'admin';
  process.env.ADMIN_PASSWORD = 'change_me_123456';
  process.env.ADMIN_PASSWORD_HASH = '';
}

setupTestEnv();

const { createApp } = require('../src/app');

const CONTACTS_PATH = path.resolve(__dirname, '..', 'storage', 'contacts.json');
let contactsBackup = null;

test.before(async () => {
  if (fssync.existsSync(CONTACTS_PATH)) {
    contactsBackup = await fs.readFile(CONTACTS_PATH, 'utf8');
    return;
  }
  contactsBackup = null;
});

test.after(async () => {
  if (contactsBackup === null) {
    if (fssync.existsSync(CONTACTS_PATH)) {
      await fs.unlink(CONTACTS_PATH);
    }
    return;
  }

  await fs.mkdir(path.dirname(CONTACTS_PATH), { recursive: true });
  await fs.writeFile(CONTACTS_PATH, contactsBackup, 'utf8');
});

test('admin contacts bulk endpoints update and delete selected contacts', async () => {
  await fs.mkdir(path.dirname(CONTACTS_PATH), { recursive: true });
  await fs.writeFile(CONTACTS_PATH, '[]', 'utf8');

  const app = createApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  let cookie = '';

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
    cookie = loginRes.headers.get('set-cookie')?.split(';')[0] || '';
    assert.ok(cookie);

    const createPayloads = [
      { name: 'Bulk Route A', number: '081200009901', status: 'masuk' },
      { name: 'Bulk Route B', number: '081200009902', status: 'masuk' },
      { name: 'Bulk Route C', number: '081200009903', status: 'cuti' },
    ];

    const createdResponses = await Promise.all(
      createPayloads.map((payload) =>
        fetch(`${baseUrl}/api/admin/contacts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: cookie,
          },
          body: JSON.stringify(payload),
        })
      )
    );

    for (const response of createdResponses) {
      assert.equal(response.status, 201);
    }

    const createdBodies = await Promise.all(createdResponses.map((response) => response.json()));
    const createdIds = createdBodies.map((body) => body.contact.id);

    const bulkStatusRes = await fetch(`${baseUrl}/api/admin/contacts/bulk-status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      body: JSON.stringify({
        ids: [createdIds[0], createdIds[1]],
        status: 'dinas',
      }),
    });
    assert.equal(bulkStatusRes.status, 200);
    const bulkStatusBody = await bulkStatusRes.json();
    assert.equal(bulkStatusBody.contacts.length, 2);
    assert.ok(bulkStatusBody.contacts.every((contact) => contact.status === 'dinas'));

    const bulkDeleteRes = await fetch(`${baseUrl}/api/admin/contacts/bulk-delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      body: JSON.stringify({
        ids: [createdIds[1], createdIds[2]],
      }),
    });
    assert.equal(bulkDeleteRes.status, 200);
    const bulkDeleteBody = await bulkDeleteRes.json();
    assert.equal(bulkDeleteBody.deletedCount, 2);

    const listRes = await fetch(`${baseUrl}/api/admin/contacts`, {
      headers: { Cookie: cookie },
    });
    assert.equal(listRes.status, 200);
    const listBody = await listRes.json();
    assert.equal(listBody.contacts.length, 1);
    assert.equal(listBody.contacts[0].id, createdIds[0]);
    assert.equal(listBody.contacts[0].status, 'dinas');
  } finally {
    if (cookie) {
      await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { Cookie: cookie },
      });
    }
    await new Promise((resolve) => server.close(resolve));
  }
});
