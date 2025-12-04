const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const projectRoot = path.resolve(__dirname, "..", "..");
const envFilename =
  process.env.NODE_ENV === "production" ? ".env.production" : ".env";
const envPath = path.join(projectRoot, envFilename);

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const DEFAULT_SCHEDULE_VERSION = "2025-09-wita";

const DEFAULT_SCHEDULE = {
  timezone: process.env.TIMEZONE || process.env.TZ || "Asia/Makassar",
  dailyTimes: {
    1: "16:00",
    2: "16:00",
    3: "16:00",
    4: "16:00",
    5: "16:30",
    6: null,
    7: null,
  },
  manualOverrides: [],
  paused: false,
  lastUpdatedAt: new Date(0).toISOString(),
  updatedBy: "system",
  defaultVersion: DEFAULT_SCHEDULE_VERSION,
};

const parseOrigins = (raw) => {
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

module.exports = {
  projectRoot,
  nodeEnv: process.env.NODE_ENV || "development",
  // Default backend port aligns with Docker and frontend expectations
  port: parseInt(process.env.PORT || "3301", 10),
  timezone: process.env.TIMEZONE || process.env.TZ || "Asia/Makassar",
  // Default dev web app port matches Vite dev server (see frontend/vite.config.js)
  webAppUrl: process.env.WEB_APP_URL || "http://localhost:5174",
  sessionSecret: (() => {
    const secret = process.env.SESSION_SECRET;
    if (!secret || secret.length < 16) {
      throw new Error("SESSION_SECRET wajib diisi dan minimal 16 karakter.");
    }
    return secret;
  })(),
  admin: {
    username: process.env.ADMIN_USERNAME || "admin",
    passwordHash: process.env.ADMIN_PASSWORD_HASH || "",
    plainPassword: process.env.ADMIN_PASSWORD || "",
  },
  apiKeys: {
    control: process.env.CONTROL_API_KEY || process.env.API_KEY || "",
    public: process.env.PUBLIC_API_KEY || "",
  },
  socket: {
    corsOrigin: process.env.SOCKET_CORS_ORIGIN || "",
    allowedOrigins: parseOrigins(process.env.SOCKET_ALLOWED_ORIGINS),
  },
  scheduler: {
    defaultSchedule: DEFAULT_SCHEDULE,
    retryIntervalMs: parseInt(
      process.env.SCHEDULER_RETRY_INTERVAL_MS || "60000",
      10
    ),
    maxRetries: parseInt(process.env.SCHEDULER_MAX_RETRIES || "3", 10),
  },
};
