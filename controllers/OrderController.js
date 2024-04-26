const OrderService = require('../services/OrderService')
const orderService = new OrderService()

class OrderController {
  async createOrder (req, res) {
    try {
      const { name, image, products } = req.body

      const createdOrder = await orderService.createOrder(name, image, products, req.user)

      res.status(201).json(createdOrder)
    } catch (error) {
      console.error('Error creating order:', error)
      if (error.message.startsWith('Invalid Product IDs:')) {
        res.status(400).json({ error: error.message })
      } else {
        res.status(500).json({ error: 'Internal server error' })
      }
    }
  }

  async updateOrder (req, res) {
    try {
      const orderId = req.params.orderId
      const { products, name, image, documents } = req.body

      // Update the order
      const updatedOrder = await orderService.updateOrder(orderId, name, image, products, documents)

      res.json(updatedOrder)
    } catch (error) {
      console.error('Error updating order:', error)
      if (error.message.startsWith('Invalid Product IDs:') || error.message.startsWith('Product not found')) {
        res.status(400).json({ error: error.message })
      } else {
        res.status(500).json({ error: 'Order not found' })
      }
    }
  }

  async deleteOrder (req, res) {
    try {
      const orderId = req.params.orderId

      // Delete the order
      await orderService.deleteOrder(orderId)
      res.json({ message: 'Order deleted successfully' })
    } catch (error) {
      console.error('Error deleting order:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  async getUserOrders (req, res) {
    try {
      const { id: userId } = req.user

      // Get the user's orders
      const userOrders = await orderService.getUserOrders(userId)

      res.json(userOrders)
    } catch (error) {
      console.error('Error fetching user order:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  async getOrderById (req, res) {
    try {
      const orderId = req.params.orderId

      // Get the user's orders
      const order = await orderService.getOrderById(orderId)
      if (order) {
        res.json(order)
      } else {
        res.status(404).json({ error: 'Order not found' })
      }
    } catch (error) {
      console.error('Error fetching user order:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }
}

module.exports = OrderController
