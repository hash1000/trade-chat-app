const { Op } = require("sequelize");
const { Service, ServiceAddOn, ServiceAddOnFile } = require("../models");

class ServiceAddOnService {
  /**
   * Assert service exists and return it.
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
   * Assert current user is the service owner.
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
   * Fetch a single add-on belonging to a service, with files.
   * @param {number} serviceId
   * @param {number} addOnId
   * @returns {Promise<ServiceAddOn>}
   */
  async getAddOnOrFail(serviceId, addOnId) {
    const addOn = await ServiceAddOn.findOne({
      where: { id: addOnId, serviceId, deletedAt: null },
      include: [{ model: ServiceAddOnFile, as: "files", order: [["sort_order", "ASC"]] }],
    });
    if (!addOn) {
      const err = new Error("Add-on not found.");
      err.statusCode = 404;
      throw err;
    }
    return addOn;
  }

  /**
   * List add-ons for a service with pagination.
   * @param {number} serviceId
   * @param {{ page?: number, limit?: number, includeInactive?: boolean }} options
   * @returns {Promise<{ data: ServiceAddOn[], pagination: object }>}
   */
  async listAddOns(serviceId, { page = 1, limit = 20, includeInactive = false } = {}) {
    await this.assertServiceExists(serviceId);

    const offset = (page - 1) * limit;
    const where = { serviceId, deletedAt: null };

    const { count, rows } = await ServiceAddOn.findAndCountAll({
      where,
      include: [
        {
          model: ServiceAddOnFile,
          as: "files",
          attributes: ["id"],
          required: false,
          where: {},
        },
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
      distinct: true,
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
   * Get a single add-on by ID with its files.
   * @param {number} serviceId
   * @param {number} addOnId
   * @returns {Promise<ServiceAddOn>}
   */
  async getAddOn(serviceId, addOnId) {
    await this.assertServiceExists(serviceId);
    return this.getAddOnOrFail(serviceId, addOnId);
  }

  /**
   * Create a new add-on for a service.
   * @param {number} serviceId
   * @param {number} actorId
   * @param {{ title: string, description?: string, amount: number }} data
   * @returns {Promise<ServiceAddOn>}
   */
  async createAddOn(serviceId, actorId, data) {
    const service = await this.assertServiceExists(serviceId);
    this.assertOwner(service, actorId);

    const { title, description, amount } = data;

    if (!title || !String(title).trim()) {
      const err = new Error("title is required.");
      err.statusCode = 400;
      throw err;
    }

    if (amount == null || isNaN(Number(amount)) || Number(amount) < 0) {
      const err = new Error("amount must be a non-negative number.");
      err.statusCode = 400;
      throw err;
    }

    const addOn = await ServiceAddOn.create({
      serviceId,
      title: String(title).trim(),
      description: description ? String(description).trim() : null,
      amount: Number(amount),
    });

    return this.getAddOnOrFail(serviceId, addOn.id);
  }

  /**
   * Update an existing add-on.
   * @param {number} serviceId
   * @param {number} addOnId
   * @param {number} actorId
   * @param {object} data
   * @returns {Promise<ServiceAddOn>}
   */
  async updateAddOn(serviceId, addOnId, actorId, data) {
    const service = await this.assertServiceExists(serviceId);
    this.assertOwner(service, actorId);

    const addOn = await ServiceAddOn.findOne({ where: { id: addOnId, serviceId, deletedAt: null } });
    if (!addOn) {
      const err = new Error("Add-on not found.");
      err.statusCode = 404;
      throw err;
    }

    const updates = {};

    if (data.title !== undefined) {
      if (!String(data.title).trim()) {
        const err = new Error("title cannot be empty.");
        err.statusCode = 400;
        throw err;
      }
      updates.title = String(data.title).trim();
    }

    if (data.description !== undefined) {
      updates.description = data.description ? String(data.description).trim() : null;
    }

    if (data.amount !== undefined) {
      if (isNaN(Number(data.amount)) || Number(data.amount) < 0) {
        const err = new Error("amount must be a non-negative number.");
        err.statusCode = 400;
        throw err;
      }
      updates.amount = Number(data.amount);
    }

    await addOn.update(updates);

    return this.getAddOnOrFail(serviceId, addOnId);
  }

  /**
   * Soft-delete an add-on.
   * @param {number} serviceId
   * @param {number} addOnId
   * @param {number} actorId
   * @returns {Promise<void>}
   */
  async deleteAddOn(serviceId, addOnId, actorId) {
    const service = await this.assertServiceExists(serviceId);
    this.assertOwner(service, actorId);

    const addOn = await ServiceAddOn.findOne({ where: { id: addOnId, serviceId, deletedAt: null } });
    if (!addOn) {
      const err = new Error("Add-on not found.");
      err.statusCode = 404;
      throw err;
    }

    await addOn.update({ deletedAt: new Date(), deletedBy: actorId });
  }
}

module.exports = ServiceAddOnService;
