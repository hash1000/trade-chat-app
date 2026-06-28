const { DataTypes } = require("sequelize");
const db = require("../config/database");

const ServiceOrderAddOn = db.define(
  "ServiceOrderAddOn",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    serviceOrderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    addOnId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    priceAtOrder: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
    },
    subtotal: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
    },
    createdAt: {
      allowNull: false,
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      allowNull: false,
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  { tableName: "service_order_add_ons" }
);

module.exports = ServiceOrderAddOn;
