const express = require("express");
const router = express.Router();
const {
  startBot,
  stopBot,
  getBotStatus,
} = require("../controllers/botController");
const { cleanupWwebjsProfileLocks } = require("../utils/chromeProfile");
const { botActionLimiter } = require("../middleware/rateLimiters");

// Menyalakan bot
router.post("/start", botActionLimiter, async (req, res, next) => {
  try {
    try {
      cleanupWwebjsProfileLocks();
    } catch (_) {
      /* no-op */
    }
    await startBot();
    const status = getBotStatus();
    res.json({ success: true, message: "Bot berhasil diaktifkan.", ...status });
  } catch (err) {
    next(err);
  }
});

// Mematikan bot
router.post("/stop", botActionLimiter, async (req, res, next) => {
  try {
    await stopBot(undefined, { manual: true });
    const status = getBotStatus();
    res.json({ success: true, message: "Bot berhasil dihentikan.", ...status });
  } catch (err) {
    next(err);
  }
});

// Mengecek status aktif bot
router.get("/status", (req, res) => {
  res.json(getBotStatus());
});

module.exports = router;
