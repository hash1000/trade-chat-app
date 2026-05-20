// repositories/ServicePurchaseRepository.js
const { ServicePurchase, Service } = require("../models");

class ServicePurchaseRepository {
  async create(data) {
    return ServicePurchase.create(data);
  }

  async findByUser(userId) {
    return ServicePurchase.findAll({
      where: { userId },
      include: [{ model: Service, as: "service" }],
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