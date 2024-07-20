const { Op } = require('sequelize')
const Friends = require('../models/friends')
const User = require('../models/user')

class FriendsRepository {
  async create (userId, profileId) {
    return Friends.create({
      userId,
      profileId,
      type: 'sent'
    })
  }

  async update (userId, profileId, type) {
    return Friends.update({
      type
    }, {
      where: {
        [Op.or]: [
          { userId, profileId },
          { userId: profileId, profileId: userId }
        ]
      }
    })
  }

  async remove (userId, profileId) {
    return Friends.destroy({
      where: {
        [Op.or]: [
          { userId, profileId },
          { userId: profileId, profileId: userId }
        ]
      }
    })
  }

  async get (userId, profileId) {
    const favourite = await Friends.findOne({
      where: {
        [Op.or]: [
          { userId, profileId },
          { userId: profileId, profileId: userId }
        ]
      },
      attributes: ['type', 'userId', 'profileId'],
      raw: true
    })
    // if type is sent and profileId is mine then return type as received
    if (favourite && favourite.type === 'sent' && favourite.profileId === userId) {
      favourite.type = 'received'
    }
    return favourite
  }

  async getFriends (userId) {
    const friends = await Friends.findAll({
      where: {
        [Op.or]: [
          { userId },
          { profileId: userId }
        ]
      },
      attributes: ['type', 'userId', 'profileId'],
    })
    const friendsIds = friends.map(friend => {
      if (friend.userId === userId) {
        return friend.profileId
      } else {
        return friend.userId
      }
    })
    const users = await User.findAll({
      where: {
        id: {
          [Op.in]: friendsIds
        }
      },
      attributes: ['id', 'role', 'country_code', 'email', 'phoneNumber', 'profilePic'],
      raw: true
    })
    const friendsMap = friends.reduce((acc, friend) => {
      if (friend.userId === userId) {
        acc[friend.profileId] = friend
      } else {
        acc[friend.userId] = friend
      }
      return acc
    }, {})
    return users.map(user => {
      user.friendship = friendsMap[user.id]
      if (user.friendship && user.friendship.type === 'sent' && user.friendship.profileId === userId) {
        user.friendship.type = 'received'
      }
      return user
    })
  }
}

module.exports = FriendsRepository
