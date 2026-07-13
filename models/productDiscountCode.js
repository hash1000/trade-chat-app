const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ProductDiscountCode = sequelize.define(
  "ProductDiscountCode",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    shopProductId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "shopProducts", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },

    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        len: [1, 50],
      },
    },

    discountPercentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      validate: {
        min: 0.01,
        max: 100,
      },
    },

    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },

    isUsed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    // null = unlimited (∞). Code stays valid while usedCount < usageLimit.
    usageLimit: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },

    usedCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    usedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "users", key: "id" },
    },

    usedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    expiryDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "users", key: "id" },
    },
  },
  {
    tableName: "product_discount_codes",
    timestamps: true,
    indexes: [
      { unique: true, fields: ["code"] },
      { fields: ["shopProductId"] },
      { fields: ["shopProductId", "isUsed"] },
    ],
  }
);

module.exports = ProductDiscountCode;
