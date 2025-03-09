const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Address = sequelize.define(
    "Address",
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
      },
      companyName: { type: DataTypes.STRING, allowNull: true },
      firstName: { type: DataTypes.STRING, allowNull: true },
      middleName: { type: DataTypes.STRING, allowNull: true },
      lastName: { type: DataTypes.STRING, allowNull: true },
      title: { type: DataTypes.STRING, allowNull: true },
      contactPerson: { type: DataTypes.STRING, allowNull: true },
      country: { type: DataTypes.STRING, allowNull: true },
      city: { type: DataTypes.STRING, allowNull: true },
      postalCode: { type: DataTypes.STRING, allowNull: true },
      street: { type: DataTypes.STRING, allowNull: true },
      streetNumber: { type: DataTypes.STRING, allowNull: true },
      vatNumber: { type: DataTypes.STRING, allowNull: true },
      customerNumber: { type: DataTypes.STRING, allowNull: true },
      deliveryNote: { type: DataTypes.STRING, allowNull: true },
      userId: {
        allowNull: false,
        type: DataTypes.INTEGER,
      },
      type: {
        type: DataTypes.ENUM("company", "delivery"),
        allowNull: false,
      },
      pin: { type: DataTypes.BOOLEAN, allowNull: true },
      createdAt: { allowNull: false, type: DataTypes.DATE },
      updatedAt: { allowNull: false, type: DataTypes.DATE },
    },
    {
      tableName: "addresses",
    }
  );

  Address.associate = (models) => {
    Address.belongsTo(models.User, {
      foreignKey: "userId",
      as: "user",
    });

    Address.hasOne(models.Order, {
      foreignKey: "addressId",
      as: "orders",
    });
  };

  return Address;
};
