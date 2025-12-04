const express = require("express");
const { getClient } = require("../controllers/botController");
const { sendMessage } = require("../controllers/messageController");
const { requireAdmin } = require("../middleware/adminAuth");

const router = express.Router();

router.use(requireAdmin);

router.post("/send", async (req, res) => {
  const { number, message } = req.body;
  const client = getClient();

  if (!client) {
    return res.status(503).send({ success: false, error: "Bot belum aktif." });
  }

  try {
    await sendMessage(number, message, client);
    res.send({ success: true, message: "Pesan berhasil dikirim." });
  } catch (err) {
    res.status(500).send({ success: false, error: err.message });
  }
});

module.exports = router;
