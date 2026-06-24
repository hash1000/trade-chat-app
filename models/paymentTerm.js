const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const PaymentTerm = sequelize.define(
  "PaymentTerm",
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

    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: { notEmpty: true, len: [1, 100] },
    },

    type: {
      type: DataTypes.ENUM("FULL_PREPAYMENT", "SPLIT", "QMLC"),
      allowNull: false,
      defaultValue: "FULL_PREPAYMENT",
    },

    icon: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    color: {
      type: DataTypes.STRING(7),
      allowNull: true,
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },

    isDefault: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    visibleToBuyers: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },

    // FULL_PREPAYMENT fields
    whenCharged: {
      type: DataTypes.ENUM("AT_CHECKOUT"),
      allowNull: true,
    },

    // SPLIT fields
    depositPercentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },

    balancePercentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },

    balanceDueDate: {
      type: DataTypes.ENUM(
        "BEFORE_SHIPMENT",
        "AFTER_CARGO_LOADED",
        "ON_DELIVERY",
        "AFTER_INSPECTION"
      ),
      allowNull: true,
    },

    // QMLC fields
    escrowPercentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      defaultValue: 100,
    },

    releaseConditions: {
      type: DataTypes.JSON,
      allowNull: true,
    },

    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "users", key: "id" },
    },
  },
  {
    tableName: "payment_terms",
    timestamps: true,
    indexes: [
      { fields: ["serviceId", "isDefault"] },
      { fields: ["serviceId", "isActive"] },
      { fields: ["serviceId", "visibleToBuyers"] },
    ],
  }
);

module.exports = PaymentTerm;
