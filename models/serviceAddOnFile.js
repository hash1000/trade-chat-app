const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// Media attachments for a ServiceAddOn — mirrors ServiceFile structure
const ServiceAddOnFile = sequelize.define(
  "ServiceAddOnFile",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    addOnId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "service_add_ons",
        key: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
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
      type: DataTypes.ENUM("video", "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt", "image", "other"),
      allowNull: false,
    },

    s3_key: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    sort_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "service_add_on_files",
    timestamps: true,
  }
);

module.exports = ServiceAddOnFile;
