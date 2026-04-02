const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const { withFileLock } = require('../utils/fileMutex');

const STORAGE_DIR = path.join(__dirname, '..', '..', 'storage');
const STORAGE_FILE = path.join(STORAGE_DIR, 'contacts.json');
const EXAMPLE_FILE = path.join(STORAGE_DIR, 'contacts.example.json');

function withContactsLock(task) {
  return withFileLock(STORAGE_FILE, task);
}

const ALLOWED_STATUSES = ['masuk', 'cuti', 'sakit', 'dinas', 'nonaktif'];

function createError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function nowIso() {
  return new Date().toISOString();
}

function ensureIsoTimestamp(rawValue, fallbackValue) {
  if (typeof rawValue !== 'string' || !rawValue.trim()) {
    return fallbackValue;
  }
  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) {
    return fallbackValue;
  }
  return parsed.toISOString();
}

function sanitizeNumber(rawNumber) {
  if (!rawNumber && rawNumber !== 0) return '';
  const digits = String(rawNumber).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('8')) return `62${digits}`;
  return digits;
}

function isValidNumber(sanitizedNumber) {
  return /^62\d{8,13}$/.test(sanitizedNumber);
}

function normalizeStatus(status) {
  const normalized = String(status || 'masuk').trim().toLowerCase();
  if (!ALLOWED_STATUSES.includes(normalized)) {
    throw createError(
      `Status tidak valid. Gunakan salah satu dari: ${ALLOWED_STATUSES.join(', ')}`
    );
  }
  return normalized;
}

function normalizeIds(ids) {
  if (!Array.isArray(ids)) return [];
  const normalized = ids
    .map((id) => String(id || '').trim())
    .filter(Boolean);
  return [...new Set(normalized)];
}

function mapStoredContact(rawContact) {
  if (!rawContact || typeof rawContact !== 'object') {
    return null;
  }

  const fallbackCreatedAt = nowIso();
  const createdAt = ensureIsoTimestamp(rawContact.createdAt, fallbackCreatedAt);
  const updatedAt = ensureIsoTimestamp(rawContact.updatedAt, createdAt);
  const statusUpdatedAt = ensureIsoTimestamp(rawContact.statusUpdatedAt, updatedAt);
  const sanitizedNumber = sanitizeNumber(rawContact.number);
  const normalizedStatus = ALLOWED_STATUSES.includes(String(rawContact.status).toLowerCase())
    ? String(rawContact.status).toLowerCase()
    : 'masuk';

  return {
    id: rawContact.id || randomUUID(),
    name: typeof rawContact.name === 'string' ? rawContact.name.trim() : '',
    number: sanitizedNumber,
    status: normalizedStatus,
    createdAt,
    updatedAt,
    statusUpdatedAt,
  };
}

function needsRewrite(rawContact, mappedContact) {
  if (!rawContact || !mappedContact) return false;

  return (
    rawContact.id !== mappedContact.id ||
    String(rawContact.name || '').trim() !== mappedContact.name ||
    sanitizeNumber(rawContact.number) !== mappedContact.number ||
    String(rawContact.status || '').toLowerCase() !== mappedContact.status ||
    rawContact.createdAt !== mappedContact.createdAt ||
    rawContact.updatedAt !== mappedContact.updatedAt ||
    rawContact.statusUpdatedAt !== mappedContact.statusUpdatedAt
  );
}

function sortContactsByName(contacts) {
  return [...contacts].sort((a, b) =>
    a.name.localeCompare(b.name, 'id', { sensitivity: 'base' })
  );
}

async function ensureStorageFile() {
  await fsPromises.mkdir(STORAGE_DIR, { recursive: true });
  try {
    await fsPromises.access(STORAGE_FILE, fs.constants.F_OK);
  } catch (err) {
    let initialData = JSON.stringify([], null, 2);

    try {
      const exampleContent = await fsPromises.readFile(EXAMPLE_FILE, 'utf8');
      const parsed = JSON.parse(exampleContent);
      if (Array.isArray(parsed)) {
        initialData = JSON.stringify(parsed, null, 2);
      }
    } catch (exampleError) {
      if (exampleError.code !== 'ENOENT') {
        console.warn(
          '[ContactService] Gagal membaca contacts.example.json, membuat file kosong.',
          exampleError
        );
      }
    }

    await fsPromises.writeFile(STORAGE_FILE, initialData, 'utf8');
  }
}

async function readContacts() {
  await ensureStorageFile();
  try {
    const raw = await fsPromises.readFile(STORAGE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error('Konten kontak tidak valid.');
    }

    let shouldRewrite = false;
    const contacts = parsed
      .map((contact) => {
        const mapped = mapStoredContact(contact);
        if (!mapped) return null;
        if (!isValidNumber(mapped.number) || !mapped.name) {
          shouldRewrite = true;
          return null;
        }
        if (needsRewrite(contact, mapped)) {
          shouldRewrite = true;
        }
        return mapped;
      })
      .filter(Boolean);

    if (shouldRewrite) {
      await writeContacts(contacts);
    }

    return contacts;
  } catch (err) {
    console.error('[ContactService] Gagal membaca kontak, mengganti dengan file kosong.', err);
    const emptyContacts = JSON.stringify([], null, 2);
    await fsPromises.writeFile(STORAGE_FILE, emptyContacts, 'utf8');
    return [];
  }
}

async function writeContacts(contacts) {
  const sorted = sortContactsByName(contacts);
  await fsPromises.writeFile(STORAGE_FILE, JSON.stringify(sorted, null, 2), 'utf8');
  return sorted;
}

async function getAllContacts() {
  return withContactsLock(async () => {
    const contacts = await readContacts();
    return sortContactsByName(contacts);
  });
}

async function createContact({ name, number, status }) {
  return withContactsLock(async () => {
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    if (!trimmedName) {
      throw createError('Nama kontak wajib diisi.');
    }

    const sanitizedNumber = sanitizeNumber(number);
    if (!isValidNumber(sanitizedNumber)) {
      throw createError('Nomor WhatsApp tidak valid. Gunakan format 62XXXXXXXXXXX.');
    }

    const normalizedStatus = normalizeStatus(status);
    const contacts = await readContacts();

    if (contacts.some((contact) => contact.number === sanitizedNumber)) {
      throw createError('Nomor WhatsApp sudah terdaftar.');
    }

    const now = nowIso();
    const newContact = {
      id: randomUUID(),
      name: trimmedName,
      number: sanitizedNumber,
      status: normalizedStatus,
      createdAt: now,
      updatedAt: now,
      statusUpdatedAt: now,
    };

    contacts.push(newContact);
    await writeContacts(contacts);
    return newContact;
  });
}

async function updateContact(id, { name, number, status }) {
  return withContactsLock(async () => {
    if (!id) {
      throw createError('ID kontak wajib diisi.');
    }

    const contacts = await readContacts();
    const index = contacts.findIndex((contact) => contact.id === id);
    if (index === -1) {
      throw createError('Kontak tidak ditemukan.', 404);
    }

    const existing = contacts[index];
    const updatedContact = { ...existing };
    let hasGeneralChange = false;
    let statusChanged = false;

    if (name !== undefined) {
      const trimmedName = typeof name === 'string' ? name.trim() : '';
      if (!trimmedName) {
        throw createError('Nama kontak wajib diisi.');
      }
      if (trimmedName !== existing.name) {
        updatedContact.name = trimmedName;
        hasGeneralChange = true;
      }
    }

    if (number !== undefined) {
      const sanitizedNumber = sanitizeNumber(number);
      if (!isValidNumber(sanitizedNumber)) {
        throw createError('Nomor WhatsApp tidak valid. Gunakan format 62XXXXXXXXXXX.');
      }

      if (
        contacts.some(
          (contact, contactIndex) =>
            contact.number === sanitizedNumber && contactIndex !== index
        )
      ) {
        throw createError('Nomor WhatsApp sudah terdaftar.');
      }

      if (sanitizedNumber !== existing.number) {
        updatedContact.number = sanitizedNumber;
        hasGeneralChange = true;
      }
    }

    if (status !== undefined) {
      const normalizedStatus = normalizeStatus(status);
      if (normalizedStatus !== existing.status) {
        updatedContact.status = normalizedStatus;
        hasGeneralChange = true;
        statusChanged = true;
      }
    }

    if (hasGeneralChange) {
      const now = nowIso();
      updatedContact.updatedAt = now;
      if (statusChanged) {
        updatedContact.statusUpdatedAt = now;
      }
      contacts[index] = updatedContact;
      await writeContacts(contacts);
      return updatedContact;
    }

    return existing;
  });
}

async function updateContactStatus(id, status) {
  return updateContact(id, { status });
}

async function bulkUpdateContactStatus(ids, status) {
  return withContactsLock(async () => {
    const normalizedIds = normalizeIds(ids);
    if (!normalizedIds.length) {
      throw createError('Pilih minimal satu kontak.');
    }

    const normalizedStatus = normalizeStatus(status);
    const contacts = await readContacts();
    const idSet = new Set(normalizedIds);
    const existingIds = new Set(contacts.map((contact) => contact.id));
    const missingIds = normalizedIds.filter((id) => !existingIds.has(id));

    if (missingIds.length) {
      throw createError('Sebagian kontak tidak ditemukan.', 404);
    }

    const now = nowIso();
    let changedCount = 0;
    const updatedContacts = contacts.map((contact) => {
      if (!idSet.has(contact.id)) return contact;
      if (contact.status === normalizedStatus) return contact;
      changedCount += 1;
      return {
        ...contact,
        status: normalizedStatus,
        updatedAt: now,
        statusUpdatedAt: now,
      };
    });

    if (changedCount > 0) {
      await writeContacts(updatedContacts);
    }

    const updatedById = new Map(updatedContacts.map((contact) => [contact.id, contact]));
    return normalizedIds
      .map((id) => updatedById.get(id))
      .filter(Boolean);
  });
}

async function deleteContact(id) {
  return withContactsLock(async () => {
    if (!id) {
      throw createError('ID kontak wajib diisi.');
    }

    const contacts = await readContacts();
    const index = contacts.findIndex((contact) => contact.id === id);
    if (index === -1) {
      throw createError('Kontak tidak ditemukan.', 404);
    }

    const [deletedContact] = contacts.splice(index, 1);
    await writeContacts(contacts);
    return deletedContact;
  });
}

async function bulkDeleteContacts(ids) {
  return withContactsLock(async () => {
    const normalizedIds = normalizeIds(ids);
    if (!normalizedIds.length) {
      throw createError('Pilih minimal satu kontak.');
    }

    const contacts = await readContacts();
    const idSet = new Set(normalizedIds);
    const existingIds = new Set(contacts.map((contact) => contact.id));
    const missingIds = normalizedIds.filter((id) => !existingIds.has(id));

    if (missingIds.length) {
      throw createError('Sebagian kontak tidak ditemukan.', 404);
    }

    const deletedContacts = contacts.filter((contact) => idSet.has(contact.id));
    const remainingContacts = contacts.filter((contact) => !idSet.has(contact.id));

    if (deletedContacts.length) {
      await writeContacts(remainingContacts);
    }

    return deletedContacts;
  });
}

module.exports = {
  getAllContacts,
  createContact,
  updateContact,
  updateContactStatus,
  bulkUpdateContactStatus,
  deleteContact,
  bulkDeleteContacts,
  sanitizeNumber,
  isValidNumber,
  ALLOWED_STATUSES,
};
