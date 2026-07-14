const ShopProductService = require("../services/ShopProductService");
const { groupProductFiles } = require("../utilities/productFileMulter");

const productService = new ShopProductService();

class ShopProductController {
  async createProduct(req, res) {
    try {
      const { id: userId } = req.user;
      const product = await productService.createProduct(
        userId,
        req.body,
        groupProductFiles(req.files)
      );

      return res.status(201).json({
        success: true,
        message: "shop product created successfully",
        data: product,
      });
    } catch (error) {
      console.error("ShopProductController.createProduct error:", error);
      return res
        .status(error.statusCode || 500)
        .json({ message: error.message });
    }
  }

  async updateProduct(req, res) {
    try {
      const { productId } = req.params;
      const { id: userId } = req.user;

      const product = await productService.updateProduct(
        productId,
        userId,
        req.body,
        groupProductFiles(req.files)
      );

      return res.json(product);
    } catch (error) {
      console.error("ShopProductController.updateProduct error:", error);
      return res
        .status(error.statusCode || 500)
        .json({ message: error.message });
    }
  }

  async deleteProduct(req, res) {
    try {
      const { productId } = req.params;
      const { id: userId } = req.user;

      await productService.deleteProduct(productId, userId);
      return res.json({ message: "Product deleted successfully" });
    } catch (error) {
      return res
        .status(error.statusCode || 500)
        .json({ message: error.message });
    }
  }

  async getProductsByShop(req, res) {
    try {
      const { shopId } = req.params;
      const { id: userId } = req.user;

      const products = await productService.getProductsByShop(shopId, userId);
      return res.json({
        status: true,
        message: "Successfully fetched product",
        data: products,
      });
    } catch (error) {
      return res
        .status(error.statusCode || 500)
        .json({ message: error.message });
    }
  }

  async getProductById(req, res) {
    try {
      const { productId } = req.params;
      const { id: userId } = req.user;

      const product = await productService.getProductById(productId, userId);
      // fire-and-forget — never throws, never delays response
      productService.recordView(userId, Number(productId)).catch(() => {});
      return res.json({
        status: true,
        message: "Successfully fetched product",
        data: product,
      });
    } catch (error) {
      return res
        .status(error.statusCode || 500)
        .json({ message: error.message });
    }
  }

  async getPaginatedProducts(req, res) {
    try {
      console.log("Fetching paginated products");
      const { page = 1, limit = 10, name, shopId } = req.query;
      const products = await productService.getPaginatedProducts(
        page,
        limit,
        name,
        shopId
      );
      return res.json({
        status: true,
        message: "Successfully fetched  products",
        data: products,
      });
    } catch (error) {
      return res.status(500).json({ message: "Failed to list products" });
    }
  }

  async getMyProducts(req, res) {
    try {
      const { id: userId } = req.user;
      const { page = 1, limit = 10, name, shopId } = req.query;

      const products = await productService.getMyPaginatedProducts(
        userId,
        page,
        limit,
        name,
        shopId
      );

      return res.json({
        status: true,
        message: "Successfully fetched products",
        data: products,
      });
    } catch (error) {
      console.error("ShopProductController.getMyProducts error:", error);
      return res
        .status(error.statusCode || 500)
        .json({ message: error.message || "Failed to list products" });
    }
  }

  async getPublicProductsByShop(req, res) {
    try {
      const { shopId } = req.params;
      const products = await productService.getPublicProductsByShop(shopId);

      return res.json({
        success: true,
        message: "Successfully fetched products",
        data: products,
      });
    } catch (error) {
      return res
        .status(error.statusCode || 500)
        .json({ message: error.message || "Failed to fetch products" });
    }
  }

  async getPublicProductById(req, res) {
    try {
      const { productId } = req.params;
      const product = await productService.getPublicProductById(productId);

      return res.json({
        success: true,
        message: "Successfully fetched product",
        data: product,
      });
    } catch (error) {
      return res
        .status(error.statusCode || 500)
        .json({ message: error.message || "Failed to fetch product" });
    }
  }

  async getPublicPaginatedProducts(req, res) {
    try {
      const { page = 1, limit = 10, name, shopId } = req.query;
      const products = await productService.getPublicPaginatedProducts(
        page,
        limit,
        name,
        shopId
      );

      return res.json({
        success: true,
        message: "Successfully fetched products",
        data: products,
      });
    } catch (error) {
      return res.status(500).json({ message: "Failed to list products" });
    }
  }

  // ── Likes ────────────────────────────────────────────────────────────────

  async likeProduct(req, res) {
    try {
      const { id: userId } = req.user;
      const { productId } = req.params;
      const { created } = await productService.likeProduct(userId, Number(productId));
      return res.status(created ? 201 : 200).json({
        success: true,
        message: created ? "Product liked" : "Product already liked",
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  }

  async unlikeProduct(req, res) {
    try {
      const { id: userId } = req.user;
      const { productId } = req.params;
      const removed = await productService.unlikeProduct(userId, Number(productId));
      if (!removed) {
        return res.status(404).json({ success: false, message: "You have not liked this product" });
      }
      return res.json({ success: true, message: "Product unliked" });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  }

  async getLikesCount(req, res) {
    try {
      const { productId } = req.params;
      const likes = await productService.getLikesCount(Number(productId));
      return res.json({ success: true, data: { likes } });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  }

  async checkUserLiked(req, res) {
    try {
      const { id: userId } = req.user;
      const { productId } = req.params;
      const liked = await productService.hasUserLiked(userId, Number(productId));
      return res.json({ success: true, data: { liked } });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  }

  // ── Views ────────────────────────────────────────────────────────────────

  async getViewsCount(req, res) {
    try {
      const { productId } = req.params;
      const views = await productService.getViewsCount(Number(productId));
      return res.json({ success: true, data: { views } });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  }

  // ── Ratings (per-user 0-10) ──────────────────────────────────────────────

  async rateProduct(req, res) {
    try {
      const { id: userId } = req.user;
      const { productId } = req.params;
      const { rating, comment } = req.body;
      await productService.rateProduct(userId, Number(productId), rating, comment);
      return res.status(201).json({ success: true, message: "Rating saved" });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  }

  async deleteRating(req, res) {
    try {
      const { id: userId } = req.user;
      const { productId } = req.params;
      const removed = await productService.deleteRating(userId, Number(productId));
      if (!removed) {
        return res.status(404).json({ success: false, message: "You have not rated this product" });
      }
      return res.json({ success: true, message: "Rating removed" });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  }

  // ── Categories ────────────────────────────────────────────────────────────

  // Public — buyers browse a product's categories
  async listCategories(req, res) {
    try {
      const { productId } = req.params;
      const categories = await productService.listCategories(Number(productId));
      return res.json({ success: true, data: categories });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  }

  async addCategories(req, res) {
    try {
      const { productId } = req.params;
      const { id: userId } = req.user;
      const categoryIds =
        req.body.categoryIds ?? (req.body.categoryId !== undefined ? [req.body.categoryId] : undefined);

      const result = await productService.addCategories(Number(productId), userId, categoryIds);
      return res.status(201).json({ success: true, message: "Categories assigned to product", data: result });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  }

  async removeCategory(req, res) {
    try {
      const { productId, categoryId } = req.params;
      const { id: userId } = req.user;

      await productService.removeCategory(Number(productId), userId, Number(categoryId));
      return res.json({ success: true, message: "Category removed from product" });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  }

  // ── Admin badges ──────────────────────────────────────────────────────────

  async updateBadges(req, res) {
    try {
      const { productId } = req.params;
      const { isTopChoice, isQRMVerified } = req.body;
      const product = await productService.updateBadges(Number(productId), { isTopChoice, isQRMVerified });
      return res.json({ success: true, message: "Badges updated", data: product });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  }
}

module.exports = ShopProductController;
