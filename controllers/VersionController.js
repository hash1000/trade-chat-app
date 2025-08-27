const VersionService = require('../services/VersionService');
const versionService = new VersionService();

class VersionController {
  // GET all versions
  async getAll(req, res) {
    try {
      const versions = await versionService.getAll();
      return res.json({ success: true, data: versions });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // Add new version
  async add(req, res) {
    try {
      const { version } = req.body;
      const newVersion = await versionService.create(version);
      return res.status(201).json({ success: true, data: newVersion });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // Update version
  async update(req, res) {
    try {
      const { versionId } = req.params;
      const { version } = req.body;

      const updated = await versionService.update(versionId, version);

      if (updated[0] === 0) {
        return res.status(404).json({ success: false, message: 'Version not found' });
      }

      return res.json({ success: true, message: 'Version updated successfully' });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
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