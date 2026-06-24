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
          attributes: ["id", "name", "email", "profile_image"],
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
  async addMember(serviceId, actorId, userId) {
    const service = await this.assertServiceExists(serviceId);
    this.assertOwner(service, actorId);

    const targetUser = await User.findByPk(userId, { attributes: ["id"] });
    if (!targetUser) {
      const err = new Error("User not found.");
      err.statusCode = 404;
      throw err;
    }

    const existing = await ServiceMember.findOne({ where: { serviceId, userId } });
    if (existing) {
      const err = new Error("User is already a member of this service.");
      err.statusCode = 409;
      throw err;
    }

    const member = await ServiceMember.create({ serviceId, userId });

    return ServiceMember.findByPk(member.id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email", "profile_image"],
        },
      ],
    });
  }

  /**
   * Remove a user from service members.
   * @param {number} serviceId
   * @param {number} actorId - must be service owner
   * @param {number} userId - member to remove
   * @returns {Promise<boolean>}
   */
  async removeMember(serviceId, actorId, userId) {
    const service = await this.assertServiceExists(serviceId);
    this.assertOwner(service, actorId);

    const member = await ServiceMember.findOne({ where: { serviceId, userId } });
    if (!member) {
      const err = new Error("User is not a member of this service.");
      err.statusCode = 404;
      throw err;
    }

    await member.destroy();
    return true;
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

    const isMember = await ServiceMember.findOne({ where: { serviceId, userId: assigneeEditorId } });
    if (!isMember) {
      const err = new Error("assigneeEditorId must be an existing member of this service.");
      err.statusCode = 400;
      throw err;
    }

    await service.update({ assigneeEditorId });

    return Service.findByPk(serviceId, {
      include: [
        {
          model: User,
          as: "assigneeEditor",
          attributes: ["id", "name", "email", "profile_image"],
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
