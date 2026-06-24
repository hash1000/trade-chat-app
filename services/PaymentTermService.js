const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { Service, PaymentTerm, User } = require("../models");

// Deterministic icon + color derived from term name
const ICONS = ["checkmark", "split", "shield", "clock", "lock", "star", "bolt", "tag"];
const COLORS = [
  "#4CAF50", "#FF9800", "#2196F3", "#9C27B0",
  "#F44336", "#00BCD4", "#FF5722", "#607D8B",
];

function generateIconAndColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return {
    icon: ICONS[hash % ICONS.length],
    color: COLORS[hash % COLORS.length],
  };
}

const VALID_RELEASE_CONDITIONS = [
  "BUYER_APPROVAL",
  "DELIVERY_CONFIRMED",
  "QUALITY_VERIFIED",
  "INSPECTION_PASSED",
];

class PaymentTermService {
  async assertServiceExists(serviceId) {
    const service = await Service.findByPk(serviceId);
    if (!service) {
      const err = new Error("Service not found.");
      err.statusCode = 404;
      throw err;
    }
    return service;
  }

  assertOwnerOrAdmin(service, userId, isAdmin) {
    if (service.userId !== userId && !isAdmin) {
      const err = new Error("Forbidden. Only the service owner or an admin can perform this action.");
      err.statusCode = 403;
      throw err;
    }
  }

  async assertTermBelongsToService(termId, serviceId) {
    const term = await PaymentTerm.findOne({ where: { id: termId, serviceId } });
    if (!term) {
      const err = new Error("Payment term not found.");
      err.statusCode = 404;
      throw err;
    }
    return term;
  }

  _validateTypeFields(type, data) {
    if (type === "FULL_PREPAYMENT") {
      if (data.whenCharged && data.whenCharged !== "AT_CHECKOUT") {
        const err = new Error("whenCharged must be 'AT_CHECKOUT' for FULL_PREPAYMENT.");
        err.statusCode = 400;
        throw err;
      }
    }

    if (type === "SPLIT") {
      const deposit = Number(data.depositPercentage);
      if (isNaN(deposit) || deposit <= 0 || deposit >= 100) {
        const err = new Error("depositPercentage must be between 0.01 and 99.99 for SPLIT.");
        err.statusCode = 400;
        throw err;
      }
      if (!data.balanceDueDate) {
        const err = new Error("balanceDueDate is required for SPLIT.");
        err.statusCode = 400;
        throw err;
      }
    }

    if (type === "QMLC") {
      if (data.releaseConditions !== undefined) {
        if (!Array.isArray(data.releaseConditions) || data.releaseConditions.length === 0) {
          const err = new Error("releaseConditions must be a non-empty array for QMLC.");
          err.statusCode = 400;
          throw err;
        }
        for (const cond of data.releaseConditions) {
          if (!VALID_RELEASE_CONDITIONS.includes(cond)) {
            const err = new Error(`Invalid release condition: ${cond}.`);
            err.statusCode = 400;
            throw err;
          }
        }
      }
    }
  }

  _buildTypeFields(type, data) {
    const fields = {};

    if (type === "FULL_PREPAYMENT") {
      fields.whenCharged = data.whenCharged || "AT_CHECKOUT";
      fields.depositPercentage = null;
      fields.balancePercentage = null;
      fields.balanceDueDate = null;
      fields.escrowPercentage = null;
      fields.releaseConditions = null;
    } else if (type === "SPLIT") {
      const deposit = Number(data.depositPercentage);
      fields.depositPercentage = deposit;
      fields.balancePercentage = parseFloat((100 - deposit).toFixed(2));
      fields.balanceDueDate = data.balanceDueDate;
      fields.whenCharged = null;
      fields.escrowPercentage = null;
      fields.releaseConditions = null;
    } else if (type === "QMLC") {
      fields.escrowPercentage = data.escrowPercentage != null ? Number(data.escrowPercentage) : 100;
      fields.releaseConditions = data.releaseConditions || VALID_RELEASE_CONDITIONS;
      fields.whenCharged = null;
      fields.depositPercentage = null;
      fields.balancePercentage = null;
      fields.balanceDueDate = null;
    }

    return fields;
  }

  async _unsetOtherDefaults(serviceId, excludeTermId = null, transaction = null) {
    const where = { serviceId, isDefault: true };
    if (excludeTermId) where.id = { [Op.ne]: excludeTermId };
    await PaymentTerm.update({ isDefault: false }, { where, transaction });
  }

  /**
   * Create a new payment term for a service.
   */
  async createTerm(serviceId, actorId, isAdmin, data) {
    const service = await this.assertServiceExists(serviceId);
    this.assertOwnerOrAdmin(service, actorId, isAdmin);

    const { name, type = "FULL_PREPAYMENT", description, visibleToBuyers, isDefault } = data;

    if (!name || !String(name).trim()) {
      const err = new Error("name is required.");
      err.statusCode = 400;
      throw err;
    }

    this._validateTypeFields(type, data);

    const derived = generateIconAndColor(name.trim());
    const typeFields = this._buildTypeFields(type, data);

    // Count existing terms to decide auto-default
    const existingCount = await PaymentTerm.count({ where: { serviceId } });
    const shouldBeDefault = isDefault === true || existingCount === 0;

    return sequelize.transaction(async (t) => {
      if (shouldBeDefault) {
        await this._unsetOtherDefaults(serviceId, null, t);
      }

      const term = await PaymentTerm.create(
        {
          serviceId,
          name: name.trim(),
          type,
          icon: derived.icon,
          color: derived.color,
          description: description || null,
          isActive: true,
          isDefault: shouldBeDefault,
          visibleToBuyers: visibleToBuyers !== false,
          createdBy: actorId,
          ...typeFields,
        },
        { transaction: t }
      );

      return term;
    });
  }

  /**
   * List payment terms for a service (owner/admin sees all; public sees visibleToBuyers=true only).
   */
  async listTerms(serviceId, actorId, isAdmin, { includeInactive = false, publicOnly = false } = {}) {
    await this.assertServiceExists(serviceId);

    const where = { serviceId };

    if (publicOnly) {
      where.visibleToBuyers = true;
      where.isActive = true;
    } else {
      if (!includeInactive) where.isActive = true;
    }

    const terms = await PaymentTerm.findAll({
      where,
      include: [{ model: User, as: "creator", attributes: ["id", "name", "email"] }],
      order: [
        ["isDefault", "DESC"],
        ["createdAt", "ASC"],
      ],
    });

    return terms;
  }

  /**
   * Get a single payment term by id.
   */
  async getTerm(serviceId, termId, actorId, isAdmin, publicOnly = false) {
    await this.assertServiceExists(serviceId);
    const term = await this.assertTermBelongsToService(termId, serviceId);

    if (publicOnly && (!term.visibleToBuyers || !term.isActive)) {
      const err = new Error("Payment term not found.");
      err.statusCode = 404;
      throw err;
    }

    return term;
  }

  /**
   * Update a payment term.
   */
  async updateTerm(serviceId, termId, actorId, isAdmin, data) {
    const service = await this.assertServiceExists(serviceId);
    this.assertOwnerOrAdmin(service, actorId, isAdmin);
    const term = await this.assertTermBelongsToService(termId, serviceId);

    const updates = {};

    if (data.name !== undefined) {
      if (!String(data.name).trim()) {
        const err = new Error("name cannot be empty.");
        err.statusCode = 400;
        throw err;
      }
      updates.name = data.name.trim();
      const derived = generateIconAndColor(updates.name);
      updates.icon = derived.icon;
      updates.color = derived.color;
    }

    if (data.description !== undefined) updates.description = data.description;
    if (data.isActive !== undefined) updates.isActive = Boolean(data.isActive);
    if (data.visibleToBuyers !== undefined) updates.visibleToBuyers = Boolean(data.visibleToBuyers);

    const effectiveType = data.type || term.type;
    if (data.type && data.type !== term.type) {
      updates.type = data.type;
    }

    // Re-validate & rebuild type fields if type-specific fields are provided
    const hasTypeFields =
      data.whenCharged !== undefined ||
      data.depositPercentage !== undefined ||
      data.balanceDueDate !== undefined ||
      data.escrowPercentage !== undefined ||
      data.releaseConditions !== undefined;

    if (hasTypeFields || data.type) {
      const mergedData = { ...term.toJSON(), ...data };
      this._validateTypeFields(effectiveType, mergedData);
      Object.assign(updates, this._buildTypeFields(effectiveType, mergedData));
    }

    return sequelize.transaction(async (t) => {
      if (data.isDefault === true) {
        await this._unsetOtherDefaults(serviceId, termId, t);
        updates.isDefault = true;
      }

      await term.update(updates, { transaction: t });
      return term.reload({ transaction: t });
    });
  }

  /**
   * Set a term as the default (unsetting all others for that service).
   */
  async setDefault(serviceId, termId, actorId, isAdmin) {
    const service = await this.assertServiceExists(serviceId);
    this.assertOwnerOrAdmin(service, actorId, isAdmin);
    const term = await this.assertTermBelongsToService(termId, serviceId);

    if (!term.isActive) {
      const err = new Error("Cannot set an inactive term as default.");
      err.statusCode = 400;
      throw err;
    }

    return sequelize.transaction(async (t) => {
      await this._unsetOtherDefaults(serviceId, termId, t);
      await term.update({ isDefault: true }, { transaction: t });
      return term.reload({ transaction: t });
    });
  }

  /**
   * Delete a payment term (only if not in use on active orders).
   */
  async deleteTerm(serviceId, termId, actorId, isAdmin) {
    const service = await this.assertServiceExists(serviceId);
    this.assertOwnerOrAdmin(service, actorId, isAdmin);
    const term = await this.assertTermBelongsToService(termId, serviceId);

    // Guard: if this is the only term, prevent deletion
    const termCount = await PaymentTerm.count({ where: { serviceId } });
    if (termCount === 1) {
      const err = new Error("Cannot delete the only payment term for this service.");
      err.statusCode = 400;
      throw err;
    }

    const wasDefault = term.isDefault;
    await term.destroy();

    // Promote the oldest remaining term to default if we deleted the default
    if (wasDefault) {
      const oldest = await PaymentTerm.findOne({
        where: { serviceId, isActive: true },
        order: [["createdAt", "ASC"]],
      });
      if (oldest) await oldest.update({ isDefault: true });
    }
  }
}

module.exports = PaymentTermService;
