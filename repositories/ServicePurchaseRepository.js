// repositories/ServicePurchaseRepository.js
const {
  ServicePurchase,
  Service,
  WalletTransaction,
  User,
} = require("../models");

class ServicePurchaseRepository {
  /**
   * Create a purchase record inside an existing DB transaction.
   * Always pass { transaction: t } — this is called from a sequelize.transaction() block.
   */
  async create(data, options = {}) {
    return ServicePurchase.create(data, options);
  }

  /**
   * Buyer: list my purchases with service details + the linked transaction.
   */
  async findByUser(userId) {
    return ServicePurchase.findAll({
      where: { userId },
      include: [
        {
          model: Service,
          as: "service",
          attributes: [
            "id",
            "name",
            "profile_image",
            "type",
            "location",
            "price",
          ],
        },

        {
          model: WalletTransaction,
          as: "transaction",
          attributes: ["id", "amount", "currency", "type", "createdAt"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });
  }

  /**
   * Admin/owner: who bought a specific service.
   */
  async findByService(serviceId) {
    return ServicePurchase.findAll({
      where: { serviceId },
      include: [
        {
          model: User,
          as: "buyer",
          attributes: ["id", "firstName", "lastName", "username", "email"], // ← was "name"
        },
        {
          model: WalletTransaction,
          as: "transaction",
          attributes: ["id", "amount", "currency", "createdAt"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });
  }

  async findByUserAndService(userId, serviceId) {
    return ServicePurchase.findOne({ where: { userId, serviceId } });
  }

  async findByPk(id) {
    return ServicePurchase.findByPk(id);
  }
}

module.exports = ServicePurchaseRepository;
