const Version = require("../models/version");

class VersionRepository {
  async getAll() {
    return await Version.findAll();
  }

  async create(version, changelog) {
    const payload = { version };
    if (changelog !== undefined) payload.changelog = changelog;
    return await Version.create(payload);
  }

  // Service function to update the version
  // Update version (Service)
  async update(versionId, version, changelog) {
    try {
      const payload = { version };
      if (changelog !== undefined) payload.changelog = changelog;

      // Update version using versionRepository
      const [updatedRows] = await Version.update(
        payload,
        { where: { id: versionId } },
      );

      // If no rows were updated
      if (updatedRows === 0) {
        throw new Error("No version found to update");
      }

      return { success: true, message: "Version updated successfully" };
    } catch (err) {
      console.error("Error in version update service:", err);
      return {
        success: false,
        message: "Error updating version: " + err.message,
      };
    }
  }

  async remove(versionId) {
    return await Version.destroy({ where: { id: versionId } });
  }
}

module.exports = VersionRepository;
