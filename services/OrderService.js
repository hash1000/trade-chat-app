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
    const existingOrder = await this.orderRepository.getUserOrders(userId);
    const address = await this.addressService.getPinAddressByUserId(userId);
    const orderData = { name, image, userId, isFavorite: existingOrder.length === 0, orderNo, price, status };
    
    if (address) {
      return await this.orderRepository.createOrder(orderData);
    }
    return null;
  }

  async updateOrder(name, image, orderId, price, status, documents) {
    return this.orderRepository.updateOrder(name, image, orderId, price, status, documents);
  }

  async isFavoriteOrder(orderId) {
    return this.orderRepository.isFavoriteOrder(orderId);
  }

  async uploadDocument(orderNo,documents) {
    const documentObj = [];
    let transaction;
    try {
      transaction = await sequelize.transaction();
      if (!documents || documents.length === 0) {
        throw new Error("No documents provided");
      }
  
      for (const file of documents) {
        const fileUrl = await uploadFileToS3(file, process.env.SPACES_BUCKET_NAME);
        documentObj.push(fileUrl);
      }
  
      return await this.orderRepository.uploadDocument(orderNo,documentObj,transaction );
      
      await transaction.commit();
      return createdDocs;
    } catch (error) {
      await transaction.rollback();
      
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

  async deleteOrder(orderNo) {
    return await this.orderRepository.deleteOrder(orderNo);
  }

  async getUserOrders(userId) {
    return await this.orderRepository.getUserOrders(userId);
  }

  async getAllUserOrders(){
    return await this.orderRepository.getAllUserOrders();  
  }

  async getOrderById(orderId) {
    return await this.orderRepository.getOrderByOrderId(orderId);
  }
}

module.exports = OrderService;
