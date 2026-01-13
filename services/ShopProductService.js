const ShopProductRepository = require("../repositories/ShopProductRepository");
const ProductImageRepository = require("../repositories/ProductImageRepository");
const Shop = require("../models/shop");
const CustomError = require("../errors/CustomError");
const sequelize = require("../config/database");

class ShopProductService {
  constructor() {
    this.productRepository = new ShopProductRepository();
    this.productImageRepository = new ProductImageRepository();
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
    const { productImages, ...data } = productData;

    const shop = await Shop.findByPk(productData.shopId);
    if (!shop) throw new CustomError("Shop not found", 404);

    if (shop.userId !== userId) {
      throw new CustomError("Unauthorized", 403);
    }

    // Create product without a transaction
    const product = await this.productRepository.createProduct(data);

    // Prepare image data
    const productImageData = productImages.map((u) => ({
      url: u.url,
      shopProductId: product.id,
    }));

    // Create product images without a transaction
    const productImage =
      await this.productImageRepository.createBulkProductImage(
        productImageData
      );

    // Return the product and associated images
    return { product, productImages: productImage };
  }

  async updateProduct(productId, userId, productData) {
    const { productImages, ...data } = productData;
    const product = await this.productRepository.getById(productId);

    await this.validateShopOwnership(product.shopId, userId);

    const updateproduct = await this.productRepository.updateProduct(
      productId,
      data
    );

    await this.productImageRepository.bulkDeleteProductImagesByShopProductId(
      updateproduct.id
    );

    const productImageData = productImages.map((u) => ({
      url: u.url,
      shopProductId: updateproduct.id,
    }));

    const newProductImage = await this.productImageRepository.createBulkProductImage(productImageData);

    return { updateproduct, newProductImage };
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
