const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const MessageMention = sequelize.define(
  "MessageMention",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    messageId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "message_mentions",
    timestamps: true,
    indexes: [{ unique: true, fields: ["messageId", "userId"] }],
  }
);

module.exports = MessageMention;
