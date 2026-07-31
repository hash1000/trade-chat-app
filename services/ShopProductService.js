const ShopProductRepository = require("../repositories/ShopProductRepository");
const ProductImageRepository = require("../repositories/ProductImageRepository");
const ProductFileService = require("../services/ProductFileService");
const ProductVariationService = require("../services/ProductVariationService");
const Shop = require("../models/shop");
const CustomError = require("../errors/CustomError");
const sequelize = require("../config/database");

const ALLOWED_PRICING_TYPES = ["free", "fixed", "range"];
const ALLOWED_STATUSES = ["draft", "published", "archived"];

// Stock is out only when every sellable unit is at 0 — for a variation product
// that means every variation's stock is 0, not just one.
function isOutOfStock(product) {
  if (product.hasVariations) {
    const variations = product.variations || [];
    if (variations.length === 0) return false; // no variations yet — not a stock statement
    return variations.every((v) => Number(v.stock) <= 0);
  }
  return Number(product.quantity) <= 0;
}

// isActive is the seller's own on/off toggle for an add-on and takes priority
// over stock — a disabled add-on isn't purchasable even if stock remains.
function addOnEffectiveStatus(addOn) {
  if (!addOn.isActive) return "inactive";
  return Number(addOn.stock) <= 0 ? "out_of_stock" : "in_stock";
}

function withAddOnStatus(addOns) {
  return Array.isArray(addOns)
    ? addOns.map((a) => ({ ...a, effectiveStatus: addOnEffectiveStatus(a) }))
    : addOns;
}

// status is the seller-set value (draft/published/archived) persisted on the row.
// effectiveStatus is what buyers should see: archived always wins, otherwise
// out_of_stock is layered on top of "published" when stock is exhausted. This is
// computed on read, never stored, so it can't drift out of sync with real stock.
function attachEffectiveStatus(json) {
  if (Array.isArray(json.variations)) {
    // Per-variation status: a single sold-out variation is out_of_stock on its
    // own, independent of its siblings — the product-level rollup (below) only
    // flips once every variation is out.
    json.variations = json.variations.map((v) => ({
      ...v,
      effectiveStatus: Number(v.stock) <= 0 ? "out_of_stock" : "in_stock",
      addOns: withAddOnStatus(v.addOns),
    }));
  }

  json.addOns = withAddOnStatus(json.addOns);

  json.effectiveStatus =
    json.status === "archived"
      ? "archived"
      : isOutOfStock(json)
      ? "out_of_stock"
      : json.status;
  return json;
}

// Owner-editable boolean trust flags. isTopChoice / isQRMVerified are
// admin-only badges and can only change through updateBadges.
const TRUST_FLAGS = ["insured", "moneyBack", "support247"];

function parseBool(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function parseTags(raw) {
  let arr = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!Array.isArray(arr) || arr.some((t) => typeof t !== "string")) {
    throw new CustomError("tags must be an array of strings.", 422);
  }
  arr = [...new Set(arr.map((t) => t.trim().toLowerCase()))];
  if (arr.length > 10) {
    throw new CustomError("tags may not exceed 10 items.", 422);
  }
  if (arr.some((t) => t.length > 30)) {
    throw new CustomError("Each tag may not exceed 30 characters.", 422);
  }
  return arr;
}

// Validates pricing fields and returns the normalized column values
function resolvePricing({ pricing_type, price, min_price, max_price }, existing = null) {
  const type = pricing_type ?? existing?.pricing_type ?? "fixed";

  if (!ALLOWED_PRICING_TYPES.includes(type)) {
    throw new CustomError("Invalid pricing_type. Allowed: free, fixed, range.", 422);
  }

  if (type === "fixed") {
    const p = price !== undefined ? Number(price) : Number(existing?.price);
    if (!p || Number.isNaN(p) || p <= 0) {
      throw new CustomError("price is required for fixed pricing and must be greater than 0.", 422);
    }
    return { pricing_type: type, price: p, min_price: null, max_price: null };
  }

  if (type === "range") {
    const min = min_price !== undefined ? Number(min_price) : existing?.min_price != null ? Number(existing.min_price) : null;
    const max = max_price !== undefined ? Number(max_price) : existing?.max_price != null ? Number(existing.max_price) : null;
    if (min == null || max == null || Number.isNaN(min) || Number.isNaN(max) || min < 0 || max <= 0) {
      throw new CustomError("min_price and max_price are required for range pricing.", 422);
    }
    if (min > max) {
      throw new CustomError("min_price cannot be greater than max_price.", 422);
    }
    return { pricing_type: type, price: 0, min_price: min, max_price: max };
  }

  // free
  return { pricing_type: type, price: 0, min_price: null, max_price: null };
}

function parseProductImages(raw) {
  if (raw === undefined || raw === null) return undefined;
  let arr = raw;
  if (typeof arr === "string") {
    const trimmed = arr.trim();
    // multipart delivers a repeated field as a bare string, not JSON
    if (trimmed.startsWith("[")) {
      try {
        arr = JSON.parse(trimmed);
      } catch {
        throw new CustomError("productImages must be an array.", 422);
      }
    } else {
      arr = [trimmed];
    }
  }
  if (!Array.isArray(arr)) {
    throw new CustomError("productImages must be an array.", 422);
  }
  return arr
    .map((item) => (typeof item === "string" ? item : item && item.url))
    .filter((url) => typeof url === "string" && url.length > 0);
}

class ShopProductService {
  constructor() {
    this.productRepository = new ShopProductRepository();
    this.productImageRepository = new ProductImageRepository();
    this.productFileService = new ProductFileService();
    this.variationService = new ProductVariationService();
  }

  // The product gallery accepts uploaded files, URL strings, or both. Uploads are
  // pushed to S3 with a generated thumbnail; a URL is stored as-is with a null
  // thumbnail, so clients that pre-upload via POST /file/short keep working.
  // Returns undefined when neither was given — on update that means "leave as is".
  async resolveProductImages(rawImages, files = []) {
    const urls = parseProductImages(rawImages);
    if (urls === undefined && files.length === 0) return undefined;

    const uploaded = await this.productFileService.uploadImages(files);
    const passthrough = (urls ?? []).map((url) => ({ url, thumbnailUrl: null }));

    return [...passthrough, ...uploaded];
  }

  // variations may arrive as an array (JSON body) or a JSON string (multipart)
  parseVariations(raw) {
    if (raw === undefined || raw === null) return undefined;
    let arr = raw;
    if (typeof arr === "string") {
      try {
        arr = JSON.parse(arr);
      } catch {
        throw new CustomError("variations must be an array.", 422);
      }
    }
    if (!Array.isArray(arr)) {
      throw new CustomError("variations must be an array.", 422);
    }
    return arr;
  }

  // categoryIds may arrive as an array (JSON body) or a JSON string (multipart)
  parseCategoryIds(raw) {
    if (raw === undefined || raw === null) return undefined;
    let arr = raw;
    if (typeof arr === "string") {
      try {
        arr = JSON.parse(arr);
      } catch {
        throw new CustomError("categoryIds must be an array of category IDs.", 422);
      }
    }
    if (!Array.isArray(arr)) {
      throw new CustomError("categoryIds must be an array of category IDs.", 422);
    }
    return arr;
  }

  async validateShopOwnership(shopId, userId) {
    const shop = await Shop.findByPk(shopId);

    if (!shop) {
      throw new CustomError("Shop not found", 404);
    }

    if (shop.userId !== userId) {
      throw new CustomError("Unauthorized access to this shop", 403);
    }

    return shop;
  }

  async createProduct(userId, productData, files = {}) {
    const {
      media: mediaFiles = [],
      productImages: productImageFiles = [],
      variationImages = {},
    } = files;

    const {
      name,
      description,
      shopId,
      quantity,
      rating,
      pricing_type,
      price,
      min_price,
      max_price,
      tags,
      insured,
      moneyBack,
      support247,
      productImages,
      variations,
      categoryIds,
      hasVariations,
      status,
    } = productData;

    await this.validateShopOwnership(shopId, userId);

    if (status !== undefined && !ALLOWED_STATUSES.includes(status)) {
      throw new CustomError(`Invalid status. Allowed: ${ALLOWED_STATUSES.join(", ")}.`, 422);
    }

    const variationPayloads = this.parseVariations(variations);
    const useVariations = hasVariations !== undefined ? parseBool(hasVariations) : false;

    if (useVariations && (!variationPayloads || variationPayloads.length === 0)) {
      throw new CustomError(
        "A variation-based product needs at least one variation.",
        422
      );
    }
    if (!useVariations && variationPayloads && variationPayloads.length > 0) {
      throw new CustomError(
        "Turn hasVariations on to give this product variations.",
        422
      );
    }

    // a variation-based product carries no price of its own: the pricing fields are
    // placeholders until syncPricing derives them from the variations below
    const pricing = useVariations
      ? { pricing_type: "range", price: 0, min_price: null, max_price: null }
      : resolvePricing({ pricing_type, price, min_price, max_price });

    const data = {
      name: typeof name === "string" ? name.trim() : name,
      description: description != null ? String(description).trim() : null,
      shopId: Number(shopId),
      quantity: quantity !== undefined ? Number(quantity) : 0,
      rating: rating !== undefined ? Number(rating) : 0,
      hasVariations: useVariations,
      status: status !== undefined ? status : "draft",
      ...pricing,
      tags: tags !== undefined && tags !== null ? parseTags(tags) : [],
      insured: insured !== undefined ? parseBool(insured) : false,
      moneyBack: moneyBack !== undefined ? parseBool(moneyBack) : false,
      support247: support247 !== undefined ? parseBool(support247) : false,
    };

    const product = await this.productRepository.createProduct(data);

    const images = await this.resolveProductImages(productImages, productImageFiles);
    let createdImages = [];
    if (images && images.length > 0) {
      createdImages = await this.productImageRepository.createBulkProductImage(
        images.map(({ url, thumbnailUrl }) => ({ url, thumbnailUrl, shopProductId: product.id }))
      );
    }

    let media = [];
    if (Array.isArray(mediaFiles) && mediaFiles.length > 0) {
      media = await this.productFileService.uploadMedia(product.id, userId, mediaFiles);
    }

    let createdVariations = [];
    if (variationPayloads && variationPayloads.length > 0) {
      createdVariations = await this.variationService.setVariations(
        product.id,
        variationPayloads,
        variationImages
      );
      await this.variationService.syncPricing(product.id);
      await product.reload();
    }

    const catIds = this.parseCategoryIds(categoryIds);
    let categories = [];
    if (catIds && catIds.length > 0) {
      await this.productRepository.addCategories(product.id, catIds);
      categories = await this.productRepository.listCategories(product.id);
    }

    return { product, productImages: createdImages, media, variations: createdVariations, categories };
  }

  async updateProduct(productId, userId, productData, files = {}) {
    const {
      media: mediaFiles = [],
      productImages: productImageFiles = [],
      variationImages = {},
    } = files;

    const {
      name,
      description,
      quantity,
      rating,
      pricing_type,
      price,
      min_price,
      max_price,
      tags,
      insured,
      moneyBack,
      support247,
      productImages,
      variations,
      categoryIds,
      hasVariations,
      desiredLikeCount,
      desiredViewCount,
      ratingAvg,
      ratingCount,
      status,
    } = productData;

    const product = await this.productRepository.getById(productId);
    await this.validateShopOwnership(product.shopId, userId);

    if (status !== undefined && !ALLOWED_STATUSES.includes(status)) {
      throw new CustomError(`Invalid status. Allowed: ${ALLOWED_STATUSES.join(", ")}.`, 422);
    }

    const variationPayloads = this.parseVariations(variations);
    const useVariations =
      hasVariations !== undefined ? parseBool(hasVariations) : product.hasVariations;
    const turningOff = product.hasVariations && !useVariations;
    const pricingGiven =
      pricing_type !== undefined || price !== undefined || min_price !== undefined || max_price !== undefined;

    if (turningOff) {
      if ((await this.variationService.countVariations(productId)) > 0) {
        throw new CustomError(
          "Delete this product's variations before turning hasVariations off.",
          422
        );
      }
      // the derived range dies with the variations, so a real price has to replace it
      if (!pricingGiven) {
        throw new CustomError(
          "Set a price for this product when turning hasVariations off.",
          422
        );
      }
    }

    // only enforced at the moment variations are switched on: a product that has been
    // emptied out by deleting its variations must stay editable
    if (!product.hasVariations && useVariations) {
      const count = variationPayloads
        ? variationPayloads.length
        : await this.variationService.countVariations(productId);
      if (count === 0) {
        throw new CustomError("A variation-based product needs at least one variation.", 422);
      }
    }
    if (!useVariations && variationPayloads && variationPayloads.length > 0) {
      throw new CustomError("Turn hasVariations on to give this product variations.", 422);
    }

    const data = {};
    if (name !== undefined) data.name = typeof name === "string" ? name.trim() : name;
    if (description !== undefined) data.description = description != null ? String(description).trim() : null;
    if (quantity !== undefined) data.quantity = Number(quantity);
    if (rating !== undefined) data.rating = Number(rating);
    if (tags !== undefined) data.tags = tags === null ? [] : parseTags(tags);
    if (insured !== undefined) data.insured = parseBool(insured);
    if (moneyBack !== undefined) data.moneyBack = parseBool(moneyBack);
    if (support247 !== undefined) data.support247 = parseBool(support247);
    if (hasVariations !== undefined) data.hasVariations = useVariations;
    if (status !== undefined) data.status = status;

    // pricing on a variation-based product is derived, so the body's pricing fields
    // are ignored there and syncPricing has the last word.
    // On the way out of variation mode the derived pricing is not a base to build on
    // — the leftover "range" would otherwise demand a min/max — so it resolves fresh.
    if (!useVariations && pricingGiven) {
      Object.assign(
        data,
        resolvePricing({ pricing_type, price, min_price, max_price }, turningOff ? null : product)
      );
    }

    // ── Base counts (admin-controlled boost) ────────────────────────────────
    if (desiredViewCount !== undefined) {
      if (!Number.isInteger(desiredViewCount) || desiredViewCount < 0) {
        throw new CustomError("desiredViewCount must be a non-negative integer.", 422);
      }
      const realViews = await this.productRepository.getViewsCount(productId);
      data.baseViewCount = Math.max(0, desiredViewCount - realViews);
    }

    if (desiredLikeCount !== undefined) {
      if (!Number.isInteger(desiredLikeCount) || desiredLikeCount < 0) {
        throw new CustomError("desiredLikeCount must be a non-negative integer.", 422);
      }
      const realLikes = await this.productRepository.getLikesCount(productId);
      data.baseLikeCount = Math.max(0, desiredLikeCount - realLikes);
    }

    if (ratingAvg !== undefined) {
      const v = Number(ratingAvg);
      if (Number.isNaN(v) || v < 0 || v > 10) {
        throw new CustomError("ratingAvg must be a number between 0 and 10.", 422);
      }
      data.ratingAvg = parseFloat(v.toFixed(2));
    }

    if (ratingCount !== undefined) {
      if (!Number.isInteger(Number(ratingCount)) || Number(ratingCount) < 0) {
        throw new CustomError("ratingCount must be a non-negative integer.", 422);
      }
      data.ratingCount = Number(ratingCount);
    }

    const updatedProduct = await this.productRepository.updateProduct(productId, data);

    // productImages: replace-all only when provided (omit to keep existing)
    const resolved = await this.resolveProductImages(productImages, productImageFiles);
    let images;
    if (resolved !== undefined) {
      await this.productImageRepository.bulkDeleteProductImagesByShopProductId(updatedProduct.id);
      images = resolved.length > 0
        ? await this.productImageRepository.createBulkProductImage(
            resolved.map(({ url, thumbnailUrl }) => ({
              url,
              thumbnailUrl,
              shopProductId: updatedProduct.id,
            }))
          )
        : [];
    }

    let media;
    if (Array.isArray(mediaFiles) && mediaFiles.length > 0) {
      media = await this.productFileService.uploadMedia(updatedProduct.id, userId, mediaFiles);
    }

    // variations: replace-all only when provided (omit to keep existing)
    if (variationPayloads !== undefined) {
      await this.variationService.setVariations(
        updatedProduct.id,
        variationPayloads,
        variationImages
      );
    }
    if (useVariations) {
      await this.variationService.syncPricing(updatedProduct.id);
    }

    // categories: replace-all only when provided (omit to keep existing)
    const catIds = this.parseCategoryIds(categoryIds);
    if (catIds !== undefined) {
      await this.productRepository.removeAllCategories(updatedProduct.id);
      if (catIds.length > 0) {
        await this.productRepository.addCategories(updatedProduct.id, catIds);
      }
    }

    const full = await this.productRepository.getById(updatedProduct.id);
    return { product: full, ...(images !== undefined && { productImages: images }), ...(media !== undefined && { media }) };
  }

  async deleteProduct(productId, userId) {
    const product = await this.productRepository.getById(productId);

    await this.validateShopOwnership(product.shopId, userId);

    return this.productRepository.deleteProduct(productId);
  }

  async getProductsByShop(shopId, userId) {
    await this.validateShopOwnership(shopId, userId);

    return this.productRepository.getByShopId(shopId);
  }

  async getProductById(productId, userId) {
    const product = await this.productRepository.getById(productId);

    await this.validateShopOwnership(product.shopId, userId);

    const json = product.toJSON();
    json.variationsSummary = this.variationService.summarize(json.variations || []);
    return attachEffectiveStatus(json);
  }

  async getPaginatedProducts(page, limit, name, shopId) {
    return this.productRepository.getPaginatedProducts(
      page,
      limit,
      name,
      shopId
    );
  }

  async getMyPaginatedProducts(userId, page, limit, name, shopId) {
    if (shopId) {
      await this.validateShopOwnership(shopId, userId);
    }

    const result = await this.productRepository.getMyPaginatedProducts(
      userId,
      page,
      limit,
      name,
      shopId
    );
    result.products = result.products.map((p) => attachEffectiveStatus(p.toJSON()));
    return result;
  }

  async getPublicProductsByShop(shopId) {
    const shop = await Shop.findByPk(shopId);
    if (!shop) throw new CustomError("Shop not found", 404);

    const products = await this.productRepository.getPublicByShopId(shopId);
    return products.map((p) => attachEffectiveStatus(p.toJSON()));
  }

  async getPublicProductById(productId, userId) {
    const product = await this.productRepository.getPublicById(productId);
    const json = product.toJSON();
    json.variationsSummary = this.variationService.summarize(json.variations || []);
    json.isLike = userId
      ? await this.productRepository.hasUserLiked(userId, json.id)
      : false;
    return attachEffectiveStatus(json);
  }

  async incrementViewCount(productId) {
    return this.productRepository.incrementViewCount(productId);
  }

  async getPublicPaginatedProducts(page, limit, name, shopId, userId) {
    const result = await this.productRepository.getPublicPaginatedProducts(
      page,
      limit,
      name,
      shopId
    );
    const products = result.products.map((p) => p.toJSON());

    const likedIds = userId
      ? await this.productRepository.getLikedProductIds(
          userId,
          products.map((p) => p.id)
        )
      : new Set();

    result.products = products.map((p) => {
      p.isLike = likedIds.has(p.id);
      return attachEffectiveStatus(p);
    });
    return result;
  }

  // ── Likes ────────────────────────────────────────────────────────────────

  async likeProduct(userId, productId) {
    await this.productRepository.getById(productId);
    return this.productRepository.likeProduct(userId, productId);
  }

  async unlikeProduct(userId, productId) {
    return this.productRepository.unlikeProduct(userId, productId);
  }

  async getLikesCount(productId) {
    const product = await this.productRepository.getById(productId);
    const count = await this.productRepository.getLikesCount(productId);
    return (product.baseLikeCount || 0) + count;
  }

  async hasUserLiked(userId, productId) {
    return this.productRepository.hasUserLiked(userId, productId);
  }

  // ── Views ────────────────────────────────────────────────────────────────

  async recordView(userId, productId) {
    return this.productRepository.recordView(userId, productId);
  }

  async getViewsCount(productId) {
    const product = await this.productRepository.getById(productId);
    const count = await this.productRepository.getViewsCount(productId);
    return (product.baseViewCount || 0) + count;
  }

  // ── Ratings (per-user 0-10) ──────────────────────────────────────────────

  async rateProduct(userId, productId, rating, comment) {
    await this.productRepository.getById(productId);
    const value = Number(rating);
    if (!Number.isInteger(value) || value < 0 || value > 10) {
      throw new CustomError("rating must be an integer between 0 and 10.", 422);
    }
    return sequelize.transaction((t) =>
      this.productRepository.upsertRating(userId, productId, value, comment, t)
    );
  }

  async deleteRating(userId, productId) {
    await this.productRepository.getById(productId);
    return sequelize.transaction((t) =>
      this.productRepository.deleteRating(userId, productId, t)
    );
  }

  // ── Categories ────────────────────────────────────────────────────────────

  async listCategories(productId) {
    await this.productRepository.getById(productId);
    return this.productRepository.listCategories(productId);
  }

  async addCategories(productId, userId, categoryIds) {
    const product = await this.productRepository.getById(productId);
    await this.validateShopOwnership(product.shopId, userId);

    const ids = this.parseCategoryIds(categoryIds);
    if (!ids || ids.length === 0) {
      throw new CustomError("categoryIds must be a non-empty array.", 422);
    }

    const added = await this.productRepository.addCategories(productId, ids);
    return { addedCategoryIds: added };
  }

  async removeCategory(productId, userId, categoryId) {
    const product = await this.productRepository.getById(productId);
    await this.validateShopOwnership(product.shopId, userId);

    const removed = await this.productRepository.removeCategory(productId, categoryId);
    if (!removed) {
      throw new CustomError("Category is not assigned to this product", 404);
    }
    return true;
  }

  // ── Admin badges ──────────────────────────────────────────────────────────

  async updateBadges(productId, { isTopChoice, isQRMVerified }) {
    const data = {};
    if (isTopChoice !== undefined) data.isTopChoice = parseBool(isTopChoice);
    if (isQRMVerified !== undefined) data.isQRMVerified = parseBool(isQRMVerified);
    if (Object.keys(data).length === 0) {
      throw new CustomError("Provide isTopChoice and/or isQRMVerified.", 422);
    }

    const product = await this.productRepository.updateBadges(productId, data);
    if (!product) throw new CustomError("Product not found", 404);
    return product;
  }
}

module.exports = ShopProductService;
