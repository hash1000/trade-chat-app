const sequelize = require("../config/database");
const OrderRepository = require("../repositories/OrderRepository");
const { uploadFileToS3, deleteFileFromS3 } = require("../utilities/s3Utils");
const AddressService = require("./AddressService");
const multer = require("multer");

class OrderService {
  constructor() {
    this.orderRepository = new OrderRepository();
    this.addressService = new AddressService();
  }
  

  async createOrder(name, image, userId, orderNo, price, status, user) {
    const orderData = { name, image, userId, orderNo, price, status };
    const address = await this.addressService.getPinAddressByUserId(userId);
    
    if (address) {
      return await this.orderRepository.createOrder(orderData);
    }
    return null;
  }

  async updateOrder(name, image, orderId, price, status, documents) {
    return this.orderRepository.updateOrder(name, image, orderId, price, status, documents);
  }

  async uploadDocument(orderNo, documents) {
    let transaction;
    const uploadedFiles = [];
  
    try {
      // Validate input
      if (!documents || documents.length === 0) {
        throw new Error("No documents provided");
      }
  
      // Start transaction
      transaction = await sequelize.transaction();
  
      // Upload files to S3
      for (const file of documents) {
        const fileUrl = await uploadFileToS3(file, process.env.SPACES_BUCKET_NAME);
        uploadedFiles.push(fileUrl);
      }
  
      // Create database records
      const result = await this.orderRepository.uploadDocument(
        orderNo,
        uploadedFiles,
        transaction
      );
  
      // Commit transaction
      await transaction.commit();
      return result;
    } catch (error) {
      // Rollback transaction if exists
      if (transaction) await transaction.rollback();
      
      // Clean up uploaded files if any
      if (uploadedFiles.length > 0) {
        await Promise.all(uploadedFiles.map(url => deleteFileFromS3(url)));
      }
  
      throw error;
    }
  }

  async deleteOrder(orderNo) {
    return await this.orderRepository.deleteOrder(orderNo);
  }

  async getUserOrders(userId) {
    return await this.orderRepository.getUserOrders(userId);
  }

  async getOrderById(orderId) {
    return await this.orderRepository.getOrderByOrderId(orderId);
  }
}

module.exports = OrderService;
