const apiKeyAuth = require('../middleware/apiKeyAuth');
const { requireAdmin } = require('../middleware/adminAuth');

const authRoutes = require('./authRoutes');
const messageRoutes = require('./messageRoutes');
const systemRoutes = require('./systemRoutes');
const templateRoutes = require('./templateRoutes');
const scheduleAdminRoutes = require('./scheduleAdminRoutes');
const schedulePublicRoutes = require('./schedulePublicRoutes');
const calendarAdminRoutes = require('./calendarAdminRoutes');
const adminBotRoutes = require('./adminBotRoutes');
const adminContactRoutes = require('./adminContactRoutes');
const webRoutes = require('./webRoutes');
const quotesRoutes = require('./quotesRoutes');
const testCookie = require('./testCookie');
const { buildErrorViewModel } = require('../utils/errorViewModel');

const DEPRECATION_SUNSET = 'Sun, 31 Jan 2027 00:00:00 GMT';

function markDeprecatedApi(successorBasePath) {
  return (req, res, next) => {
    const suffix = req.path === '/' ? '' : req.path;
    const successorPath = `${successorBasePath}${suffix}`;

    res.set('Deprecation', 'true');
    res.set('Sunset', DEPRECATION_SUNSET);
    res.set('Link', `<${successorPath}>; rel="successor-version"`);
    res.set(
      'Warning',
      `299 - "Endpoint ini deprecated. Gunakan ${successorBasePath}"`
    );
    res.set('X-SIGAP-Deprecated-Replacement', successorBasePath);
    next();
  };
}

function applyLegacyBotPayloadCompat(req, res, next) {
  const originalJson = res.json.bind(res);

  res.json = (payload) => {
    const isLegacyMutation = req.method === 'POST' && (req.path === '/start' || req.path === '/stop');

    if (
      isLegacyMutation &&
      payload &&
      typeof payload === 'object' &&
      !Array.isArray(payload) &&
      !Object.prototype.hasOwnProperty.call(payload, 'success')
    ) {
      return originalJson({ success: true, ...payload });
    }

    return originalJson(payload);
  };

  next();
}

function registerRoutes(app) {
  app.use('/api/auth', authRoutes);
  app.use(
    '/api/bot',
    apiKeyAuth,
    markDeprecatedApi('/api/admin/bot'),
    applyLegacyBotPayloadCompat,
    adminBotRoutes
  );
  app.use('/api/messages', messageRoutes);
  app.use('/api/system', systemRoutes);
  app.use(
    '/api/templates',
    apiKeyAuth,
    markDeprecatedApi('/api/admin/templates'),
    templateRoutes
  );
  app.use('/api/admin/templates', requireAdmin, templateRoutes);
  app.use('/api/admin/bot', requireAdmin, adminBotRoutes);
  app.use('/api/admin/calendar', requireAdmin, calendarAdminRoutes);
  app.use('/api/admin/schedule', requireAdmin, scheduleAdminRoutes);
  app.use('/api/admin/contacts', requireAdmin, adminContactRoutes);
  app.use('/api/quotes', quotesRoutes);
  app.use('/api/schedule', schedulePublicRoutes);
  app.use('/', webRoutes);
  app.use('/api/test-cookie', testCookie);

  app.use((req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ message: 'Endpoint tidak ditemukan.' });
    }

    const viewModel = buildErrorViewModel({
      status: 404,
      path: req.originalUrl || req.path,
      method: req.method,
    });

    return res.status(404).render('errors/error', viewModel);
  });

  app.use((err, req, res, next) => {
    if (res.headersSent) {
      return next(err);
    }

    const status = err.status || 500;
    const message = err.message || 'Terjadi kesalahan pada server.';

    if (req.path.startsWith('/api')) {
      return res.status(status).json({ message });
    }

    const viewModel = buildErrorViewModel({
      status,
      message,
      path: req.originalUrl || req.path,
      method: req.method,
    });

    res.status(status).render('errors/error', viewModel);
  });
}

module.exports = registerRoutes;
