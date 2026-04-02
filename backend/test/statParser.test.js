const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = 'test-session-secret-1234';
}

const { parseLogFilePerDay } = require('../src/utils/statParser');

function almostEqual(actual, expected, epsilon = 1e-6) {
  return Math.abs(actual - expected) <= epsilon;
}

async function withTempLog(lines, runner) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sigap-stat-'));
  const filePath = path.join(dir, 'app-31-03-2026.log');
  await fs.writeFile(filePath, `${lines.join('\n')}\n`, 'utf8');

  try {
    await runner(filePath);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test('parseLogFilePerDay counts messages, warns/errors, and uptime with text patterns', async () => {
  const lines = [
    '[31-03-2026 08:00:00] INFO - [Bot] WhatsApp Client is ready! (ready-event)',
    '[31-03-2026 08:05:00] INFO - [Message] Pesan berhasil dikirim ke Budi (628123)',
    '[31-03-2026 08:06:00] WARN - [Message] Gagal mengirim pesan ke Budi (628123).',
    '[31-03-2026 08:07:00] ERROR - [Message] Detail kegagalan: TimeoutError - timed out',
    '[31-03-2026 09:30:00] INFO - [Sistem] Bot dinonaktifkan.',
  ];

  await withTempLog(lines, async (filePath) => {
    const stats = await parseLogFilePerDay(filePath);

    assert.equal(stats.messagesPerDay['31-03-2026'], 1);
    assert.equal(stats.errorsPerDay['31-03-2026'], 2);
    assert.equal(almostEqual(stats.uptimePerDay['31-03-2026'], 1.5), true);
  });
});

test('parseLogFilePerDay ignores "belum aktif" and accepts status bot markers', async () => {
  const lines = [
    '[31-03-2026 09:00:00] INFO - [Sistem] Bot belum aktif.',
    '[31-03-2026 10:00:00] INFO - [Sistem] Status bot: aktif.',
    '[31-03-2026 11:00:00] INFO - [Message] Tidak ada kontak yang ditemukan.',
    '[31-03-2026 12:00:00] INFO - [Sistem] Status bot: nonaktif.',
  ];

  await withTempLog(lines, async (filePath) => {
    const stats = await parseLogFilePerDay(filePath);

    assert.equal(stats.errorsPerDay['31-03-2026'] || 0, 0);
    assert.equal(almostEqual(stats.uptimePerDay['31-03-2026'], 2), true);
  });
});

test('parseLogFilePerDay closes uptime window at EOF when stop marker is missing', async () => {
  const lines = [
    '[31-03-2026 14:00:00] INFO - [Sistem] Status bot: aktif.',
    '[31-03-2026 15:00:00] INFO - [Heartbeat] Sistem aktif @ 31-03-2026 15:00:00',
  ];

  await withTempLog(lines, async (filePath) => {
    const stats = await parseLogFilePerDay(filePath);
    assert.equal(almostEqual(stats.uptimePerDay['31-03-2026'], 1), true);
  });
});
