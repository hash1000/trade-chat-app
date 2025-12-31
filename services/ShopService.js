const CustomError = require("../errors/CustomError");
const ShopRepository = require("../repositories/ShopRepository");

class ShopService {
  constructor() {
    this.shopRepository = new ShopRepository()
  }

  async createShop(userId, shopData) {
    return this.shopRepository.createShop({ ...shopData, userId })
  }

  async updateShop(shopId, userId, shopData) {
    const shop = await this.shopRepository.getShopById(shopId)

    if (shop.userId !== userId) {
      throw new CustomError('Unauthorized', 403)
    }

    return this.shopRepository.updateShop(shopId, shopData)
  }

  async deleteShop(shopId, userId) {
    const shop = await this.shopRepository.getShopById(shopId)

    if (shop.userId !== userId) {
      throw new CustomError('Unauthorized', 403)
    }

    return this.shopRepository.deleteShop(shopId)
  }

  async getShopsByUserId(userId) {
    return this.shopRepository.getByUserId(userId)
  }

    async getShopsById(userId,id) {
    return this.shopRepository.getById(userId,id)
  }

  async getPaginatedShops(page, limit, shop_name, country) {
    return this.shopRepository.getPaginatedShops(page, limit, shop_name, country)
  }
}

module.exports = ShopService;
