const { HostNotFoundError, ValidationError } = require("sequelize");
const OrderService = require("../services/OrderService");
const orderService = new OrderService();

class OrderController {

  async createOrder(req, res) {
    try {
      const { ids, names } = req.userRoles;
      const { name, image, orderNo, price, status } = req.body;
      const { userId } = req.parsedParams;
      const creatorId = req.user.id;

      let createdOrder;
      // Check permissions and update order accordingly
      if (names.includes("admin")) {
        createdOrder = await orderService.createOrder(
          name,
          image,
          userId,
          creatorId,
          "admin",
          orderNo,
          price,
          status
        );
      } else if (names.includes("operator")) {
        createdOrder = await orderService.createOrder(
          name,
          image,
          userId,
          creatorId,
          "operator",
          orderNo,
          price,
          status
        );
      } else {
        // If user has no valid role to update the order
        return res.status(403).json({ error: "Unauthorized: Insufficient permissions" });
      }

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

  async updateOrderAddress(req, res) {
    try {
      const user = req.user; // Extract user from request
      const { orderId } = req.parsedParams;
      const { pin, type, ...updateFields } = req.body;
      if (!updateFields || Object.keys(updateFields).length === 0) {
        return res
          .status(400)
          .json({ error: "No fields provided for update." });
      }
      // Update the address
      const updatedAddress = await orderService.updateOrderAddress(
        user.id,
        orderId,
        updateFields
      );

      return res.status(200).json({
        message: "Address updated successfully.",
        address: updatedAddress,
      });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  async updateOrder(req, res) {
    try {
      const { ids, names } = req.userRoles;
      const { name, image, price, status, documents } = req.body;
      const { orderId } = req.parsedParams;

      let updatedOrder;

      // Check permissions and update order accordingly
      if (names.includes("admin")) {
        updatedOrder = await orderService.updateOrder(
          name,
          image,
          orderId,
          price,
          status,
          documents
        );
      } else if (names.includes("operator")) {
        updatedOrder = await orderService.updateOperatorOrder(
          name,
          image,
          orderId,
          price,
          status,
          documents
        );
      } else {
        // If user has no valid role to update the order
        return res.status(403).json({ error: "Unauthorized: Insufficient permissions" });
      }

      // Return the updated order
      res.json(updatedOrder);
    } catch (error) {
      console.error("Error updating order:", error);
      return res.status(400).json({ error: error.message });
    }
  }

  async isFavoriteOrder(req, res) {
    try {
      const { orderId } = req.parsedParams;

      const result = await orderService.isFavoriteOrder(orderId);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  async uploadDocument(req, res) {
    try {
      const orderNo = req.params.orderNo;
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }
      const result = await orderService.uploadDocument(orderNo, req.files);
      res.json({
        message: "Documents uploaded successfully",
        count: result.length,
        documents: result,
      });
    } catch (error) {
      console.error("Error uploading order:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  async deleteOrder(req, res) {
    try {
      const { ids, names } = req.userRoles;
      const { orderNo } = req.params;

      let deleteResult;

      // Check permissions and delete order accordingly
      if (names.includes("admin")) {
        deleteResult = await orderService.deleteOrder(orderNo, "admin");
      } else if (names.includes("operator")) {
        deleteResult = await orderService.deleteOrder(orderNo, "operator");
      } else {
        // If user has no valid role to delete the order
        return res.status(403).json({ error: "Unauthorized: Insufficient permissions" });
      }

      // Return the result of the delete operation
      return res.status(deleteResult.status).json({ message: deleteResult.message });
    } catch (error) {
      console.error("Error deleting order:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  async getUserOrders(req, res) {
    try {
      const { ids, names } = req.userRoles;
      const { userId } = req.params;

      let userOrders;

      // Check permissions and fetch orders accordingly
      if (names.includes("admin")) {
        userOrders = await orderService.getUserOrders(userId);
      } else if (names.includes("operator")) {
        userOrders = await orderService.getUserOrders(userId, "operator");
      } else if (names.includes("user")) {
        userOrders = await orderService.getUserOrders(userId);
      } else {
        return res.status(403).json({ error: "Unauthorized: Insufficient permissions" });
      }

      // Return the orders
      return res.status(200).json({
        message: "Orders retrieved successfully",
        orders: userOrders,
      });
    } catch (error) {
      console.error("Error fetching user orders:", error);

      // Handle specific errors
      if (error.message.includes("No orders found")) {
        return res.status(404).json({ error: error.message });
      } else {
        return res.status(500).json({
          error: "Internal server error",
          details: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
      }
    }
  }

  async getAllUserOrders(req, res) {
    try {
        const { ids, names } = req.userRoles;
        const userId = req.user.id; // Get the logged-in user's ID
        console.log("userId", userId);

        let userAllOrders;

        // Check permissions and fetch orders accordingly
        if (names.includes("admin")) {
            userAllOrders = await orderService.getAllUserOrders();
        } else if (names.includes("operator")) {
            userAllOrders = await orderService.getAllUserOrders("operator");
        } else if (names.includes("user")) {
            userAllOrders = await orderService.getUserOrders(userId);
        } else {
            return res.status(403).json({ error: "Unauthorized: Insufficient permissions" });
        }

        // Return the orders
        return res.status(200).json({
            message: "Orders retrieved successfully",
            orders: userAllOrders,
        });
    } catch (error) {
        console.error("Error fetching all user orders:", error);

        // Handle specific errors
        if (error.message.includes("No orders found")) {
            return res.status(404).json({ error: error.message });
        } else {
            return res.status(500).json({
                error: "Internal server error",
                details: process.env.NODE_ENV === "development" ? error.message : undefined,
            });
        }
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
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
}

module.exports = OrderController;
