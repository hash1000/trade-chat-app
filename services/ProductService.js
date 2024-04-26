const ProductRepository = require('../repositories/ProductRepository')

class ProductService {
  constructor () {
    this.productRepository = new ProductRepository()
  }

  async createProduct (userId, productData) {
    return this.productRepository.createProduct({
      ...productData,
      userId // Set the userId with the correct value
    })
  }

  async updateProduct (productId, productData) {
    return this.productRepository.updateProduct(productId, productData)
  }

  async deleteProduct (productId) {
    return this.productRepository.deleteProduct(productId)
  }

  async getProductsByUserId (userId) {
    return await this.productRepository.getByUserId(userId)
  }

  async getPaginatedProducts (page, limit, title, category) {
    return this.productRepository.getPaginatedProducts(page, limit, title, category)
  }

  async getProductById (productId) {
    return this.productRepository.getProductById(productId)
  }
}

module.exports = ProductService
