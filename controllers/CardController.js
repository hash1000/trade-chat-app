const CardService = require('../services/CardService')
const cardService = new CardService()

class CardController {
  // Get all bank accounts for user (sorted by sequence)
  async getBankAccounts (req, res) {
    try {
      const { id: userId } = req.user
      const accounts = await cardService.getCardsByUserId(userId)
      res.json(accounts)
    } catch (error) {
      console.error(error)
      res.status(500).json({ error: 'Server Error' })
    }
  }

  // Get specific card by ID
  async getCardById (req, res) {
    try {
      const { id: userId } = req.user
      const { id } = req.params
      const card = await cardService.getCardById(userId, id)

      if (!card) {
        return res.status(404).json({ error: 'Card not found' })
      }

      res.json(card)
    } catch (error) {
      console.error(error)
      res.status(500).json({ error: 'Server Error' })
    }
  }

  // Create new card
  async createCard (req, res) {
    try {
      const { id: userId } = req.user
      const { cardName, cardNumber, cardHolder, cardExpiry, cardCVC } = req.body

      const newCard = await cardService.createCard(userId, {
        cardName,
        cardNumber,
        cardHolder,
        cardExpiry,
        cardCVC
      })

      res.status(201).json(newCard)
    } catch (error) {
      console.error(error)
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({ error: 'Card number already exists' })
      }
      res.status(500).json({ error: 'Server Error' })
    }
  }

  // Update card
  async updateCard (req, res) {
    try {
      const { id: userId } = req.user
      const { id } = req.params
      const updateData = req.body

      const updatedCard = await cardService.updateCard(userId, id, updateData)

      if (!updatedCard) {
        return res.status(404).json({ error: 'Card not found' })
      }

      res.json(updatedCard)
    } catch (error) {
      console.error(error)
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({ error: 'Card number already exists' })
      }
      res.status(500).json({ error: 'Server Error' })
    }
  }

  // Delete card
  async deleteCard (req, res) {
    try {
      const { id: userId } = req.user
      const { id } = req.params

      const result = await cardService.deleteCard(userId, id)

      if (!result) {
        return res.status(404).json({ error: 'Card not found' })
      }

      res.json({ message: 'Card deleted successfully' })
    } catch (error) {
      console.error(error)
      res.status(500).json({ error: 'Server Error' })
    }
  }

  // Reorder card sequence
  async reorderCard (req, res) {
    try {
      const { id: userId } = req.user
      const { id } = req.params
      const { newPosition } = req.body
      
      if (newPosition === undefined || newPosition < 1) {
        return res.status(400).json({ error: 'Valid newPosition is required' })
      }

      const reorderedCards = await cardService.reorderCard(userId, id, newPosition)

      if (!reorderedCards) {
        return res.status(404).json({ error: 'Card not found' })
      }

      res.json(reorderedCards)
    } catch (error) {
      console.error(error)
      res.status(500).json({ error: 'Server Error' })
    }
  }
}

module.exports = CardController