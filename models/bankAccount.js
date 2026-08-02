// models/BankAccount.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const BankAccount = sequelize.define(
  "BankAccount",
  {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    accountName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    bank_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    iban: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: false,
      defaultValue: null,
    },
    swift_code: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    familyName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    documentType: {
      type: DataTypes.ENUM("passport", "id_card"),
      allowNull: true,
    },
    documentValue: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    accountNo: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    accountCurrency: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    bic: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    bank_address: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    beneficiary_address: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    intermediate_bank_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    intermediate_bank_swift: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    intermediate_bank_address: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    classification: {
      type: DataTypes.ENUM("sender", "receiver", "both"),
      allowNull: false,
      defaultValue: "both",
    },
    currency: {
      type: DataTypes.ENUM("USD", "EUR"),
      allowNull: true,
    },
    testCard: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    sequence: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    addressId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "address",
        key: "id",
      },
    },
    walletType: {
      type: DataTypes.ENUM("PERSONAL", "COMPANY"),
      allowNull: false,
      defaultValue: "COMPANY",
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    timestamps: true,
    tableName: "bank_accounts",
  },
);

module.exports = BankAccount;
