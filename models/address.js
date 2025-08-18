const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./user");

const Address = sequelize.define(
  "Address",
  {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER,
    },
    companyName: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    firstName: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    middleName: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    lastName: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    title: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    contactPerson: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    country: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    city: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    postalCode: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    street: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    streetNumber: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    vatNumber: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    customerNumber: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    deliveryNote: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    userId: {
      allowNull: false,
      type: DataTypes.INTEGER,
      references: {
        model: User,
        key: "id",
      },
    },
    creatorId: {
      allowNull: false,
      type: DataTypes.INTEGER,
      references: {
        model: User,
        key: "id",
      },
    },
    type: {
      type: DataTypes.ENUM("company", "delivery"),
      allowNull: false,
    },
    pin: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    createdAt: {
      allowNull: false,
      type: DataTypes.DATE,
    },
    updatedAt: {
      allowNull: false,
      type: DataTypes.DATE,
    },
  },
  {
    tableName: "address", // Specify the table name
  }
);

module.exports = Address;
