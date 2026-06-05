const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ServiceFile = sequelize.define(
  "ServiceFile",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    service_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    file_url: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    file_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    file_type: {
      type: DataTypes.ENUM("image", "pdf", "doc", "docx", "other"),
      allowNull: false,
    },

    sort_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "service_files",
    timestamps: true,
  }
);

module.exports = ServiceFile;
