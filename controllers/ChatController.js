const ChatService = require("../services/ChatService");
const chatService = new ChatService();

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

  async sendPaymentRequest(req, res) {
    const { amount, requesteeId } = req.body;
    const { id: requesterId } = req.user;
    const paymentRequest = await chatService.sendPaymentRequest(
      Number(requesterId),
      Number(requesteeId),
      amount
    );
    res.json(paymentRequest);
  }

  async sendPayment(req, res) {
    try {
      const { amount, requesteeId } = req.body;
      const { id: requesterId } = req.user;

      // Call the payment service to handle the payment
      const payment = await chatService.sendPayment(
        Number(requesterId),
        Number(requesteeId),
        Number(amount)
      );

      res.status(200).json(payment);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
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
