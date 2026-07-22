const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

// The parent "checkout event". One buyer, one wallet debit, one address/delivery
// choice, but may fan out into several ProductShopOrder children — one per shop
// represented in the cart at checkout time. Has no status of its own: the
// buyer-facing state is derived from its children's statuses on read.
const ProductOrder = sequelize.define(
  'ProductOrder',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    orderNo: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    addressId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    deliveryType: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Which of the buyer's wallets (by type) was debited at checkout.
    walletType: {
      type: DataTypes.ENUM('PERSONAL', 'COMPANY'),
      allowNull: false,
    },
    // Sum of every child shop-order's totalAmount at the moment of checkout.
    totalAmount: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    timestamps: true,
    tableName: 'product_orders',
  }
)

module.exports = ProductOrder
