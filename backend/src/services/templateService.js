const fsPromises = require('fs/promises');
const path = require('path');
const { withFileLock } = require('../utils/fileMutex');

const STORAGE_DIR = path.join(__dirname, '..', '..', 'storage');
const STORAGE_FILE = path.join(STORAGE_DIR, 'message_templates.json');
const LEGACY_TEMPLATE_FILE = path.join(
  __dirname,
  '..',
  'templates',
  'message_template.txt'
);

const DEFAULT_TEMPLATE_ID = 'default-reminder';
const DEFAULT_TEMPLATE_NAME = 'Templat Pesan Pengingat';
const DEFAULT_TEMPLATE_CATEGORY = 'Bawaan';
const DEFAULT_TEMPLATE_DESCRIPTION =
  'Templat utama untuk pengiriman pesan pengingat otomatis.';
const FALLBACK_TEMPLATE_CONTENT =
  'Halo {name},\n{quote}\nSemoga harimu menyenangkan!';

function withTemplateLock(task) {
  return withFileLock(STORAGE_FILE, task);
}

function createError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeTemplateId(rawValue, fallback = '') {
  if (typeof rawValue !== 'string') return fallback;

  const normalized = rawValue
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || fallback;
}

function normalizeTimestamp(rawValue, fallbackValue) {
  if (typeof rawValue !== 'string' || !rawValue.trim()) {
    return fallbackValue;
  }

  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) {
    return fallbackValue;
  }

  return parsed.toISOString();
}

function normalizeText(rawValue, fallback = '') {
  if (typeof rawValue !== 'string') return fallback;
  const trimmed = rawValue.trim();
  return trimmed || fallback;
}

function normalizeContent(rawValue) {
  if (typeof rawValue !== 'string') return '';
  return rawValue.replace(/\r\n/g, '\n');
}

function buildDefaultTemplate(content) {
  const timestamp = nowIso();
  return {
    id: DEFAULT_TEMPLATE_ID,
    name: DEFAULT_TEMPLATE_NAME,
    category: DEFAULT_TEMPLATE_CATEGORY,
    description: DEFAULT_TEMPLATE_DESCRIPTION,
    content: normalizeContent(content) || FALLBACK_TEMPLATE_CONTENT,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function sanitizeTemplateCandidate(rawTemplate) {
  if (!rawTemplate || typeof rawTemplate !== 'object') {
    return null;
  }

  const content = normalizeContent(rawTemplate.content ?? rawTemplate.template);
  if (!content.trim()) {
    return null;
  }

  const createdAt = normalizeTimestamp(rawTemplate.createdAt, nowIso());
  const updatedAt = normalizeTimestamp(rawTemplate.updatedAt, createdAt);

  return {
    id: normalizeTemplateId(rawTemplate.id, ''),
    name: normalizeText(rawTemplate.name, DEFAULT_TEMPLATE_NAME),
    category: normalizeText(rawTemplate.category, DEFAULT_TEMPLATE_CATEGORY),
    description:
      typeof rawTemplate.description === 'string'
        ? rawTemplate.description.trim()
        : DEFAULT_TEMPLATE_DESCRIPTION,
    content,
    createdAt,
    updatedAt,
  };
}

function sanitizeStore(rawStore, fallbackContent) {
  const rawTemplates = Array.isArray(rawStore?.templates) ? rawStore.templates : [];
  const candidates = rawTemplates
    .map((item) => sanitizeTemplateCandidate(item))
    .filter(Boolean);

  const requestedActiveTemplateId = normalizeTemplateId(
    rawStore?.activeTemplateId,
    ''
  );

  const selectedCandidate =
    candidates.find((item) => item.id === requestedActiveTemplateId) ||
    candidates.find((item) => item.id === DEFAULT_TEMPLATE_ID) ||
    candidates[0] ||
    null;

  const baseTemplate = selectedCandidate || buildDefaultTemplate(fallbackContent);
  const createdAt = normalizeTimestamp(baseTemplate.createdAt, nowIso());

  const template = {
    id: DEFAULT_TEMPLATE_ID,
    name: normalizeText(baseTemplate.name, DEFAULT_TEMPLATE_NAME),
    category: normalizeText(baseTemplate.category, DEFAULT_TEMPLATE_CATEGORY),
    description:
      typeof baseTemplate.description === 'string' &&
      baseTemplate.description.trim()
        ? baseTemplate.description.trim()
        : DEFAULT_TEMPLATE_DESCRIPTION,
    content: normalizeContent(baseTemplate.content) || fallbackContent,
    createdAt,
    updatedAt: normalizeTimestamp(baseTemplate.updatedAt, createdAt),
  };

  return {
    version: 1,
    activeTemplateId: DEFAULT_TEMPLATE_ID,
    templates: [template],
  };
}

async function readLegacyTemplateContent() {
  try {
    const content = await fsPromises.readFile(LEGACY_TEMPLATE_FILE, 'utf8');
    if (content.trim()) return normalizeContent(content);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('[TemplateService] Gagal membaca message_template.txt:', error);
    }
  }

  return FALLBACK_TEMPLATE_CONTENT;
}

async function syncLegacyTemplateFile(store) {
  const template = store.templates[0];
  if (!template) return;

  await fsPromises.mkdir(path.dirname(LEGACY_TEMPLATE_FILE), { recursive: true });
  await fsPromises.writeFile(
    LEGACY_TEMPLATE_FILE,
    normalizeContent(template.content),
    'utf8'
  );
}

async function writeStoreUnsafe(store) {
  await fsPromises.mkdir(STORAGE_DIR, { recursive: true });
  await fsPromises.writeFile(
    STORAGE_FILE,
    `${JSON.stringify(store, null, 2)}\n`,
    'utf8'
  );
  await syncLegacyTemplateFile(store);
  return store;
}

async function readStoreUnsafe() {
  await fsPromises.mkdir(STORAGE_DIR, { recursive: true });
  const fallbackContent = await readLegacyTemplateContent();

  try {
    const rawContent = await fsPromises.readFile(STORAGE_FILE, 'utf8');
    const parsedStore = JSON.parse(rawContent);
    const sanitizedStore = sanitizeStore(parsedStore, fallbackContent);

    if (JSON.stringify(parsedStore) !== JSON.stringify(sanitizedStore)) {
      await writeStoreUnsafe(sanitizedStore);
    }

    return sanitizedStore;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(
        '[TemplateService] File templat rusak atau tidak valid. Membuat ulang dari fallback.',
        error
      );
    }

    const defaultStore = sanitizeStore(null, fallbackContent);
    await writeStoreUnsafe(defaultStore);
    return defaultStore;
  }
}

function ensureSingleTemplate(store) {
  if (!Array.isArray(store.templates) || !store.templates.length) {
    const template = buildDefaultTemplate(FALLBACK_TEMPLATE_CONTENT);
    store.templates = [template];
    store.activeTemplateId = DEFAULT_TEMPLATE_ID;
    return template;
  }

  const template = {
    ...store.templates[0],
    id: DEFAULT_TEMPLATE_ID,
  };

  store.templates = [template];
  store.activeTemplateId = DEFAULT_TEMPLATE_ID;
  return template;
}

function serializeCollection(store) {
  const template = ensureSingleTemplate(store);

  return {
    templates: [
      {
        ...template,
        isActive: true,
      },
    ],
    activeTemplateId: DEFAULT_TEMPLATE_ID,
    templateId: DEFAULT_TEMPLATE_ID,
    template: template.content || '',
  };
}

async function getTemplateCollection() {
  return withTemplateLock(async () => {
    const store = await readStoreUnsafe();
    return serializeCollection(store);
  });
}

async function getActiveTemplateContent() {
  return withTemplateLock(async () => {
    const store = await readStoreUnsafe();
    const template = ensureSingleTemplate(store);
    return template?.content || null;
  });
}

async function saveTemplateContent(content) {
  return withTemplateLock(async () => {
    const normalizedContent = normalizeContent(content);
    if (!normalizedContent.trim()) {
      throw createError('Isi templat tidak boleh kosong.');
    }

    const store = await readStoreUnsafe();
    const template = ensureSingleTemplate(store);

    template.content = normalizedContent;
    template.updatedAt = nowIso();

    await writeStoreUnsafe(store);
    return {
      created: false,
      template,
      ...serializeCollection(store),
    };
  });
}

async function upsertTemplate(payload = {}) {
  return withTemplateLock(async () => {
    const store = await readStoreUnsafe();
    const template = ensureSingleTemplate(store);

    const hasContentField =
      Object.prototype.hasOwnProperty.call(payload, 'content') ||
      Object.prototype.hasOwnProperty.call(payload, 'template');
    const nextContentRaw = hasContentField ? payload.content ?? payload.template : null;
    const normalizedNextContent =
      nextContentRaw === null ? null : normalizeContent(nextContentRaw);

    if (
      hasContentField &&
      (typeof normalizedNextContent !== 'string' || !normalizedNextContent.trim())
    ) {
      throw createError('Isi templat tidak boleh kosong.');
    }

    const hasNameField = Object.prototype.hasOwnProperty.call(payload, 'name');
    const hasCategoryField = Object.prototype.hasOwnProperty.call(payload, 'category');
    const hasDescriptionField =
      Object.prototype.hasOwnProperty.call(payload, 'description');

    if (hasNameField) {
      template.name = normalizeText(payload.name, template.name || DEFAULT_TEMPLATE_NAME);
    }

    if (hasCategoryField) {
      template.category = normalizeText(
        payload.category,
        template.category || DEFAULT_TEMPLATE_CATEGORY
      );
    }

    if (hasDescriptionField) {
      template.description =
        typeof payload.description === 'string' && payload.description.trim()
          ? payload.description.trim()
          : '';
    }

    if (normalizedNextContent) {
      template.content = normalizedNextContent;
    }

    template.id = DEFAULT_TEMPLATE_ID;
    template.updatedAt = nowIso();

    await writeStoreUnsafe(store);
    return {
      created: false,
      template,
      ...serializeCollection(store),
    };
  });
}

async function setActiveTemplate(templateId) {
  return withTemplateLock(async () => {
    const store = await readStoreUnsafe();
    const template = ensureSingleTemplate(store);
    const normalizedTemplateId = normalizeTemplateId(templateId, '');

    if (normalizedTemplateId && normalizedTemplateId !== template.id) {
      throw createError('Templat tidak ditemukan.', 404);
    }

    return {
      template,
      ...serializeCollection(store),
    };
  });
}

async function removeTemplate(templateId) {
  return withTemplateLock(async () => {
    const store = await readStoreUnsafe();
    const template = ensureSingleTemplate(store);
    const normalizedTemplateId = normalizeTemplateId(templateId, '');

    if (normalizedTemplateId && normalizedTemplateId !== template.id) {
      throw createError('Templat tidak ditemukan.', 404);
    }

    throw createError('Sistem menggunakan satu templat tetap dan tidak dapat dihapus.', 400);
  });
}

module.exports = {
  DEFAULT_TEMPLATE_ID,
  getTemplateCollection,
  getActiveTemplateContent,
  saveTemplateContent,
  upsertTemplate,
  setActiveTemplate,
  removeTemplate,
};
