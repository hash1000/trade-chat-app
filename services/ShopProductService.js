const ShopProductRepository = require("../repositories/ShopProductRepository");
const Shop = require("../models/shop");
const CustomError = require("../errors/CustomError");

class ShopProductService {
  constructor() {
    this.productRepository = new ShopProductRepository();
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

  async createProduct(userId, productData) {
    const shop = await Shop.findByPk(productData.shopId);
    if (!shop) throw new CustomError("Shop not found", 404);

    if (shop.userId !== userId) {
      throw new CustomError("Unauthorized", 403);
    }

    return this.productRepository.createProduct(productData);
  }

  async updateProduct(productId, userId, productData) {
    const product = await this.productRepository.getById(productId);

    await this.validateShopOwnership(product.shopId, userId);

    return this.productRepository.updateProduct(productId, productData);
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

    return product;
  }

  async getPaginatedProducts(page, limit, name, shopId) {
    return this.productRepository.getPaginatedProducts(
      page,
      limit,
      name,
      shopId
    );
  }
}

module.exports = ShopProductService;
