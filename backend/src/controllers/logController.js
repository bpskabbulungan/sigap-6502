const { setupLogger } = require("../utils/logger");
const { getCurrentLogTimestamp } = require("../utils/time");
const { emitLogUpdate } = require("../utils/socketHandler");

const logger = setupLogger("app");

const LOG_AUDIENCES = {
  ADMIN: "admin",
  PUBLIC: "public",
};

const MAX_LOG_ENTRIES = 100;
const logs = [];

function resolveArgs(levelOrOptions, maybeOptions) {
  if (levelOrOptions && typeof levelOrOptions === "object" && !Array.isArray(levelOrOptions)) {
    return { level: "info", metadata: levelOrOptions };
  }

  return {
    level: typeof levelOrOptions === "string" ? levelOrOptions : "info",
    metadata:
      maybeOptions && typeof maybeOptions === "object" && !Array.isArray(maybeOptions)
        ? maybeOptions
        : {},
  };
}

function normalizeAudiences(audience) {
  if (!audience) return [LOG_AUDIENCES.ADMIN];
  if (Array.isArray(audience)) {
    const unique = Array.from(new Set(audience.filter(Boolean)));
    return unique.length > 0 ? unique : [LOG_AUDIENCES.ADMIN];
  }
  return [audience];
}

function addLog(text, levelOrOptions = "info", maybeOptions) {
  const { level, metadata } = resolveArgs(levelOrOptions, maybeOptions);
  const audiences = normalizeAudiences(metadata.audience).map((item) =>
    item === LOG_AUDIENCES.PUBLIC ? LOG_AUDIENCES.PUBLIC : LOG_AUDIENCES.ADMIN
  );

  const time = getCurrentLogTimestamp();
  const line = `[${time}] ${text}`;

  console.log(line);

  audiences.forEach((audience) => {
    if (logs.length >= MAX_LOG_ENTRIES) {
      logs.shift();
    }
    logs.push({ line, audience });
    emitLogUpdate(line, audience);
  });

  if (!metadata.skipPersist) {
    switch (level) {
      case "error":
        logger.error(text);
        break;
      case "warn":
        logger.warn(text);
        break;
      default:
        logger.info(text);
    }
  }
}

function getLogs(limit = 100, audience = LOG_AUDIENCES.PUBLIC) {
  const normalized = audience === LOG_AUDIENCES.ADMIN ? LOG_AUDIENCES.ADMIN : LOG_AUDIENCES.PUBLIC;
  const filtered =
    normalized === LOG_AUDIENCES.ADMIN
      ? logs
      : logs.filter((entry) => entry.audience === LOG_AUDIENCES.PUBLIC);

  return filtered.slice(-limit).map((entry) => entry.line);
}

module.exports = { addLog, getLogs, LOG_AUDIENCES };
