const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const DiscountCode = sequelize.define(
  'DiscountCode',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    shopId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    code: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    discountPercent: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    usageLimit: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    usedCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    timestamps: true,
    tableName: 'discountCodes',
  }
)

module.exports = DiscountCode
