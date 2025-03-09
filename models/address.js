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
    lastName: {
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
    vatNumber: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    userId: {
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
    createdAt: {
      allowNull: false,
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      allowNull: false,
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "addresses",
  }
);

// Associations
// Address.belongsTo(User, { foreignKey: "userId", as: "user" });
// User.hasMany(Address, { foreignKey: "userId", as: "addresses" });

module.exports = Address;
