const express = require('express');
const router = express.Router();

const VersionController = require('../controllers/VersionController');
const authMiddleware = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorization');
const versionOwner = require('../middlewares/versionOwner');
const { versionValidator } = require('../middlewares/versionValidation');

const versionController = new VersionController();

// GET all versions
router.get('/',  versionController.getAll.bind(versionController));

// POST create a new version
// Writes: admin role + the app owner's account (APP_VERSION_ADMIN_EMAILS). Reading stays public for the app's update check.
router.post('/add', authMiddleware, authorize(['admin']), versionOwner, versionValidator, versionController.add.bind(versionController));

// PATCH update a version
router.patch('/update/:versionId', authMiddleware, authorize(['admin']), versionOwner, versionValidator, versionController.update.bind(versionController));

// DELETE remove a version
router.delete('/remove/:versionId', authMiddleware, authorize(['admin']), versionOwner, versionController.remove.bind(versionController));

module.exports = router;
