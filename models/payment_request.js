const { DataTypes } = require("sequelize");
const user = require('./user')

module.exports = (sequelize) => {
  const PaymentRequest = sequelize.define(
    "payment_requests",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      requesterId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'User',
          key: 'id'
        }
      },
      requesteeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'User',
          key: 'id'
        }
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'pending'
      }
    }, {
    tableName: 'payment_requests',
    timestamps: true
  }
  );

  PaymentRequest.associate = function (models) {
    PaymentRequest.belongsTo(User, { as: 'requester', foreignKey: 'requesterId' });
    PaymentRequest.belongsTo(User, { as: 'requestee', foreignKey: 'requesteeId' });
  };

  return PaymentRequest;
};
