const ShopProductService = require('../services/ShopProductService')
const productService = new ShopProductService()

class ShopProductController {
  async createProduct(req, res) {
    try {
      const { id: userId } = req.user
      const product = await productService.createProduct(userId, req.body)
      return res.status(201).json(product)
    } catch (error) {
      return res
        .status(error.statusCode || 500)
        .json({ message: error.message })
    }
  }

  async updateProduct(req, res) {
    try {
      const { productId } = req.params
      const { id: userId } = req.user

      const product = await productService.updateProduct(
        productId,
        userId,
        req.body
      )

      return res.json(product)
    } catch (error) {
      return res
        .status(error.statusCode || 500)
        .json({ message: error.message })
    }
  }

  async deleteProduct(req, res) {
    try {
      const { productId } = req.params
      const { id: userId } = req.user

      await productService.deleteProduct(productId, userId)
      return res.json({ message: 'Product deleted successfully' })
    } catch (error) {
      return res
        .status(error.statusCode || 500)
        .json({ message: error.message })
    }
  }

  async getProductsByShop(req, res) {
    try {
      const { shopId } = req.params
      const { id: userId } = req.user

      const products = await productService.getProductsByShop(shopId, userId)
      return res.json({
        status: true,
        message: "Successfully fetched product",
        data: products
      })
    } catch (error) {
      return res
        .status(error.statusCode || 500)
        .json({ message: error.message })
    }
  }

  async getProductById(req, res) {
    try {
      const { productId } = req.params
      const { id: userId } = req.user

      const product = await productService.getProductById(productId, userId)
      return res.json({
        status: true,
        message: "Successfully fetched product",
        data: product
      })
    } catch (error) {
      return res
        .status(error.statusCode || 500)
        .json({ message: error.message })
    }
  }

  async getPaginatedProducts(req, res) {
    try {
    console.log("Fetching paginated products");
      const { page = 1, limit = 10, name, shopId } = req.query
      const products = await productService.getPaginatedProducts(
        page,
        limit,
        name,
        shopId
      )
      return res.json({
        status: true,
        message: "Successfully fetched  products",
        data: products
      })
    } catch (error) {
      return res.status(500).json({ message: 'Failed to list products' })
    }
  }
}

module.exports = ShopProductController
