const VersionService = require('../services/VersionService');
const versionService = new VersionService();
const Version = require('../models/version');
const VersionEmailService = require('../services/VersionEmailService');
const versionEmailService = new VersionEmailService();

class VersionController {
  // GET all versions
 async getAll(req, res) {
  try {
    const versions = (await versionService.getAll()).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    return res.json({
      success: true,
      data: versions,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

  // Add new version
  async add(req, res) {
    try {
      const { version, changelog } = req.body;
      const newVersion = await versionService.create(version, changelog);
      return res.status(201).json({ success: true, data: newVersion });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // Update version
  async update(req, res) {
    try {
      const { versionId } = req.params;
      const { version, changelog } = req.body; // Extract version and changelog from request body

      const previous = await Version.findByPk(versionId, { attributes: ['version'] });

      // Update version using version service
      const updated = await versionService.update(versionId, version, changelog);

      // If no version was updated
      if (updated.success === false) {
        return res.status(404).json({ success: false, message: 'Version not found' });
      }

      // Respond immediately to the user after the version update
      res.json({ success: true, message: 'Version updated successfully' });

      // Email users still on an old build — only when the version number
      // itself changed (editing just the changelog sends nothing). Runs in
      // the background; see services/VersionEmailService.js for who gets it.
      if (version && (!previous || previous.version !== version)) {
        versionEmailService
          .send(version)
          .catch((err) => console.error('Version update emails failed:', err.message));
      }
    } catch (error) {
      console.error('Error in update process:', error);
      if (res.headersSent) return;
      return res.status(500).json({
        success: false,
        message: "Error updating version: " + error.message,
      });
    }
  }

  // Remove version
  async remove(req, res) {
    try {
      const { versionId } = req.params;

      const deleted = await versionService.remove(versionId);

      if (!deleted) {
        return res.status(404).json({ success: false, message: 'Version not found' });
      }

      return res.json({ success: true, message: 'Version deleted successfully' });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = VersionController;
