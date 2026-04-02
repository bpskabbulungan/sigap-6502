const express = require('express');
const {
  handleGetSchedule,
  handleUpdateSchedule,
  handleAddOverride,
  handleRemoveOverride,
  handleNextRunPreview,
} = require('../controllers/scheduleController');

const router = express.Router();

router.get('/', handleGetSchedule);
router.put('/', handleUpdateSchedule);
router.get('/next-run', handleNextRunPreview);

// Canonical endpoints (new naming)
router.post('/announcements', handleAddOverride);
router.delete('/announcements/:identifier', handleRemoveOverride);

// Backward-compatible aliases
router.post('/overrides', handleAddOverride);
router.delete('/overrides/:identifier', handleRemoveOverride);

module.exports = router;
