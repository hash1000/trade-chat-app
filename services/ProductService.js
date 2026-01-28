const ProductRepository = require("../repositories/ProductRepository");
const ProductImageRepository = require("../repositories/ProductImageRepository");

class ProductService {
  constructor() {
    this.productRepository = new ProductRepository();
    this.productImageRepository = new ProductImageRepository();
  }

  async createProduct(userId, productData) {
    const {}= productData
    const product=  this.productRepository.createProduct({
      ...productData,
      userId,
    });

    await this.productImageRepository(productData)

    return product
  }

  async updateProduct(productId, productData) {
    return this.productRepository.updateProduct(productId, productData);
  }

  async deleteProduct(productId) {
    return this.productRepository.deleteProduct(productId);
  }

  async getProductsByUserId(userId) {
    return await this.productRepository.getByUserId(userId);
  }

  async getPaginatedProducts(page, limit, title, category) {
    return this.productRepository.getPaginatedProducts(
      page,
      limit,
      title,
      category
    );
  }

  async getProductById(productId) {
    return this.productRepository.getProductById(productId);
  }
}

module.exports = ProductService;
