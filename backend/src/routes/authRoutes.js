const express = require('express');
const {
  handleLogin,
  handleLogout,
  handleSession,
} = require('../controllers/authController');
const { loginLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

// prevent caching for auth routes
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

router.post('/login', loginLimiter, handleLogin);
router.post('/logout', handleLogout);
router.get('/session', handleSession);

module.exports = router;

