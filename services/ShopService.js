const CustomError = require("../errors/CustomError");
const ShopRepository = require("../repositories/ShopRepository");
const { User } = require("../models");

// Fields the assigned editor is allowed to change. Teams, members and the
// editor itself can only be changed by the shop creator.
const EDITABLE_SHOP_FIELDS = [
  "name",
  "description",
  "country",
  "leadTime",
  "profile_image",
  "header_image",
  "multiple_images",
  "rating",
  "likes",
];

function normalizeImageUrls(raw) {
  if (raw === undefined) return undefined;
  let arr = raw;
  if (typeof arr === "string") {
    try {
      arr = JSON.parse(arr);
    } catch {
      throw new CustomError("multiple_images must be an array", 422);
    }
  }
  if (!Array.isArray(arr)) {
    throw new CustomError("multiple_images must be an array", 422);
  }
  return arr
    .map((item) => (typeof item === "string" ? item : item && item.url))
    .filter((url) => typeof url === "string" && url.length > 0);
}

class ShopService {
  constructor() {
    this.shopRepository = new ShopRepository()
  }

  assertOwner(shop, userId) {
    if (shop.userId !== userId) {
      throw new CustomError("Forbidden. Only the shop creator can perform this action.", 403);
    }
  }

  async validateEditor(editorId) {
    const user = await User.findByPk(editorId, { attributes: ["id"] });
    if (!user) throw new CustomError(`Editor user not found: ${editorId}`, 404);
  }

  async createShop(userId, shopData) {
    const { teams, members, editor, multiple_images, ...data } = shopData;

    if (editor !== undefined && editor !== null) {
      await this.validateEditor(editor);
    }

    const shop = await this.shopRepository.createShop({
      ...data,
      userId,
      editorId: editor ?? null,
    });

    if (Array.isArray(teams) && teams.length > 0) {
      await this.shopRepository.addTeams(shop.id, teams, userId);
    }
    if (Array.isArray(members) && members.length > 0) {
      await this.shopRepository.addMembers(shop.id, members);
    }
    const urls = normalizeImageUrls(multiple_images);
    if (urls && urls.length > 0) {
      await this.shopRepository.replaceImages(shop.id, urls);
    }

    return this.shopRepository.getShopWithRelations(shop.id, {
      includeTeams: true,
      includeMembers: true,
    });
  }

  async updateShop(shopId, userId, shopData) {
    const shop = await this.shopRepository.getShopById(shopId);

    const isOwner = shop.userId === userId;
    const isEditor = shop.editorId === userId;

    if (!isOwner && !isEditor) {
      throw new CustomError("Unauthorized", 403);
    }

    const { teams, members, editor, multiple_images, ...data } = shopData;

    // Assignment fields are creator-only, even for the editor
    if (!isOwner && (teams !== undefined || members !== undefined || editor !== undefined)) {
      throw new CustomError(
        "Forbidden. Only the shop creator can assign teams, members or editor.",
        403
      );
    }

    // The editor can only touch plain shop fields
    if (!isOwner) {
      for (const key of Object.keys(data)) {
        if (!EDITABLE_SHOP_FIELDS.includes(key)) {
          delete data[key];
        }
      }
    }

    // Never allow ownership to be moved through update
    delete data.userId;
    delete data.editorId;

    if (editor !== undefined && editor !== null) {
      await this.validateEditor(editor);
      data.editorId = editor;
    } else if (editor === null) {
      data.editorId = null;
    }

    await this.shopRepository.updateShop(shopId, data);

    // Replace-all semantics when arrays are provided
    if (teams !== undefined) {
      await this.shopRepository.removeAllTeams(shopId);
      if (Array.isArray(teams) && teams.length > 0) {
        await this.shopRepository.addTeams(shopId, teams, shop.userId);
      }
    }
    if (members !== undefined) {
      await this.shopRepository.removeAllMembers(shopId);
      if (Array.isArray(members) && members.length > 0) {
        await this.shopRepository.addMembers(shopId, members);
      }
    }
    const urls = normalizeImageUrls(multiple_images);
    if (urls !== undefined) {
      await this.shopRepository.replaceImages(shopId, urls);
    }

    return this.shopRepository.getShopWithRelations(shopId, {
      includeTeams: true,
      includeMembers: true,
    });
  }

  async deleteShop(shopId, userId) {
    const shop = await this.shopRepository.getShopById(shopId)
    this.assertOwner(shop, userId)

    return this.shopRepository.deleteShop(shopId)
  }

  async getShopsByUserId(userId, options = {}) {
    return this.shopRepository.getByUserId(userId, options)
  }

  async getShopsById(userId, id, options = {}) {
    return this.shopRepository.getById(userId, id, options)
  }

  async getPaginatedShops(page, limit, shop_name, country) {
    return this.shopRepository.getPaginatedShops(page, limit, shop_name, country)
  }

  // ── Teams ──────────────────────────────────────────────────────────────────

  async addTeams(shopId, userId, teamIds) {
    const shop = await this.shopRepository.getShopById(shopId);
    this.assertOwner(shop, userId);

    const added = await this.shopRepository.addTeams(shopId, teamIds, shop.userId);
    return { addedTeamIds: added };
  }

  async removeTeam(shopId, userId, teamId) {
    const shop = await this.shopRepository.getShopById(shopId);
    this.assertOwner(shop, userId);

    const removed = await this.shopRepository.removeTeam(shopId, teamId);
    if (!removed) {
      throw new CustomError("Team is not assigned to this shop", 404);
    }
    return true;
  }

  // ── Members ────────────────────────────────────────────────────────────────

  async getMembers(shopId, options) {
    await this.shopRepository.getShopById(shopId);
    return this.shopRepository.getMembers(shopId, options);
  }

  async addMembers(shopId, userId, userIds) {
    const shop = await this.shopRepository.getShopById(shopId);
    this.assertOwner(shop, userId);

    return this.shopRepository.addMembers(shopId, userIds);
  }

  async removeMembers(shopId, userId, userIds) {
    const shop = await this.shopRepository.getShopById(shopId);
    this.assertOwner(shop, userId);

    return this.shopRepository.removeMembers(shopId, userIds);
  }

  // ── Editor ─────────────────────────────────────────────────────────────────

  async setEditor(shopId, userId, editorId) {
    const shop = await this.shopRepository.getShopById(shopId);
    this.assertOwner(shop, userId);

    await this.validateEditor(editorId);
    await shop.update({ editorId });

    return this.shopRepository.getShopWithRelations(shopId, {
      includeTeams: true,
      includeMembers: true,
    });
  }

  async clearEditor(shopId, userId) {
    const shop = await this.shopRepository.getShopById(shopId);
    this.assertOwner(shop, userId);

    await shop.update({ editorId: null });
    return true;
  }
}

module.exports = ShopService;
