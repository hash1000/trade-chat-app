const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ServiceAddOn = sequelize.define(
  "ServiceAddOn",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    serviceId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "services",
        key: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },

    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    amount: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
    },

    deletedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "service_add_ons",
    timestamps: true,
  }
);

module.exports = ServiceAddOn;
