const Reaction = require('../models/reactions')

class ReactionRepository {
  createReaction(userId, profileId, type, transaction) {
    return Reaction.create({
      userId,
      profileId,
      type
    }, { transaction })
  }

  updateReaction(userId, profileId, type, transaction) {
    return Reaction.update({
      type
    }, {
      where: {
        userId,
        profileId
      }
    }, { transaction })
  }

  async removeReaction(userId, profileId, type, transaction) {
    return Reaction.destroy({
      where: {
        userId,
        profileId,
        type
      }
    }, { transaction })
  }

  async getReactions(userId, profileId) {
    const my_reaction = await Reaction.findOne({
      where: {
        userId,
        profileId
      }
    })
    return my_reaction ? my_reaction.toJSON() : null;
  }

  async getReactionsCountByType(profileId) {
    const reactions = await Reaction.count({
      where: {
        profileId
      },
      group: ['type']
    })
    return reactions.reduce((acc, reaction) => {
      acc[reaction.type] = reaction.count
      return acc
    }, {})
  }
}

module.exports = ReactionRepository
