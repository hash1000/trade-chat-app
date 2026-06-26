const { Service, ServiceMember, User } = require("../models");

class ServiceMemberService {
  /**
   * Assert service exists and return it. Throws 404 if not found.
   * @param {number} serviceId
   * @returns {Promise<Service>}
   */
  async assertServiceExists(serviceId) {
    const service = await Service.findByPk(serviceId);
    if (!service) {
      const err = new Error("Service not found.");
      err.statusCode = 404;
      throw err;
    }
    return service;
  }

  /**
   * Assert current user owns the service. Throws 403 if not owner.
   * @param {Service} service
   * @param {number} userId
   */
  assertOwner(service, userId) {
    if (service.userId !== userId) {
      const err = new Error("Forbidden. Only the service owner can perform this action.");
      err.statusCode = 403;
      throw err;
    }
  }

  /**
   * Get paginated list of service members with user details.
   * @param {number} serviceId
   * @param {{ page?: number, limit?: number }} options
   * @returns {Promise<{ data: ServiceMember[], pagination: object }>}
   */
  async getMembers(serviceId, { page = 1, limit = 10 } = {}) {
    await this.assertServiceExists(serviceId);

    const offset = (page - 1) * limit;

    const { count, rows } = await ServiceMember.findAndCountAll({
      where: { serviceId },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "username", "email", "profilePic"],
        },
      ],
      order: [["addedAt", "ASC"]],
      limit,
      offset,
    });

    return {
      data: rows,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit),
      },
    };
  }

  /**
   * Add a user as a member of a service.
   * @param {number} serviceId
   * @param {number} actorId - ID of the user performing the action (must be owner)
   * @param {number} userId - ID of the user to add
   * @returns {Promise<ServiceMember>}
   */
  async addMembers(serviceId, actorId, userIds) {
    const service = await this.assertServiceExists(serviceId);
    this.assertOwner(service, actorId);

    const users = await User.findAll({ where: { id: userIds }, attributes: ["id"] });
    const foundIds = users.map((u) => u.id);
    const notFound = userIds.filter((id) => !foundIds.includes(id));
    if (notFound.length > 0) {
      const err = new Error(`Users not found: ${notFound.join(", ")}`);
      err.statusCode = 404;
      throw err;
    }

    const existing = await ServiceMember.findAll({ where: { serviceId, userId: userIds } });
    const alreadyMemberIds = existing.map((m) => m.userId);
    const toAdd = userIds.filter((id) => !alreadyMemberIds.includes(id));

    if (toAdd.length > 0) {
      await ServiceMember.bulkCreate(toAdd.map((userId) => ({ serviceId, userId })));
    }

    const members = await ServiceMember.findAll({
      where: { serviceId, userId: userIds },
      include: [{ model: User, as: "user", attributes: ["id", "username", "email", "profilePic"] }],
    });

    return { added: members, alreadyMembers: alreadyMemberIds };
  }

  /**
   * Remove a user from service members.
   * @param {number} serviceId
   * @param {number} actorId - must be service owner
   * @param {number} userId - member to remove
   * @returns {Promise<boolean>}
   */
  async removeMembers(serviceId, actorId, userIds) {
    const service = await this.assertServiceExists(serviceId);
    this.assertOwner(service, actorId);

    const members = await ServiceMember.findAll({ where: { serviceId, userId: userIds } });
    const foundUserIds = members.map((m) => m.userId);
    const notFound = userIds.filter((id) => !foundUserIds.includes(id));

    if (notFound.length > 0) {
      const err = new Error(`Users are not members of this service: ${notFound.join(", ")}`);
      err.statusCode = 404;
      throw err;
    }

    await ServiceMember.destroy({ where: { serviceId, userId: userIds } });
    return { removedUserIds: foundUserIds };
  }

  /**
   * Set the assignee editor for a service.
   * @param {number} serviceId
   * @param {number} actorId
   * @param {number} assigneeEditorId - must be an existing service member
   * @returns {Promise<Service>}
   */
  async setAssignee(serviceId, actorId, assigneeEditorId) {
    const service = await this.assertServiceExists(serviceId);
    this.assertOwner(service, actorId);

    await service.update({ assigneeEditorId });

    return Service.findByPk(serviceId, {
      include: [
        {
          model: User,
          as: "assigneeEditor",
          attributes: ["id", "username", "email", "profilePic"],
        },
      ],
    });
  }

  /**
   * Clear the assignee editor from a service.
   * @param {number} serviceId
   * @param {number} actorId
   * @returns {Promise<void>}
   */
  async clearAssignee(serviceId, actorId) {
    const service = await this.assertServiceExists(serviceId);
    this.assertOwner(service, actorId);
    await service.update({ assigneeEditorId: null });
  }
}

module.exports = ServiceMemberService;
