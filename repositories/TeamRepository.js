const { Team, User, TeamMember } = require("../models");

class TeamRepository {
  async create(data) {
    return Team.create(data);
  }

  async findByPk(id, options = {}) {
    return Team.findByPk(id, {
      include: options.includeMembers
        ? [{ model: User, as: "members", through: { attributes: [] }, attributes: ["id", "firstName", "lastName", "username", "email"] }]
        : [],
      ...options,
    });
  }

  async findAll(options = {}) {
    return Team.findAll({
      include: options.includeMembers
        ? [{ model: User, as: "members", through: { attributes: [] }, attributes: ["id", "firstName", "lastName", "username", "email"] }]
        : [],
      order: [["createdAt", "DESC"]],
      ...options,
    });
  }

  async update(id, data) {
    const team = await Team.findByPk(id);
    if (!team) return null;
    await team.update(data);
    return team;
  }

  async delete(id) {
    const team = await Team.findByPk(id);
    if (!team) return null;
    await team.destroy();
    return team;
  }

  async addMember(teamId, userId) {
    const [member] = await TeamMember.findOrCreate({
      where: { teamId, userId },
      defaults: { teamId, userId },
    });
    return member;
  }

  async addMembers(teamId, userIds) {
    if (!Array.isArray(userIds) || userIds.length === 0) return [];
    const numericIds = [...new Set(userIds.map((id) => Number(id)).filter((id) => !Number.isNaN(id) && id > 0))];
    await Promise.all(
      numericIds.map((userId) =>
        TeamMember.findOrCreate({
          where: { teamId, userId },
          defaults: { teamId, userId },
        })
      )
    );
    return numericIds;
  }

  async removeMember(teamId, userId) {
    const deleted = await TeamMember.destroy({
      where: { teamId, userId },
    });
    return deleted > 0;
  }

  async getTeamsForUser(userId) {
    return Team.findAll({
      include: [
        {
          model: User,
          as: "members",
          through: { attributes: [] },
          where: { id: userId },
          required: true,
          attributes: [],
        },
      ],
      order: [["createdAt", "DESC"]],
    });
  }
}

module.exports = TeamRepository;
