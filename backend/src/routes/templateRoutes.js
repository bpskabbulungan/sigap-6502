const express = require('express');
const router = express.Router();
const {
  getTemplateCollection,
  saveTemplateContent,
  upsertTemplate,
  setActiveTemplate,
  removeTemplate,
} = require('../services/templateService');

function handleTemplateError(res, error, fallbackMessage) {
  const status = error?.status || 500;
  const message = error?.message || fallbackMessage;
  return res.status(status).json({ message });
}

async function handleGetTemplate(req, res) {
  try {
    const collection = await getTemplateCollection();
    return res.json(collection);
  } catch (err) {
    return handleTemplateError(res, err, 'Gagal membaca data templat.');
  }
}

// Canonical JSON endpoint
router.get('/raw', handleGetTemplate);

// Backward-compatible alias of /raw
router.get('/', handleGetTemplate);

router.post('/', async (req, res) => {
  const templateValue = req.body?.template;
  if (typeof templateValue !== 'string' || !templateValue.trim()) {
    return res.status(400).json({ message: 'Templat tidak valid.' });
  }

  try {
    const result = await saveTemplateContent(templateValue, {
      templateId: req.body?.templateId,
    });
    return res.json({
      message: 'Templat berhasil disimpan.',
      updatedTemplateId: result.template?.id || null,
      ...result,
    });
  } catch (err) {
    return handleTemplateError(res, err, 'Gagal menyimpan templat.');
  }
});

router.post('/upsert', async (req, res) => {
  try {
    const result = await upsertTemplate(req.body || {});
    const statusCode = result.created ? 201 : 200;
    return res.status(statusCode).json({
      message: result.created
        ? 'Templat baru berhasil ditambahkan.'
        : 'Templat berhasil diperbarui.',
      updatedTemplateId: result.template?.id || null,
      ...result,
    });
  } catch (err) {
    return handleTemplateError(res, err, 'Gagal memperbarui data templat.');
  }
});

router.patch('/active', async (req, res) => {
  const templateId = req.body?.templateId;
  if (typeof templateId !== 'string' || !templateId.trim()) {
    return res.status(400).json({ message: 'ID templat tidak valid.' });
  }

  try {
    const result = await setActiveTemplate(templateId);
    return res.json({
      message: 'Templat aktif berhasil diperbarui.',
      updatedTemplateId: result.template?.id || null,
      ...result,
    });
  } catch (err) {
    return handleTemplateError(res, err, 'Gagal memperbarui templat aktif.');
  }
});

router.delete('/:templateId', async (req, res) => {
  const templateId = req.params?.templateId;
  if (typeof templateId !== 'string' || !templateId.trim()) {
    return res.status(400).json({ message: 'ID templat tidak valid.' });
  }

  try {
    const result = await removeTemplate(templateId);
    return res.json({
      message: 'Templat berhasil dihapus.',
      ...result,
    });
  } catch (err) {
    return handleTemplateError(res, err, 'Gagal menghapus templat.');
  }
});

module.exports = router;
