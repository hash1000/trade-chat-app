const { Op } = require('sequelize')
const UserFavourite = require('../models/user_favourites')
const Friends = require('../models/friends')
const User = require('../models/user')
const Chat = require('../models/chat')
const sequelize = require("../config/database");

class UserFavouriteRepository {
  async create (userId, profileId) {
    const favourite = await UserFavourite.create({
      userId,
      profileId
    })
    const chat = await Chat.findOne({
      where: {
        [Op.and]: [{ user2Id: profileId }, { user1Id: userId }],
      },
    });
    return  { favourite, chat }
  }

  async remove (userId, profileId) {
    return UserFavourite.destroy({
      where: {
        userId,
        profileId
      }
    })
  }

  async cancelUserFavourite(requesterId, requesteeId) {
    return  await UserFavourite.destroy({
      where: {
        [Op.or]: [
          { userId: requesterId },
          { profileId: requesteeId },
        ],
      }
    });
  }

  async get (userId, profileId) {
    const favourite = await UserFavourite.findOne({
      where: {
        userId,
        profileId
      }
    })
    return favourite ? favourite.toJSON() : null;
  }

  async getFavourites (userId) {
    const userFavourites = await UserFavourite.findAll({
      where: {
        userId
      }
    })
    const favouriteIds = userFavourites.map(favourite => favourite.profileId)
    const users = await User.findAll({
      where: {
        id: {
          [Op.in]: favouriteIds
        }
      },
      attributes: [
        "id",             
        "firstName",
        "lastName",
        "username",
        "country",
        "gender",
        "role",
        "age",
        "profilePic",
        "description",
        "settings",
        "phoneNumber"
      ],
      raw: true
    })
    return users;
    // const friendship = await Friends.findAll({
    //   where: {
    //     [Op.or]: [
    //       { userId, },
    //       { profileId: userId }
    //     ]
    //   },
    //   attributes: ['type', 'userId', 'profileId']
    // })
    // const friendsMap = friendship.reduce((acc, curr) => {
    //   if (curr.userId === userId) {
    //     acc[curr.profileId] = curr
    //   } else {
    //     acc[curr.userId] = curr
    //   }
    //   return acc
    // }, {})

    // return users.map(user => {
    //   user.friendship = friendsMap[user.id] || null
    //   if (user.friendship && user.friendship.type === 'sent' && user.friendship.profileId === userId) {
    //     user.friendship.type = 'received'
    //   }
    //   return user
    // })
  }
}

module.exports = UserFavouriteRepository
