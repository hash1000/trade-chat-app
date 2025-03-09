const { DataTypes } = require("sequelize");
const db = require("../config/database");

const Order = db.define("Order", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  addressId: { type: DataTypes.INTEGER, allowNull: false },
  adminId: { type: DataTypes.INTEGER, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.ENUM("WAITING", "PAYED", "SHIPPED"), allowNull: false, defaultValue: "WAITING" },
  isFavorite: { type: DataTypes.BOOLEAN, allowNull: true },
  image: { type: DataTypes.STRING, allowNull: false },
  price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  orderNo: { type: DataTypes.STRING, allowNull: false, unique: true },
  createdAt: { allowNull: false, type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updatedAt: { allowNull: false, type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: "orders" });

module.exports = Order;
