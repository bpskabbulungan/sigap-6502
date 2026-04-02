const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { z } = require('zod');
const config = require('../config/env');

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 64;
const PASSWORD_MAX_LENGTH = 256;
const REMEMBER_ME_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 180;

const INVALID_CREDENTIALS_MESSAGE = 'Kredensial tidak valid.';
const INVALID_LOGIN_INPUT_MESSAGE = 'Periksa username dan password.';
const LOGIN_UNAVAILABLE_MESSAGE = 'Layanan login sedang tidak tersedia. Coba lagi.';
const LOGIN_FAILURE_MESSAGE = 'Permintaan login belum dapat diproses.';
const DUMMY_BCRYPT_HASH =
  '$2a$10$CPODAkLy.3J4ySFvXXzqJ.JbmOrESAwddyA9RuvH2QsgDchTXcczC';

function normalizeRememberInput(value) {
  if (value === undefined || value === null || value === '') {
    return false;
  }

  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'on';
  }

  return false;
}

const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(
      USERNAME_MIN_LENGTH,
      `Username wajib diisi (minimal ${USERNAME_MIN_LENGTH} karakter).`
    )
    .max(USERNAME_MAX_LENGTH, `Username maksimal ${USERNAME_MAX_LENGTH} karakter.`),
  password: z
    .string()
    .max(PASSWORD_MAX_LENGTH, `Password maksimal ${PASSWORD_MAX_LENGTH} karakter.`)
    .refine((value) => value.trim().length > 0, { message: 'Password wajib diisi.' }),
  remember: z.preprocess(normalizeRememberInput, z.boolean()).default(false),
});

class AuthUnavailableError extends Error {
  constructor() {
    super(LOGIN_UNAVAILABLE_MESSAGE);
    this.name = 'AuthUnavailableError';
    this.status = 503;
  }
}

function timingSafeStringEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));

  if (leftBuffer.length !== rightBuffer.length) {
    const maxLength = Math.max(leftBuffer.length, rightBuffer.length);
    const paddedLeft = Buffer.alloc(maxLength);
    const paddedRight = Buffer.alloc(maxLength);
    leftBuffer.copy(paddedLeft);
    rightBuffer.copy(paddedRight);
    crypto.timingSafeEqual(paddedLeft, paddedRight);
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function extractFieldErrors(zodError) {
  const fieldErrors = zodError.flatten().fieldErrors;

  return {
    ...(fieldErrors.username?.[0] ? { username: fieldErrors.username[0] } : {}),
    ...(fieldErrors.password?.[0] ? { password: fieldErrors.password[0] } : {}),
  };
}

function parseLoginPayload(payload) {
  const parsed = loginSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: extractFieldErrors(parsed.error),
    };
  }

  return {
    ok: true,
    data: {
      username: parsed.data.username,
      password: parsed.data.password,
      remember: Boolean(parsed.data.remember),
    },
  };
}

async function verifyCredentials(inputUsername, inputPassword) {
  const configuredUsername = String(config.admin.username || '');
  const usernameMatches = timingSafeStringEqual(inputUsername, configuredUsername);
  const { passwordHash, plainPassword } = config.admin;

  if (passwordHash) {
    const hashToCheck = usernameMatches ? passwordHash : DUMMY_BCRYPT_HASH;
    const passwordMatches = await bcrypt.compare(inputPassword, hashToCheck);
    return usernameMatches && passwordMatches;
  }

  if (plainPassword) {
    // Keep response time closer between valid and invalid attempts.
    await bcrypt.compare(inputPassword, DUMMY_BCRYPT_HASH);
    const passwordMatches = timingSafeStringEqual(inputPassword, plainPassword);
    return usernameMatches && passwordMatches;
  }

  throw new AuthUnavailableError();
}

async function establishSession(req, username, options = {}) {
  const remember = Boolean(options.remember);

  await new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) {
        reject(err);
        return;
      }

      req.session.isAdmin = true;
      req.session.username = username;
      req.session.createdAt = new Date().toISOString();

      if (remember) {
        req.session.cookie.maxAge = REMEMBER_ME_MAX_AGE_MS;
      } else {
        req.session.cookie.expires = false;
        req.session.cookie.maxAge = null;
      }

      req.session.save((saveErr) => {
        if (saveErr) {
          reject(saveErr);
        } else {
          resolve();
        }
      });
    });
  });
}

function clearSessionCookie(req, res) {
  const cookieOptions = {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
  };

  if (req.secure) {
    cookieOptions.secure = true;
  }

  res.clearCookie('session', cookieOptions);
}

function setNoStore(res) {
  res.set('Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
}

async function handleLogin(req, res) {
  const parsedPayload = parseLoginPayload(req.body);
  if (!parsedPayload.ok) {
    return res.status(400).json({
      message: INVALID_LOGIN_INPUT_MESSAGE,
      errors: parsedPayload.fieldErrors,
    });
  }

  const { username, password, remember } = parsedPayload.data;

  try {
    const valid = await verifyCredentials(username, password);
    if (!valid) {
      return res.status(401).json({ message: INVALID_CREDENTIALS_MESSAGE });
    }

    await establishSession(req, config.admin.username, { remember });
    setNoStore(res);

    return res.json({
      message: 'Login berhasil.',
      user: { username: config.admin.username, role: 'admin' },
    });
  } catch (err) {
    if (err instanceof AuthUnavailableError) {
      console.error('[AUTH] Login tidak dapat diproses: konfigurasi password admin belum siap.');
      return res.status(err.status).json({ message: LOGIN_UNAVAILABLE_MESSAGE });
    }

    console.error('[AUTH] Login gagal:', err);
    return res.status(500).json({ message: LOGIN_FAILURE_MESSAGE });
  }
}

function handleSession(req, res) {
  setNoStore(res);

  if (req.session?.isAdmin) {
    return res.json({
      authenticated: true,
      user: { username: req.session.username, role: 'admin' },
    });
  }

  return res.json({ authenticated: false });
}

async function handleLogout(req, res) {
  try {
    if (req.session) {
      await new Promise((resolve, reject) => {
        req.session.destroy((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    clearSessionCookie(req, res);
    return res.json({ message: 'Logout berhasil.' });
  } catch (err) {
    console.error('[AUTH] Logout gagal:', err);
    return res.status(500).json({ message: 'Logout belum dapat diproses.' });
  }
}

async function renderLogin(req, res) {
  if (req.session?.isAdmin) {
    res.redirect('/admin/dashboard');
    return;
  }

  res.render('auth/login', { error: null, values: { username: '' } });
}

async function handleLoginForm(req, res) {
  const parsedPayload = parseLoginPayload(req.body);
  if (!parsedPayload.ok) {
    res.render('auth/login', {
      error: INVALID_LOGIN_INPUT_MESSAGE,
      values: { username: req.body?.username || '' },
    });
    return;
  }

  const { username, password, remember } = parsedPayload.data;

  try {
    const valid = await verifyCredentials(username, password);
    if (!valid) {
      res.render('auth/login', {
        error: 'Kombinasi username/password salah.',
        values: { username },
      });
      return;
    }

    await establishSession(req, config.admin.username, { remember });
    res.redirect('/admin/dashboard');
  } catch (err) {
    if (err instanceof AuthUnavailableError) {
      console.error('[AUTH] Form login tidak dapat diproses: konfigurasi password admin belum siap.');
      res.render('auth/login', {
        error: LOGIN_UNAVAILABLE_MESSAGE,
        values: { username: req.body?.username || '' },
      });
      return;
    }

    console.error('[AUTH] Form login gagal:', err);
    res.render('auth/login', {
      error: 'Login belum dapat diproses. Coba lagi.',
      values: { username: req.body?.username || '' },
    });
  }
}

async function handleLogoutWeb(req, res) {
  try {
    if (req.session) {
      await new Promise((resolve, reject) => {
        req.session.destroy((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  } catch (err) {
    console.error('[AUTH] Logout web gagal:', err);
  }

  clearSessionCookie(req, res);
  res.redirect('/admin/login');
}

module.exports = {
  handleLogin,
  handleLogout,
  handleSession,
  renderLogin,
  handleLoginForm,
  handleLogoutWeb,
};
