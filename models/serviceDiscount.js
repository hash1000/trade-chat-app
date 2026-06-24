const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ServiceDiscount = sequelize.define(
  "ServiceDiscount",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    serviceId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "services", key: "id" },
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
    tableName: "service_discounts",
    timestamps: true,
    indexes: [
      { unique: true, fields: ["code"] },
      { fields: ["serviceId"] },
      { fields: ["serviceId", "isUsed"] },
    ],
  }
);

module.exports = ServiceDiscount;
