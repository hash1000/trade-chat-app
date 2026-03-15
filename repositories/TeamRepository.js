const { Team, User, TeamMember, Service, TeamServiceLink } = require("../models");
const { Op } = require("sequelize");

class TeamRepository {
  buildIncludes(options = {}) {
    const include = [];

    if (options.includeMembers) {
      include.push({
        model: User,
        as: "members",
        through: { attributes: [] },
        attributes: ["id", "firstName", "lastName", "username", "email"],
      });
    }

    if (options.includeServices) {
      include.push({
        model: Service,
        as: "services",
        through: { attributes: [] },
      });
    }

    return include;
  }

  async create(data) {
    return Team.create(data);
  }

  async findByPk(id, options = {}) {
    const queryOptions = { ...options };
    delete queryOptions.includeMembers;
    delete queryOptions.includeServices;

    return Team.findByPk(id, {
      include: this.buildIncludes(options),
      ...queryOptions,
    });
  }

  async findAll(options = {}) {
    const queryOptions = { ...options };
    delete queryOptions.includeMembers;
    delete queryOptions.includeServices;

    return Team.findAll({
      include: this.buildIncludes(options),
      order: [["createdAt", "DESC"]],
      ...queryOptions,
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
    if (numericIds.length === 0) return [];

    const existingUsers = await User.findAll({
      where: { id: { [Op.in]: numericIds } },
      attributes: ["id"],
    });
    const existingIds = new Set(existingUsers.map((u) => u.id));
    const missingIds = numericIds.filter((id) => !existingIds.has(id));
    if (missingIds.length > 0) {
      const err = new Error(`User(s) not found: ${missingIds.join(", ")}`);
      err.name = "InvalidUserIdError";
      err.missingUserIds = missingIds;
      throw err;
    }

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

  async removeAllMembers(teamId) {
    await TeamMember.destroy({ where: { teamId } });
  }

  async addService(teamId, serviceId) {
    const [service] = await TeamServiceLink.findOrCreate({
      where: { teamId, serviceId },
      defaults: { teamId, serviceId },
    });
    return service;
  }

  async addServices(teamId, serviceIds) {
    if (!Array.isArray(serviceIds) || serviceIds.length === 0) return [];
    const numericIds = [...new Set(serviceIds.map((id) => Number(id)).filter((id) => !Number.isNaN(id) && id > 0))];
    if (numericIds.length === 0) return [];

    const existingServices = await Service.findAll({
      where: { id: { [Op.in]: numericIds } },
      attributes: ["id"],
    });
    const existingIds = new Set(existingServices.map((service) => service.id));
    const missingIds = numericIds.filter((id) => !existingIds.has(id));
    if (missingIds.length > 0) {
      const err = new Error(`Service(s) not found: ${missingIds.join(", ")}`);
      err.name = "InvalidServiceIdError";
      err.missingServiceIds = missingIds;
      throw err;
    }

    await Promise.all(
      numericIds.map((serviceId) =>
        TeamServiceLink.findOrCreate({
          where: { teamId, serviceId },
          defaults: { teamId, serviceId },
        })
      )
    );

    return numericIds;
  }

  async removeService(teamId, serviceId) {
    const deleted = await TeamServiceLink.destroy({
      where: { teamId, serviceId },
    });
    return deleted > 0;
  }

  async removeAllServices(teamId) {
    await TeamServiceLink.destroy({ where: { teamId } });
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
        {
          model: Service,
          as: "services",
          through: { attributes: [] },
        },
      ],
      order: [["createdAt", "DESC"]],
    });
  }
}

module.exports = TeamRepository;
