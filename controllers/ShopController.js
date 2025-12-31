const ShopService = require('../services/ShopService')
const shopService = new ShopService()

class ShopController {
  async createShop(req, res) {
    try {
      const { id: userId } = req.user
      const shop = await shopService.createShop(userId, req.body)
      return res.status(201).json(shop)
    } catch (error) {
      console.error(error)
      return res.status(500).json({ message: 'Failed to create shop' })
    }
  }

  async updateShop(req, res) {
    try {
      const { shopId } = req.params
      const { id: userId } = req.user

      const shop = await shopService.updateShop(shopId, userId, req.body)
      return res.json(shop)
    } catch (error) {
      console.error(error)
      return res.status(error.statusCode || 500).json({ message: error.message })
    }
  }

  async deleteShop(req, res) {
    try {
      const { shopId } = req.params
      const { id: userId } = req.user

      await shopService.deleteShop(shopId, userId)
      return res.json({ message: 'Shop deleted successfully' })
    } catch (error) {
      console.error(error)
      return res.status(error.statusCode || 500).json({ message: error.message })
    }
  }

  async getShops(req, res) {
    try {
      const { id: userId } = req.user
      const shops = await shopService.getShopsByUserId(userId)
      return res.json(shops)
    } catch (error) {
      console.error(error)
      return res.status(500).json({ message: 'Failed to retrieve shops' })
    }
  }


  async getShopById(req, res) {
    try {
      const { id: userId } = req.user
      const { id } = req.params
      const shops = await shopService.getShopsById(userId,id)
      return res.json(shops)
    } catch (error) {
      console.error(error)
      return res.status(500).json({ message: 'Failed to retrieve shops' })
    }
  }

  async getPaginatedShops(req, res) {
    try {
      const { page = 1, limit = 10, shop_name, country } = req.query
      const data = await shopService.getPaginatedShops(page, limit, shop_name, country)
      return res.json(data)
    } catch (error) {
      console.error(error)
      return res.status(500).json({ message: 'Failed to list shops' })
    }
  }
}

module.exports = ShopController
