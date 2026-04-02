const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const fssync = require('node:fs');
const path = require('node:path');

process.env.NODE_ENV = 'test';

const CONTACTS_PATH = path.resolve(__dirname, '..', 'storage', 'contacts.json');

const {
  createContact,
  updateContact,
  bulkUpdateContactStatus,
  bulkDeleteContacts,
  getAllContacts,
} = require('../src/services/contactService');

let backup = null;

test.before(async () => {
  if (fssync.existsSync(CONTACTS_PATH)) {
    backup = await fs.readFile(CONTACTS_PATH, 'utf8');
    return;
  }
  backup = null;
});

test.after(async () => {
  if (backup === null) {
    if (fssync.existsSync(CONTACTS_PATH)) {
      await fs.unlink(CONTACTS_PATH);
    }
    return;
  }

  await fs.mkdir(path.dirname(CONTACTS_PATH), { recursive: true });
  await fs.writeFile(CONTACTS_PATH, backup, 'utf8');
});

test('create/update contact keeps timestamp metadata consistent', async () => {
  await fs.mkdir(path.dirname(CONTACTS_PATH), { recursive: true });
  await fs.writeFile(CONTACTS_PATH, '[]', 'utf8');

  const created = await createContact({
    name: 'Pegawai Satu',
    number: '081200001111',
    status: 'masuk',
  });

  assert.match(created.createdAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(created.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(created.statusUpdatedAt, /^\d{4}-\d{2}-\d{2}T/);

  const afterNameUpdate = await updateContact(created.id, { name: 'Pegawai Satu Update' });
  assert.equal(afterNameUpdate.name, 'Pegawai Satu Update');
  assert.equal(afterNameUpdate.status, 'masuk');
  assert.ok(
    Date.parse(afterNameUpdate.updatedAt) >= Date.parse(created.updatedAt),
    'updatedAt should move forward or stay equal'
  );
  assert.equal(
    Date.parse(afterNameUpdate.statusUpdatedAt),
    Date.parse(created.statusUpdatedAt),
    'statusUpdatedAt should not change for non-status update'
  );

  const afterStatusUpdate = await updateContact(created.id, { status: 'dinas' });
  assert.equal(afterStatusUpdate.status, 'dinas');
  assert.ok(
    Date.parse(afterStatusUpdate.statusUpdatedAt) >= Date.parse(afterNameUpdate.statusUpdatedAt)
  );
});

test('bulk status update and bulk delete work for selected contact ids', async () => {
  await fs.mkdir(path.dirname(CONTACTS_PATH), { recursive: true });
  await fs.writeFile(CONTACTS_PATH, '[]', 'utf8');

  const first = await createContact({
    name: 'Bulk A',
    number: '081200001211',
    status: 'masuk',
  });
  const second = await createContact({
    name: 'Bulk B',
    number: '081200001212',
    status: 'masuk',
  });
  const third = await createContact({
    name: 'Bulk C',
    number: '081200001213',
    status: 'cuti',
  });

  const updated = await bulkUpdateContactStatus([first.id, third.id], 'dinas');
  assert.equal(updated.length, 2);
  assert.ok(updated.every((contact) => contact.status === 'dinas'));

  const afterBulkUpdate = await getAllContacts();
  assert.equal(afterBulkUpdate.filter((contact) => contact.status === 'dinas').length, 2);

  const deleted = await bulkDeleteContacts([second.id, third.id]);
  assert.equal(deleted.length, 2);

  const afterBulkDelete = await getAllContacts();
  assert.equal(afterBulkDelete.length, 1);
  assert.equal(afterBulkDelete[0].id, first.id);
});
