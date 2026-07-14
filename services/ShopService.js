const CustomError = require("../errors/CustomError");
const ShopRepository = require("../repositories/ShopRepository");
const ShopFileService = require("./ShopFileService");
const { User, Wallet } = require("../models");

// Fields the assigned editor is allowed to change. Teams, members and the
// editor itself can only be changed by the shop creator. The *_thumbnail
// values are derived server-side from the uploaded file, never sent by clients.
const EDITABLE_SHOP_FIELDS = [
  "name",
  "description",
  "country",
  "leadTime",
  "profile_image",
  "profile_image_thumbnail",
  "header_image",
  "header_image_thumbnail",
  "multiple_images",
  "rating",
  "likes",
];

const SINGLE_IMAGE_FIELDS = ["header_image", "profile_image"];

function normalizeImageUrls(raw) {
  if (raw === undefined) return undefined;
  let arr = raw;
  if (typeof arr === "string") {
    const trimmed = arr.trim();
    // A multipart body delivers a repeated field as a bare string, not JSON
    if (trimmed.startsWith("[")) {
      try {
        arr = JSON.parse(trimmed);
      } catch {
        throw new CustomError("multiple_images must be an array", 422);
      }
    } else {
      arr = [trimmed];
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
    this.shopFileService = new ShopFileService()
  }

  // header_image / profile_image accept either an uploaded file or a plain URL
  // string. An upload wins, and gets a generated thumbnail; a URL is stored
  // as-is with no thumbnail, which keeps clients that already upload through
  // POST /file/short working. Returns {} when the field was not supplied at
  // all, so an update leaves the existing image untouched.
  async resolveSingleImage(files, data, field) {
    const uploaded = files?.[field]?.[0];

    if (uploaded) {
      const { url, thumbnailUrl } = await this.shopFileService.uploadImage(uploaded);
      return { [field]: url, [`${field}_thumbnail`]: thumbnailUrl };
    }

    const url = data[field];
    if (typeof url === "string" && url.trim().length > 0) {
      return { [field]: url.trim(), [`${field}_thumbnail`]: null };
    }

    return {};
  }

  // Uploaded gallery files are appended after any URLs passed in the body, so a
  // client can mix the two. Returns undefined when neither was supplied, which
  // means "leave the gallery alone" on update.
  async resolveGalleryImages(files, multipleImages) {
    const uploads = files?.multiple_images ?? [];
    const urls = normalizeImageUrls(multipleImages);

    if (uploads.length === 0 && urls === undefined) return undefined;

    const uploaded = await this.shopFileService.uploadImages(uploads);
    const passthrough = (urls ?? []).map((url) => ({ url, thumbnailUrl: null }));

    return [...passthrough, ...uploaded];
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

  // The payout wallet must belong to the shop owner — you cannot get paid
  // into someone else's wallet.
  async validatePayoutWallet(payoutWalletId, ownerId) {
    const wallet = await Wallet.findByPk(payoutWalletId, { attributes: ["id", "userId"] });
    if (!wallet) throw new CustomError(`Wallet not found: ${payoutWalletId}`, 404);
    if (wallet.userId !== ownerId) {
      throw new CustomError("Forbidden. The payout wallet must be your own wallet.", 403);
    }
  }

  async createShop(userId, shopData, files = {}) {
    const { teams, members, editor, multiple_images, payoutWalletId, ...data } = shopData;

    if (editor !== undefined && editor !== null) {
      await this.validateEditor(editor);
    }

    if (payoutWalletId !== undefined && payoutWalletId !== null) {
      await this.validatePayoutWallet(payoutWalletId, userId);
    }

    // Validate everything that can reject before spending an S3 upload on it
    for (const field of SINGLE_IMAGE_FIELDS) {
      Object.assign(data, await this.resolveSingleImage(files, data, field));
    }
    const images = await this.resolveGalleryImages(files, multiple_images);

    const shop = await this.shopRepository.createShop({
      ...data,
      userId,
      editorId: editor ?? null,
      payoutWalletId: payoutWalletId ?? null,
    });

    if (Array.isArray(teams) && teams.length > 0) {
      await this.shopRepository.addTeams(shop.id, teams, userId);
    }
    if (Array.isArray(members) && members.length > 0) {
      await this.shopRepository.addMembers(shop.id, members);
    }
    if (images && images.length > 0) {
      await this.shopRepository.replaceImages(shop.id, images);
    }

    return this.shopRepository.getShopWithRelations(shop.id, {
      includeTeams: true,
      includeMembers: true,
    });
  }

  async updateShop(shopId, userId, shopData, files = {}) {
    const shop = await this.shopRepository.getShopById(shopId);

    const isOwner = shop.userId === userId;
    const isEditor = shop.editorId === userId;

    if (!isOwner && !isEditor) {
      throw new CustomError("Unauthorized", 403);
    }

    const { teams, members, editor, multiple_images, payoutWalletId, ...data } = shopData;

    // Assignment fields and the payout wallet are creator-only, even for the editor
    if (
      !isOwner &&
      (teams !== undefined ||
        members !== undefined ||
        editor !== undefined ||
        payoutWalletId !== undefined)
    ) {
      throw new CustomError(
        "Forbidden. Only the shop creator can assign teams, members, editor or the payout wallet.",
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
    delete data.payoutWalletId;

    // After the editable-field filter, so the derived *_thumbnail values it
    // does not know about survive. Both the owner and the editor may change images.
    for (const field of SINGLE_IMAGE_FIELDS) {
      Object.assign(data, await this.resolveSingleImage(files, data, field));
    }

    if (editor !== undefined && editor !== null) {
      await this.validateEditor(editor);
      data.editorId = editor;
    } else if (editor === null) {
      data.editorId = null;
    }

    if (payoutWalletId !== undefined) {
      if (payoutWalletId === null) {
        data.payoutWalletId = null;
      } else {
        await this.validatePayoutWallet(payoutWalletId, shop.userId);
        data.payoutWalletId = payoutWalletId;
      }
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
    const images = await this.resolveGalleryImages(files, multiple_images);
    if (images !== undefined) {
      await this.shopRepository.replaceImages(shopId, images);
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
