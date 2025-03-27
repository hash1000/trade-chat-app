const { Order, User } = require("../models");
const OrderProduct = require("../models/order_products");
const Product = require("../models/product");
const sequelize = require("../config/database");
const ProductService = require("../services/ProductService");
const { OrderUpdateNotification } = require("../notifications");
const { Document } = require("../models");
const multer = require("multer");
const Address = require("../models/address");

class OrderRepository {
  async getOrderById(orderId) {
    return await Order.findByPk(orderId);
  }

  async createOrder(orderData) {
    const {
      name,
      image,
      userId,
      creatorId,
      creatorRole,
      addressId,
      isFavorite,
      isLock,
      orderNo,
      price,
      status,
    } = orderData;

    let transaction;
    try {
      transaction = await sequelize.transaction();
      const createdOrder = await Order.create(
        {
          name,
          image,
          orderNo,
          isFavorite,
          isLock,
          userId,
          creatorId,
          creatorRole,
          addressId,
          price,
          status,
        },
        { transaction }
      );

      await transaction.commit();

      return createdOrder;
    } catch (error) {
      if (transaction) await transaction.rollback();
      throw error;
    }
  }

  async isFavoriteOrder(orderId) {
    let transaction;
    try {
      // Check if the order is already marked as favorite
      const hasFavOrder = await Order.findOne({
        where: { id: orderId, isFavorite: 1 },
      });

      // Toggle favorite status
      if (hasFavOrder) {
        if (hasFavOrder.id === orderId) {
          await Order.update({ isFavorite: 0 }, { where: { id: orderId } });
          return { success: true, message: "Order is now unfavorite." };
        }
      }

      // Start transaction for setting as favorite
      transaction = await sequelize.transaction();

      const order = await Order.findOne({
        where: { id: orderId },
      });

      // Pin the new Order
      const [affectedRows] = await Order.update(
        { isFavorite: 1 },
        {
          where: { id: orderId, userId: order.userId },
          transaction,
        }
      );

      if (affectedRows === 0) {
        throw new Error("No order found to update.");
      }

      // Commit transaction
      await transaction.commit();
      return { success: true, message: "Order is marked as favorite." };
    } catch (error) {
      if (transaction) await transaction.rollback();
      console.error("Error updating favorite status:", error.message || error);
      return {
        success: false,
        message: "Failed to update favorite status.",
        error: error.message || error,
      };
    }
  }
  
  async isLockOrder(orderId) {
    let transaction;
    try {
      // Check if the order is already marked as favorite
      const hasFavOrder = await Order.findOne({
        where: { id: orderId, isLock: 1 },
      });

      // Toggle favorite status
      if (hasFavOrder) {
        if (hasFavOrder.id === orderId) {
          await Order.update({ isLock: 0 }, { where: { id: orderId } });
          return { success: true, message: "Order is now unLock" };
        }
      }

      // Start transaction for setting as favorite
      transaction = await sequelize.transaction();

      const order = await Order.findOne({
        where: { id: orderId },
      });

      // Pin the new Order
      const [affectedRows] = await Order.update(
        { isLock: 1 },
        {
          where: { id: orderId, userId: order.userId },
          transaction,
        }
      );

      if (affectedRows === 0) {
        throw new Error("No order found to update.");
      }

      // Commit transaction
      await transaction.commit();
      return { success: true, message: "Order is marked as lock." };
    } catch (error) {
      if (transaction) await transaction.rollback();
      console.error("Error updating lock status:", error.message || error);
      return {
        success: false,
        message: "Failed to update lock status.",
        error: error.message || error,
      };
    }
  }
  
  async UploadDocument(orderNo, documents) {
    let transaction;
    try {
      transaction = await sequelize.transaction();
      const document = await Document.create(
        { orderNo, documents },
        transaction
      );
      return document;
    } catch (error) {
      console.error(error);
      if (transaction) await transaction.rollback();
      throw error;
    }
  }

  async updateOrder(name, image, orderId, price, status, documents) {
    let transaction;
    try {
      transaction = await sequelize.transaction();

      // 1. Get the order with existing documents
      const order = await Order.findByPk(orderId, {
        include: [
          {
            model: Document,
            as: "documents", // Match your association alias
          },
        ],
        transaction,
      });

      if (!order) {
        throw new Error("Order not found");
      }

      // 2. Update order fields
      const updateFields = {};
      if (name) updateFields.name = name;
      if (image) updateFields.image = image;
      if (price) updateFields.price = price;
      if (status) updateFields.status = status;

      await order.update(updateFields, { transaction });

      // 3. Handle documents update
      if (documents && documents.length > 0) {
        // Destroy existing documents
        await Document.destroy({
          where: { orderNo: order.orderNo },
          transaction,
        });

        // Create new documents
        await Document.bulkCreate(
          documents.map((doc) => ({
            orderNo: order.orderNo,
            title: doc.title,
            document: doc.document, // Make sure this matches your model field name
          })),
          { transaction }
        );
      }

      // 4. Get the updated order with fresh documents
      const updatedOrder = await Order.findByPk(orderId, {
        include: [
          {
            model: Document,
            as: "documents",
          },
        ],
        transaction,
      });

      await transaction.commit();
      return updatedOrder;
    } catch (error) {
      console.error(error);
      if (transaction) await transaction.rollback();
      throw new Error(`Order update failed: ${error.message}`);
    }
  }

  async updateOrderDocument(orderNo, documents) {
    let transaction;
    try {
      transaction = await sequelize.transaction();

      // Check if the order exists
      const order = await this.getOrderById(orderId);
      if (!order) {
        throw new Error("Order not found");
      }
      if (documents) {
        const fileUrl = await uploadFileToS3(
          documents,
          process.env.SPACES_BUCKET_NAME
        );
        order.documents = fileUrl;
      }
      if (updateDocuments && updateDocuments.length > 0) {
        // Get the current products of the order
        const currentProducts = await OrderProduct.findAll({
          where: { orderId },
          transaction,
        });

        // Get the IDs of the products to be removed
        const productIdsToRemove = currentProducts
          .filter(
            (product) =>
              !updateDocuments.some((p) => p.productId === product.productId)
          )
          .map((product) => product.productId);

        // Remove the products not included in the update data
        await OrderProduct.destroy({
          where: {
            orderId,
            productId: productIdsToRemove,
          },
          transaction,
        });

        // Update or create the remaining products
        for (const updateDocument of updateDocuments) {
          const { productId, quantity } = updateDocument;
          const productService = new ProductService();
          await productService.getProductById(productId);

          // Find the order product to update or create
          const orderProduct = await OrderProduct.findOne({
            where: { orderId, productId },
            transaction,
          });

          if (orderProduct) {
            // Update the quantity of the existing order product
            orderProduct.quantity = quantity;
            await orderProduct.save({ transaction });
          } else {
            // Create a new order product
            await OrderProduct.create(
              {
                orderId,
                productId,
                quantity,
              },
              { transaction }
            );
          }
        }
      }
      await order.save({ transaction });
      await transaction.commit();
      // await new OrderUpdateNotification(order).sendNotification();

      return order;
    } catch (error) {
      console.error(error);
      if (transaction) await transaction.rollback();
      throw error;
    }
  }

  async updateOrderDocument(orderNo, documents) {
    let transaction;
    try {
      transaction = await sequelize.transaction();

      // Check if the order exists
      const order = await this.getOrderById(orderId);
      if (!order) {
        throw new Error("Order not found");
      }
      if (documents) {
        order.documents = documents;
      }
      if (updatedProducts && updatedProducts.length > 0) {
        // Get the current products of the order
        const currentProducts = await OrderProduct.findAll({
          where: { orderId },
          transaction,
        });

        // Get the IDs of the products to be removed
        const productIdsToRemove = currentProducts
          .filter(
            (product) =>
              !updatedProducts.some((p) => p.productId === product.productId)
          )
          .map((product) => product.productId);

        // Remove the products not included in the update data
        await OrderProduct.destroy({
          where: {
            orderId,
            productId: productIdsToRemove,
          },
          transaction,
        });

        // Update or create the remaining products
        for (const updatedProduct of updatedProducts) {
          const { productId, quantity } = updatedProduct;
          const productService = new ProductService();
          await productService.getProductById(productId);

          // Find the order product to update or create
          const orderProduct = await OrderProduct.findOne({
            where: { orderId, productId },
            transaction,
          });

          if (orderProduct) {
            // Update the quantity of the existing order product
            orderProduct.quantity = quantity;
            await orderProduct.save({ transaction });
          } else {
            // Create a new order product
            await OrderProduct.create(
              {
                orderId,
                productId,
                quantity,
              },
              { transaction }
            );
          }
        }
      }
      await order.save({ transaction });
      await transaction.commit();
      // await new OrderUpdateNotification(order).sendNotification();

      return order;
    } catch (error) {
      console.error(error);
      if (transaction) await transaction.rollback();
      throw error;
    }
  }

  async deleteOrder(orderNo, creatorRole) {
    let transaction;
    try {
      transaction = await sequelize.transaction();

      // Check if the order exists
      const order = await Order.findOne({
        where: { id: orderNo },
        transaction,
      });

      if (!order) {
        await transaction.rollback();
        return { status: 404, message: "Order not found" };
      }

      // Check permissions
      if (creatorRole !== "admin" && creatorRole !== order.creatorRole) {
        await transaction.rollback();
        return {
          status: 403,
          message: "Unauthorized: Insufficient permissions",
        };
      }

      // Delete related documents
      await Document.destroy({
        where: { orderNo: order.orderNo },
        transaction,
      });

      // Delete the order
      await Order.destroy({ where: { orderNo: order.orderNo }, transaction });

      await transaction.commit();
      return { status: 200, message: "Order deleted successfully" };
    } catch (error) {
      if (transaction) await transaction.rollback();
      console.error("Error deleting order:", error);
      return {
        status: 500,
        message: `Failed to delete order: ${error.message}`,
      };
    }
  }


  async uploadDocument(orderNo, documentObj) {
    try {
      const documents = [];

      for (const document of documentObj) {
        const doc = await Document.create({
          orderNo: orderNo,
          title: document.title,
          document: document.url,
        });
        documents.push(doc);
      }

      return documents;
    } catch (error) {
      throw error;
    }
  }

  async getDocumentById(documentId) {
    try {
      return await Document.findOne({
        where: { id: documentId }
      });
    } catch (error) {
      throw error;
    }
  }
  
  async deleteDocument(documentId, transaction) {
    try {
      return await Document.destroy({
        where: { id: documentId },
        transaction
      });
    } catch (error) {
      throw error;
    }
  }

  async getUserOrders(userId, creatorRole = null) {
    try {
      const whereClause = { userId };

      // Add creatorRole to the query if provided
      if (creatorRole) {
        whereClause.creatorRole = creatorRole;
      }

      const userOrders = await Order.findAll({
        where: whereClause,
        include: [
          {
            model: Document,
            as: "documents",
          },
          {
            model: User,
            as: "users",
          },
          {
            model: User,
            as: "creator", // Correct alias for creatorId association
          },
          {
            model: Address,
            as: "address",
          },
        ],
      });

      if (!userOrders || userOrders.length === 0) {
        throw new Error("No orders found for this user");
      }

      return userOrders;
    } catch (error) {
      console.error("Error fetching user orders:", error);
      throw new Error(`Failed to fetch user orders: ${error.message}`);
    }
  }

  async getAllUserOrders(creatorRole = null) {
    try {
      const whereClause = {};

      // Add creatorRole to the query if provided
      if (creatorRole) {
        whereClause.creatorRole = creatorRole;
      }

      const userAllOrders = await Order.findAll({
        where: whereClause,
        include: [
          {
            model: Document,
            as: "documents",
          },
          {
            model: User,
            as: "users",
          },
          {
            model: User,
            as: "creator",
          },
          {
            model: Address,
            as: "address",
          },
        ],
      });

      if (!userAllOrders || userAllOrders.length === 0) {
        throw new Error("No orders found");
      }

      return userAllOrders;
    } catch (error) {
      console.error("Error fetching all user orders:", error);
      throw new Error(`Failed to fetch all user orders: ${error.message}`);
    }
  }


  async getOrdersByRole(operatorId) {
    return await Order.findAll({
      include: [
        {
          model: User,
          as: "users", // Fetch the user who placed the order
        },
        {
          model: Document,
          as: "documents",
        },
        {
          model: User,
          as: "creator", // Correct alias for creatorId association
        },
        {
          model: Role,
          where: {},
        },
        { model: Address, as: "address" },
      ],
    });
  }

  async getOrderByOrderId(orderId) {
    return await Order.findOne({
      where: { id: orderId },
      include: [
        {
          model: Document,
          as: "documents",
        },
        {
          model: User,
          as: "users", // Fetch the user who placed the order
        },
        {
          model: User,
          as: "creator", // Correct alias for creatorId association
        },
        { model: Address, as: "address" },
      ],
    });
  }
}

module.exports = OrderRepository;
