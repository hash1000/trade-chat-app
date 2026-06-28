const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Service = sequelize.define(
  "Service",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    payoutWalletId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    profile_image: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    type: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    location: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    replyTime: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    pricing_type: {
      type: DataTypes.ENUM("free", "fixed", "range"),
      allowNull: false,
      defaultValue: "fixed",
    },

    price: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: true,
    },

    min_price: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: true,
    },

    max_price: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: true,
    },

    images: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },

    isTopChoice: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    isQRMVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    insured: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    moneyBack: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    support247: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    isChat: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    tags: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },

    ratingAvg: {
      type: DataTypes.DECIMAL(4, 2),
      allowNull: false,
      defaultValue: 0,
    },

    ratingCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    purchaseCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    baseViewCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    baseLikeCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    // Optional single assignee editor (not the owner, a designated editor)
    assigneeEditorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
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
    tableName: "services",
    timestamps: true,
  },
);

module.exports = Service;
