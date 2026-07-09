const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const ProductVariation = sequelize.define(
  'ProductVariation',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    shopProductId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    sizeSpec: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    unit: {
      type: DataTypes.ENUM('per_piece', 'per_unit', 'per_m3', 'per_m2', 'per_carton', 'per_ton'),
      allowNull: false,
      defaultValue: 'per_piece',
    },
    price: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    stock: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    minOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    inStock: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    byOrder: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // derived from UI screen "Edit variation availability" (lead time text e.g. "15-30 days")
    leadTime: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    tableName: 'productVariations',
  }
)

module.exports = ProductVariation
