const { DataTypes } = require("sequelize");
const db = require("../config/database");

const Cart = db.define(
  "Cart",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: "Cart",
    },
    status: {
      type: DataTypes.ENUM("active", "converted", "abandoned"),
      allowNull: false,
      defaultValue: "active",
    },
  },
  {
    tableName: "carts",
    timestamps: true,
  }
);

module.exports = Cart;
