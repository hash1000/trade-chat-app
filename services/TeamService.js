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

  async getTeamsForUser(userId) {
    return this.teamRepository.getTeamsForUser(userId);
  }
}

module.exports = TeamService;
