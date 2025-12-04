const express = require('express');
const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');
const { getLogs, addLog, LOG_AUDIENCES } = require('../controllers/logController');
const { getQR, getBotStatus } = require('../controllers/botController');
const { parseLogFilePerDay } = require('../utils/statParser');
const { TIMEZONE } = require('../utils/calendar');
const { APP_DATE_FORMAT } = require('../utils/dateFormatter');
const { requireAdmin } = require('../middleware/adminAuth');

const router = express.Router();
let QRCodeLib = null;

router.get('/health', (req, res) => {
  const botStatus = getBotStatus();
  res.json({
    status: 'ok',
    botActive: botStatus.active,
    botPhase: botStatus.phase,
    botStatus,
    timezone: TIMEZONE,
    timestamp: moment().tz(TIMEZONE).toISOString(),
  });
});

router.get('/logs', requireAdmin, (req, res) => {
  const limit = Number.parseInt(req.query.limit, 10) || 100;
  const audience =
    req.query.audience === LOG_AUDIENCES.ADMIN
      ? LOG_AUDIENCES.ADMIN
      : LOG_AUDIENCES.PUBLIC;

  res.json({ logs: getLogs(limit, audience) });
});

router.get('/bot/status', (req, res) => {
  res.json(getBotStatus());
});

router.get('/qr', requireAdmin, (req, res) => {
  const qr = getQR();
  res.json({ qr });
});

router.get('/qr.svg', requireAdmin, async (req, res, next) => {
  try {
    const qr = getQR();
    if (!qr) {
      return res.status(404).send('QR belum tersedia. Pastikan bot sedang menunggu pemindaian.');
    }

    if (!QRCodeLib) {
      // eslint-disable-next-line global-require
      QRCodeLib = require('qrcode');
    }

    const svg = await QRCodeLib.toString(qr, {
      type: 'svg',
      margin: 1,
      width: 280,
      errorCorrectionLevel: 'M',
    });

    res.setHeader('Content-Type', 'image/svg+xml');
    return res.send(svg);
  } catch (error) {
    return next(error);
  }
});

router.get('/keepalive', requireAdmin, (req, res) => {
  const now = moment().tz(TIMEZONE);
  const nowIso = now.toISOString();
  const nowLabel = now.format(`${APP_DATE_FORMAT} HH:mm:ss`);
  addLog(`[KeepAlive] Ping diterima pada ${nowLabel}`, {
    audience: LOG_AUDIENCES.ADMIN,
  });
  res.json({ status: 'alive', timestamp: nowIso, formattedTimestamp: nowLabel });
});

router.get('/stats', requireAdmin, async (req, res, next) => {
  const logsDir = path.join(__dirname, '..', '..', 'logs');
  try {
    await fs.promises.mkdir(logsDir, { recursive: true });
    const combined = {
      messagesPerDay: {},
      errorsPerDay: {},
      uptimePerDay: {},
    };

    const files = (await fs.promises.readdir(logsDir)).filter((f) => f.endsWith('.log'));
    await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(logsDir, file);
        const stats = await parseLogFilePerDay(filePath);

        Object.entries(stats.messagesPerDay).forEach(([date, count]) => {
          combined.messagesPerDay[date] = (combined.messagesPerDay[date] || 0) + count;
        });
        Object.entries(stats.errorsPerDay).forEach(([date, count]) => {
          combined.errorsPerDay[date] = (combined.errorsPerDay[date] || 0) + count;
        });
        Object.entries(stats.uptimePerDay).forEach(([date, hours]) => {
          combined.uptimePerDay[date] = (combined.uptimePerDay[date] || 0) + hours;
        });
      })
    );

    res.json(combined);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
