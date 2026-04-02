const path = require('path');
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const cors = require('cors');
const { createSessionMiddleware } = require('./middleware/session');          

const config = require('./config/env');
const { attachAuthState } = require('./middleware/adminAuth');
const registerRoutes = require('./routes');

function normalizeOrigin(rawOrigin) {
  if (typeof rawOrigin !== 'string') return null;
  const trimmed = rawOrigin.trim();
  if (!trimmed) return null;
  if (trimmed === '*') return '*';

  try {
    return new URL(trimmed).origin;
  } catch (_) {
    return trimmed.replace(/\/+$/, '');
  }
}

function addOrigin(origins, rawOrigin) {
  const origin = normalizeOrigin(rawOrigin);
  if (!origin) return;
  origins.add(origin);
  if (origin === '*') return;

  try {
    const parsed = new URL(origin);
    if (parsed.hostname === 'localhost') {
      parsed.hostname = '127.0.0.1';
      origins.add(parsed.origin);
    } else if (parsed.hostname === '127.0.0.1') {
      parsed.hostname = 'localhost';
      origins.add(parsed.origin);
    }
  } catch (_) {
    // ignore non-url origins
  }
}

function buildAllowedOrigins() {
  const origins = new Set();

  addOrigin(origins, config.webAppUrl);
  addOrigin(origins, `http://localhost:${config.port}`);
  addOrigin(origins, `http://127.0.0.1:${config.port}`);
  addOrigin(origins, config.socket.corsOrigin);
  config.socket.allowedOrigins.forEach((origin) => addOrigin(origins, origin));

  if (config.nodeEnv !== 'production') {
    // Dev defaults for Vite and Docker frontend ports.
    addOrigin(origins, 'http://localhost:5174');
    addOrigin(origins, 'http://127.0.0.1:5174');
    addOrigin(origins, 'http://localhost:3302');
    addOrigin(origins, 'http://127.0.0.1:3302');
  }

  return origins;
}

function createApp() {
  const app = express();
  const allowedOrigins = buildAllowedOrigins();

  const corsOptions = {
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowedOrigins.has('*') || allowedOrigins.has(origin)) return cb(null, true);
      return cb(new Error('Origin tidak diizinkan oleh CORS'), false);
    },
    credentials: true,
  };

  app.set('trust proxy', 1);                  
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());
  app.use(cors(corsOptions));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(createSessionMiddleware());
  app.use(attachAuthState);                   
  app.use(express.static(path.join(__dirname, '..', 'public')));

  registerRoutes(app);
  return app;
}

function attachSocket(app, io) { app.set('io', io); }

module.exports = { createApp, attachSocket, buildAllowedOrigins };
