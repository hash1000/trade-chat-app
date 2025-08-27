const Version = require('../models/version');

class VersionRepository {
  async getAll() {
    return await Version.findAll();
  }

  async create(version) {
    return await Version.create({ version });
  }

  async update(versionId, version) {
    return await Version.update(
      { version },
      { where: { id: versionId } }
    );
  }

  async remove(versionId) {
    return await Version.destroy({ where: { id: versionId } });
  }
}

module.exports = VersionRepository;
