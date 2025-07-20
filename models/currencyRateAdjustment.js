const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const CurrencyRateAdjustment = sequelize.define("CurrencyRateAdjustment", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  baseCurrency: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  targetCurrency: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  fetchedRate: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  adjustment: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0,
  },
  finalRate: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  updatedBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, {
  tableName: "currencyRateAdjustment", // ✅ matches your migration
  timestamps: true,                      // ✅ enables createdAt and updatedAt
  underscored: false                      // optional: maps camelCase -> snake_case fields
});

module.exports = CurrencyRateAdjustment;
