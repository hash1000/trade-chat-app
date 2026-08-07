const { Op } = require("sequelize");
const sequelize = require("../config/database");

const UserRepository = require("../repositories/UserRepository"); // Replace the path with the correct location of your UserRepository.js file
const ReactionRepository = require("../repositories/ReactionRepository"); // Replace the path with the correct location of your UserRepository.js file
const UserFavouriteRepository = require("../repositories/UserFavouriteRepository");
const FriendsRepository = require("../repositories/FriendsRepository");
const ChatRepository = require("../repositories/ChatRepository");
const Wallet = require("../models/wallet");
const UserTags = require("../models/userTags");

const { AddRequestNotification } = require("../notifications");

const CustomError = require("../errors/CustomError");
const BankAccount = require("../models/bankAccount");

const userRepository = new UserRepository();
const reactionRepository = new ReactionRepository();
const userFavouriteRepository = new UserFavouriteRepository();
const friendsRepository = new FriendsRepository();
const chatRepository = new ChatRepository();

class UserService {
  async getUserProfileById(profileId, userId) {
    const [
      my_reaction,
      user,
      wallets,
      favourite,
      friendship,
      senderCardCount,
    ] = await Promise.all([
      reactionRepository.getReactions(userId, profileId),
      userRepository.getUserProfile(profileId),
      // Load wallets with linked bank accounts
      Wallet.findAll({
        where: {
          userId: profileId,
        },
        include: [
          {
            model: BankAccount,
            as: "bankAccounts",
            required: false,
            where: { isDeleted: false },
            through: {
              attributes: [],
            },
          },
        ],
      }),
      userFavouriteRepository.get(userId, profileId),
      friendsRepository.get(userId, profileId),
      BankAccount.count({
        where: {
          userId: profileId,
          isDeleted: false,
          classification: { [Op.in]: ["sender", "both"] },
        },
        group: ["walletType"],
      }),
    ]);

    const walletDtos = wallets.map((w) => {
      return {
        id: w.id,
        currency: w.currency,
        walletType: w.walletType,
        availableBalance: Number(w.availableBalance),
        lockedBalance: Number(w.lockedBalance),
        accountNumber: w.accountNumber,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,

        linkedBankAccounts: w.bankAccounts.map((ba) => ({
          id: ba.id,
          firstName: ba.firstName,
          lastName: ba.lastName,
          familyName: ba.familyName,
          documentType: ba.documentType,
          documentValue: ba.documentValue,
          iban: ba.iban,
          accountNo: ba.accountNo,
          swift_code: ba.swift_code,
          bic: ba.bic,
          bank_name: ba.bank_name,
          bank_address: ba.bank_address,
          intermediate_bank_name: ba.intermediate_bank_name,
          intermediate_bank_swift: ba.intermediate_bank_swift,
          intermediate_bank_address: ba.intermediate_bank_address,
          note: ba.note,
          classification: ba.classification,
          currency: ba.currency,
          walletType: ba.walletType,
          isDefault: ba.isDefault,
        })),
      };
    });

    // Optional wallet summary
    const usdWallet = wallets.find(
      (w) => w.currency === "USD" && w.walletType === "PERSONAL",
    );

    const eurWallet = wallets.find(
      (w) => w.currency === "EUR" && w.walletType === "PERSONAL",
    );

    const walletSummary = {
      USD: {
        available: usdWallet ? Number(usdWallet.availableBalance) : 0,

        locked: usdWallet ? Number(usdWallet.lockedBalance) : 0,
      },

      EUR: {
        available: eurWallet ? Number(eurWallet.availableBalance) : 0,

        locked: eurWallet ? Number(eurWallet.lockedBalance) : 0,
      },
    };

    const isHaveCompanySenderCard = senderCardCount.some(
      (row) => row.walletType === "COMPANY" && row.count > 0,
    );

    const isHavePersonalSenderCard = senderCardCount.some(
      (row) => row.walletType === "PERSONAL" && row.count > 0,
    );

    return {
      ...user,

      wallets: walletDtos,

      walletSummary,

      friendship,

      liked: my_reaction?.type === "like",

      disliked: my_reaction?.type === "dislike",

      favourited: !!favourite,

      isHaveCompanySenderCard,

      isHavePersonalSenderCard,
    };
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
        profileId,
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
            transaction,
          );
          if (type === "like") {
            await userRepository.updateReactionCount(
              profileId,
              "dislikes",
              dislikeCount - 1,
              transaction,
            );
            await userRepository.updateReactionCount(
              profileId,
              "likes",
              likeCount + 1,
              transaction,
            );
          } else if (type === "dislike") {
            await userRepository.updateReactionCount(
              profileId,
              "likes",
              likeCount - 1,
              transaction,
            );
            await userRepository.updateReactionCount(
              profileId,
              "dislikes",
              dislikeCount + 1,
              transaction,
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
          transaction,
        );
        await userRepository.updateReactionCount(
          profileId,
          `${type}s`,
          reactionCount + 1,
          transaction,
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
        transaction,
      );
      if (updated > 0) {
        const reactionCount = user[`${type}s`] || 0;
        await userRepository.updateReactionCount(
          profileId,
          `${type}s`,
          reactionCount - 1,
          transaction,
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

  // Adding a friend is immediate and one-sided: no request/accept/reject step.
  // Friendship is per-direction (me -> them).
  async createFriendship(userId, profileId) {
    const me = Number(userId);
    const them = Number(profileId);

    if (!Number.isInteger(me) || !Number.isInteger(them)) {
      throw new CustomError("Invalid user id", 400);
    }
    if (me === them) {
      throw new CustomError("You cannot add yourself as a friend.", 400);
    }

    const target = await userRepository.getById(them);
    if (!target) {
      throw new CustomError("User not found", 404);
    }

    // My own directed friend entry. Only mine - adding them does not add me.
    const existing = await friendsRepository.getDirected(me, them);
    const alreadyFriend = Boolean(existing);
    if (!alreadyFriend) {
      await friendsRepository.addFriend(me, them);

      const otherUser = await userRepository.getUserTokenAndName(them);
      const myUser = await userRepository.getUserTokenAndName(me);
      if (otherUser && otherUser.fcm && myUser && myUser.name) {
        await new AddRequestNotification(
          otherUser.fcm,
          {},
          myUser,
        ).sendNotification();
      }
    }

    return {
      alreadyFriend,
      message: alreadyFriend
        ? "Already in your friend list."
        : "Friend added.",
    };
  }

  // Removes only my own entry. The other user keeps me in their list, and the
  // chat row is left intact so message history survives.
  async removeFriendship(userId, profileId) {
    const removed = await friendsRepository.removeDirected(
      Number(userId),
      Number(profileId),
    );
    return {
      removed: removed > 0,
      message: removed > 0 ? "Removed from your friend list." : "Not in your friend list.",
    };
  }

  async getFriendStatus(userId, profileId) {
    const me = Number(userId);
    const them = Number(profileId);

    if (!Number.isInteger(me) || !Number.isInteger(them)) {
      throw new CustomError("Invalid user id", 400);
    }

    const target = await userRepository.getById(them);
    if (!target) {
      throw new CustomError("User not found", 404);
    }

    const myFriendship = await friendsRepository.getDirected(me, them);
    const theirFriendship = await friendsRepository.getDirected(them, me);

    const isFriend = Boolean(myFriendship);

    return {
      isFriend,
      isMutualFriend: isFriend && Boolean(theirFriendship),
    };
  }

  // Friend/favourite check for a single profile, independent of any chat.
  async getFriendFavouriteStatus(userId, profileId) {
    const me = Number(userId);
    const them = Number(profileId);

    if (!Number.isInteger(me) || !Number.isInteger(them)) {
      throw new CustomError("Invalid user id", 400);
    }

    const [friendship, favourite, existingChat] = await Promise.all([
      friendsRepository.getDirected(me, them),
      userFavouriteRepository.get(me, them),
      chatRepository.findExistingDirectChat(me, them),
    ]);

    return {
      isFriend: Boolean(friendship),
      isFavourite: Boolean(favourite),
      // Symmetric lookup by membership, not by who created it — user1
      // creating a chat with user2 means user2 sees the same chatId here.
      chatId: existingChat ? existingChat.id : null,
    };
  }

  async getUserContacts(userId) {
    const favourites = await userFavouriteRepository.getFavourites(userId);
    const friends = await friendsRepository.getFriends(userId);
    return { favourites, friends };
  }

  // Replaces the old chat-row-based updateFriend, now backed by the
  // FriendProfile table instead of a chats row. userName/profilePic/description
  // are private overrides visible only in the requester's own friend list -
  // they never touch the target user's real profile. rating and tags keep
  // their original (non-private) behavior: rating overwrites the target's
  // real User.rating, tags merge into the requester's own global UserTags.
  async updateFriendProfile(
    requesterId,
    requesteeId,
    userName,
    profilePic,
    description,
    rating,
    tags,
  ) {
    const target = await userRepository.getById(requesteeId);
    if (!target) {
      throw new CustomError("User not found", 404);
    }

    await friendsRepository.upsertProfileOverride(requesterId, requesteeId, {
      userName,
      profilePic,
      description,
    });

    if (rating) {
      await userRepository.update(requesteeId, { rating });
    }

    let newTags = tags;
    if (tags) {
      const existing = await UserTags.findOne({ where: { userId: requesterId } });
      if (existing) {
        const merged = `${existing.tags},${tags}`.split(",");
        newTags = merged
          .filter((value, index, self) => self.indexOf(value) === index)
          .join(",");
        await UserTags.update(
          { tags: newTags, updatedAt: new Date() },
          { where: { userId: requesterId } },
        );
      } else {
        await UserTags.create({
          userId: requesterId,
          tags: newTags,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    return {
      message: "Friend and tags successfully updated",
      tags: newTags,
    };
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
          // phoneNumber !== null &&
          // country_code !== null &&
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
