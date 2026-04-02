const express = require('express');
const {
  getAllContacts,
  createContact,
  updateContact,
  updateContactStatus,
  bulkUpdateContactStatus,
  deleteContact,
  bulkDeleteContacts,
  ALLOWED_STATUSES,
} = require('../services/contactService');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const contacts = await getAllContacts();
    res.json({ contacts, allowedStatuses: ALLOWED_STATUSES });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const contact = await createContact(req.body || {});
    res.status(201).json({ contact });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const contact = await updateContact(req.params.id, req.body || {});
    res.json({ contact });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    if (typeof req.body?.status === 'undefined') {
      const error = new Error('Status wajib diisi.');
      error.status = 400;
      throw error;
    }
    const contact = await updateContactStatus(req.params.id, req.body?.status);
    res.json({ contact });
  } catch (err) {
    next(err);
  }
});

router.patch('/bulk-status', async (req, res, next) => {
  try {
    if (typeof req.body?.status === 'undefined') {
      const error = new Error('Status wajib diisi.');
      error.status = 400;
      throw error;
    }

    const ids = req.body?.ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      const error = new Error('Pilih minimal satu kontak.');
      error.status = 400;
      throw error;
    }

    const contacts = await bulkUpdateContactStatus(ids, req.body?.status);
    res.json({ contacts });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await deleteContact(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.post('/bulk-delete', async (req, res, next) => {
  try {
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      const error = new Error('Pilih minimal satu kontak.');
      error.status = 400;
      throw error;
    }

    const deletedContacts = await bulkDeleteContacts(ids);
    res.json({
      deletedCount: deletedContacts.length,
      contacts: deletedContacts,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
