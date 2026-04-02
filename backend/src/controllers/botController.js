const wweb = require("whatsapp-web.js");
const { Client, LocalAuth } = wweb;
const RemoteWebCache = wweb.RemoteWebCache;

const qrcode = require("qrcode-terminal");
const path = require("path");
const fs = require("fs");
const moment = require("moment-timezone");
const { startScheduler, stopScheduler } = require("./schedulerController");
const { startHeartbeat, stopHeartbeat } = require("../utils/heartbeat");
const { addLog, LOG_AUDIENCES } = require("./logController");
const { emitStatusUpdate, emitQrUpdate } = require("../utils/socketHandler");
const { TIMEZONE } = require("../utils/calendar");

const BOT_VERBOSE_LOGS = process.env.BOT_VERBOSE_LOGS !== "false";
const WA_WEB_VERSION = (process.env.WA_WEB_VERSION || "").trim();

const logAdmin = (message, level = "info", options = {}) =>
  addLog(message, level, { audience: options.audience || LOG_AUDIENCES.ADMIN, ...options });
const logPublic = (message, level = "info", options = {}) =>
  addLog(message, level, { audience: options.audience || LOG_AUDIENCES.PUBLIC, ...options });

let client = null;
let latestQR = null;
let botActive = false;
let botPhase = "idle";
let clientSessionId = 0;
let isRestarting = false;
let manualStopInProgress = false;
let isClientReady = false;
let statusCheckerInterval = null;
let lastHealthyAt = null;
let consecutiveStateWarnings = 0;

let firstBoot = true;
let readyInterval = null;
let readyDeadlineAt = null;
let authStateInterval = null;

const COLD_READY_MS = (() => {
  const raw = parseInt(process.env.BOT_READY_TIMEOUT_MS || "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 3 * 60 * 1000;
})();
const WARM_READY_MS = (() => {
  const raw = parseInt(process.env.BOT_READY_TIMEOUT_WARM_MS || "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 90 * 1000;
})();
const TRANSIENT_STATES = new Set(["OPENING", "PAIRING", "UNPAIRED_IDLE", "UNLAUNCHED"]);
const TRANSIENT_GRACE_MS = 90 * 1000;
const MAX_STATE_WARNINGS_BEFORE_RESTART = 2;

function beginClientSession() {
  clientSessionId += 1;
  return clientSessionId;
}

function invalidateClientSession() {
  clientSessionId += 1;
  return clientSessionId;
}

function isCurrentClientSession(targetClient, expectedSessionId) {
  return (
    Boolean(targetClient) &&
    targetClient === client &&
    expectedSessionId === clientSessionId
  );
}

function armReadyDeadline(label) {
  const ms = firstBoot ? COLD_READY_MS : WARM_READY_MS;
  readyDeadlineAt = Date.now() + ms;
  clearInterval(readyInterval);
  readyInterval = setInterval(() => {
    if (readyDeadlineAt && Date.now() > readyDeadlineAt) {
      clearInterval(readyInterval);
      readyInterval = null;
      readyDeadlineAt = null;

      if (isClientReady) return;

      logAdmin(
        `[Sistem] Ready timeout (${label}) setelah ${Math.round(
          ms / 1000
        )} detik tanpa progres. Restarting bot...`
      );
      logPublic("[Sistem] Bot belum siap, mencoba restart otomatis untuk melanjutkan.");
      updateBotStatus({ active: false, phase: "restarting" });

      (async () => {
        try {
          isRestarting = true;
          await stopBot(
            { scheduler: true, heartbeat: true, bot: true },
            { nextPhase: "restarting" }
          );
          await startBot();
        } catch (e) {
          logAdmin(`[Sistem] Gagal restart setelah timeout: ${e.message}`);
        } finally {
          isRestarting = false;
        }
      })();
    }
  }, 1000);
}

function bumpReadyDeadline(reason) {
  if (!readyDeadlineAt) return;
  readyDeadlineAt = Date.now() + (firstBoot ? COLD_READY_MS : WARM_READY_MS);
  if (BOT_VERBOSE_LOGS) logAdmin(`[Debug] Aktivitas: ${reason}`);
}

function clearReadyDeadline() {
  readyDeadlineAt = null;
  clearInterval(readyInterval);
  readyInterval = null;
}

function stopAuthStatePolling() {
  if (authStateInterval) {
    clearInterval(authStateInterval);
    authStateInterval = null;
  }
}

function markClientHealthy(reason) {
  lastHealthyAt = Date.now();
  consecutiveStateWarnings = 0;

  if (BOT_VERBOSE_LOGS && reason) {
    logAdmin(`[Debug] Client sehat (${reason}).`);
  }
}

function resetClientHealth() {
  lastHealthyAt = null;
  consecutiveStateWarnings = 0;
}

function handleReady(source = "ready-event", targetClient = client, sessionId = clientSessionId) {
  if (!isCurrentClientSession(targetClient, sessionId)) {
    if (BOT_VERBOSE_LOGS) {
      logAdmin(`[Debug] Abaikan ready dari sesi usang (${source}).`);
    }
    return;
  }
  if (isClientReady) return;
  clearReadyDeadline();
  stopAuthStatePolling();
  isClientReady = true;
  firstBoot = false;
  latestQR = null;
  logPublic(`[Bot] WhatsApp Client is ready! (${source})`);
  logPublic("[Sistem] Status bot: aktif.");
  emitQrUpdate(null);
  updateBotStatus({ active: true, phase: "ready" });
  markClientHealthy(source);
  startHeartbeat(logAdmin, logPublic, TIMEZONE, moment);
  startClientStatusChecker();
  startScheduler(targetClient, addLog);
}

function startAuthStatePolling(targetClient = client, sessionId = clientSessionId) {
  stopAuthStatePolling();
  let pollCount = 0;
  authStateInterval = setInterval(async () => {
    if (!isCurrentClientSession(targetClient, sessionId) || isClientReady) return;
    pollCount += 1;
    try {
      const state = await targetClient.getState();
      if (!isCurrentClientSession(targetClient, sessionId)) return;
      logAdmin(`[Debug] Auth poll state: ${state || "unknown"} (#${pollCount})`);
      if (state === "CONNECTED") {
        logAdmin("[Sistem] Deteksi CONNECTED saat auth. Menandai bot siap.");
        handleReady("state-connected", targetClient, sessionId);
      }
    } catch (err) {
      if (!isCurrentClientSession(targetClient, sessionId)) return;
      logAdmin(
        `[Debug] Auth poll gagal: ${err.message || String(err)} (#${pollCount})`
      );
    }
  }, 10000);
}

// --- Status helpers ---
function updateBotStatus(partial = {}) {
  const nextActive = Object.prototype.hasOwnProperty.call(partial, "active")
    ? Boolean(partial.active)
    : botActive;
  const nextPhase = Object.prototype.hasOwnProperty.call(partial, "phase")
    ? partial.phase
    : botPhase;

  const changed = nextActive !== botActive || nextPhase !== botPhase;

  botActive = nextActive;
  botPhase = nextPhase;

  if (changed) {
    emitStatusUpdate({ active: botActive, phase: botPhase });
  }
}

function getBotStatus() {
  return { active: botActive, phase: botPhase };
}

// --- Core ---
async function startBot() {
  if (client) {
    logAdmin("[Sistem] Bot sudah aktif.");
    return;
  }

  isClientReady = false;
  updateBotStatus({ active: false, phase: "starting" });

  const puppeteerOptions = {
    headless: process.env.PUPPETEER_HEADLESS
      ? process.env.PUPPETEER_HEADLESS === "true"
      : true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
    ],
  };

  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    puppeteerOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  const clientOpts = {
    authStrategy: new LocalAuth({
      dataPath: path.join(__dirname, "..", "..", "storage", "sessions"),
    }),
    puppeteer: puppeteerOptions,
  };

  if (RemoteWebCache) {
    const cache = new RemoteWebCache({
      remotePath:
        "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html",
      strict: false,
    });
    clientOpts.webVersionCache = cache;
  }

  if (WA_WEB_VERSION) {
    clientOpts.webVersion = WA_WEB_VERSION;
  }

  const currentSessionId = beginClientSession();
  const currentClient = new Client(clientOpts);
  client = currentClient;
  const isStaleSession = () =>
    !isCurrentClientSession(currentClient, currentSessionId);

  // --- Events ---
  currentClient.on("loading_screen", (percent, message) => {
    if (isStaleSession()) return;
    bumpReadyDeadline("loading_screen");
    if (!BOT_VERBOSE_LOGS) return;
    const percentText =
      typeof percent === "number" && !Number.isNaN(percent)
        ? `${percent}%`
        : percent != null
        ? String(percent)
        : "?";
    const detail = message ? ` - ${message}` : "";
    logAdmin(`[Bot] Loading screen: ${percentText}${detail}`);
  });

  currentClient.on("change_state", (state) => {
    if (isStaleSession()) return;
    bumpReadyDeadline("change_state");
    if (state === "CONNECTED") {
      markClientHealthy("change_state CONNECTED");
    }
    if (!BOT_VERBOSE_LOGS) return;
    logAdmin(`[Bot] State berubah: ${state}`);
  });

  currentClient.on("qr", (qr) => {
    if (isStaleSession()) return;
    clearReadyDeadline();
    stopAuthStatePolling();
    if (latestQR !== qr) {
      latestQR = qr;
      updateBotStatus({ active: false, phase: "waiting-qr" });
      qrcode.generate(qr, { small: true });
      logAdmin("[Bot] Scan QR code ini dengan WhatsApp Anda.");
      emitQrUpdate(qr);
    }
  });

  currentClient.on("authenticated", () => {
    if (isStaleSession()) return;
    latestQR = null;
    logPublic("[Bot] Authenticated");
    updateBotStatus({ active: false, phase: "authenticated" });
    emitQrUpdate(null);
    armReadyDeadline("post-auth");
    startAuthStatePolling(currentClient, currentSessionId);
  });

  currentClient.on("ready", async () => {
    if (isStaleSession()) return;
    handleReady("ready-event", currentClient, currentSessionId);
  });

  currentClient.on("auth_failure", async (e) => {
    if (isStaleSession()) return;
    firstBoot = true;
    clearReadyDeadline();
    stopAuthStatePolling();
    resetClientHealth();
    logAdmin(`[Sistem] Autentikasi gagal${e ? `: ${e}` : ""}. Reset sesi...`);
    logPublic("[Sistem] Autentikasi WhatsApp gagal. Menunggu pemindaian ulang.");
    try {
      const sessionPath = path.join(
        __dirname,
        "..",
        "..",
        "storage",
        "sessions"
      );
      fs.rmSync(sessionPath, { recursive: true, force: true });
    } catch (_) {
      // Abaikan kegagalan pembersihan sesi.
    }
    client = null;
    isClientReady = false;
    latestQR = null;
    emitQrUpdate(null);
    logAdmin("[Sistem] Silakan scan ulang QR terbaru.");
    updateBotStatus({ active: false, phase: "error" });
  });

  currentClient.on("disconnected", async (reason) => {
    if (isStaleSession()) return;
    clearReadyDeadline();
    stopAuthStatePolling();
    resetClientHealth();

    if (manualStopInProgress) {
      logAdmin(
        "[Sistem] Disconnect saat penghentian manual. Melewati auto-restart."
      );
      manualStopInProgress = false;
      return;
    }

    if (isRestarting) return;
    isRestarting = true;

    logAdmin(`[Sistem] Client disconnected: ${reason}. Mencoba restart...`);
    logPublic("[Sistem] Koneksi WhatsApp terputus. Mencoba restart otomatis...");

    try {
      await stopBot(
        { scheduler: true, heartbeat: true, bot: true },
        { nextPhase: "restarting" }
      );
    } catch (err) {
      logAdmin(
        `[Sistem] Gagal menghentikan bot setelah disconnect: ${err.message}`
      );
    }

    try {
      await startBot();
    } catch (err) {
      logAdmin(`[Sistem] Gagal restart bot: ${err.message}`);
    } finally {
      isRestarting = false;
    }
  });

  // --- Initialize ---
  try {
    logPublic("[Sistem] Inisialisasi WhatsApp client...");
    if (WA_WEB_VERSION) {
      logAdmin(`[Sistem] Memakai WA Web version ${WA_WEB_VERSION}.`);
    } else {
      logAdmin("[Sistem] WA Web mengikuti cache otomatis (tidak dipaksa).");
    }
    try {
      await currentClient.initialize();
      if (isStaleSession()) return;
    } catch (e) {
      if (isStaleSession()) return;
      try {
        const sessionsBase = path.join(
          __dirname,
          "..",
          "..",
          "storage",
          "sessions"
        );
        const profileDir = path.join(sessionsBase, "session");
        for (const f of [
          path.join(profileDir, "SingletonLock"),
          path.join(profileDir, "SingletonCookie"),
          path.join(profileDir, "SingletonSocket"),
          path.join(profileDir, "DevToolsActivePort"),
        ]) {
          try {
            fs.rmSync(f, { force: true });
          } catch (_) {
            // Abaikan kegagalan penghapusan file lock.
          }
        }
        logAdmin(
          "[Sistem] Deteksi kegagalan launch. Membersihkan lock dan mencoba lagi..."
        );
      } catch (_) {
        // Abaikan kegagalan pembersihan profile directory.
      }
      await currentClient.initialize();
      if (isStaleSession()) return;
    }
    logPublic("[Sistem] Inisialisasi WhatsApp client selesai. Menunggu status siap.");
  } catch (err) {
    if (isStaleSession()) return;
    clearReadyDeadline();
    stopAuthStatePolling();
    resetClientHealth();
    logAdmin(`[Sistem] Gagal inisialisasi client: ${err.message}`);
    logPublic("[Sistem] Bot gagal inisialisasi. Menunggu tindakan administrator.");
    client = null;
    isClientReady = false;
    latestQR = null;
    emitQrUpdate(null);
    logAdmin(
      '[Sistem] QR dibatalkan. Setelah perbaikan, tekan "Start Bot" untuk mencoba lagi.'
    );
    updateBotStatus({ active: false, phase: "error" });
  }
}

async function stopBot(logPartsArg, optionsArg) {
  const logParts = logPartsArg ?? {
    scheduler: true,
    heartbeat: true,
    bot: true,
  };
  const options = optionsArg ?? {};
  const { nextPhase = "stopped" } = options;

  const hasManualOption = Object.prototype.hasOwnProperty.call(
    options,
    "manual"
  );
  const manualStop = hasManualOption
    ? Boolean(options.manual)
    : arguments.length === 0;
  const clientToStop = client;

  if (!clientToStop) {
    if (logParts.heartbeat)
      logAdmin("[Sistem] Menghentikan heartbeat...");
    stopHeartbeat();

    stopClientStatusChecker();
    clearReadyDeadline();
    stopAuthStatePolling();
    resetClientHealth();

    if (logParts.bot) logAdmin("[Sistem] Bot belum aktif.");
    updateBotStatus({ active: false, phase: nextPhase });
    return;
  }

  // Invalidate session first so late events from old client cannot override status.
  invalidateClientSession();

  try {
    const schedulerLogger = logParts.scheduler ? addLog : () => {};
    await stopScheduler(schedulerLogger);

    if (logParts.heartbeat) logAdmin("[Sistem] Menghentikan heartbeat...");
    stopHeartbeat();

    stopClientStatusChecker();

    clearReadyDeadline();
    stopAuthStatePolling();
    resetClientHealth();

    if (manualStop) manualStopInProgress = true;

    try {
      await clientToStop.destroy();
    } finally {
      if (manualStop) manualStopInProgress = false;
    }

    client = null;
    latestQR = null;
    isClientReady = false;

    if (logParts.bot) logPublic("[Sistem] Bot dinonaktifkan.");
    emitQrUpdate(null);
    updateBotStatus({ active: false, phase: nextPhase });
  } catch (err) {
    logAdmin(`[Sistem] Gagal stop bot: ${err.message}`);
    throw err;
  }
}

function startClientStatusChecker(intervalMs = 60000) {
  if (statusCheckerInterval) clearInterval(statusCheckerInterval);

  resetClientHealth();
  markClientHealthy("status-check-start");

  const restartAfterSilentCrash = async () => {
    if (isRestarting) return;
    isRestarting = true;

    try {
      try {
        await stopBot(
          { scheduler: true, heartbeat: true, bot: true },
          { nextPhase: "restarting" }
        );
      } catch (err) {
        logAdmin(
          `[Sistem] Gagal menghentikan bot setelah pengecekan silent crash: ${err.message}`
        );
      }

      try {
        await startBot();
      } catch (err) {
        logAdmin(
          `[Sistem] Gagal restart bot setelah pengecekan silent crash: ${err.message}`
        );
      }
    } finally {
      isRestarting = false;
    }
  };

  statusCheckerInterval = setInterval(async () => {
    if (isRestarting) return;
    const inspectedClient = client;
    const inspectedSessionId = clientSessionId;
    if (!isCurrentClientSession(inspectedClient, inspectedSessionId)) return;

    try {
      const state = await inspectedClient.getState();
      if (!isCurrentClientSession(inspectedClient, inspectedSessionId)) return;

      if (state === "CONNECTED") {
        markClientHealthy("getState CONNECTED");
        return;
      }

      const now = Date.now();
      const msSinceHealthy = lastHealthyAt ? now - lastHealthyAt : Infinity;
      const isTransient = TRANSIENT_STATES.has(state);
      const withinTransientGrace =
        isTransient && msSinceHealthy < TRANSIENT_GRACE_MS;

      if (withinTransientGrace) {
        consecutiveStateWarnings = 0;
        if (BOT_VERBOSE_LOGS) {
          const remaining = Math.max(
            0,
            Math.round((TRANSIENT_GRACE_MS - msSinceHealthy) / 1000)
          );
          logAdmin(
            `[Debug] State ${state} masih transien, menunggu ${remaining}s sebelum restart.`
          );
        }
        return;
      }

      consecutiveStateWarnings += 1;

      if (consecutiveStateWarnings < MAX_STATE_WARNINGS_BEFORE_RESTART) {
        if (BOT_VERBOSE_LOGS) {
          logAdmin(
            `[Debug] State ${state || "unknown"} (${consecutiveStateWarnings}/${MAX_STATE_WARNINGS_BEFORE_RESTART} peringatan) sebelum restart.`
          );
        }
        return;
      }

      logAdmin(`[Sistem] Client state: ${state || "unknown"}. Restarting bot...`);
      logPublic(
        "[Sistem] Koneksi bot terputus. Mencoba memulihkan secara otomatis..."
      );
      resetClientHealth();
      await restartAfterSilentCrash();
    } catch (err) {
      if (!isCurrentClientSession(inspectedClient, inspectedSessionId)) return;
      logAdmin(`[Sistem] Gagal cek client state: ${err.message}`);
      resetClientHealth();
      await restartAfterSilentCrash();
    }
  }, intervalMs);
}

function stopClientStatusChecker() {
  if (statusCheckerInterval) {
    clearInterval(statusCheckerInterval);
    statusCheckerInterval = null;
  }
}

function getQR() {
  return latestQR;
}

function getClient() {
  return isClientReady && client ? client : null;
}

function isBotActive() {
  return botActive;
}

module.exports = {
  startBot,
  stopBot,
  getQR,
  getClient,
  getBotStatus,
  isBotActive,
};
