const { DataTypes } = require('sequelize')

module.exports = (sequelize) => {
  const Reaction = sequelize.define(
    'Reaction',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      userId: {
        allowNull: false,
        type: DataTypes.INTEGER,
        references: {
          model: 'users', // Use table name as string
          key: 'id'
        }
      },
      profileId: {
        allowNull: false,
        type: DataTypes.INTEGER,
        references: {
          model: 'users', // Use table name as string
          key: 'id'
        }
      },
      type: {
        allowNull: false,
        type: DataTypes.ENUM('like', 'dislike')
      }
    },
    {
      modelName: 'Reaction',
      tableName: 'reactions',
      timestamps: true // Automatically adds createdAt & updatedAt
    }
  )

  // Define associations inside an associate function
  Reaction.associate = (models) => {
    Reaction.belongsTo(models.User, { foreignKey: 'userId', as: 'user' })
    Reaction.belongsTo(models.User, { foreignKey: 'profileId', as: 'profile' })
  }

  return Reaction
}
