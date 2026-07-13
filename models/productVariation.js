const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

// A product variation, e.g. MacBook → Air / Pro / Pro Max.
// Availability has two independent modes (both can be on):
//   - inStock:  selling from held stock (stock qty + its own min order)
//   - byOrder:  made/sourced on demand (its own min order + lead time)
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
    inStock: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    stock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    stockMinOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    byOrder: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    byOrderMinOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    leadTime: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    timestamps: true,
    tableName: 'productVariations',
  }
)

module.exports = ProductVariation
