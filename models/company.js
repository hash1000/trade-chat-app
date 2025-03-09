const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Company = sequelize.define(
    "Company",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      companyName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      managerFirstName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      managerLastName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      companyPhone: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      companyAddress: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      companyCountry: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      companyCity: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      companyZip: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      deliveryAddress: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      deliveryCountry: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      deliveryCity: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      deliveryZip: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "companies",
    }
  );

  Company.associate = function (models) {
    Company.belongsTo(models.User, {
      foreignKey: "userId",
      as: "user",
    });
  };

  return Company;
};
