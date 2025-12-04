const express = require('express');
const { startBot, stopBot, getBotStatus } = require('../controllers/botController');
const { cleanupWwebjsProfileLocks } = require('../utils/chromeProfile');
const { botActionLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

router.post('/start', botActionLimiter, async (req, res, next) => {
  try {
    try {
      const removed = cleanupWwebjsProfileLocks();
      if (removed) {
        // optional: no need to spam logs here; server logs already record
      }
    } catch (_) {
      /* no-op */
    }
    await startBot();
    const status = getBotStatus();
    res.json({ ...status, message: 'Bot berhasil diaktifkan.' });
  } catch (err) {
    next(err);
  }
});

router.post('/stop', botActionLimiter, async (req, res, next) => {
  try {
    await stopBot(undefined, { manual: true });
    const status = getBotStatus();
    res.json({ ...status, message: 'Bot berhasil dihentikan.' });
  } catch (err) {
    next(err);
  }
});

router.get('/status', (req, res) => {
  res.json(getBotStatus());
});

module.exports = router;
