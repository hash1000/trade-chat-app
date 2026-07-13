const ProductVariationService = require("../services/ProductVariationService");
const variationService = new ProductVariationService();

function handle(res, error, context) {
  console.error(context, error);
  return res
    .status(error.statusCode || 500)
    .json({ success: false, error: error.message || "Server error. Please try again later." });
}

class ShopProductVariationController {
  async listVariations(req, res) {
    try {
      const { productId } = req.params;
      const variations = await variationService.listVariations(Number(productId));
      return res.json({
        success: true,
        data: {
          variations,
          summary: variationService.summarize(variations),
        },
      });
    } catch (error) {
      return handle(res, error, "ShopProductVariationController.listVariations error:");
    }
  }

  async createVariation(req, res) {
    try {
      const { productId } = req.params;
      const { id: userId } = req.user;
      const variation = await variationService.createVariation(Number(productId), userId, req.body);
      return res.status(201).json({ success: true, data: variation });
    } catch (error) {
      return handle(res, error, "ShopProductVariationController.createVariation error:");
    }
  }

  async updateVariation(req, res) {
    try {
      const { productId, variationId } = req.params;
      const { id: userId } = req.user;
      const variation = await variationService.updateVariation(
        Number(productId),
        Number(variationId),
        userId,
        req.body
      );
      return res.json({ success: true, data: variation });
    } catch (error) {
      return handle(res, error, "ShopProductVariationController.updateVariation error:");
    }
  }

  async deleteVariation(req, res) {
    try {
      const { productId, variationId } = req.params;
      const { id: userId } = req.user;
      await variationService.deleteVariation(Number(productId), Number(variationId), userId);
      return res.json({ success: true, message: "Variation deleted." });
    } catch (error) {
      return handle(res, error, "ShopProductVariationController.deleteVariation error:");
    }
  }
}

module.exports = ShopProductVariationController;
