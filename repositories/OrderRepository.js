const Order = require('../models/order')
const OrderProduct = require('../models/order_products')
const Product = require('../models/product')
const sequelize = require('../config/database')
const ProductService = require('../services/ProductService')
const {OrderUpdateNotification} = require("../notifications");

class OrderRepository {
  async getOrderById (orderId) {
    return await Order.findByPk(orderId)
  }

  async createOrder (orderData, userId) {
    const { name, image, products } = orderData

    let transaction
    try {
      transaction = await sequelize.transaction()

      // Create the order within the transaction
      const createdOrder = await Order.create(
        {
          name,
          image,
          userId
        },
        { transaction }
      )

      // Fetch the associated products in a single query
      const productIds = products.map(({ productId }) => productId)
      const productInstances = await Product.findAll({
        where: { id: productIds },
        transaction
      })

      // Check if all products were found in the database
      const foundProductIds = productInstances.map((product) => product.id)
      const missingProductIds = productIds.filter(
        (productId) => !foundProductIds.includes(productId)
      )
      if (missingProductIds.length > 0) {
        throw new Error(`Invalid Product IDs: ${missingProductIds.join(', ')}`)
      }

      // Create the order products within the transaction
      const orderProducts = productInstances.map((productInstance, index) => {
        const { quantity } = products[index]
        return {
          orderId: createdOrder.id,
          productId: productInstance.id,
          quantity
        }
      })

      await OrderProduct.bulkCreate(orderProducts, { transaction })

      await transaction.commit()

      return createdOrder
    } catch (error) {
      if (transaction) await transaction.rollback()
      throw error
    }
  }

  async updateOrder (orderId, name, image, updatedProducts, documents) {
    let transaction
    try {
      transaction = await sequelize.transaction()

      // Check if the order exists
      const order = await this.getOrderById(orderId)
      if (!order) {
        throw new Error('Order not found')
      }
      if (name) {
        order.name = name
      }
      if (image) {
        order.image = image
      }
      if (documents) {
        order.documents = documents
      }
      if (updatedProducts && updatedProducts.length > 0) {
      // Get the current products of the order
        const currentProducts = await OrderProduct.findAll({
          where: { orderId },
          transaction
        })

        // Get the IDs of the products to be removed
        const productIdsToRemove = currentProducts
          .filter((product) => !updatedProducts.some((p) => p.productId === product.productId))
          .map((product) => product.productId)

        // Remove the products not included in the update data
        await OrderProduct.destroy({
          where: {
            orderId,
            productId: productIdsToRemove
          },
          transaction
        })

        // Update or create the remaining products
        for (const updatedProduct of updatedProducts) {
          const { productId, quantity } = updatedProduct
          const productService = new ProductService()
          await productService.getProductById(productId)

          // Find the order product to update or create
          const orderProduct = await OrderProduct.findOne({
            where: { orderId, productId },
            transaction
          })

          if (orderProduct) {
          // Update the quantity of the existing order product
            orderProduct.quantity = quantity
            await orderProduct.save({ transaction })
          } else {
          // Create a new order product
            await OrderProduct.create(
              {
                orderId,
                productId,
                quantity
              },
              { transaction }
            )
          }
        }
      }
      await order.save({ transaction })
      await transaction.commit()
      // await new OrderUpdateNotification(order).sendNotification();

      return order
    } catch (error) {
      console.error(error)
      if (transaction) await transaction.rollback()
      throw error
    }
  }

  async deleteOrder (orderId) {
    let transaction
    try {
      transaction = await sequelize.transaction()
      // Check if the order exists
      const order = await this.getOrderById(orderId)
      if (!order) {
        throw new Error('Order not found')
      }

      // Delete the order products associated with the order
      await OrderProduct.destroy({
        where: { orderId },
        transaction
      })

      // Delete the order
      await Order.destroy({
        where: { id: orderId },
        transaction
      })

      await transaction.commit()
    } catch (error) {
      if (transaction) await transaction.rollback()
      throw error
    }
  }

  async getUserOrders (userId) {
    // Retrieve the user's orders from the database
    return await Order.findAll({
      where: { userId },
      include: [
        {
          model: OrderProduct,
          as: 'orderProducts', // Update the alias to match the association alias
          include: [
            {
              model: Product
            }
          ]
        }
      ]
    })
  }

  async getOrderProductById (orderId) {
    // Retrieve the user's orders from the database
    return await Order.findOne({
      where: { id: orderId },
      include: [
        {
          model: OrderProduct,
          as: 'orderProducts', // Update the alias to match the association alias
          include: [
            {
              model: Product
            }
          ]
        }
      ]
    })
  }
}

module.exports = OrderRepository
