const sequelize = require("../config/database");
const { Order } = require("../models");
const AddressRepository = require("../repositories/AddressRepository");
const OrderRepository = require("../repositories/OrderRepository");
const { uploadFileToS3, deleteFileFromS3 } = require("../utilities/s3Utils");
const AddressService = require("./AddressService");
const multer = require("multer");

class OrderService {
  constructor() {
    this.orderRepository = new OrderRepository();
    this.addressService = new AddressService();
    this.addressRepository = new AddressRepository();
  }

  async createOrder(name, image, userId, creatorId, creatorRole, orderNo, price, status) {
    const address = await this.addressService.getPinAddressByUserId(userId);
    if (address) {
      const orderData = {
        name,
        image,
        userId,
        creatorId,
        creatorRole,
        addressId: address.id,
        isFavorite: false,
        orderNo,
        price,
        status,
      };
      return await this.orderRepository.createOrder(orderData);
    }
    return null;
  }

  async updateOrder(name, image, orderId, price, status, documents) {
    try {
      const updatedOrder = await this.orderRepository.updateOrder(
        name,
        image,
        orderId,
        price,
        status,
        documents
      );

      if (!updatedOrder) {
        throw new Error("Order not found");
      }

      return updatedOrder;
    } catch (error) {
      console.error("Error in updateOrder:", error);
      throw error; // Re-throw the error for centralized handling
    }
  }

  async updateOperatorOrder(name, image, orderId, price, status, documents) {
    try {
      const order = await this.orderRepository.getOrderById(orderId);
console.log("order",order);
      if (!order) {
        throw new Error("Order not found");
      }

      if (order.creatorRole !== "operator") {
        throw new Error(
          "Unauthorized: Only the creator operator can update this order"
        );
      }

      const updatedOrder = await this.orderRepository.updateOrder(
        name,
        image,
        orderId,
        price,
        status,
        documents
      );

      return updatedOrder;
    } catch (error) {
      console.error("Error in updateOperatorOrder:", error);
      throw error;
    }
  }

  async updateOrderAddress(userId, orderId, updateFields) {
    const order = await this.orderRepository.getOrderById(orderId);
    if (order) {
      // Fetch the address to ensure it belongs to the user
      const address = await this.addressRepository.getAddressById(
        order.userId,
        updateFields.addressId
      );
      if (!address) {
        throw new Error("Address not found or does not belong to the user.");
      }
      // Update the address fields
      const updatedAddress = await this.addressRepository.updateAddress(
        updateFields.addressId,
        updateFields
      );

      const updatedOrder = await this.orderRepository.getOrderByOrderId(
        orderId
      );
      return updatedOrder;
    }
    throw new Error("Order not found.");
  }

  async isFavoriteOrder(orderId) {
    const order = await this.orderRepository.getOrderByOrderId(orderId);
    if (order) {
      return this.orderRepository.isFavoriteOrder(orderId);
    }
    return { success: false, message: "This Order is does not exist" };
  }

  async uploadDocument(orderNo, documents) {
    const documentObj = [];
    // let transaction;
    try {
      // transaction = await sequelize.transaction();
      if (!documents || documents.length === 0) {
        throw new Error("No documents provided");
      }

      for (const file of documents) {
        const fileUrl = await uploadFileToS3(
          file,
          process.env.SPACES_BUCKET_NAME
        );
        documentObj.push(fileUrl);
      }

      return await this.orderRepository.uploadDocument(orderNo, documentObj);

      // await transaction.commit();
      return createdDocs;
    } catch (error) {
      // await transaction.rollback();

      // Delete uploaded files from S3 on error
      for (const file of uploadedFiles) {
        try {
          await deleteFileFromS3(file.url, process.env.SPACES_BUCKET_NAME);
        } catch (err) {
          console.error("Failed to delete file:", err);
        }
      }

      throw error;
    }
  }

  async deleteOrder(orderNo, creatorRole) {
    return await this.orderRepository.deleteOrder(orderNo, creatorRole);
  }


  async getUserOrders(userId, creatorRole = null) {
    return await this.orderRepository.getUserOrders(userId,creatorRole);
  }

  async getAllUserOrders(creatorRole = null) {
    return await this.orderRepository.getAllUserOrders(creatorRole);
  }

  async getOrderById(orderId) {
    return await this.orderRepository.getOrderByOrderId(orderId);
  }
}

module.exports = OrderService;
