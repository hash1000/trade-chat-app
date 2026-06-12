const { Service, ServicePurchase } = require("../models");
const sequelize = require("../config/database");
const ServiceRepository = require("../repositories/ServiceRepository");

class ServiceService {
  constructor() {
    this.serviceRepository = new ServiceRepository();
  }

  async create(data) {
    return this.serviceRepository.create(data);
  }

  async getById(id, options = {}) {
    return this.serviceRepository.findByPk(id, options);
  }

  async getByIdWithDeleted(id) {
    return this.serviceRepository.findByPkWithDeleted(id);
  }

  async getAll(options = {}) {
    return this.serviceRepository.findAll(options);
  }

  async update(id, data) {
    return this.serviceRepository.update(id, data);
  }

  async delete(id, deletedBy) {
    return this.serviceRepository.delete(id, deletedBy);
  }

  async restore(id) {
    const service = await Service.findByPk(id, {
      paranoid: false,
    });

    if (!service) return null;

    return service.update({
      deletedAt: null,
      deletedBy: null,
    });
  }

  async addTeam(serviceId, teamId) {
    return this.serviceRepository.addTeam(serviceId, teamId);
  }

  async addTeams(serviceId, teamIds) {
    return this.serviceRepository.addTeams(serviceId, teamIds);
  }

  async removeTeam(serviceId, teamId) {
    return this.serviceRepository.removeTeam(serviceId, teamId);
  }

  async setTeams(serviceId, teamIds) {
    await this.serviceRepository.removeAllTeams(serviceId);
    if (Array.isArray(teamIds) && teamIds.length > 0) {
      await this.serviceRepository.addTeams(serviceId, teamIds);
    }
  }

  async addCategory(serviceId, categoryId) {
    return this.serviceRepository.addCategory(serviceId, categoryId);
  }

  async addCategories(serviceId, categoryIds) {
    return this.serviceRepository.addCategories(serviceId, categoryIds);
  }

  async removeCategory(serviceId, categoryId) {
    return this.serviceRepository.removeCategory(serviceId, categoryId);
  }

  async setCategories(serviceId, categoryIds) {
    await this.serviceRepository.removeAllCategories(serviceId);
    if (Array.isArray(categoryIds) && categoryIds.length > 0) {
      await this.serviceRepository.addCategories(serviceId, categoryIds);
    }
  }

  async likeService(userId, serviceId) {
    return this.serviceRepository.likeService(userId, serviceId);
  }

  async unlikeService(userId, serviceId) {
    return this.serviceRepository.unlikeService(userId, serviceId);
  }

  async getLikesCount(serviceId) {
    return this.serviceRepository.getLikesCount(serviceId);
  }

  async hasUserLiked(userId, serviceId) {
    return this.serviceRepository.hasUserLiked(userId, serviceId);
  }

  async recordView(userId, serviceId) {
    return this.serviceRepository.recordView(userId, serviceId);
  }

  async getViewsCount(serviceId) {
    return this.serviceRepository.getViewsCount(serviceId);
  }

  async updateRating(userId, serviceId, rating, comment) {
    return sequelize.transaction(async (t) => {
      return this.serviceRepository.updateRating(userId, serviceId, rating, comment, t);
    });
  }

  async rateService(userId, serviceId, rating, comment) {
    const purchase = await ServicePurchase.findOne({ where: { userId, serviceId } });
    if (!purchase) {
      const err = new Error("You must purchase this service before rating it.");
      err.name = "NotPurchasedError";
      throw err;
    }

    return sequelize.transaction(async (t) => {
      await this.serviceRepository.upsertRating(userId, serviceId, rating, comment, t);
    });
  }

  async deleteRating(userId, serviceId) {
    return sequelize.transaction(async (t) => {
      return this.serviceRepository.deleteRating(userId, serviceId, t);
    });
  }

  async updateBadges(serviceId, data) {
    return this.serviceRepository.updateBadges(serviceId, data);
  }
}

module.exports = ServiceService;
