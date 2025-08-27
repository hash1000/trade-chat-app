const VersionRepository = require('../repositories/VersionRepository');

class VersionService {
  constructor() {
    this.versionRepository = new VersionRepository();
  }

  async getAll() {
    return await this.versionRepository.getAll();
  }

  async create(version) {
    return await this.versionRepository.create(version);
  }

  async update(versionId, version) {
    return await this.versionRepository.update(versionId, version);
  }

  async remove(versionId) {
    return await this.versionRepository.remove(versionId);
  }
}

module.exports = VersionService;
