const ProductAddOnService = require("../services/ProductAddOnService");
const addOnService = new ProductAddOnService();

function handle(res, error, context) {
  console.error(context, error);
  return res
    .status(error.statusCode || 500)
    .json({ success: false, error: error.message || "Server error. Please try again later." });
}

class ShopProductAddOnController {
  // ── Product-level (hasVariations: false) ─────────────────────────────────

  async listProductAddOns(req, res) {
    try {
      const { productId } = req.params;
      const addOns = await addOnService.listProductAddOns(Number(productId));
      return res.json({ success: true, data: addOns });
    } catch (error) {
      return handle(res, error, "ShopProductAddOnController.listProductAddOns error:");
    }
  }

  async createProductAddOn(req, res) {
    try {
      const { productId } = req.params;
      const { id: userId } = req.user;
      const addOn = await addOnService.createProductAddOn(Number(productId), userId, req.body, req.files ?? []);
      return res.status(201).json({ success: true, data: addOn });
    } catch (error) {
      return handle(res, error, "ShopProductAddOnController.createProductAddOn error:");
    }
  }

  // ── Variation-level (hasVariations: true) ────────────────────────────────

  async listVariationAddOns(req, res) {
    try {
      const { productId, variationId } = req.params;
      const addOns = await addOnService.listVariationAddOns(Number(productId), Number(variationId));
      return res.json({ success: true, data: addOns });
    } catch (error) {
      return handle(res, error, "ShopProductAddOnController.listVariationAddOns error:");
    }
  }

  async createVariationAddOn(req, res) {
    try {
      const { productId, variationId } = req.params;
      const { id: userId } = req.user;
      const addOn = await addOnService.createVariationAddOn(
        Number(productId),
        Number(variationId),
        userId,
        req.body,
        req.files ?? []
      );
      return res.status(201).json({ success: true, data: addOn });
    } catch (error) {
      return handle(res, error, "ShopProductAddOnController.createVariationAddOn error:");
    }
  }

  // ── Shared update/delete ──────────────────────────────────────────────────

  async updateAddOn(req, res) {
    try {
      const { addOnId } = req.params;
      const { id: userId } = req.user;
      const addOn = await addOnService.updateAddOn(Number(addOnId), userId, req.body, req.files ?? []);
      return res.json({ success: true, data: addOn });
    } catch (error) {
      return handle(res, error, "ShopProductAddOnController.updateAddOn error:");
    }
  }

  async deleteAddOn(req, res) {
    try {
      const { addOnId } = req.params;
      const { id: userId } = req.user;
      await addOnService.deleteAddOn(Number(addOnId), userId);
      return res.json({ success: true, message: "Add-on deleted." });
    } catch (error) {
      return handle(res, error, "ShopProductAddOnController.deleteAddOn error:");
    }
  }

  async deleteAddOnImage(req, res) {
    try {
      const { imageId } = req.params;
      const { id: userId } = req.user;
      await addOnService.deleteAddOnImage(Number(imageId), userId);
      return res.json({ success: true, message: "Image deleted." });
    } catch (error) {
      return handle(res, error, "ShopProductAddOnController.deleteAddOnImage error:");
    }
  }
}

module.exports = ShopProductAddOnController;
