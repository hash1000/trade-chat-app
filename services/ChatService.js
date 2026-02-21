
const UserService = require("./UserService");
const ChatRepository = require("../repositories/ChatRepository");
const PaymentRepository = require("../repositories/PaymentRepository");
const UserRepository = require("../repositories/UserRepository");
const socket = require("../config/socket");
const InSufficientBalance = require("../errors/InSufficientBalance");
const { User } = require("../models");
const path = require("path");

const {
  PutObjectCommand,
  S3Client
} = require("@aws-sdk/client-s3");

const s3Client = new S3Client({
  endpoint: process.env.SPACES_END_POINT, // Find your endpoint in the control panel, under Settings. Prepend "https://".
  forcePathStyle: false, // Configures to use subdomain/virtual calling format.
  region: process.env.SPACES_REGION, // Must be "us-east-1" when creating new Spaces. Otherwise, use the region in your endpoint (for example, nyc3).
  credentials: {
    accessKeyId: process.env.SPACES_ACCESS_KEY, // Access key pair. You can create access key pairs using the control panel or API.
    secretAccessKey: process.env.SPACES_SECRET, // Secret access key defined through an environment variable.
  },
});
const userService = new UserService();

class CartService {
  constructor() {
    this.chatRepository = new ChatRepository();
    this.paymentRepository = new PaymentRepository();
    this.userRepository = new UserRepository();
  }

  async chatRequest(requesterId, requesteeId) {
    const io = socket.getIO();
    // Create a new chat if it doesn't exist already
    let chat = await this.chatRepository.findChat(requesterId, requesteeId);

    if (!chat) {
      chat = await this.chatRepository.createChat(requesterId, requesteeId);
    }

    // Notify the requested user that someone wants to chat with them
    io.to(`user-${requesteeId}`).emit("chat request", {
      chatId: chat.id,
      fromUserId: requesterId,
    });

    return { chatId: chat.id };
  }
  async inviteRequest(requesterId, requesteeId) {
    try {
      const user = await User.findByPk(requesteeId);
      if (!user) {
        return {
          status: 404,
          message: "User not found.",
        };
      }
      // Check if a chat already exists between the two users
      let chat = await this.chatRepository.findExistingChat(requesterId, requesteeId);
  
      if (!chat) {
        // If no chat exists, create a new invite
        chat = await this.chatRepository.createInvite(requesterId, requesteeId);
        return {
          message: 'Successfully sent friend request.',
          chatId: chat.id,
        };
      }
  
      return {
        message: 'Friend request already sent.',
        chatId: chat.id,
      };
    } catch (error) {
      console.error('Error in inviteRequest:', error);
      return {
        message: 'Failed to send friend request. Please try again later.',
        error: error.message || 'Unknown error',
      };
    }
  }
  
  async inviteCancel(requesterId, requesteeId) {
    try {
      // Check if a chat already exists between the two users
      let chat = await this.chatRepository.findExistingChat(requesterId, requesteeId);
  
      if (!chat) {
        // If no chat exists, return a not found message
        return {
          message: 'No friend request found to cancel.',
        };
      }
  
      // Cancel the invite
      await this.chatRepository.cancelInvite(requesterId, requesteeId);
      return {
        message: 'Successfully canceled friend request.',
      };
    } catch (error) {
      console.error('Error in inviteCancel:', error);
      return {
        message: 'Failed to cancel friend request. Please try again later.',
        error: error.message || 'Unknown error',
      };
    }
  }
  

  async getChats(userId, page, pageSize) {
    return await this.chatRepository.getUserChat(userId, page, pageSize);
  }

  async updateChats(
    requesterId,
    requesteeId,
    userName,
    profilePic,
    description,
    rating,
    tags
  ) {
    let chat = await this.chatRepository.findInvite(requesterId, requesteeId);
    if (!chat) {
      return {
        message: `not sent any invite to this User not found and user id is  ${requesterId}`,
      };
    } else {
      chat = await this.chatRepository.updateFriend(
        requesterId,
        requesteeId,
        userName,
        profilePic,
        description,
        rating,
        tags
      );
    }
    return {
      message:
        chat > 0
          ? `friend and userTags successfully updated `
          : `you cannot invite with this id: ${requesteeId} `,
      chatId: chat,
    };
  }

  async getMessages(chatId, page, pageSize, messageId, userId) {
    return await this.chatRepository.getMessages(
      chatId,
      page,
      pageSize,
      messageId,
      userId
    );
  }

  async deleteChat(chatId, page, pageSize) {
    return await this.chatRepository.deleteChat(chatId);
  }

  async getSingleChat(requesterId, requesteeId) {
    const user = await this.chatRepository.findSingleChat(
      requesterId,
      requesteeId
    );
    const { favourite, chat } = user;

    return {
      isFriend: chat !== null ? true : false,
      isFavourite: favourite !== null ? true : false,
    };
  }

  async getUserTransactions(userId, specificUserId, from, to) {
    return await this.chatRepository.getUserTransactions(
      userId,
      specificUserId,
      from,
      to
    );
  }

  // services/chatService.js
  async sendPaymentRequest(requesterId, requesteeId, amount, description) {
    try {
      const users = await userService.getUsersByIds([requesterId, requesteeId]);
      if (users.length !== 2) {
        throw new Error("One or both users not found");
      }

      const paymentRequest = await this.paymentRepository.createPaymentRequest(
        requesterId,
        requesteeId,
        amount,
        description
      );

      return paymentRequest;
    } catch (error) {
      console.error("Error in sendPaymentRequest:", error.message);
      throw error;
    }
  }

  async sendPayment(requesterId, requesteeId, amount, description) {
    const user = await userService.getUserById(requesteeId);
    if (!user) {
      return { message: `User with ID ${requesteeId} not found` };
    }
    if (requesterId === requesteeId && user.roles[0].name !== "admin") {
      return {
        message: "Regular users cannot transfer balance to themselves.",
        success: false,
      };
    }

    const paymentRequest = await this.paymentRepository.createPaymentRequest(
      requesterId,
      requesteeId,
      amount,
      description,
      "accepted"
    );

    this.transferBalance(requesterId, requesteeId, amount)
      .then(() => {
        // Handle success
      })
      .catch((error) => {
        if (error instanceof InSufficientBalance) {
          return socket.emit("error", "Not enough balance");
        }
      });
    const transaction = await this.chatRepository.getTransactionById(
      paymentRequest.id
    );
    return transaction;
  }

  async transferBalance(fromUserId, toUserId, amount) {
    try {
      const sender = await userService.getUserById(fromUserId);
      if (fromUserId === toUserId && sender.roles[0].name === "admin") {
        sender.personalWalletBalance += amount;
        await sender.save();
        console.log(`Added ${amount} units to user's own wallet.`);
        return;
      }

      if (sender.personalWalletBalance >= amount) {
        sender.personalWalletBalance -= amount;
        await sender.save();

        // Add balance to the receiver
        const receiver = await User.findByPk(toUserId);
        receiver.personalWalletBalance += amount;
        await receiver.save();
        console.log(`Successfully transferred ${amount} units.`);
      }
    } catch (error) {
      console.error("Error transferring balance:", error);
      throw error;
    }
  }

  async bulkForwardMessages(payload, files, userId, recipientId, user, req) {
    // get chat id if chat exists else create chat
    const chat = await this.chatRepository.findOrCreateChat(
      userId,
      recipientId
    );
    const { id: chatId } = chat;

    // parse the payload for the files and upload them to the server
    let fileUrls = [];
    if (files && files.length > 0) {
      fileUrls = await Promise.all(
        files.map(async (file) => {
          console.log(file.originalname);
          const fileName = `${chatId}-${Date.now()}${path.extname(
            file.originalname
          )}`;
          const params = {
            Bucket: process.env.SPACES_BUCKET_NAME,
            Key: fileName,
            Body: file.buffer,
          };
          await s3Client.send(new PutObjectCommand(params));
          return fileName;
        })
      );
    }

    // replace the index with the fileUrl in the payload
    const modifiedPayload = payload.map((message) => {
      if (message.index != null) {
        message.fileUrl = fileUrls[message.index];
      }
      if (message.thumbnail_index != null) {
        message.settings = {
          ...(message.settings || {}),
          thumbnail_url: fileUrls[message.thumbnail_index],
        };
      }
      return message;
    });

    // create messages
    const messages = await this.chatRepository.createMessages(
      chatId,
      userId,
      modifiedPayload
    );

    const io = await req.app.get("io");
    messages.forEach((message) => {
      io.to(`chat-${chatId}`).emit("message event", message);
    });

    const otherUser = await User.findOne({ where: { id: recipientId } });
    // await new NewMessageNotification(otherUser.fcm,messages[messages.length-1], user).sendNotification();
    return messages;
  }
}

module.exports = CartService;
