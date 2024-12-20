const { Op } = require("sequelize");
const sequelize = require("../config/database");

const Chat = require("../models/chat");
const User = require("../models/user");
const Message = require("../models/message");
const PaymentRequest = require("../models/payment_request");
const FavouritePayment = require("../models/favourite_payments");
const UserFavourite = require("../models/user_favourites");

class ChatRepository {
  async findChat(requesterId, requesteeId) {
    return Chat.findOne({
      where: {
        [Op.or]: [
          { user1Id: requesterId, user2Id: requesteeId },
          { user1Id: requesteeId, user2Id: requesterId },
        ],
      },
    });
  }

  async findSingleChat(requesterId, requesteeId) {
    try {
      // Update the column names to match your database schema
      const favourite = await UserFavourite.findOne({
        where: { userId: requesterId, profileId: requesteeId },
      });

      const chat = await Chat.findOne({
        where: {
          [Op.and]: [{ user2Id: requesteeId }, { user1Id: requesterId }],
        },
      });

      return { favourite, chat };
    } catch (error) {
      console.error("Error in findSingleChat:", error);
      throw error;
    }
  }

  async findInvite(requesterId, requesteeId) {
    return Chat.findOne({
      where: {
        [Op.or]: [
          { user1Id: requesterId, user2Id: requesteeId },
          { user1Id: requesteeId, user2Id: requesterId },
        ],
      },
    });
  }
  async findExistingChat(requesterId, requesteeId) {
    return Chat.findOne({
      where: {
        user1Id: requesterId,
        user2Id: requesteeId,
      },
    });
  }
  // Create a new user
  async createChat(requesterId, requesteeId) {
    return Chat.create({
      user1Id: requesterId,
      user2Id: requesteeId,
    });
  }
  // Create a new user
  async createInvite(requesterId, requesteeId) {
    return Chat.create({
      user1Id: requesterId,
      user2Id: requesteeId,
    });
  }

  async cancelInvite(requesterId, requesteeId) {
    return Chat.destroy({
      where: {
        [Op.or]: [
          { user1Id: requesterId },
          { user2Id: requesteeId },
        ],
      }
    });
  }

  async findOrCreateChat(requesterId, requesteeId) {
    const chat = await this.findChat(requesterId, requesteeId);
    return chat ? chat : await this.createChat(requesterId, requesteeId);
  }

  async getUserChat(userId, page, pageSize) {
    const limit = parseInt(pageSize);
    const offset = (page - 1) * limit;
    const { Op } = require("sequelize");

    // Fetch chats with the latest message
    const chats = await Chat.findAndCountAll({
      where: {
        [Op.or]: [{ user1Id: userId }],
      },
      limit,
      offset,
      include: [
        {
          model: User,
          as: "user2",
          attributes: [
            "firstName",
            "lastName",
            "username",
            "country",
            "gender",
            "age",
            "role",
            "profilePic",
            "description",
            "settings",
            "phoneNumber",
          ],
        },
      ],
    });
    // Map the results to the desired format
    const friends = chats.rows.map((chat) => ({
      id: chat.user2Id,
      username: chat.userName || chat.user2.username,
      firstName: chat.user2.firstName,
      lastName: chat.user2.lastName,
      country: chat.user2.country,
      gender: chat.user2.gender,
      age: chat.user2.age,
      role: chat.user2.role,
      profilePic: chat.profilePic || chat.user2.profilePic,
      description: chat.description || chat.user2.description,
      settings: {
        tags: chat.tags || chat.user2.tags,
      },
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      phoneNumber: chat.phoneNumber || chat.user2.phoneNumber,
    }));

    return friends;
  }

  async getBinaryUserChat(userId, page, pageSize) {
    const limit = parseInt(pageSize, 10);
    const offset = (page - 1) * limit;
    const { Op } = require("sequelize");
  
    // Fetch chats where userId is either user1Id or user2Id
    const chats = await Chat.findAndCountAll({
      where: {
        [Op.or]: [
          { user1Id: userId },
          { user2Id: userId },
        ],
      },
      limit, // Paginate the results
      offset,
      order: [["updatedAt", "DESC"]], // Optional: Order by latest updated chats
    });
  
    return chats;
  }
  

  async getMessages(chatId, page, pageSize, messageId, userId) {
    const chat = await Chat.findByPk(chatId);
    if (!chat) {
      return [];
    }
    let condition = { chatId };
    if (messageId !== null) {
      condition = {
        chatId,
        id: { [Op.gt]: messageId },
      };
    }
    if (messageId === null) {
      if (chat.user1Id === userId) {
        condition = {
          ...condition,
          id: { [Op.gt]: chat.lastReadUser1Id },
        };
      } else {
        condition = {
          ...condition,
          id: { [Op.gt]: chat.lastReadUser2Id },
        };
      }
    }

    const messages = await Message.findAndCountAll({
      where: condition,
      ...(messageId === null && {
        limit: parseInt(pageSize),
        offset: (page - 1) * parseInt(pageSize),
      }),
      order: [["createdAt", "DESC"]],
      include: [{ model: PaymentRequest }],
    });

    const replyToIds = messages.rows
      .filter((message) => message.quoteToId != null)
      .map((message) => message.quoteToId);
    const replyToMessages = await Message.findAll({
      where: {
        id: replyToIds,
      },
    });

    const replyToMessagesMap = replyToMessages.reduce((acc, message) => {
      acc[message.id] = message;
      return acc;
    }, {});

    messages.rows.forEach((message) => {
      if (message.quoteToId != null) {
        message.dataValues.replyTo = replyToMessagesMap[message.quoteToId];
      }
    });

    // if this chat id has lastMessageId and the user is user1Id in the chat set the lastReadUser1Id to the lastMessageId
    // else if this chat id has lastMessageId and the user is user2Id in the chat set the lastReadUser2Id to the lastMessageId
    if (messages.rows.length > 0) {
      const readId = messages.rows[0].id;
      const toUpdate = {};
      if (chat.user1Id === userId) {
        toUpdate.lastReadUser1Id = readId;
      } else {
        toUpdate.lastReadUser2Id = readId;
      }
      await Chat.update(toUpdate, {
        where: {
          id: chatId,
        },
      });

      // // read the chat and take the minimum of the lastReadUser1Id and lastReadUser2Id
      // const latestChat = await Chat.findByPk(chatId)
      // const lastRead = Math.min(latestChat.lastReadUser1Id, latestChat.lastReadUser2Id)
      // // delete all messages with id less than lastRead
      // await Message.destroy({
      //   where: {
      //     chatId,
      //     id: {
      //       [Op.lt]: lastRead,
      //       paymentRequestId: null
      //     }
      //   }
      // })
    }

    return {
      total: messages.count,
      totalPages: Math.ceil(messages.count / pageSize),
      currentPage: page,
      messages: messages.rows,
    };
  }

  async updateFriend(
    requesterId,
    requesteeId,
    userName,
    profilePic,
    description,
    tags
  ) {
    let updateFriend = await Chat.update(
      {
        userName: userName,
        profilePic: profilePic,
        description: description,
        tags: tags,
      },
      {
        where: { user1Id: requesterId, user2Id: requesteeId },
      }
    );
    return [updateFriend];
  }

  async deleteChat(chatId) {
    let transaction;
    try {
      transaction = await sequelize.transaction();

      // get all messages and delete payment requests
      const messages = await Message.findAll({ where: { chatId } });
      const paymentIds = messages
        .filter((message) => message.paymentRequestId != null)
        .map((message) => message.paymentRequestId);
      // Delete the order products associated with the order
      await Message.destroy({
        where: { chatId },
        transaction,
      });

      await FavouritePayment.destroy({
        where: { paymentId: paymentIds },
        transaction,
      });

      await PaymentRequest.destroy({
        where: { id: paymentIds },
        transaction,
      });

      // Delete the order
      await Chat.destroy({
        where: { id: chatId },
        transaction,
      });

      await transaction.commit();
    } catch (error) {
      if (transaction) await transaction.rollback();
      throw error;
    }
  }

  async getUserTransactions(userId, specificUserId, from, to) {
    // if specificUserId is provided, get transactions between the two users
    let condition = {
      status: "accepted",
      createdAt: {
        [Op.between]: [from, to],
      },
      [Op.or]: [
        {
          requesteeId: userId,
        },
        {
          requesterId: userId,
        },
      ],
    };
    if (specificUserId) {
      condition = {
        status: "accepted",
        createdAt: {
          [Op.between]: [from, to],
        },
        [Op.or]: [
          {
            requesteeId: userId,
            requesterId: specificUserId,
          },
          {
            requesteeId: specificUserId,
            requesterId: userId,
          },
        ],
      };
    }
    const transactions = await PaymentRequest.findAndCountAll({
      where: condition,
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: User,
          as: "requester",
          attributes: [
            "id",
            "username",
            "phoneNumber",
            "profilePic",
            "email",
            "settings",
          ],
        },
        {
          model: User,
          as: "requestee",
          attributes: [
            "id",
            "username",
            "phoneNumber",
            "profilePic",
            "email",
            "settings",
          ],
        },
      ],
    });

    // count total transactions, total outgoing transactions, total incoming transactions, total amount sent, total amount received
    const totalTransactions = transactions.count;
    const totalOutgoingTransactions = transactions.rows.filter(
      (transaction) => transaction.requesterId === userId
    ).length;
    const totalIncomingTransactions = transactions.rows.filter(
      (transaction) => transaction.requesteeId === userId
    ).length;
    const totalAmountSent = transactions.rows
      .filter((transaction) => transaction.requesterId === userId)
      .reduce((acc, transaction) => acc + Number(transaction.amount), 0);
    const totalAmountReceived = transactions.rows
      .filter((transaction) => transaction.requesteeId === userId)
      .reduce((acc, transaction) => acc - Number(transaction.amount), 0);
    let transactionBalance;
    if (totalAmountReceived > totalAmountSent) {
      transactionBalance = totalAmountReceived - totalAmountSent;
    } else {
      transactionBalance = totalAmountSent - totalAmountReceived;
    }

    // get transactions by month
    const transactionsByMonth = Object.values(
      transactions.rows.reduce((acc, transaction) => {
        const month = transaction.createdAt.getMonth();
        if (!acc[month]) {
          acc[month] = { month, transactions: [] };
        }
        acc[month].transactions.push(transaction);
        return acc;
      }, {})
    );

    // get favourite payments for the user and add to the response
    const favouritePayments = await FavouritePayment.findAll({
      where: {
        userId,
      },
    });

    // group the favourite payments by month
    // put them as objects in an array with month key and its value
    // and then transactions key and its value
    const favouritePaymentsByMonth = Object.values(
      favouritePayments.reduce((acc, payment) => {
        const month = payment.createdAt.getMonth();
        if (!acc[month]) {
          acc[month] = {
            month,
            transactions: [],
          };
        }
        acc[month].transactions.push(payment);
        return acc;
      }, {})
    );

    // count percentage of outgoing and incoming transactions
    // get the percentage of outgoing transactions and parse in int

    let percentageOutgoingTransactions =
      (totalOutgoingTransactions / totalTransactions) * 100;
    // get the percentage of incoming transactions and parse in int
    let percentageIncomingTransactions =
      (totalIncomingTransactions / totalTransactions) * 100;

    // minus the greater percentage from 100 to get the lesser percentage to get a fixed number of 0 decimal places
    if (percentageOutgoingTransactions > percentageIncomingTransactions) {
      percentageOutgoingTransactions = 100 - percentageIncomingTransactions;
    } else {
      percentageIncomingTransactions = 100 - percentageOutgoingTransactions;
    }

    return {
      transactions: transactionsByMonth || [],
      favouriteTransactions: favouritePaymentsByMonth || [],
      totalTransactions: totalTransactions || 0,
      totalOutgoingTransactions: totalOutgoingTransactions || 0,
      totalIncomingTransactions: totalIncomingTransactions || 0,
      totalAmountSent: totalAmountSent || 0,
      totalAmountReceived: totalAmountReceived || 0,
      transactionBalance: transactionBalance || 0,
      percentageOutgoingTransactions: percentageOutgoingTransactions || 0,
      percentageIncomingTransactions: percentageIncomingTransactions || 0,
    };
  }

  async createMessage(
    chatId,
    userId,
    text,
    paymentRequestId,
    replyToId = null
  ) {
    return Message.create({
      chatId,
      senderId: userId,
      text,
      paymentRequestId,
      replyToId,
    });
  }

  async createMessages(chatId, senderId, messages) {
    return Message.bulkCreate(
      messages.map((message) => ({
        chatId,
        senderId,
        text: message.text || "",
        fileUrl: message.fileUrl || null,
        local_id: Number(message.local_id) || null,
        settings: message.settings || {},
      }))
    );
  }

  async bulkDeleteMessages(chatId, messageIds) {
    return Message.destroy({
      where: {
        chatId,
        id: messageIds,
      },
    });
  }

  async getTransactionById(transactionId) {
    return await PaymentRequest.findByPk(transactionId, {
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: User,
          as: "requester",
          attributes: [
            "id",
            "username",
            "phoneNumber",
            "profilePic",
            "email",
            "settings",
          ],
        },
        {
          model: User,
          as: "requestee",
          attributes: [
            "id",
            "username",
            "phoneNumber",
            "profilePic",
            "email",
            "settings",
          ],
        },
      ],
    });
  }
}

module.exports = ChatRepository;
