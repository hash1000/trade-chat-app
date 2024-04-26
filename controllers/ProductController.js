const ProductService = require('../services/ProductService')
const CustomError = require('../errors/CustomError')
const productService = new ProductService()

class ProductController {
  async createProduct (req, res) {
    const productData = req.body
    const { id: userId } = req.user
    try {
      const product = await productService.createProduct(userId, productData)
      res.json(product)
    } catch (error) {
      console.error(error)
      res.status(500).json({ message: 'Failed to create product' })
    }
  }

  async updateProduct (req, res) {
    const productId = req.params.productId
    const productData = req.body
    try {
      await productService.updateProduct(productId, productData)
      res.json({ message: 'Product updated successfully' })
    } catch (error) {
      console.error(error)
      res.status(500).json({ message: 'Failed to update product' })
    }
  }

  async deleteProduct (req, res) {
    const productId = req.params.productId
    try {
      await productService.deleteProduct(productId)
      res.json({ message: 'Product deleted successfully' })
    } catch (error) {
      console.error(error)
      if (error instanceof CustomError) {
        return res.status(error.statusCode).json({ message: error.message })
      }
      res.status(500).json({ message: 'Failed to delete product' })
    }
  }

  async getProducts (req, res) {
    const { id: userId } = req.user
    try {
      const products = await productService.getProductsByUserId(userId)
      res.json(products)
    } catch (error) {
      console.error(error)
      res.status(500).json({ message: 'Failed to retrieve products' })
    }
  }

  async getPaginatedProducts (req, res) {
    try {
      const { page = 1, limit = 10, title, category } = req.query

      const products = await productService.getPaginatedProducts(page, limit, title, category)

      return res.json(products)
    } catch (error) {
      console.error(error)
      res.status(500).json({ message: 'Failed to list product' })
    }
  }
}

module.exports = ProductController
