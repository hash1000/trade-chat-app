const OrderRepository = require('../repositories/OrderRepository')

class OrderService {
  constructor () {
    this.orderRepository = new OrderRepository()
  }

  async createOrder (name, image, products = [], user) {
    const { id: userId } = user
    const orderData = {
      name,
      image,
      products: []
    }

    for (const { productId, quantity } of products) {
      orderData.products.push({ productId, quantity })
    }

    return await this.orderRepository.createOrder(orderData, userId)
  }

  async updateOrder (orderId, name, image, products = [], documents) {
    return this.orderRepository.updateOrder(orderId, name, image, products, documents)
  }

  async deleteOrder (orderId) {
    await this.orderRepository.deleteOrder(orderId)
  }

  async getUserOrders (userId) {
    // Retrieve the user's orders from the repository
    return await this.orderRepository.getUserOrders(userId)
  }

  async getOrderById (userId) {
    // Retrieve the user's orders from the repository
    return await this.orderRepository.getOrderProductById(userId)
  }
}

module.exports = OrderService
