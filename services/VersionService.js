const VersionRepository = require('../repositories/VersionRepository');

class VersionService {
  constructor() {
    this.versionRepository = new VersionRepository();
  }

  async getAll() {
    return await this.versionRepository.getAll();
  }

  async create(version, changelog) {
    return await this.versionRepository.create(version, changelog);
  }

  async update(versionId, version, changelog) {
    return await this.versionRepository.update(versionId, version, changelog);
  }

  async remove(versionId) {
    return await this.versionRepository.remove(versionId);
  }
}

module.exports = VersionService;
