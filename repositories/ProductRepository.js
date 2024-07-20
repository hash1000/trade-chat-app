const Product = require('../models/product')
const { Op } = require('sequelize')
const OrderProduct = require('../models/order_products')
const CustomError = require('../errors/CustomError')

class ProductRepository {
  async createProduct (productData) {
    return Product.create(productData)
  }

  async updateProduct (productId, productData) {
    const product = await Product.findByPk(productId)
    if (!product) {
      throw new Error('Product not found')
    }
    Object.assign(product, productData)
    return product.save()
  }

  async deleteProduct (productId) {
    const product = await Product.findByPk(productId)
    if (!product) {
      throw new CustomError('Product not found', 400)
    }
    const orderProducts = await OrderProduct.findAll({
      where: { productId }
    })
    if (orderProducts && orderProducts.length > 0) {
      throw new CustomError('Product is in use', 400)
    }
    return product.destroy()
  }

  async getProductById (productId) {
    const product = await Product.findByPk(productId)
    if (!product) {
      throw new Error('Product not found')
    }
    return product
  }

  async getByUserId (userId) {
    // Retrieve the products created by the user from the database
    return await Product.findAll({ where: { userId } })
  }

  async getPaginatedProducts (page, limit, title, category) {
    const offset = (page - 1) * limit

    const whereCondition = {}
    if (title) {
      whereCondition.title = { [Op.like]: `%${title}%` }
    }
    if (category) {
      whereCondition.category = { [Op.like]: `%${category}%` }
    }

    const products = await Product.findAndCountAll({
      where: whereCondition,
      limit,
      offset
    })

    return {
      total: products.count,
      totalPages: Math.ceil(products.count / limit),
      currentPage: page,
      products: products.rows
    }
  }
}

module.exports = ProductRepository
