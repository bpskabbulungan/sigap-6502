const express = require('express');
const moment = require('moment-timezone');

const config = require('../config/env');
const {
  renderLogin,
  handleLoginForm,
  handleLogoutWeb,
} = require('../controllers/authController');
const { loginLimiter } = require('../middleware/rateLimiters');
const { getSchedule, getNextRun } = require('../services/scheduleService');
const { getLogs } = require('../controllers/logController');
const { isBotActive } = require('../controllers/botController');
const { TIMEZONE } = require('../utils/calendar');
const { formatDateLabels, formatIsoDateId } = require('../utils/dateFormatter');

const router = express.Router();

function markLegacyAdminUi(req, res, next) {
  res.set('Deprecation', 'true');
  res.set(
    'Warning',
    '299 - "Legacy server-rendered admin UI deprecated. Gunakan frontend SPA."'
  );
  res.set('X-SIGAP-Deprecated-Replacement', `${config.webAppUrl}/admin/login`);
  next();
}

function redirectToFrontend(res, pathname) {
  const safeBase = String(config.webAppUrl || '').replace(/\/$/, '');
  return res.redirect(302, `${safeBase}${pathname}`);
}

function requireAdminWeb(req, res, next) {
  if (!req.session?.isAdmin) {
    return res.redirect('/admin/login');
  }
  return next();
}

router.get('/', async (req, res, next) => {
  try {
    const schedule = await getSchedule();
    const nextRun = await getNextRun({ includeDetails: true });

    const nextRunView = nextRun?.targetMoment
      ? (() => {
          const labels = formatDateLabels(nextRun.targetMoment, schedule.timezone);
          return {
            timestamp: nextRun.targetMoment.toISOString(),
            formatted: labels.publicLabel,
            adminLabel: labels.adminLabel,
            publicLabel: labels.publicLabel,
            timezone: schedule.timezone,
            override: nextRun.override,
          };
        })()
      : null;

    res.render('public/status', {
      botActive: isBotActive(),
      schedule,
      nextRun: nextRunView,
      formatIsoDateId,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/admin/login', markLegacyAdminUi, renderLogin);
router.post('/admin/login', loginLimiter, handleLoginForm);
router.post('/admin/logout', requireAdminWeb, handleLogoutWeb);
router.get('/admin', (req, res) => redirectToFrontend(res, '/admin/dashboard'));
router.get('/template', (req, res) => redirectToFrontend(res, '/admin/templates'));

router.get('/admin/dashboard', markLegacyAdminUi, requireAdminWeb, async (req, res, next) => {
  try {
    const schedule = await getSchedule();
    const nextRun = await getNextRun({ includeDetails: true });

    const nextRunView = nextRun?.targetMoment
      ? (() => {
          const labels = formatDateLabels(nextRun.targetMoment, schedule.timezone);
          return {
            timestamp: nextRun.targetMoment.toISOString(),
            formatted: labels.adminLabel,
            adminLabel: labels.adminLabel,
            publicLabel: labels.publicLabel,
            timezone: schedule.timezone,
            override: nextRun.override,
          };
        })()
      : null;

    const generatedLabels = formatDateLabels(moment().tz(TIMEZONE), TIMEZONE);

    res.render('admin/dashboard', {
      username: req.session.username,
      botActive: isBotActive(),
      logs: getLogs(50),
      schedule,
      nextRun: nextRunView,
      generatedAt: generatedLabels.adminLabel,
      formatIsoDateId,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
