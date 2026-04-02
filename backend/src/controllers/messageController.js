const fs = require('fs');
const path = require('path');
const { getRandomQuote } = require('../utils/quotes');
const { resetHeartbeat } = require('../utils/heartbeat');
const { getAllContacts } = require('../services/contactService');
const { getActiveTemplateContent } = require('../services/templateService');
const { LOG_AUDIENCES } = require('./logController');

const NAME_PLACEHOLDER = '{name}';
const QUOTE_PLACEHOLDER = '{quote}';
const DEFAULT_MESSAGE_MODE = 'default-template';
const CUSTOM_MESSAGE_MODE = 'custom-message';

function writeLog(addLog, message, level = 'info', audience = LOG_AUDIENCES.ADMIN) {
  if (typeof addLog !== 'function') {
    return;
  }

  if (addLog === console.log) {
    if (level === 'error') {
      console.error(message);
      return;
    }

    if (level === 'warn') {
      console.warn(message);
      return;
    }

    console.log(message);
    return;
  }

  addLog(message, level, { audience });
}

function logAdmin(addLog, message, level = 'info') {
  writeLog(addLog, message, level, LOG_AUDIENCES.ADMIN);
}

function logPublic(addLog, message, level = 'info') {
  writeLog(addLog, message, level, LOG_AUDIENCES.PUBLIC);
}

function getPublicDisplayName(name) {
  if (!name || typeof name !== 'string') {
    return 'Kontak';
  }

  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : 'Kontak';
}

async function loadContacts() {
  try {
    const contacts = await getAllContacts();
    const eligibleContacts = Array.isArray(contacts)
      ? contacts.filter((contact) => contact.status === 'masuk')
      : [];

    if (!Array.isArray(eligibleContacts) || eligibleContacts.length === 0) {
      console.log('[Message] Tidak ada kontak yang ditemukan.');
      return [];
    }
    return eligibleContacts.map(({ name, number }) => ({ name, number }));
  } catch (err) {
    console.error('[Message] Gagal baca kontak:', err);
    return [];
  }
}

async function loadMessageTemplate() {
  try {
    const content = await getActiveTemplateContent();
    if (typeof content === 'string' && content.trim()) {
      return content;
    }
  } catch (err) {
    console.error('[Message] Gagal baca template:', err);
  }

  try {
    const fallback = fs.readFileSync(
      path.join(__dirname, '..', 'templates', 'message_template.txt'),
      'utf-8'
    );
    if (typeof fallback === 'string' && fallback.trim()) {
      return fallback;
    }
  } catch (fallbackError) {
    console.error('[Message] Gagal baca template fallback:', fallbackError);
  }

  return null;
}

function applyTemplateTokens(template, { name, quote }) {
  return String(template || '')
    .replaceAll(NAME_PLACEHOLDER, name)
    .replaceAll(QUOTE_PLACEHOLDER, quote);
}

async function resolveDefaultTemplateMessage(name) {
  const template = await loadMessageTemplate();
  if (!template) {
    throw new Error('Templat bawaan tidak tersedia.');
  }

  const quote = await getRandomQuote();
  return applyTemplateTokens(template, { name, quote });
}

async function resolveManualAnnouncementMessage(name, manualEvent = {}) {
  const mode = manualEvent.messageMode || DEFAULT_MESSAGE_MODE;

  if (mode !== CUSTOM_MESSAGE_MODE) {
    return resolveDefaultTemplateMessage(name);
  }

  const customTemplate =
    typeof manualEvent.customMessage === 'string'
      ? manualEvent.customMessage.trim()
      : '';

  if (!customTemplate) {
    throw new Error('Pesan custom untuk pengumuman tidak tersedia.');
  }

  const needsQuote = customTemplate.includes(QUOTE_PLACEHOLDER);
  const quote = needsQuote ? await getRandomQuote() : '';

  return applyTemplateTokens(customTemplate, { name, quote });
}

async function buildMessageForContact(name, options = {}) {
  const displayName =
    typeof name === 'string' && name.trim() ? name.trim() : 'Rekan';

  if (options?.manualEvent) {
    return resolveManualAnnouncementMessage(displayName, options.manualEvent);
  }

  return resolveDefaultTemplateMessage(displayName);
}

async function sendMessage(number, message, client) {
  const chatId = number.includes('@c.us') ? number : `${number}@c.us`;
  await client.sendMessage(chatId, message);
}

function resolveDispatchLabel(options = {}) {
  if (options?.manualEvent) {
    return 'pengumuman terjadwal';
  }

  return 'pesan presensi';
}

async function sendMessageToNumber(
  client,
  number,
  name,
  addLog = console.log,
  options = {}
) {
  const dispatchLabel = resolveDispatchLabel(options);

  try {
    const message = await buildMessageForContact(name, options);

    const chatId = number.includes('@c.us') ? number : `${number}@c.us`;
    await client.sendMessage(chatId, message);
    const publicName = getPublicDisplayName(name);
    logAdmin(
      addLog,
      `[Message] ${dispatchLabel} berhasil dikirim ke ${name} (${number}).`
    );
    logPublic(addLog, `[Message] ${dispatchLabel} berhasil dikirim ke ${publicName}.`);
    return true;
  } catch (err) {
    const publicName = getPublicDisplayName(name);
    logAdmin(
      addLog,
      `[Message] Gagal mengirim ${dispatchLabel} ke ${name} (${number}).`,
      'warn'
    );
    logPublic(
      addLog,
      `[Message] Gagal mengirim ${dispatchLabel} ke ${publicName}.`,
      'warn'
    );
    logAdmin(addLog, `[Message] Detail kegagalan: ${err.name} - ${err.message}`, 'error');
    return false;
  }
}

async function sendMessagesToAll(client, addLog = console.log, options = {}) {
  if (!client) {
    logAdmin(addLog, '[Message] Client tidak tersedia.', 'warn');
    return { successCount: 0, failedCount: 0, total: 0 };
  }

  let state;
  try {
    state = await client.getState();
  } catch (err) {
    logAdmin(addLog, '[Message] Gagal mendapatkan state client.', 'warn');
    return { successCount: 0, failedCount: 0, total: 0 };
  }

  if (state !== 'CONNECTED') {
    logAdmin(addLog, `[Message] Client state bukan CONNECTED: ${state}`, 'warn');
    return { successCount: 0, failedCount: 0, total: 0 };
  }

  const contacts = await loadContacts();
  if (!Array.isArray(contacts) || contacts.length === 0) {
    logAdmin(addLog, '[Message] Tidak ada kontak yang ditemukan.', 'warn');
    return { successCount: 0, failedCount: 0, total: 0 };
  }

  const dispatchLabel = resolveDispatchLabel(options);
  const startMessage = `[Message] Mulai mengirim ${dispatchLabel} ke ${contacts.length} kontak...`;
  logAdmin(addLog, startMessage);
  logPublic(addLog, startMessage);

  let successCount = 0;
  let failedCount = 0;

  await Promise.all(
    contacts.map(
      (contact, index) =>
        new Promise((resolve) => {
          setTimeout(async () => {
            const success = await sendMessageToNumber(
              client,
              contact.number,
              contact.name,
              addLog,
              options
            );
            if (success) successCount += 1;
            else failedCount += 1;
            resolve();
          }, index * 1500);
        })
    )
  );

  const hasFailure = failedCount > 0;
  const summaryMessage = `[Message] Pengiriman ${dispatchLabel} selesai: ${successCount} sukses, ${failedCount} gagal.`;
  logAdmin(addLog, summaryMessage, hasFailure ? 'warn' : 'info');
  logPublic(
    addLog,
    summaryMessage,
    hasFailure ? 'warn' : 'info'
  );
  resetHeartbeat();

  return {
    successCount,
    failedCount,
    total: contacts.length,
  };
}

module.exports = {
  sendMessage,
  sendMessagesToAll,
  sendMessageToNumber,
  loadContacts,
};
