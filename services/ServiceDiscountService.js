const sequelize = require("../config/database");
const { Service, ServiceDiscount, User } = require("../models");

class ServiceDiscountService {
  /**
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
   * @param {Service} service
   * @param {number} userId
   * @param {boolean} isAdmin
   */
  assertOwnerOrAdmin(service, userId, isAdmin) {
    if (service.userId !== userId && !isAdmin) {
      const err = new Error(
        "Forbidden. Only the service owner or an admin can perform this action.",
      );
      err.statusCode = 403;
      throw err;
    }
  }

  /**
   * Create a discount code for a service.
   * @param {number} serviceId
   * @param {number} actorId
   * @param {boolean} isAdmin
   * @param {{ code: string, discountPercentage: number, expiryDate?: string }} data
   * @returns {Promise<ServiceDiscount>}
   */
  async createDiscount(serviceId, actorId, isAdmin, data) {
    const service = await this.assertServiceExists(serviceId);
    this.assertOwnerOrAdmin(service, actorId, isAdmin);

    const { code, discountPercentage, expiryDate } = data;

    if (!code || !String(code).trim()) {
      const err = new Error("code is required.");
      err.statusCode = 400;
      throw err;
    }

    const pct = Number(discountPercentage);
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      const err = new Error("discountPercentage must be between 0.01 and 100.");
      err.statusCode = 400;
      throw err;
    }

    let parsedExpiry = null;
    if (expiryDate !== undefined && expiryDate !== null && expiryDate !== "") {
      parsedExpiry = new Date(expiryDate);
      if (isNaN(parsedExpiry.getTime())) {
        const err = new Error("expiryDate must be a valid date.");
        err.statusCode = 400;
        throw err;
      }
      if (parsedExpiry <= new Date()) {
        const err = new Error("expiryDate must be a future date.");
        err.statusCode = 400;
        throw err;
      }
    }

    // Ensure code is unique
    // const existing = await ServiceDiscount.findOne({ where: { code: String(code).trim() } });
    // if (existing) {
    //   const err = new Error("A discount with this code already exists.");
    //   err.statusCode = 409;
    //   throw err;
    // }

    const discount = await ServiceDiscount.create({
      serviceId,
      code: String(code).trim().toUpperCase(),
      discountPercentage: pct,
      expiryDate: parsedExpiry,
      createdBy: actorId,
    });

    return discount.reload({
      include: [
        {
          model: User,
          as: "creator",
          attributes: [
            "id",
            "firstName",
            "lastName",
            "username",
            "email",
            "profilePic",
          ],
        },
      ],
    });
  }

  /**
   * List discount codes for a service (owner/admin only).
   * @param {number} serviceId
   * @param {number} actorId
   * @param {boolean} isAdmin
   * @param {{ includeUsed?: boolean, page?: number, limit?: number }} options
   * @returns {Promise<{ data: ServiceDiscount[], pagination: object }>}
   */
  async listDiscounts(
    serviceId,
    actorId,
    isAdmin,
    { includeUsed = false, page = 1, limit = 20 } = {},
  ) {
    const service = await this.assertServiceExists(serviceId);
    this.assertOwnerOrAdmin(service, actorId, isAdmin);

    const offset = (page - 1) * limit;
    const where = { serviceId };
    if (!includeUsed) {
      where.isUsed = false;
    }

    const { count, rows } = await ServiceDiscount.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "creator",
          attributes: [
            "id",
            "firstName",
            "lastName",
            "username",
            "email",
            "profilePic",
          ],
        },
        {
          model: User,
          as: "redeemer",
          attributes: [
            "id",
            "firstName",
            "lastName",
            "username",
            "email",
            "profilePic",
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
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
   * Validate a discount code without redeeming it.
   * @param {string} code
   * @param {number} serviceId
   * @returns {Promise<{ valid: boolean, discountPercentage?: number, reason?: string, message: string }>}
   */
  async validateCode(code, serviceId) {
    const discount = await ServiceDiscount.findOne({ where: { code } });

    if (!discount) {
      return {
        valid: false,
        reason: "NOT_FOUND",
        message: "Discount code not found.",
      };
    }

    if (discount.serviceId !== Number(serviceId)) {
      return {
        valid: false,
        reason: "SERVICE_MISMATCH",
        message: "This code does not apply to the given service.",
      };
    }

    if (!discount.isActive) {
      return {
        valid: false,
        reason: "INACTIVE",
        message: "This discount code is no longer active.",
      };
    }

    if (discount.expiryDate && new Date(discount.expiryDate) < new Date()) {
      return {
        valid: false,
        reason: "EXPIRED",
        message: "This discount code has expired.",
      };
    }

    if (discount.isUsed) {
      return {
        valid: false,
        reason: "ALREADY_USED",
        message: "This discount code has already been used.",
      };
    }

    return {
      valid: true,
      discountPercentage: parseFloat(discount.discountPercentage),
      message: "Code is valid.",
    };
  }

  /**
   * Atomically redeem a discount code.
   * Uses a single UPDATE WHERE isUsed=false to be race-condition safe.
   * @param {string} code
   * @param {number} serviceId
   * @param {number} userId
   * @returns {Promise<{ success: boolean, discountPercentage: number }>}
   */
  async redeemCode(code, serviceId, userId) {
    // First validate fully so we return proper error reasons before trying to redeem
    const validation = await this.validateCode(code, serviceId);
    if (!validation.valid) {
      const err = new Error(validation.message);
      err.statusCode = validation.reason === "NOT_FOUND" ? 404 : 400;
      err.reason = validation.reason;
      throw err;
    }

    // Atomic update — affected rows = 0 means a concurrent redeem won the race
    const [, meta] = await sequelize.query(
      `UPDATE service_discounts SET isUsed = true, usedBy = ?, usedAt = NOW() WHERE code = ? AND isUsed = false LIMIT 1`,
      { replacements: [userId, code] },
    );

    const affectedRows = meta?.affectedRows ?? meta;
    if (affectedRows === 0) {
      const err = new Error("This discount code has already been used.");
      err.statusCode = 400;
      err.reason = "ALREADY_USED";
      throw err;
    }

    return { success: true, discountPercentage: validation.discountPercentage };
  }

  /**
   * Get a single discount by id. Owner or admin only.
   * @param {number} discountId
   * @param {number} actorId
   * @param {boolean} isAdmin
   * @returns {Promise<ServiceDiscount>}
   */
  async getDiscount(discountId, actorId, isAdmin) {
    const discount = await ServiceDiscount.findByPk(discountId, {
      include: [
        {
          model: User,
          as: "creator",
          attributes: [
            "id",
            "firstName",
            "lastName",
            "username",
            "email",
            "profilePic",
          ],
        },
        {
          model: User,
          as: "redeemer",
          attributes: [
            "id",
            "firstName",
            "lastName",
            "username",
            "email",
            "profilePic",
          ],
        },
      ],
    });

    if (!discount) {
      const err = new Error("Discount not found.");
      err.statusCode = 404;
      throw err;
    }

    const service = await this.assertServiceExists(discount.serviceId);
    this.assertOwnerOrAdmin(service, actorId, isAdmin);

    return discount;
  }

  /**
   * Update a discount (disable/enable, expiryDate). Owner or admin only.
   * @param {number} discountId
   * @param {number} actorId
   * @param {boolean} isAdmin
   * @param {{ isActive?: boolean, expiryDate?: string|null }} data
   * @returns {Promise<ServiceDiscount>}
   */
  async updateDiscount(discountId, actorId, isAdmin, data) {
    const discount = await ServiceDiscount.findByPk(discountId);
    if (!discount) {
      const err = new Error("Discount not found.");
      err.statusCode = 404;
      throw err;
    }

    const service = await this.assertServiceExists(discount.serviceId);
    this.assertOwnerOrAdmin(service, actorId, isAdmin);

    const updates = {};

    if (data.isActive !== undefined) {
      if (typeof data.isActive !== "boolean") {
        const err = new Error("isActive must be a boolean.");
        err.statusCode = 400;
        throw err;
      }
      updates.isActive = data.isActive;
    }

    if (data.expiryDate !== undefined) {
      if (data.expiryDate === null || data.expiryDate === "") {
        updates.expiryDate = null;
      } else {
        const parsed = new Date(data.expiryDate);
        if (isNaN(parsed.getTime())) {
          const err = new Error("expiryDate must be a valid date.");
          err.statusCode = 400;
          throw err;
        }
        if (parsed <= new Date()) {
          const err = new Error("expiryDate must be a future date.");
          err.statusCode = 400;
          throw err;
        }
        updates.expiryDate = parsed;
      }
    }

    if (Object.keys(updates).length === 0) {
      const err = new Error("Provide at least one of: isActive, expiryDate.");
      err.statusCode = 400;
      throw err;
    }

    await discount.update(updates);
    return discount.reload({
      include: [
        {
          model: User,
          as: "creator",
          attributes: [
            "id",
            "firstName",
            "lastName",
            "username",
            "email",
            "profilePic",
          ],
        },
        {
          model: User,
          as: "redeemer",
          attributes: [
            "id",
            "firstName",
            "lastName",
            "username",
            "email",
            "profilePic",
          ],
        },
      ],
    });
  }

  async deleteDiscount(discountId, actorId, isAdmin) {
    const discount = await ServiceDiscount.findByPk(discountId);
    if (!discount) {
      const err = new Error("Discount not found.");
      err.statusCode = 404;
      throw err;
    }

    const service = await this.assertServiceExists(discount.serviceId);
    this.assertOwnerOrAdmin(service, actorId, isAdmin);

    await discount.destroy();
  }
}

module.exports = ServiceDiscountService;
