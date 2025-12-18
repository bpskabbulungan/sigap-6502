const { getRandomQuote } = require("./quotes");

const HEARTBEAT_INTERVAL_MS = 60 * 60 * 1000; // 1 jam
const QUOTE_INTERVAL_MS = 30 * 60 * 1000; // 30 menit

let lastHeartbeatTime = Date.now();
let heartbeatIntervalId = null;
let quoteIntervalId = null;
let heartbeatContext = null;

function withContext(fn) {
  if (!heartbeatContext) return;
  fn(heartbeatContext);
}

function formatTimestamp() {
  if (!heartbeatContext || typeof heartbeatContext.moment !== "function") {
    return new Date().toISOString();
  }

  const { moment, timezone } = heartbeatContext;

  try {
    if (timezone) {
      if (typeof moment.tz === "function") {
        return moment.tz(timezone).format("DD-MM-YYYY HH:mm:ss");
      }

      return moment().tz(timezone).format("DD-MM-YYYY HH:mm:ss");
    }

    return moment().format("DD-MM-YYYY HH:mm:ss");
  } catch (err) {
    return new Date().toISOString();
  }
}

function logToAudiences(message, level = "info") {
  withContext(({ logAdmin, logPublic }) => {
    if (typeof logAdmin === "function") {
      logAdmin(message, level, { audience: ["admin", "public"] });
      return;
    }
    if (typeof logPublic === "function") logPublic(message, level);
  });
}

function handleHeartbeatTick() {
  withContext(() => {
    const now = Date.now();
    const diffMinutes = Math.max(0, Math.round((now - lastHeartbeatTime) / 60000));
    const sinceText = diffMinutes > 0 ? ` (selang ${diffMinutes} menit sejak heartbeat terakhir)` : "";
    const timestamp = formatTimestamp();

    logToAudiences(`[Heartbeat] Sistem aktif${sinceText} @ ${timestamp}`);

    lastHeartbeatTime = now;
  });
}

async function handleQuoteTick() {
  if (!heartbeatContext) return;

  const timestamp = formatTimestamp();

  try {
    const quote = await getRandomQuote();
    logToAudiences(`[Quote] ${quote} @ ${timestamp}`);
  } catch (err) {
    const adminMessage = `[Quote] Gagal memuat kutipan acak @ ${timestamp}. ${err?.message || err}`;
    const publicMessage = `[Quote] Gagal memuat kutipan acak. Akan mencoba lagi nanti @ ${timestamp}`;

    withContext(({ logAdmin, logPublic }) => {
      if (typeof logAdmin === "function") logAdmin(adminMessage, "warn");
      if (typeof logPublic === "function") logPublic(publicMessage, "warn");
    });
  }
}

function armIntervals() {
  if (heartbeatIntervalId) clearInterval(heartbeatIntervalId);
  if (quoteIntervalId) clearInterval(quoteIntervalId);

  heartbeatIntervalId = setInterval(handleHeartbeatTick, HEARTBEAT_INTERVAL_MS);
  quoteIntervalId = setInterval(() => {
    handleQuoteTick();
  }, QUOTE_INTERVAL_MS);
}

function startHeartbeat(logAdmin, logPublic, timezone, moment) {
  heartbeatContext = { logAdmin, logPublic, timezone, moment };
  resetHeartbeat();
}

function stopHeartbeat() {
  if (heartbeatIntervalId) {
    clearInterval(heartbeatIntervalId);
    heartbeatIntervalId = null;
  }

  if (quoteIntervalId) {
    clearInterval(quoteIntervalId);
    quoteIntervalId = null;
  }

  heartbeatContext = null;
}

function resetHeartbeat() {
  lastHeartbeatTime = Date.now();

  if (!heartbeatContext) return;

  armIntervals();
}

function getLastHeartbeat() {
  return lastHeartbeatTime;
}

module.exports = {
  startHeartbeat,
  stopHeartbeat,
  resetHeartbeat,
  getLastHeartbeat,
};
