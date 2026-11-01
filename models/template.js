// models/template.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./user");

// A user's saved message template. `subTitle` is the template body (same
// name the app used in Firestore). legacyId = Firestore doc id for rows
// imported by scripts/syncFirebaseTemplates.js. Paranoid: deletes are soft,
// so the sync can tell "deleted here" apart from "never imported".
const Template = sequelize.define(
  "Template",
  {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER,
    },
    userId: {
      allowNull: false,
      type: DataTypes.INTEGER,
      references: { model: User, key: "id" },
    },
    title: {
      allowNull: false,
      type: DataTypes.STRING(255),
    },
    subTitle: {
      allowNull: true,
      type: DataTypes.TEXT,
    },
    sequence: {
      allowNull: false,
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    legacyId: {
      allowNull: true,
      type: DataTypes.STRING(64),
    },
  },
  {
    tableName: "templates",
    timestamps: true,
    paranoid: true,
  }
);

Template.belongsTo(User, { foreignKey: "userId", as: "user" });

module.exports = Template;
