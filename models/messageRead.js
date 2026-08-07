const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const MessageRead = sequelize.define(
  "MessageRead",
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
    seenAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    tableName: "message_reads",
    timestamps: true,
    indexes: [{ unique: true, fields: ["messageId", "userId"] }],
  }
);

module.exports = MessageRead;
