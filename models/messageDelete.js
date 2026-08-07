const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const MessageDelete = sequelize.define(
  "MessageDelete",
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
    isDeleteAll: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: "message_deletes",
    timestamps: true,
    indexes: [{ unique: true, fields: ["messageId", "userId"] }],
  }
);

module.exports = MessageDelete;
