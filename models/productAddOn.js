const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// An optional extra a buyer can attach when adding a product to cart, e.g.
// "Extra battery — $15". Scoped to exactly one of shopProductId / variationId,
// never both: hasVariations:false products own their add-ons directly on
// shopProductId; hasVariations:true products own add-ons per variation instead.
const ProductAddOn = sequelize.define(
  "ProductAddOn",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    // Set only for a non-variation product's own add-on.
    shopProductId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    // Set only for a variation's own add-on.
    variationId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    price: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
    },
    stock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "product_add_ons",
    timestamps: true,
  }
);

module.exports = ProductAddOn;
