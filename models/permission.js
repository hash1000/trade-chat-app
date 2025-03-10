const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Permission = sequelize.define("Permission", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  roleId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  resource: {
    type: DataTypes.STRING, // Example: "orders"
    allowNull: false,
  },
  canCreate: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  canReadAll: {
    type: DataTypes.BOOLEAN,
    defaultValue: false, // Admin has true, others false
  },
  canReadAssigned: {
    type: DataTypes.BOOLEAN,
    defaultValue: false, // Operator has true
  },
  canReadOwn: {
    type: DataTypes.BOOLEAN,
    defaultValue: true, // User has true
  },
  canUpdate: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  canDelete: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  }
}, {
  tableName: "permissions",
  timestamps: false,
});

module.exports = Permission;
