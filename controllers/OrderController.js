const { HostNotFoundError, ValidationError } = require("sequelize");
const OrderService = require("../services/OrderService");
const orderService = new OrderService();

class OrderController {
  async createOrder(req, res) {
    try {
      const { name, image, orderNo, price, status } = req.body;
      const { userId } = req.parsedParams;
  
      const createdOrder = await orderService.createOrder(
        name,
        image,
        userId,
        orderNo,
        price,
        status
      );
      if (createdOrder === null) {
        return res.status(404).json({
          message: "No address found for the given user ID.",
          addressStatus: "not_found",
        });
      }

      return res.status(200).json({
        message: "Order added successfully.",
        createdOrder,
      });
  
    } catch (error) {
      console.error("Error creating order:", error);
  
      if (error.message.startsWith("Invalid Product IDs:")) {
        return res.status(400).json({ error: error.message });
      }
  
      return res.status(500).json({ error: "Internal server error" });
    }
  }
  
  async updateOrder(req, res) {
    try {
      const { name, image, price, status, documents } = req.body;
      const { orderId } = req.parsedParams;
      console.log("name, image, price, status, documents",name, image, price, status, documents, orderId);
      // Update the order
      const updatedOrder = await orderService.updateOrder(
        name,
        image,
        orderId,
        price,
        status,
        documents
      );

      res.json(updatedOrder);
    } catch (error) {
      console.error("Error updating order:", error);
      if (
        error.message.startsWith("Invalid Product IDs:") ||
        error.message.startsWith("Product not found")
      ) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Order not found" });
      }
    }
  }

  async uploadDocument(req, res) {
    try {
      const orderNo = req.params.orderNo;
      // Use middleware like multer to handle file uploads
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }
  
      const result = await orderService.uploadDocument(orderNo, req.files);
  
      res.json({
        message: "Documents uploaded successfully",
        count: result.length,
        documents: result
      });
    } catch (error) {
      console.error("Error uploading documents:", error);
      let statusCode = 500;
      if (error instanceof HostNotFoundError) statusCode = 404;
      else if (error instanceof ValidationError) statusCode = 400;
      res.status(statusCode).json({ error: error.message });
    }
  }

  async deleteOrder(req, res) {
    try {
      const { orderNo } = req.params;
      const result = await orderService.deleteOrder(orderNo);

      return res.status(result.status).json({ message: result.message });
    } catch (error) {
      console.error("Error deleting order:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  async getUserOrders(req, res) {
    try {
      const { userId } = req.parsedParams;

      const userOrders = await orderService.getUserOrders(userId);
  
      if (userOrders.length === 0) {
        return res.status(404).json({ message: "No orders found for this user" });
      }
  
      res.status(200).json({
        message: "Orders retrieved successfully",
        orders: userOrders,
      });
    } catch (error) {
      console.error("Error fetching user orders:", error);
  
      res.status(500).json({
        error: "Internal server error",
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
  
  async getOrderById(req, res) {
    try {
      const { orderId } = req.parsedParams;
      const order = await orderService.getOrderById(orderId);
  
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
  
      res.status(200).json({
        message: "Order retrieved successfully",
        order,
      });
    } catch (error) {
      console.error("Error fetching order:", error);
  
      res.status(500).json({
        error: "Internal server error",
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
  
}

module.exports = OrderController;
