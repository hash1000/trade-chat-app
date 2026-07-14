const { ShopProduct, ProductVariation, ProductVariationImage, Shop } = require("../models");
const ProductFileService = require("./ProductFileService");
const CustomError = require("../errors/CustomError");

const productFileService = new ProductFileService();

const ALLOWED_UNITS = ["per_piece", "per_unit", "per_m3", "per_m2", "per_carton", "per_ton"];

function parseBool(value, fallback) {
  if (value === undefined) return fallback;
  return value === true || value === "true" || value === 1 || value === "1";
}

function parseImages(raw) {
  if (raw === undefined || raw === null) return undefined;
  let arr = raw;
  if (typeof arr === "string") {
    const trimmed = arr.trim();
    // multipart delivers a repeated field as a bare string, not JSON
    if (trimmed.startsWith("[")) {
      try {
        arr = JSON.parse(trimmed);
      } catch {
        throw new CustomError("variation images must be an array.", 422);
      }
    } else {
      arr = [trimmed];
    }
  }
  if (!Array.isArray(arr)) {
    throw new CustomError("variation images must be an array.", 422);
  }
  return arr
    .map((item) => (typeof item === "string" ? item : item && item.url))
    .filter((url) => typeof url === "string" && url.length > 0);
}

// Uploaded files are appended after any URLs in the payload, so the two can be
// mixed. Uploads get a generated thumbnail; a passed-through URL gets null.
// Returns undefined when neither was supplied — meaning "leave images alone".
async function resolveImages(rawImages, files = []) {
  const urls = parseImages(rawImages);
  if (urls === undefined && files.length === 0) return undefined;

  const uploaded = await productFileService.uploadImages(files);
  const passthrough = (urls ?? []).map((url) => ({ url, thumbnailUrl: null }));

  return [...passthrough, ...uploaded];
}

const imageRows = (images, productVariationId) =>
  images.map(({ url, thumbnailUrl }) => ({ url, thumbnailUrl, productVariationId }));

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

  async countVariations(productId) {
    return ProductVariation.count({ where: { shopProductId: productId } });
  }

  // A variation-based product holds no price of its own — it is derived from the
  // variations: one variation reads as that fixed price, several as a range.
  // Must run after any change to a variation's price.
  async syncPricing(productId) {
    const product = await this.assertProduct(productId);
    if (!product.hasVariations) return product;

    const variations = await ProductVariation.findAll({
      where: { shopProductId: productId },
      attributes: ["price"],
    });
    const prices = variations
      .map((v) => Number(v.price))
      .filter((p) => !Number.isNaN(p));

    if (prices.length === 1) {
      return product.update({
        pricing_type: "fixed",
        price: prices[0],
        min_price: null,
        max_price: null,
      });
    }

    return product.update({
      pricing_type: "range",
      price: 0,
      min_price: prices.length ? Math.min(...prices) : null,
      max_price: prices.length ? Math.max(...prices) : null,
    });
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

  async createVariation(productId, userId, payload, files = []) {
    const product = await this.assertProduct(productId);
    await this.assertOwner(product, userId);

    if (!product.hasVariations) {
      throw new CustomError(
        "This product is not variation-based. Turn hasVariations on before adding variations.",
        422
      );
    }

    const data = normalizeVariation(payload);
    const variation = await ProductVariation.create({ ...data, shopProductId: productId });

    const images = await resolveImages(payload.images, files);
    if (images && images.length > 0) {
      await ProductVariationImage.bulkCreate(imageRows(images, variation.id));
    }

    await this.syncPricing(productId);
    return this.getVariation(variation.id);
  }

  async updateVariation(productId, variationId, userId, payload, files = []) {
    const product = await this.assertProduct(productId);
    await this.assertOwner(product, userId);

    const variation = await ProductVariation.findOne({
      where: { id: variationId, shopProductId: productId },
    });
    if (!variation) throw new CustomError("Variation not found", 404);

    const data = normalizeVariation(payload, variation);
    await variation.update(data);

    // images: replace-all only when provided (as URLs, uploaded files, or both)
    const images = await resolveImages(payload.images, files);
    if (images !== undefined) {
      await ProductVariationImage.destroy({ where: { productVariationId: variation.id } });
      if (images.length > 0) {
        await ProductVariationImage.bulkCreate(imageRows(images, variation.id));
      }
    }

    await this.syncPricing(productId);
    return this.getVariation(variation.id);
  }

  async deleteVariation(productId, variationId, userId) {
    const product = await this.assertProduct(productId);
    await this.assertOwner(product, userId);

    const variation = await ProductVariation.findOne({
      where: { id: variationId, shopProductId: productId },
    });
    if (!variation) throw new CustomError("Variation not found", 404);

    // Deleting the last one is allowed: it leaves the product variation-based but
    // priceless, which is how a creator gets back to a plain single product — clear
    // the variations, then turn hasVariations off with a price.
    await variation.destroy();
    await this.syncPricing(productId);
    return true;
  }

  // Replace-all, used when `variations` array comes inline on product create/update.
  // Ownership must already be verified by the caller.
  // variationFiles maps a variation's index in variationPayloads to the files
  // uploaded for it as variation_images_<i> — that index is the only link a flat
  // multipart body gives us back to the nested variations array.
  async setVariations(productId, variationPayloads, variationFiles = {}) {
    await ProductVariation.destroy({ where: { shopProductId: productId } });

    const created = [];
    for (let i = 0; i < variationPayloads.length; i++) {
      const payload = variationPayloads[i];
      const data = normalizeVariation(payload);
      if (payload.sortOrder === undefined) data.sortOrder = i;

      const variation = await ProductVariation.create({ ...data, shopProductId: productId });

      const images = await resolveImages(payload.images, variationFiles[i] ?? []);
      if (images && images.length > 0) {
        await ProductVariationImage.bulkCreate(imageRows(images, variation.id));
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
