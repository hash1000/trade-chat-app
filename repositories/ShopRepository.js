const { Op } = require("sequelize");
const CustomError = require("../errors/CustomError");
const {
  Shop,
  ShopProduct,
  ShopTeamLink,
  ShopMember,
  ShopImage,
  ProductImage,
  Team,
  User,
  Wallet,
} = require("../models");

const USER_ATTRIBUTES = ["id", "username", "email", "profilePic"];

class ShopRepository {
  buildIncludes({ includeTeams = false, includeMembers = false, includeProducts = false } = {}) {
    const include = [
      { model: ShopImage, as: "images" },
      { model: User, as: "createdBy", attributes: USER_ATTRIBUTES },
      { model: User, as: "editor", attributes: USER_ATTRIBUTES },
      { model: Wallet, as: "payoutWallet" },
    ];

    if (includeTeams) {
      include.push({
        model: Team,
        as: "teams",
        through: { attributes: [] },
        include: [
          {
            model: User,
            as: "members",
            attributes: USER_ATTRIBUTES,
            through: { attributes: [] },
          },
        ],
      });
    }

    if (includeMembers) {
      include.push({
        model: User,
        as: "members",
        attributes: USER_ATTRIBUTES,
        through: { attributes: [] },
      });
    }

    if (includeProducts) {
      include.push({
        model: ShopProduct,
        as: "shopProducts",
        include: [{ model: ProductImage, as: "productImages" }],
      });
    }

    return include;
  }

  async createShop(data) {
    return Shop.create(data);
  }

  async updateShop(shopId, shopData) {
    const shop = await Shop.findByPk(shopId);
    if (!shop) throw new CustomError("Shop not found", 404);

    return shop.update(shopData);
  }

  async deleteShop(shopId) {
    const shop = await Shop.findByPk(shopId);
    if (!shop) throw new CustomError("Shop not found", 404);

    return shop.destroy();
  }

  async getShopById(shopId) {
    const shop = await Shop.findByPk(shopId);
    if (!shop) throw new CustomError("Shop not found", 404);
    return shop;
  }

  async getShopWithRelations(shopId, options = {}) {
    return Shop.findByPk(shopId, { include: this.buildIncludes(options) });
  }

  async getByUserId(userId, options = {}) {
    const page = Number(options.page) || 1;
    const limit = Number(options.limit) || 10;
    const offset = (page - 1) * limit;

    const { count, rows } = await Shop.findAndCountAll({
      where: { userId },
      include: this.buildIncludes(options),
      order: [["createdAt", "DESC"]],
      limit,
      offset,
      distinct: true,
    });

    return {
      total: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      shops: rows,
    };
  }

  async getById(userId, id, options = {}) {
    return Shop.findAll({
      where: { id, userId },
      include: this.buildIncludes(options),
    });
  }

  async getPaginatedShops(page, limit, shop_name, country) {
    const offset = (page - 1) * limit;
    const where = {};

    if (shop_name) {
      where.name = { [Op.like]: `%${shop_name}%` };
    }

    if (country) {
      where.country = { [Op.like]: `%${country}%` };
    }

    const { count, rows } = await Shop.findAndCountAll({
      where,
      limit: Number(limit),
      offset,
      order: [["createdAt", "DESC"]],
      include: [
        { model: ShopImage, as: "images" },
        { model: User, as: "createdBy", attributes: USER_ATTRIBUTES },
      ],
      distinct: true,
    });

    return {
      total: count,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      shops: rows,
    };
  }

  // ── Images ─────────────────────────────────────────────────────────────────

  // Accepts either plain URL strings or {url, thumbnailUrl} objects
  async replaceImages(shopId, images) {
    await ShopImage.destroy({ where: { shopId } });
    if (!Array.isArray(images) || images.length === 0) return [];

    const rows = images.map((image) =>
      typeof image === "string"
        ? { url: image, thumbnailUrl: null, shopId }
        : { url: image.url, thumbnailUrl: image.thumbnailUrl ?? null, shopId }
    );

    return ShopImage.bulkCreate(rows);
  }

  // ── Teams ──────────────────────────────────────────────────────────────────

  async addTeams(shopId, teamIds, ownerId) {
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
      attributes: ["id", "type", "createdBy"],
    });
    const existingIds = new Set(existingTeams.map((t) => t.id));
    const missingIds = numericIds.filter((id) => !existingIds.has(id));
    if (missingIds.length > 0) {
      throw new CustomError(`Team(s) not found: ${missingIds.join(", ")}`, 404);
    }

    // Shops only accept shop-type teams owned by the shop creator —
    // service teams (and their admins) stay completely separate
    const wrongType = existingTeams.filter((t) => t.type !== "shop").map((t) => t.id);
    if (wrongType.length > 0) {
      throw new CustomError(
        `Only shop teams can be assigned to shops. Not shop teams: ${wrongType.join(", ")}`,
        422
      );
    }
    const notOwned = existingTeams.filter((t) => t.createdBy !== ownerId).map((t) => t.id);
    if (notOwned.length > 0) {
      throw new CustomError(
        `You can only assign teams you created. Not your teams: ${notOwned.join(", ")}`,
        403
      );
    }

    await Promise.all(
      numericIds.map((teamId) =>
        ShopTeamLink.findOrCreate({
          where: { teamId, shopId },
          defaults: { teamId, shopId },
        }),
      ),
    );

    return numericIds;
  }

  async removeTeam(shopId, teamId) {
    const deleted = await ShopTeamLink.destroy({ where: { teamId, shopId } });
    return deleted > 0;
  }

  async removeAllTeams(shopId) {
    await ShopTeamLink.destroy({ where: { shopId } });
  }

  // ── Members ────────────────────────────────────────────────────────────────

  async addMembers(shopId, userIds) {
    if (!Array.isArray(userIds) || userIds.length === 0) return { added: [], alreadyMembers: [] };

    const users = await User.findAll({ where: { id: userIds }, attributes: ["id"] });
    const foundIds = users.map((u) => u.id);
    const notFound = userIds.filter((id) => !foundIds.includes(id));
    if (notFound.length > 0) {
      throw new CustomError(`Users not found: ${notFound.join(", ")}`, 404);
    }

    const existing = await ShopMember.findAll({ where: { shopId, userId: userIds } });
    const alreadyMemberIds = existing.map((m) => m.userId);
    const toAdd = userIds.filter((id) => !alreadyMemberIds.includes(id));

    if (toAdd.length > 0) {
      await ShopMember.bulkCreate(toAdd.map((userId) => ({ shopId, userId })));
    }

    const members = await ShopMember.findAll({
      where: { shopId, userId: userIds },
      include: [{ model: User, as: "user", attributes: USER_ATTRIBUTES }],
    });

    return { added: members, alreadyMembers: alreadyMemberIds };
  }

  async removeMembers(shopId, userIds) {
    const members = await ShopMember.findAll({ where: { shopId, userId: userIds } });
    const foundUserIds = members.map((m) => m.userId);
    const notFound = userIds.filter((id) => !foundUserIds.includes(id));

    if (notFound.length > 0) {
      throw new CustomError(`Users are not members of this shop: ${notFound.join(", ")}`, 404);
    }

    await ShopMember.destroy({ where: { shopId, userId: userIds } });
    return { removedUserIds: foundUserIds };
  }

  async removeAllMembers(shopId) {
    await ShopMember.destroy({ where: { shopId } });
  }

  async getMembers(shopId, { page = 1, limit = 10 } = {}) {
    const offset = (page - 1) * limit;

    const { count, rows } = await ShopMember.findAndCountAll({
      where: { shopId },
      include: [{ model: User, as: "user", attributes: USER_ATTRIBUTES }],
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
}

module.exports = ShopRepository;
