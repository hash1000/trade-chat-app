// repositories/ServiceRepository.js
const { Op } = require("sequelize");
const { Sequelize } = require("sequelize");
const {
  Service,
  Team,
  TeamServiceLink,
  User,
  PublicCategory,
  ServicePublicCategory,
  Wallet,
  ServiceFile,
} = require("../models");


class ServiceRepository {
  buildIncludes(options = {}) {
    const include = [];

    include.push({
      model: User,
      as: "owner",
      attributes: [
        "id",
        "firstName",
        "lastName",
        "username",
        "email",
        "profilePic",
      ],
    });

    // ⭐ NEW: payout wallet
    include.push({
      model: Wallet,
      as: "payoutWallet",
      attributes: [
        "id",
        "currency",
        "walletType",
        "accountNumber",
        "availableBalance",
      ],
    });

    include.push({
      model: ServiceFile,
      as: "files",
      order: [["sort_order", "ASC"]],
    });

    if (options.includeTeams || options.includeMembers) {
      const teamInclude = {
        model: Team,
        as: "teams",
        through: { attributes: [] },
      };

      if (options.includeMembers) {
        teamInclude.include = [
          {
            model: User,
            as: "members",
            through: { attributes: [] },
            attributes: [
              "id",
              "firstName",
              "lastName",
              "username",
              "email",
              "profilePic",
            ],
          },
        ];
      }

      include.push(teamInclude);
    }

    if (options.includeCategories) {
      include.push({
        model: PublicCategory,
        as: "publicCategories",
        through: { attributes: [] },
      });
    }

    return include;
  }

  async create(data) {
    return Service.create(data);
  }

async findByPk(id, options = {}) {
  const queryOptions = { ...options };

  delete queryOptions.includeTeams;
  delete queryOptions.includeMembers;
  delete queryOptions.includeCategories;

  const service = await Service.findOne({
    include: this.buildIncludes(options),
    where: {
      id,
      deletedAt: null,
    },
    ...queryOptions,
  });

  if (!service) return null;

  const plain = service.toJSON();

  plain.media = plain.files || [];
  delete plain.files;

  return plain;
}

  async findByPkWithDeleted(id) {
    return Service.findOne({
      where: { id },
    });
  }

async findAll(options = {}) {
  const { userId } = options;

  const queryOptions = { ...options };

  delete queryOptions.includeTeams;
  delete queryOptions.includeMembers;
  delete queryOptions.includeCategories;
  delete queryOptions.userId;

  const attributes = { include: [] };

  if (userId) {
    attributes.include.push([
      Sequelize.literal(`
        EXISTS (
          SELECT 1
          FROM service_purchases sp
          WHERE sp.serviceId = Service.id
          AND sp.userId = ${userId}
        )
      `),
      "isPurchased",
    ]);
  }

  const services = await Service.findAll({
    attributes,
    include: this.buildIncludes(options),
    where: { deletedAt: null },
    order: [["createdAt", "DESC"]],
    ...queryOptions,
  });

  return services.map((service) => {
    const plain = service.toJSON();

    plain.media = plain.files || [];
    delete plain.files;

    return plain;
  });
}

  async update(id, data) {
    const service = await Service.findByPk(id);
    if (!service) return null;
    await service.update(data);
    return service;
  }

  async delete(id, deletedBy = null) {
    const service = await Service.findByPk(id);

    if (!service) return null;

    // already deleted
    if (service.deletedAt) return service;

    await service.update({
      deletedAt: new Date(),
      deletedBy,
    });

    return service;
  }

  async restore(id) {
    const service = await this.serviceRepository.findByPkWithDeleted(id);

    if (!service) return null;

    // only restore if it was actually deleted
    if (!service.deletedAt) return service;

    await service.update({
      deletedAt: null,
      deletedBy: null,
    });

    return service;
  }

  async addTeam(serviceId, teamId) {
    const [team] = await TeamServiceLink.findOrCreate({
      where: { teamId, serviceId },
      defaults: { teamId, serviceId },
    });
    return team;
  }

  async addTeams(serviceId, teamIds) {
    if (!Array.isArray(teamIds) || teamIds.length === 0) return [];
    const numericIds = [
      ...new Set(
        teamIds
          .map((id) => Number(id))
          .filter((id) => !Number.isNaN(id) && id > 0),
      ),
    ];
    if (numericIds.length === 0) return [];

    const existingTeams = await Team.findAll({
      where: { id: { [Op.in]: numericIds } },
      attributes: ["id"],
    });
    const existingIds = new Set(existingTeams.map((t) => t.id));
    const missingIds = numericIds.filter((id) => !existingIds.has(id));
    if (missingIds.length > 0) {
      const err = new Error(`Team(s) not found: ${missingIds.join(", ")}`);
      err.name = "InvalidTeamIdError";
      err.missingTeamIds = missingIds;
      throw err;
    }

    await Promise.all(
      numericIds.map((teamId) =>
        TeamServiceLink.findOrCreate({
          where: { teamId, serviceId },
          defaults: { teamId, serviceId },
        }),
      ),
    );

    return numericIds;
  }

  async removeTeam(serviceId, teamId) {
    const deleted = await TeamServiceLink.destroy({
      where: { teamId, serviceId },
    });
    return deleted > 0;
  }

  async removeAllTeams(serviceId) {
    await TeamServiceLink.destroy({ where: { serviceId } });
  }

  async addCategory(serviceId, categoryId) {
    const [createdCategoryId] = await this.addCategories(serviceId, [
      categoryId,
    ]);
    return createdCategoryId;
  }

  async addCategories(serviceId, categoryIds) {
    if (!Array.isArray(categoryIds) || categoryIds.length === 0) return [];
    const numericIds = [
      ...new Set(
        categoryIds
          .map((id) => Number(id))
          .filter((id) => !Number.isNaN(id) && id > 0),
      ),
    ];
    if (numericIds.length === 0) return [];

    const existingCategories = await PublicCategory.findAll({
      where: { id: { [Op.in]: numericIds } },
      attributes: ["id"],
    });
    const existingIds = new Set(existingCategories.map((c) => c.id));
    const missingIds = numericIds.filter((id) => !existingIds.has(id));
    if (missingIds.length > 0) {
      const err = new Error(`Category(s) not found: ${missingIds.join(", ")}`);
      err.name = "InvalidCategoryIdError";
      err.missingCategoryIds = missingIds;
      throw err;
    }

    await Promise.all(
      numericIds.map((categoryId) =>
        ServicePublicCategory.findOrCreate({
          where: { publicCategoryId: categoryId, serviceId },
          defaults: { publicCategoryId: categoryId, serviceId },
        }),
      ),
    );

    return numericIds;
  }

  async removeCategory(serviceId, categoryId) {
    const deleted = await ServicePublicCategory.destroy({
      where: { publicCategoryId: categoryId, serviceId },
    });
    return deleted > 0;
  }

  async removeAllCategories(serviceId) {
    await ServicePublicCategory.destroy({ where: { serviceId } });
  }
}

module.exports = ServiceRepository;
