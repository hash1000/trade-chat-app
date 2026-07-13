const { ShopProduct, ProductVariation, ProductVariationImage, Shop } = require("../models");
const CustomError = require("../errors/CustomError");

const ALLOWED_UNITS = ["per_piece", "per_unit", "per_m3", "per_m2", "per_carton", "per_ton"];

function parseBool(value, fallback) {
  if (value === undefined) return fallback;
  return value === true || value === "true" || value === 1 || value === "1";
}

function parseImages(raw) {
  if (raw === undefined || raw === null) return undefined;
  let arr = raw;
  if (typeof arr === "string") {
    try {
      arr = JSON.parse(arr);
    } catch {
      throw new CustomError("variation images must be an array.", 422);
    }
  }
  if (!Array.isArray(arr)) {
    throw new CustomError("variation images must be an array.", 422);
  }
  return arr
    .map((item) => (typeof item === "string" ? item : item && item.url))
    .filter((url) => typeof url === "string" && url.length > 0);
}

// Normalizes one variation payload; `existing` supplies fallbacks on update
function normalizeVariation(raw, existing = null) {
  const name = raw.name !== undefined ? String(raw.name).trim() : existing?.name;
  if (!name) throw new CustomError("Variation name is required.", 422);

  const unit = raw.unit !== undefined ? raw.unit : existing?.unit ?? "per_piece";
  if (!ALLOWED_UNITS.includes(unit)) {
    throw new CustomError(`Invalid unit. Allowed: ${ALLOWED_UNITS.join(", ")}.`, 422);
  }

  const price = raw.price !== undefined ? Number(raw.price) : existing ? Number(existing.price) : undefined;
  if (price === undefined || Number.isNaN(price) || price <= 0) {
    throw new CustomError("Variation price must be a number greater than 0.", 422);
  }

  const intField = (value, fallback, label, min = 0) => {
    if (value === undefined) return fallback;
    const n = Number(value);
    if (!Number.isInteger(n) || n < min) {
      throw new CustomError(`${label} must be an integer >= ${min}.`, 422);
    }
    return n;
  };

  return {
    name,
    sizeSpec: raw.sizeSpec !== undefined ? (raw.sizeSpec != null ? String(raw.sizeSpec).trim() : null) : existing?.sizeSpec ?? null,
    unit,
    price,
    inStock: parseBool(raw.inStock, existing ? existing.inStock : true),
    stock: intField(raw.stock, existing ? existing.stock : 0, "stock"),
    stockMinOrder: intField(raw.stockMinOrder, existing ? existing.stockMinOrder : 1, "stockMinOrder", 1),
    byOrder: parseBool(raw.byOrder, existing ? existing.byOrder : false),
    byOrderMinOrder: intField(raw.byOrderMinOrder, existing ? existing.byOrderMinOrder : 1, "byOrderMinOrder", 1),
    sortOrder: intField(raw.sortOrder, existing ? existing.sortOrder : 0, "sortOrder"),
  };
}

class ProductVariationService {
  async assertProduct(productId) {
    const product = await ShopProduct.findByPk(productId);
    if (!product) throw new CustomError("Product not found", 404);
    return product;
  }

  async assertOwner(product, userId) {
    const shop = await Shop.findByPk(product.shopId);
    if (!shop || shop.userId !== userId) {
      throw new CustomError("Forbidden. Only the shop owner can manage variations.", 403);
    }
  }

  async listVariations(productId) {
    await this.assertProduct(productId);
    return ProductVariation.findAll({
      where: { shopProductId: productId },
      include: [{ model: ProductVariationImage, as: "images" }],
      order: [["sortOrder", "ASC"], ["id", "ASC"]],
    });
  }

  async getVariation(variationId) {
    const variation = await ProductVariation.findByPk(variationId, {
      include: [{ model: ProductVariationImage, as: "images" }],
    });
    if (!variation) throw new CustomError("Variation not found", 404);
    return variation;
  }

  async createVariation(productId, userId, payload) {
    const product = await this.assertProduct(productId);
    await this.assertOwner(product, userId);

    const data = normalizeVariation(payload);
    const variation = await ProductVariation.create({ ...data, shopProductId: productId });

    const imageUrls = parseImages(payload.images);
    if (imageUrls && imageUrls.length > 0) {
      await ProductVariationImage.bulkCreate(
        imageUrls.map((url) => ({ url, productVariationId: variation.id }))
      );
    }

    return this.getVariation(variation.id);
  }

  async updateVariation(productId, variationId, userId, payload) {
    const product = await this.assertProduct(productId);
    await this.assertOwner(product, userId);

    const variation = await ProductVariation.findOne({
      where: { id: variationId, shopProductId: productId },
    });
    if (!variation) throw new CustomError("Variation not found", 404);

    const data = normalizeVariation(payload, variation);
    await variation.update(data);

    // images: replace-all only when provided
    const imageUrls = parseImages(payload.images);
    if (imageUrls !== undefined) {
      await ProductVariationImage.destroy({ where: { productVariationId: variation.id } });
      if (imageUrls.length > 0) {
        await ProductVariationImage.bulkCreate(
          imageUrls.map((url) => ({ url, productVariationId: variation.id }))
        );
      }
    }

    return this.getVariation(variation.id);
  }

  async deleteVariation(productId, variationId, userId) {
    const product = await this.assertProduct(productId);
    await this.assertOwner(product, userId);

    const deleted = await ProductVariation.destroy({
      where: { id: variationId, shopProductId: productId },
    });
    if (!deleted) throw new CustomError("Variation not found", 404);
    return true;
  }

  // Replace-all, used when `variations` array comes inline on product create/update.
  // Ownership must already be verified by the caller.
  async setVariations(productId, variationPayloads) {
    await ProductVariation.destroy({ where: { shopProductId: productId } });

    const created = [];
    for (let i = 0; i < variationPayloads.length; i++) {
      const payload = variationPayloads[i];
      const data = normalizeVariation(payload);
      if (payload.sortOrder === undefined) data.sortOrder = i;

      const variation = await ProductVariation.create({ ...data, shopProductId: productId });

      const imageUrls = parseImages(payload.images);
      if (imageUrls && imageUrls.length > 0) {
        await ProductVariationImage.bulkCreate(
          imageUrls.map((url) => ({ url, productVariationId: variation.id }))
        );
      }
      created.push(variation);
    }
    return created;
  }

  // Mock's "Variations summary" block: totals + price range + stock value
  summarize(variations) {
    const totalVariations = variations.length;
    const totalQuantity = variations.reduce((sum, v) => sum + (v.stock || 0), 0);
    const prices = variations.map((v) => Number(v.price)).filter((p) => !Number.isNaN(p));
    const totalStockValue = variations.reduce(
      (sum, v) => sum + Number(v.price || 0) * (v.stock || 0),
      0
    );
    return {
      totalVariations,
      totalQuantity,
      minPrice: prices.length ? Math.min(...prices) : null,
      maxPrice: prices.length ? Math.max(...prices) : null,
      totalStockValue,
    };
  }
}

module.exports = ProductVariationService;
