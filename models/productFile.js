const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ProductFile = sequelize.define(
  "ProductFile",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    shopProductId: {
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
    tableName: "product_files",
    timestamps: true,
  }
);

module.exports = ProductFile;
