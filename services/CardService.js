const CardRepository = require('../repositories/CardRepository')

class CardService {
  constructor () {
    this.cardRepository = new CardRepository()
  }

  async getCardsByUserId (userId) {
    return await this.cardRepository.getCardsByUserId(userId)
  }

  async getCardById (userId, cardId) {
    return await this.cardRepository.getCardById(userId, cardId)
  }

  async createCard (userId, cardData) {
    return await this.cardRepository.createCard(userId, cardData)
  }

  async updateCard (userId, cardId, updateData) {
    return await this.cardRepository.updateCard(userId, cardId, updateData)
  }

  async deleteCard (userId, cardId) {
    return await this.cardRepository.deleteCard(userId, cardId)
  }

  async reorderCard (userId, cardId, newPosition) {
    return await this.cardRepository.reorderCard(userId, cardId, newPosition)
  }
}

module.exports = CardService