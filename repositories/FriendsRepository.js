const { Op } = require('sequelize')
const Friends = require('../models/friends')
const FriendProfile = require('../models/friendProfile')
const User = require('../models/user')

class FriendsRepository {
  async create (userId, profileId) {
    return Friends.create({
      userId,
      profileId,
      type: 'sent'
    })
  }

  // Directed lookup: only "userId added profileId". Unlike get(), this does not
  // match the reverse row, so one user adding another never implies the reverse.
  async getDirected (userId, profileId) {
    return Friends.findOne({
      where: { userId, profileId },
      attributes: ['id', 'type', 'userId', 'profileId'],
      raw: true
    })
  }

  // Friendship is immediate - there is no request/accept step, so it is written
  // as 'accepted' straight away.
  async addFriend (userId, profileId) {
    return Friends.create({
      userId,
      profileId,
      type: 'accepted'
    })
  }

  // Remove only my own entry; the other user keeps me in their list.
  async removeDirected (userId, profileId) {
    return Friends.destroy({
      where: { userId, profileId }
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

  // Friendship is one-sided, so "is this user my friend?" only looks at my own
  // entry. Someone adding me does not make them my friend.
  async get (userId, profileId) {
    return this.getDirected(userId, profileId)
  }

  // My friend list = the users I added. Users who added me are not included.
  // Applies my private per-friend overrides (nickname/photo/note) on top of
  // each friend's real profile - these are mine only and never touch theirs.
  async getFriends (userId) {
    const friends = await Friends.findAll({
      where: { userId },
      attributes: ['type', 'userId', 'profileId'],
    })
    const friendsIds = friends.map(friend => friend.profileId)
    if (friendsIds.length === 0) {
      return []
    }
    const users = await User.findAll({
      where: {
        id: {
          [Op.in]: friendsIds
        }
      },
      attributes: ['id', 'username', 'country_code', 'email', 'phoneNumber', 'profilePic', 'description'],
      raw: true
    })
    const friendsMap = friends.reduce((acc, friend) => {
      acc[friend.profileId] = friend
      return acc
    }, {})
    const profiles = await FriendProfile.findAll({
      where: { userId, profileId: { [Op.in]: friendsIds } },
      raw: true
    })
    const profilesMap = profiles.reduce((acc, profile) => {
      acc[profile.profileId] = profile
      return acc
    }, {})
    return users.map(user => {
      user.friendship = friendsMap[user.id]
      const override = profilesMap[user.id]
      if (override) {
        user.username = override.userName || user.username
        user.profilePic = override.profilePic || user.profilePic
        user.description = override.description || user.description
      }
      return user
    })
  }

  // Upsert my private override for a specific friend (nickname/photo/note).
  async upsertProfileOverride (userId, profileId, { userName, profilePic, description }) {
    const existing = await FriendProfile.findOne({ where: { userId, profileId } })
    const fields = { userName, profilePic, description }
    if (existing) {
      await existing.update(fields)
      return existing
    }
    return FriendProfile.create({ userId, profileId, ...fields })
  }
}

module.exports = FriendsRepository
