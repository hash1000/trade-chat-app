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

  async createOrder(
    name,
    image,
    userId,
    creatorId,
    creatorRole,
    orderNo,
    price,
    status
  ) {
    const address = await this.addressService.getPinAddressByUserId(userId);
    const orderData = {
      name,
      image,
      userId,
      creatorId,
      creatorRole,
      addressId: address ? address.id : null,
      isFavorite: false,
      isLock: false,
      orderNo,
      price,
      status,
    };
    return await this.orderRepository.createOrder(orderData);
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

  async isLockOrder(orderId) {
    const order = await this.orderRepository.getOrderByOrderId(orderId);
    if (order) {
      return this.orderRepository.isLockOrder(orderId);
    }
    return { success: false, message: "This Order is does not exist" };
  }

  async uploadDocument(orderNo, files) {
    const documentUrls = [];
    const uploadedFiles = [];
  
    try {
      for (const file of files) {
        const uploaded = await uploadFileToS3(
          file.buffer,
          file.originalname,
          file.mimetype
        );
        documentUrls.push(uploaded);
        uploadedFiles.push(uploaded);
      }
  
      return await this.orderRepository.uploadDocument(orderNo, documentUrls);
    } catch (error) {
      for (const file of uploadedFiles) {
        try {
          await deleteFileFromS3(file.url, process.env.SPACES_BUCKET_NAME);
        } catch (err) {
          console.error("Rollback deletion failed:", err.message);
        }
      }
      throw error;
    }
  }

  async getDocumentById(documentId) {
    try {
      return await this.orderRepository.getDocumentById(documentId);
    } catch (error) {
      throw error;
    }
  }

  async deleteDocument(documentId, documentUrls) {
    console.log("documentUrls", documentId, documentUrls);
    let transaction;
    try {
      transaction = await sequelize.transaction();

      // First delete from database
      await this.orderRepository.deleteDocument(documentId, transaction);

      try {
        await deleteFileFromS3(documentUrls, process.env.SPACES_BUCKET_NAME);
      } catch (err) {
        console.error("Failed to delete file from S3:", err);
        // Continue even if S3 deletion fails
      }

      await transaction.commit();
    } catch (error) {
      if (transaction) await transaction.rollback();
      throw error;
    }
  }

  async deleteOrder(orderNo, creatorRole) {
    return await this.orderRepository.deleteOrder(orderNo, creatorRole);
  }

  async getUserOrders(userId, creatorRole = null) {
    return await this.orderRepository.getUserOrders(userId, creatorRole);
  }

  async getAllUserOrders(creatorRole = null) {
    return await this.orderRepository.getAllUserOrders(creatorRole);
  }

  async getOrderById(orderId) {
    return await this.orderRepository.getOrderByOrderId(orderId);
  }
}

module.exports = OrderService;
