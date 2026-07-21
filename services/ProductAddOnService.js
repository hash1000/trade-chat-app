const { ShopProduct, ProductVariation, ProductAddOn, Shop } = require("../models");
const CustomError = require("../errors/CustomError");

// Normalizes one add-on payload; `existing` supplies fallbacks on partial update.
function normalizeAddOn(raw, existing = null) {
  const name = raw.name !== undefined ? String(raw.name).trim() : existing?.name;
  if (!name) throw new CustomError("Add-on name is required.", 422);

  const price = raw.price !== undefined ? Number(raw.price) : existing ? Number(existing.price) : undefined;
  if (price === undefined || Number.isNaN(price) || price < 0) {
    throw new CustomError("Add-on price must be a non-negative number.", 422);
  }

  const stock =
    raw.stock !== undefined ? Number(raw.stock) : existing ? Number(existing.stock) : 0;
  if (!Number.isInteger(stock) || stock < 0) {
    throw new CustomError("Add-on stock must be an integer >= 0.", 422);
  }

  return {
    name,
    description:
      raw.description !== undefined
        ? raw.description != null
          ? String(raw.description).trim()
          : null
        : existing?.description ?? null,
    price,
    image:
      raw.image !== undefined ? (raw.image != null ? String(raw.image).trim() : null) : existing?.image ?? null,
    stock,
    isActive:
      raw.isActive !== undefined
        ? raw.isActive === true || raw.isActive === "true" || raw.isActive === 1 || raw.isActive === "1"
        : existing ? existing.isActive : true,
  };
}

class ProductAddOnService {
  async assertProduct(productId) {
    const product = await ShopProduct.findByPk(productId);
    if (!product) throw new CustomError("Product not found", 404);
    return product;
  }

  async assertOwner(product, userId) {
    const shop = await Shop.findByPk(product.shopId);
    if (!shop || shop.userId !== userId) {
      throw new CustomError("Forbidden. Only the shop owner can manage add-ons.", 403);
    }
  }

  async assertVariation(productId, variationId) {
    const variation = await ProductVariation.findOne({
      where: { id: variationId, shopProductId: productId },
    });
    if (!variation) throw new CustomError("Variation not found for this product.", 404);
    return variation;
  }

  // ── Product-level add-ons (hasVariations: false) ────────────────────────

  async listProductAddOns(productId) {
    await this.assertProduct(productId);
    return ProductAddOn.findAll({ where: { shopProductId: productId }, order: [["id", "ASC"]] });
  }

  async createProductAddOn(productId, userId, payload) {
    const product = await this.assertProduct(productId);
    await this.assertOwner(product, userId);

    if (product.hasVariations) {
      throw new CustomError(
        "This product is variation-based. Add-ons belong to individual variations — use POST /:productId/variations/:variationId/add-ons instead.",
        422
      );
    }

    const data = normalizeAddOn(payload);
    return ProductAddOn.create({ ...data, shopProductId: productId, variationId: null });
  }

  // ── Variation-level add-ons (hasVariations: true) ───────────────────────

  async listVariationAddOns(productId, variationId) {
    await this.assertProduct(productId);
    await this.assertVariation(productId, variationId);
    return ProductAddOn.findAll({ where: { variationId }, order: [["id", "ASC"]] });
  }

  async createVariationAddOn(productId, variationId, userId, payload) {
    const product = await this.assertProduct(productId);
    await this.assertOwner(product, userId);

    if (!product.hasVariations) {
      throw new CustomError(
        "This product is not variation-based. Use POST /:productId/add-ons for a product-level add-on instead.",
        422
      );
    }
    await this.assertVariation(productId, variationId);

    const data = normalizeAddOn(payload);
    return ProductAddOn.create({ ...data, shopProductId: null, variationId });
  }

  // ── Shared update/delete (works for either scope) ───────────────────────

  async getAddOnOrFail(addOnId) {
    const addOn = await ProductAddOn.findByPk(addOnId);
    if (!addOn) throw new CustomError("Add-on not found", 404);
    return addOn;
  }

  // Resolves the owning product regardless of whether the add-on is
  // product-scoped or variation-scoped.
  async _ownerOfAddOn(addOn) {
    if (addOn.shopProductId) {
      return this.assertProduct(addOn.shopProductId);
    }
    const variation = await ProductVariation.findByPk(addOn.variationId);
    if (!variation) throw new CustomError("Product not found", 404);
    return this.assertProduct(variation.shopProductId);
  }

  async updateAddOn(addOnId, userId, payload) {
    const addOn = await this.getAddOnOrFail(addOnId);
    const product = await this._ownerOfAddOn(addOn);
    await this.assertOwner(product, userId);

    const data = normalizeAddOn(payload, addOn);
    await addOn.update(data);
    return addOn;
  }

  async deleteAddOn(addOnId, userId) {
    const addOn = await this.getAddOnOrFail(addOnId);
    const product = await this._ownerOfAddOn(addOn);
    await this.assertOwner(product, userId);

    await addOn.destroy();
    return true;
  }
}

module.exports = ProductAddOnService;
