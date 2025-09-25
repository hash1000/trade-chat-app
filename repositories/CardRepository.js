const BankAccount = require('../models/bankAccount')
const { Op } = require('sequelize')

class CardRepository {
  async getCardsByUserId (userId) {
    return await BankAccount.findAll({
      where: { userId },
      order: [['sequence', 'ASC']]
    })
  }

  async getCardById (userId, cardId) {
    return await BankAccount.findOne({
      where: { id: cardId, userId }
    })
  }

  async createCard (userId, cardData) {
    // Get the next available sequence number
    const lastCard = await BankAccount.findOne({
      where: { userId },
      order: [['sequence', 'DESC']]
    })

    const nextSequence = lastCard ? lastCard.sequence + 1 : 1

    return await BankAccount.create({
      userId,
      ...cardData,
      sequence: nextSequence
    })
  }

  async updateCard (userId, cardId, updateData) {
    const card = await BankAccount.findOne({
      where: { id: cardId, userId }
    })

    if (!card) return null

    // Prevent sequence updates via this method
    const { sequence, ...safeUpdateData } = updateData
    await card.update(safeUpdateData)

    return card
  }

  async deleteCard (userId, cardId) {
    const transaction = await BankAccount.sequelize.transaction()
    
    try {
      // Get the card to be deleted
      const cardToDelete = await BankAccount.findOne({
        where: { id: cardId, userId },
        transaction
      })

      if (!cardToDelete) {
        await transaction.rollback()
        return null
      }

      const deletedSequence = cardToDelete.sequence

      // Delete the card
      await BankAccount.destroy({
        where: { id: cardId, userId },
        transaction
      })

      // Re-sequence remaining cards
      await BankAccount.update(
        { sequence: BankAccount.sequelize.literal('sequence - 1') },
        {
          where: {
            userId,
            sequence: { [Op.gt]: deletedSequence }
          },
          transaction
        }
      )
      
      await transaction.commit()
      return true
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  }

  async reorderBankAccount (userId, accountId, newPosition) {
    const transaction = await BankAccount.sequelize.transaction()
    
    try {
      const accountToMove = await BankAccount.findOne({
        where: { id: accountId, userId },
        transaction
      })
      
      if (!accountToMove) {
        await transaction.rollback()
        return null
      }
      
      const currentPosition = accountToMove.sequence
      
      if (currentPosition === newPosition) {
        await transaction.commit()
        return this.getBankAccountsByUserId(userId)
      }
      
      if (newPosition < currentPosition) {
        // Moving up - shift accounts down
        await BankAccount.update(
          { sequence: BankAccount.sequelize.literal('sequence + 1') },
          {
            where: {
              userId,
              sequence: { [Op.between]: [newPosition, currentPosition - 1] }
            },
            transaction
          }
        )
      } else {
        // Moving down - shift accounts up
        await BankAccount.update(
          { sequence: BankAccount.sequelize.literal('sequence - 1') },
          {
            where: {
              userId,
              sequence: { [Op.between]: [currentPosition + 1, newPosition] }
            },
            transaction
          }
        )
      }
      
      // Update the moved account
      await accountToMove.update({ sequence: newPosition }, { transaction })
      
      await transaction.commit()
      
      // Return all accounts in new order
      return this.getBankAccountsByUserId(userId)
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  }
}

module.exports = CardRepository