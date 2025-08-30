const express = require('express');
const router = express.Router();

const VersionController = require('../controllers/VersionController');
const authMiddleware = require('../middlewares/authenticate');
const { versionValidator } = require('../middlewares/versionValidation');

const versionController = new VersionController();

// GET all versions
router.get('/',  versionController.getAll.bind(versionController));

// POST create a new version
router.post('/add', versionValidator, versionController.add.bind(versionController));

// PATCH update a version
router.patch('/update/:versionId',  versionValidator, versionController.update.bind(versionController));

// DELETE remove a version
router.delete('/remove/:versionId',  versionController.remove.bind(versionController));

module.exports = router;
