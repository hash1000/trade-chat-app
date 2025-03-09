const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Message = sequelize.define(
    "Message",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      local_id: {
        type: DataTypes.INTEGER,
      },
      chatId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "chats",
          key: "id",
        },
      },
      senderId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
      },
      fileUrl: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      quoteToId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      isDeleted: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
      },
      text: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      paymentRequestId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "payment_requests",
          key: "id",
        },
      },
      settings: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "messages",
      timestamps: true,
    }
  );

  Message.associate = function (models) {
    Message.belongsTo(models.Chat, { foreignKey: "chatId", as: "chat" });
    Message.belongsTo(models.User, { foreignKey: "senderId", as: "sender" });
    Message.belongsTo(models.PaymentRequest, { foreignKey: "paymentRequestId", as: "paymentRequest" });
    Message.belongsTo(models.Message, { foreignKey: "quoteToId", as: "replyTo" });
  };

  return Message;
};
