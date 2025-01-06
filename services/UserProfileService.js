const sequelize = require("../config/database");

const UserRepository = require("../repositories/UserRepository"); // Replace the path with the correct location of your UserRepository.js file
const ReactionRepository = require("../repositories/ReactionRepository"); // Replace the path with the correct location of your UserRepository.js file
const UserFavouriteRepository = require("../repositories/UserFavouriteRepository");
const FriendsRepository = require("../repositories/FriendsRepository");
const ChatRepository = require("../repositories/ChatRepository");

const {
  AddRequestNotification,
  RequestAcceptedNotification,
} = require("../notifications");

const CustomError = require("../errors/CustomError");

const userRepository = new UserRepository();
const reactionRepository = new ReactionRepository();
const userFavouriteRepository = new UserFavouriteRepository();
const friendsRepository = new FriendsRepository();
const chatRepository = new ChatRepository();

class UserService {
  async getUserProfileById(profileId, userId) {
    const my_reaction = await reactionRepository.getReactions(
      userId,
      profileId
    );
    const user = await userRepository.getUserProfile(profileId);
    const favourite = await userFavouriteRepository.get(userId, profileId);
    const friendship = await friendsRepository.get(userId, profileId);

    const favourited = favourite ? true : false;
    const liked = my_reaction && my_reaction.type === "like" ? true : false;
    const disliked =
      my_reaction && my_reaction.type === "dislike" ? true : false;
    return { ...user, friendship, liked, disliked, favourited };
  }

  async createOrUpdateReaction(userId, profileId, type) {
    // create or update the reaction
    // if type is like, remove the dislike if exists
    // if type is dislike, remove the like if exists
    // if type is like and dislike exists, decrease the dislike count in user table
    // if type is dislike and like exists, decrease the like count in user table
    // if type is like or dislike increase the count of like or dislike in user table
    const transaction = await sequelize.transaction();
    try {
      const my_reaction = await reactionRepository.getReactions(
        userId,
        profileId
      );
      if (my_reaction) {
        if (my_reaction.type !== type) {
          const user = await userRepository.getUserCounts(profileId);
          const likeCount = user.likes || 0;
          const dislikeCount = user.dislikes || 0;
          await reactionRepository.updateReaction(
            userId,
            profileId,
            type,
            transaction
          );
          if (type === "like") {
            await userRepository.updateReactionCount(
              profileId,
              "dislikes",
              dislikeCount - 1,
              transaction
            );
            await userRepository.updateReactionCount(
              profileId,
              "likes",
              likeCount + 1,
              transaction
            );
          } else if (type === "dislike") {
            await userRepository.updateReactionCount(
              profileId,
              "likes",
              likeCount - 1,
              transaction
            );
            await userRepository.updateReactionCount(
              profileId,
              "dislikes",
              dislikeCount + 1,
              transaction
            );
          }
        }
      } else {
        const user = await userRepository.getUserCounts(profileId);
        const reactionCount = user[`${type}s`] || 0;
        await reactionRepository.createReaction(
          userId,
          profileId,
          type,
          transaction
        );
        await userRepository.updateReactionCount(
          profileId,
          `${type}s`,
          reactionCount + 1,
          transaction
        );
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.log(error);
      throw new CustomError("Internal server error", 500);
    }
  }

  async removeReaction(userId, profileId, type) {
    // if type is like or dislike decrease the count of like or dislike in user table
    // remove the reaction
    const transaction = await sequelize.transaction();
    try {
      const user = await userRepository.getUserCounts(profileId);
      const updated = await reactionRepository.removeReaction(
        userId,
        profileId,
        type,
        transaction
      );
      if (updated > 0) {
        const reactionCount = user[`${type}s`] || 0;
        await userRepository.updateReactionCount(
          profileId,
          `${type}s`,
          reactionCount - 1,
          transaction
        );
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.log(error);
      throw new CustomError("Internal server error", 500);
    }
  }

  async createFavourite(userId, profileId) {
    //  create user favourite
    return userFavouriteRepository.create(userId, profileId);
  }

  async removeFavourite(userId, profileId) {
    // remove user favourite
    return userFavouriteRepository.remove(userId, profileId);
  }

  async createFriendship(userId, profileId) {
    //  create user friendship if already created then update the status to accepted
    const friendship = await friendsRepository.get(userId, profileId);
    if (friendship) {
      if (friendship.type === "received") {
        await friendsRepository.update(userId, profileId, "accepted");
        // send request accepted notification
        const otherUser = await userRepository.getUserTokenAndName(userId);
        const myUser = await userRepository.getUserTokenAndName(profileId);
        if (otherUser && otherUser.fcm && myUser && myUser.name) {
          await new RequestAcceptedNotification(
            otherUser.fcm,
            {},
            myUser
          ).sendNotification();
        }
      }
    } else {
      await friendsRepository.create(userId, profileId);
      // sent add request notification
      const otherUser = await userRepository.getUserTokenAndName(profileId);
      const myUser = await userRepository.getUserTokenAndName(userId);
      if (otherUser && otherUser.fcm && myUser && myUser.name) {
        await new AddRequestNotification(
          otherUser.fcm,
          {},
          myUser
        ).sendNotification();
      }
    }
  }

  async removeFriendship(userId, profileId) {
    // remove user friendship
    return friendsRepository.remove(userId, profileId);
  }

  async getUserContacts(userId, page, pageSize) {
    const favourites = await userFavouriteRepository.getFavourites(userId);
    const invite = await chatRepository.getUserChat(userId, page, pageSize);
    // Iterate through the favourites array
    for (let i = 0; i < favourites.length; i++) {
      const fav = favourites[i];
      const inv = invite.find((inviteUser) => inviteUser.id === fav.id);
      // If a corresponding invite is found, update the favourite
      if (inv && fav) {
        favourites[i] = {
          ...fav, // Keep existing fields from favourites
          username: inv.username, // Update/replace with values from invite
          profilePic: inv.profilePic,
          email: inv.email,
          settings: {
            tags: inv.settings.tags,
          },
          role: inv.profilePic,
          createdAt: inv.createdAt,
          updatedAt: inv.updatedAt,
          phoneNumber: inv.phoneNumber,
        };
      }
    }
    return { favourites, friends: invite };
  }

  async getUserForNotification(id) {
    return userRepository.getUserTokenAndName(id);
  }

  async getAllUsers() {
    return userRepository.getAllprofiles();
  }

  async getAllUsersProfile() {
    try {
      const users = await userRepository.getAllUsers();

      // Filter users to only include those with non-null values for the specified keys
      const filteredUsers = users.filter((user) => {
        const { firstName, lastName, phoneNumber, country_code, gender } = user;
        return (
          firstName !== null &&
          lastName !== null &&
          phoneNumber !== null &&
          country_code !== null &&
          gender !== null
        );
      });

      return filteredUsers;
    } catch (error) {
      throw new Error("Error while fetching users: " + error.message);
    }
  }

  async getUserTags(user) {
    return userRepository.getUserTags(user);
  }
}

module.exports = UserService;
