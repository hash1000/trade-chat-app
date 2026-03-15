const ServiceRepository = require("../repositories/ServiceRepository");

class ServiceService {
  constructor() {
    this.serviceRepository = new ServiceRepository();
  }

  async create(data) {
    return this.serviceRepository.create(data);
  }

  async getById(id, options = {}) {
    return this.serviceRepository.findByPk(id, options);
  }

  async getAll(options = {}) {
    return this.serviceRepository.findAll(options);
  }

  async update(id, data) {
    return this.serviceRepository.update(id, data);
  }

  async delete(id) {
    return this.serviceRepository.delete(id);
  }

  async addTeam(serviceId, teamId) {
    return this.serviceRepository.addTeam(serviceId, teamId);
  }

  async addTeams(serviceId, teamIds) {
    return this.serviceRepository.addTeams(serviceId, teamIds);
  }

  async removeTeam(serviceId, teamId) {
    return this.serviceRepository.removeTeam(serviceId, teamId);
  }

  async setTeams(serviceId, teamIds) {
    await this.serviceRepository.removeAllTeams(serviceId);
    if (Array.isArray(teamIds) && teamIds.length > 0) {
      await this.serviceRepository.addTeams(serviceId, teamIds);
    }
  }
}

module.exports = ServiceService;
