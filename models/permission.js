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
    type: DataTypes.STRING,
    allowNull: false,
  },
  create: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  readAll: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  readSingle: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  canUpdate: { // ✅ Renamed from "update" to "canUpdate"
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  canDelete: { // ✅ Renamed from "delete" to "canDelete"
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  tableName: "permissions",
  timestamps: false,
});

module.exports = Permission;
