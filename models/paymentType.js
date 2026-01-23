const { DataTypes } = require("sequelize");
const db = require("../config/database");

const PaymentType = db.define(
  "PaymentType",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    pin: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "payment_types",
    indexes: [
      {
        unique: true,
        fields: ["name", "userId"], // Ensure name is unique per user
      },
    ],
  }
);

module.exports = PaymentType;
