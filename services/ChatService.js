const sequelize = require("../config/database");
const UserService = require("./UserService");
const ChatRepository = require("../repositories/ChatRepository");
const PaymentRepository = require("../repositories/PaymentRepository");
const UserRepository = require("../repositories/UserRepository");
const socket = require("../config/socket");
const { User } = require("../models");
const Role = require("../models/role");
const path = require("path");
const WalletService = require("./WalletService");
const crypto = require("crypto");

const { PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const Wallet = require("../models/wallet");

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
const walletService = new WalletService();

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
      let chat = await this.chatRepository.findExistingChat(
        requesterId,
        requesteeId,
      );

      if (!chat) {
        // If no chat exists, create a new invite
        chat = await this.chatRepository.createInvite(requesterId, requesteeId);
        return {
          message: "Successfully sent friend request.",
          chatId: chat.id,
        };
      }

      return {
        message: "Friend request already sent.",
        chatId: chat.id,
      };
    } catch (error) {
      console.error("Error in inviteRequest:", error);
      return {
        message: "Failed to send friend request. Please try again later.",
        error: error.message || "Unknown error",
      };
    }
  }

  async inviteCancel(requesterId, requesteeId) {
    try {
      // Check if a chat already exists between the two users
      let chat = await this.chatRepository.findExistingChat(
        requesterId,
        requesteeId,
      );

      if (!chat) {
        // If no chat exists, return a not found message
        return {
          message: "No friend request found to cancel.",
        };
      }

      // Cancel the invite
      await this.chatRepository.cancelInvite(requesterId, requesteeId);
      return {
        message: "Successfully canceled friend request.",
      };
    } catch (error) {
      console.error("Error in inviteCancel:", error);
      return {
        message: "Failed to cancel friend request. Please try again later.",
        error: error.message || "Unknown error",
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
    tags,
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
        tags,
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
      userId,
    );
  }

  async deleteChat(chatId, page, pageSize) {
    return await this.chatRepository.deleteChat(chatId);
  }

  async getSingleChat(requesterId, requesteeId) {
    const user = await this.chatRepository.findSingleChat(
      requesterId,
      requesteeId,
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
      to,
    );
  }

  // services/chatService.js
  async sendPaymentRequest(
    requesterId,
    requesteeId,
    amount,
    currency,
    description,
  ) {
    try {
      const users = await userService.getUsersByIds([requesterId, requesteeId]);
      if (users.length !== 2) {
        throw new Error("One or both users not found");
      }

      const paymentRequest = await this.paymentRepository.createPaymentRequest(
        requesterId,
        requesteeId,
        amount,
        currency,
        description,
      );

      return paymentRequest;
    } catch (error) {
      console.error("Error in sendPaymentRequest:", error.message);
      throw error;
    }
  }

  async sendPayment(requesterId, requesteeId, amount, currency, description) {
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
      currency,
      description,
      "accepted",
    );

    // Now perform the balance transfer
    await this.transferBalance(requesterId, requesteeId, amount, currency);

    const transaction = await this.chatRepository.getTransactionById(
      paymentRequest.id,
    );
    return transaction;
  }

  async adminDecreasePayment(
    adminUserId,
    targetUserId,
    amount,
    currency,
    description,
    walletType = "PERSONAL",
  ) {
    const user = await userService.getUserById(targetUserId);
    if (!user) {
      throw new Error(`User with ID ${targetUserId} not found`);
    }

    return walletService.withdraw({
      userId: targetUserId,
      currency,
      amount,
      walletType,
      meta: {
        source: "admin_manual_decrease",
        description: description || null,
      },
      performedBy: adminUserId,
    });
  }

  async adminAddPayment(
    adminUserId,
    targetUserId,
    amount,
    currency,
    description,
    walletType = "PERSONAL",
  ) {
    const user = await userService.getUserById(targetUserId);
    if (!user) {
      throw new Error(`User with ID ${targetUserId} not found`);
    }

    return walletService.deposit({
      userId: targetUserId,
      currency,
      amount,
      walletType,
      meta: {
        source: "admin_manual_add",
        description: description || null,
      },
      performedBy: adminUserId,
    });
  }

  async transferBalance(fromUserId, toUserId, amount, currency) {
    const t = await sequelize.transaction();
    try {
      const fromId = Number(fromUserId);
      const toId = Number(toUserId);
      const transferAmount = Number(amount);
      const normalizedCurrency = String(currency || "").trim().toUpperCase();

      if (!Number.isFinite(fromId) || !Number.isFinite(toId)) {
        throw new Error("Invalid sender/recipient userId");
      }
      if (!Number.isFinite(transferAmount) || transferAmount <= 0) {
        throw new Error("Invalid transfer amount");
      }
      if (!normalizedCurrency || normalizedCurrency.length !== 3) {
        throw new Error("Invalid currency");
      }

      const senderUser = await User.findByPk(fromId, {
        include: [{ model: Role, as: "roles" }],
        transaction: t,
      });
      const senderRole = senderUser?.roles?.[0]?.name;
      const isAdmin = String(senderRole || "").toLowerCase() === "admin";
      const isSameUser = fromId === toId;

      if (isSameUser && !isAdmin) {
        throw new Error("Regular users cannot transfer balance to themselves.");
      }

      // Lock wallets in stable order to reduce deadlocks
      const firstUserId = Math.min(fromId, toId);
      const secondUserId = Math.max(fromId, toId);

      const firstWallet = await Wallet.findOne({
        where: { userId: firstUserId, currency: normalizedCurrency, walletType: "PERSONAL" },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      const secondWallet =
        secondUserId === firstUserId
          ? firstWallet
          : await Wallet.findOne({
              where: { userId: secondUserId, currency: normalizedCurrency, walletType: "PERSONAL" },
              transaction: t,
              lock: t.LOCK.UPDATE,
            });

      const senderWallet = fromId === firstUserId ? firstWallet : secondWallet;
      const recipientWallet = toId === firstUserId ? firstWallet : secondWallet;

      if (!senderWallet || !recipientWallet) {
        throw new Error("Wallet not found for sender or recipient");
      }

      const senderAvailableBalance = Number(senderWallet.availableBalance) || 0;
      const recipientAvailableBalance = Number(recipientWallet.availableBalance) || 0;

      // Admin self transfer: credit availableBalance (no debit)
      if (isSameUser && isAdmin) {
        const after = senderAvailableBalance + transferAmount;
        const groupId = crypto.randomUUID();

        await walletService.createWalletTransaction(
          {
            transaction_group_id: groupId,
            walletId: senderWallet.id,
            userId: toId,
            type: "DEPOSIT",
            amount: transferAmount,
            currency: normalizedCurrency,
            receiptId: null,
            meta: {
              source: "admin_deposit_self",
              balanceBefore: senderAvailableBalance,
              balanceAfter: after,
            },
            performedBy: fromId,
          },
          t,
        );

        senderWallet.availableBalance = after;
        await senderWallet.save({ transaction: t });
        await t.commit();
        return { transaction_group_id: groupId };
      }

      if (senderAvailableBalance < transferAmount) {
        throw new Error("Insufficient balance");
      }

      const groupId = crypto.randomUUID();

      const senderAfter = senderAvailableBalance - transferAmount;
      await walletService.createWalletTransaction(
        {
          transaction_group_id: groupId,
          walletId: senderWallet.id,
          userId: fromId,
          type: "TRANSFER",
          amount: -transferAmount,
          currency: normalizedCurrency,
          receiptId: null,
          meta: {
            source: "transfer_out",
            toUser: toId,
            balanceBefore: senderAvailableBalance,
            balanceAfter: senderAfter,
          },
          performedBy: fromId,
        },
        t,
      );

      senderWallet.availableBalance = senderAfter;
      await senderWallet.save({ transaction: t });

      const recipientAfter = recipientAvailableBalance + transferAmount;
      await walletService.createWalletTransaction(
        {
          transaction_group_id: groupId,
          walletId: recipientWallet.id,
          userId: toId,
          type: "TRANSFER",
          amount: transferAmount,
          currency: normalizedCurrency,
          receiptId: null,
          meta: {
            source: "transfer_in",
            fromUser: fromId,
            balanceBefore: recipientAvailableBalance,
            balanceAfter: recipientAfter,
          },
          performedBy: fromId,
        },
        t,
      );

      recipientWallet.availableBalance = recipientAfter;
      await recipientWallet.save({ transaction: t });

      await t.commit();
      return { transaction_group_id: groupId };
    } catch (error) {
      await t.rollback();
      console.error("Error transferring balance:", error);
      throw error;
    }
  }

  async bulkForwardMessages(payload, files, userId, recipientId, user, req) {
    // get chat id if chat exists else create chat
    const chat = await this.chatRepository.findOrCreateChat(
      userId,
      recipientId,
    );
    const { id: chatId } = chat;

    // parse the payload for the files and upload them to the server
    let fileUrls = [];
    if (files && files.length > 0) {
      fileUrls = await Promise.all(
        files.map(async (file) => {
          console.log(file.originalname);
          const fileName = `${chatId}-${Date.now()}${path.extname(
            file.originalname,
          )}`;
          const params = {
            Bucket: process.env.SPACES_BUCKET_NAME,
            Key: fileName,
            Body: file.buffer,
          };
          await s3Client.send(new PutObjectCommand(params));
          return fileName;
        }),
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
      modifiedPayload,
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
