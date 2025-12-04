const fs = require('fs');
const path = require('path');
const session = require('express-session');
const FileStoreFactory = require('session-file-store');
const config = require('../config/env');

function createSessionMiddleware() {
  if (!config.sessionSecret) throw new Error('SESSION_SECRET');
  const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
  const storageDir = path.join(__dirname, '..', '..', 'storage', 'sessions');
  fs.mkdirSync(storageDir, { recursive: true });
  const FileStore = FileStoreFactory(session);

  return session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    name: 'session',
    proxy: true,                   
    store: new FileStore({
      path: storageDir,
      retries: 1,
      fileExtension: '.json',
      ttl: Math.floor(NINETY_DAYS_MS / 1000), // TTL untuk session persistence
      reapInterval: 12 * 60 * 60, // bersih-bersih file usang tiap 12 jam
    }),
    cookie: {
      secure: 'auto',              
      sameSite: 'lax',
      httpOnly: true,
      path: '/',
      maxAge: NINETY_DAYS_MS, // remember-me: keep session cookies for ~3 months
    },
  });
}
module.exports = { createSessionMiddleware };
