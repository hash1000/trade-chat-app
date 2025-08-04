const UserRepository = require("../repositories/UserRepository");
const ChatService = require("../services/ChatService");
const chatService = new ChatService();
const userRepository = new UserRepository();

class ChatController {
  async chatRequest(req, res) {
    const { requesteeId } = req.body;
    const { id: userId } = req.user;

    const chat = await chatService.chatRequest(userId, requesteeId);

    res.json(chat);
  }

  async inviteRequest(req, res) {
    try {
      const { requesteeId } = req.body;
      const { id: userId } = req.user;

      // Convert both IDs to numbers (or strings, depending on your needs)
      const requesteeIdNumber = Number(requesteeId);
      const userIdNumber = Number(userId);

      // Check if the user is trying to send an invite to themselves
      if (requesteeIdNumber !== userIdNumber) {
        const chat = await chatService.inviteRequest(
          userIdNumber,
          requesteeIdNumber
        );
        return res.status(200).json(chat);
      } else {
        return res
          .status(400)
          .json({ error: "You cannot send an invite to yourself." });
      }
    } catch (error) {
      // Handle any unexpected errors
      console.error("Error in inviteRequest:", error);
      return res
        .status(500)
        .json({ error: "An error occurred while sending the invite." });
    }
  }

  async inviteCancel(req, res) {
    try {
      const { requesteeId } = req.body;
      const { id: userId } = req.user;

      // Convert both IDs to numbers (or strings, depending on your needs)
      const requesteeIdNumber = Number(requesteeId);
      const userIdNumber = Number(userId);

      //check itself
      if (requesteeIdNumber !== userIdNumber) {
        const chat = await chatService.inviteCancel(
          userIdNumber,
          requesteeIdNumber
        );
        return res.status(200).json(chat);
      } else {
        return res
          .status(400)
          .json({ error: "You cannot send an invite to yourself." });
      }
    } catch (error) {
      console.error("Error in request:", error);
      return res
        .status(500)
        .json({ error: "An error occurred while sending the invite." });
    }
  }

  async updateChats(req, res) {
    try {
      const { requesteeId, userName, profilePic, description, tags } = req.body;
      const { id: userId } = req.user;

      const friendUpdate = await chatService.updateChats(
        userId,
        requesteeId,
        userName,
        profilePic,
        description,
        tags
      );

      return res.status(200).json(friendUpdate);
    } catch (error) {
      console.error("Error updating chat:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  async getChats(req, res) {
    const { page = 1, pageSize = 10 } = req.body;
    const { id: userId } = req.user;
    try {
      const chat = await chatService.getChats(userId, page, pageSize);
      res.json(chat);
    } catch (e) {
      console.log(e);
    }
  }

  async getSingleChat(req, res) {
    try {
      const { requesteeId } = req.body;
      const { id: userId } = req.user;

      const chatResponse = await chatService.getSingleChat(userId, requesteeId);

      return res.status(200).json({
        status: "success",
        data: chatResponse,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        status: "error",
        message: "An error occurred while retrieving the chat.",
      });
    }
  }

  async getMessages(req, res) {
    const { chatId } = req.params;
    const { id: userId } = req.user;
    const { page = 1, pageSize = 10, messageId = null } = req.query;
    const message = await chatService.getMessages(
      chatId,
      page,
      pageSize,
      messageId,
      userId
    );
    res.json(message);
  }

  async deleteChat(req, res) {
    const { chatId } = req.params;
    await chatService.deleteChat(chatId);
    res.json({
      message: "successfully deleted chat",
    });
  }

  async getUserTransactions(req, res) {
    const { id: userId } = req.user;
    // if from and to are not provided, return all transactions for past 30 days
    const { specificUserId, from, to, transaction_time = null } = req.query;
    let finalFrom = from;
    let finalTo = to ? new Date(to) : new Date();
    finalTo.setHours(23, 59, 59, 999);

    if (transaction_time !== null) {
      // transaction_time can be 0,1,2
      // 0 means previous day
      // 1 means 7 days ago from now
      // 2 means last full month from now
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      if (transaction_time == 0) {
        finalFrom = new Date(date.setDate(date.getDate() - 3));
        finalTo = new Date(finalFrom);
        finalTo.setDate(date.getDate() + 3);
        finalTo.setHours(23, 59, 59, 999);
      } else if (transaction_time == 1) {
        finalFrom = new Date(date.setDate(date.getDate() - 7));
        finalTo = new Date(finalFrom);
        finalTo.setDate(date.getDate() + 7);
        finalTo.setHours(23, 59, 59, 999);
      } else if (transaction_time == 2) {
        finalFrom = new Date(date.setDate(date.getDate() - 30));
        finalTo = new Date(finalFrom);
        finalTo.setDate(date.getDate() + 30);
        finalTo.setHours(23, 59, 59, 999);
      }
    }

    // if finalFrom and finalTo are not provided, return all transactions for past 30 days
    finalFrom = finalFrom || new Date(new Date() - 30 * 24 * 60 * 60 * 1000);

    const transactions = await chatService.getUserTransactions(
      userId,
      specificUserId,
      finalFrom,
      finalTo
    );
    res.json(transactions);
  }

  async sendPayment(req, res) {
    try {
      const { amount, requesteeId } = req.body;
      const { id: requesterId } = req.user;

      // Validate input
      if (!amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }
      if (!requesteeId) {
        return res.status(400).json({ error: "Recipient ID is required" });
      }

      // Get requester's balance
      const requester = await userRepository.getById(requesterId);
      if (!requester) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if requester has sufficient balance
      if (requester.personalWalletBalance < amount) {
        return res.status(400).json({
          error: "Insufficient funds",
          currentBalance: requester.personalWalletBalance,
          requiredAmount: amount,
        });
      }

      // Get recipient
      const recipient = await userRepository.getById(requesteeId);
      if (!recipient) {
        return res.status(404).json({ error: "Recipient not found" });
      }

      // Process payment
      const payment = await chatService.sendPayment(
        Number(requesterId),
        Number(requesteeId),
        Number(amount)
      );

      res.status(200).json({
        success: true,
        payment,
        newBalance: requester.personalWalletBalance - amount,
      });
    } catch (error) {
      console.error("Payment error:", error);
      res.status(500).json({
        error: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  }

  async sendPaymentRequest(req, res) {
    const { amount, requesteeId } = req.body;
    const { id: requesterId } = req.user;

    try {
      // Check requester's balance
      const requester = await userRepository.getById(requesterId);
      // Create payment request
      const paymentRequest = await chatService.sendPaymentRequest(
        Number(requesterId),
        Number(requesteeId),
        amount
      );

      res.json(paymentRequest);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // repositories/paymentRepository.js
  async completePaymentRequest(paymentRequestId) {
    const paymentRequest = await PaymentRequest.findByPk(paymentRequestId, {
      include: ["requester", "requestee"],
    });

    if (!paymentRequest) throw new Error("Payment request not found");
    if (paymentRequest.status !== "pending") {
      throw new Error("Payment request already processed");
    }

    // Transfer funds
    await userService.transferFunds(
      paymentRequest.requesterId,
      paymentRequest.requesteeId,
      paymentRequest.amount
    );

    // Update payment request status
    await paymentRequest.update({ status: "completed" });

    return paymentRequest;
  }

    async bulkForwardMessages(req, res) {
    const {
      body: { payload, recipientId },
      files,
    } = req;
    const { id: userId } = req.user;
    const messages = await chatService.bulkForwardMessages(
      payload,
      files,
      userId,
      recipientId,
      req.user,
      req
    );
    res.json({
      message: "successfully forwarded messages",
      data: messages,
    });
  }
}

module.exports = ChatController;
