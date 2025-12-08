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

const logAdmin = (message, level = "info", options = {}) =>
  addLog(message, level, { audience: options.audience || LOG_AUDIENCES.ADMIN, ...options });
const logPublic = (message, level = "info", options = {}) =>
  addLog(message, level, { audience: options.audience || LOG_AUDIENCES.PUBLIC, ...options });

let client = null;
let latestQR = null;
let botActive = false;
let botPhase = "idle";
let isRestarting = false;
let manualStopInProgress = false;
let isClientReady = false;
let statusCheckerInterval = null;
let lastHealthyAt = null;
let consecutiveStateWarnings = 0;

let firstBoot = true;
let readyInterval = null;
let readyDeadlineAt = null;

const COLD_READY_MS = 5 * 60 * 1000;
const WARM_READY_MS = 2 * 60 * 1000;
const TRANSIENT_STATES = new Set(["OPENING", "PAIRING", "UNPAIRED_IDLE", "UNLAUNCHED"]);
const TRANSIENT_GRACE_MS = 3 * 60 * 1000;
const MAX_STATE_WARNINGS_BEFORE_RESTART = 3;

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
    clientOpts.webVersionCache = new RemoteWebCache({
      remotePath:
        "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html",
      strict: false,
    });
  }

  client = new Client(clientOpts);

  // --- Events ---
  client.on("loading_screen", (percent, message) => {
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

  client.on("change_state", (state) => {
    bumpReadyDeadline("change_state");
    if (state === "CONNECTED") {
      markClientHealthy("change_state CONNECTED");
    }
    if (!BOT_VERBOSE_LOGS) return;
    logAdmin(`[Bot] State berubah: ${state}`);
  });

  client.on("qr", (qr) => {
    clearReadyDeadline();
    if (latestQR !== qr) {
      latestQR = qr;
      updateBotStatus({ active: false, phase: "waiting-qr" });
      qrcode.generate(qr, { small: true });
      logAdmin("[Bot] Scan QR code ini dengan WhatsApp Anda.");
      emitQrUpdate(qr);
    }
  });

  client.on("authenticated", () => {
    latestQR = null;
    logPublic("[Bot] Authenticated");
    updateBotStatus({ active: false, phase: "authenticated" });
    emitQrUpdate(null);
    armReadyDeadline("post-auth");
  });

  client.on("ready", async () => {
    clearReadyDeadline();
    isClientReady = true;
    firstBoot = false;
    latestQR = null;
    logPublic("[Bot] WhatsApp Client is ready!");
    emitQrUpdate(null);
    updateBotStatus({ active: true, phase: "ready" });
    markClientHealthy("ready-event");
    startHeartbeat(logAdmin, logPublic, TIMEZONE, moment);

    startClientStatusChecker();

    startScheduler(client, addLog);
  });

  client.on("auth_failure", async (e) => {
    firstBoot = true;
    clearReadyDeadline();
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

  client.on("disconnected", async (reason) => {
    clearReadyDeadline();
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
    try {
      await client.initialize();
    } catch (e) {
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
      await client.initialize();
    }
    logPublic("[Sistem] Bot aktif.");
  } catch (err) {
    clearReadyDeadline();
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

  if (!client) {
    if (logParts.heartbeat)
      logAdmin("[Sistem] Menghentikan heartbeat...");
    stopHeartbeat();

    stopClientStatusChecker();
    clearReadyDeadline();
    resetClientHealth();

    if (logParts.bot) logAdmin("[Sistem] Bot belum aktif.");
    updateBotStatus({ active: false, phase: nextPhase });
    return;
  }

  try {
    const schedulerLogger = logParts.scheduler ? addLog : () => {};
    await stopScheduler(schedulerLogger);

    if (logParts.heartbeat) logAdmin("[Sistem] Menghentikan heartbeat...");
    stopHeartbeat();

    stopClientStatusChecker();

    clearReadyDeadline();
    resetClientHealth();

    if (manualStop) manualStopInProgress = true;

    try {
      await client.destroy();
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
    if (!client) return;

    try {
      const state = await client.getState();

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
