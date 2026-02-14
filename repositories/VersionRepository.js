const Version = require("../models/version");

class VersionRepository {
  async getAll() {
    return await Version.findAll();
  }

  async create(version) {
    return await Version.create({ version });
  }

  // Service function to update the version
  // Update version (Service)
  async update(versionId, version) {
    try {
      // Update version using versionRepository
      const [updatedRows] = await Version.update(
        { version },
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
