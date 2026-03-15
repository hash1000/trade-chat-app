const TeamRepository = require("../repositories/TeamRepository");

class TeamService {
  constructor() {
    this.teamRepository = new TeamRepository();
  }

  async create(data) {
    return this.teamRepository.create(data);
  }

  async getById(id, options = {}) {
    return this.teamRepository.findByPk(id, options);
  }

  async getAll(options = {}) {
    return this.teamRepository.findAll(options);
  }

  async update(id, data) {
    return this.teamRepository.update(id, data);
  }

  async delete(id) {
    return this.teamRepository.delete(id);
  }

  async addMember(teamId, userId) {
    return this.teamRepository.addMember(teamId, userId);
  }

  async addMembers(teamId, userIds) {
    return this.teamRepository.addMembers(teamId, userIds);
  }

  async removeMember(teamId, userId) {
    return this.teamRepository.removeMember(teamId, userId);
  }

  async setMembers(teamId, userIds) {
    await this.teamRepository.removeAllMembers(teamId);
    if (Array.isArray(userIds) && userIds.length > 0) {
      await this.teamRepository.addMembers(teamId, userIds);
    }
  }

  async addService(teamId, serviceId) {
    return this.teamRepository.addService(teamId, serviceId);
  }

  async addServices(teamId, serviceIds) {
    return this.teamRepository.addServices(teamId, serviceIds);
  }

  async removeService(teamId, serviceId) {
    return this.teamRepository.removeService(teamId, serviceId);
  }

  async setServices(teamId, serviceIds) {
    await this.teamRepository.removeAllServices(teamId);
    if (Array.isArray(serviceIds) && serviceIds.length > 0) {
      await this.teamRepository.addServices(teamId, serviceIds);
    }
  }

  async getTeamsForUser(userId) {
    return this.teamRepository.getTeamsForUser(userId);
  }
}

module.exports = TeamService;
