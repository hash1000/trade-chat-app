const Chat = require("../models/chat");
const Friends = require("../models/friends");
const User = require("../models/user");
const { Op } = require("sequelize");
const UserTags = require("../models/userTags");
const { Role, UserRole } = require("../models");

class UserRepository {

  async assignRoleToUser(userId, roleName, transaction = null) {
    try {
      const role = await Role.findOne({ where: { name: roleName }, transaction });
      if (!role) {
        throw new Error(`Role ${roleName} not found`);
      }
  
      const user = await User.findByPk(userId, { transaction });
      if (!user) {
        throw new Error(`User with id ${userId} not found`);
      }
  
      const userRole = await UserRole.create(
        {
          userId: user.id,
          roleId: role.id,
        },
        { transaction } // Pass the transaction object
      );
      return user;
    } catch (error) {
      console.error("Error in assignRoleToUser:", error); // Log the exact error
      throw new Error(`Failed to assign role: ${error.message}`);
    }
  }

  // Create a new user
  async create(user) {
    console.log("user",user);
    return User.create(user);
  }

  async getAllUsers() {
    try {
      const users = await User.findAll({
        attributes: [
          "id",
          "firstName",
          "lastName",
          "username",
          "email",
          "phoneNumber",
          "country_code",
          "country",
          "gender",
          "profilePic",
          "description",
          "settings",
          "friendShip",
          "createdAt",
          "updatedAt",
          "fcm",
          "likes",
          "dislikes",
          "last_login",
          "is_online",
          "personalWalletBalance",
          "companyWalletBalance",
          "expiration_time",
        ],
        include: [
          {
            model: Role,
            as: "roles"
          },
        ]
      });
      return users.map((user) => user.toJSON());
    } catch (error) {
      throw new Error("Error while fetching users: " + error.message);
    }
  }

  // Get a user by ID
  async getById(userId) {
    console.log("repos");
    return await User.findByPk(userId, {
      include: [
        {
          model: Role,
          as: "roles"
        },
      ]
    });
  }

  async getUserTokenAndName(userId) {
    return User.findByPk(userId, {
      include: [
        {
          model: Role,
          as: "roles",
        },
      ],
      attributes: ["id", "name", "fcm"]
    });
  }

  async getUserProfile(id) {
    const user = await User.findOne({
      where: { id },
      attributes: [
        "id",
        "firstName",
        "lastName",
        "username",
        "email",
        "phoneNumber",
        "country_code",
        "gender",
        "country",
        "age",
        "profilePic",
        "description",
        "settings",
        "friendShip",
        "createdAt",
        "updatedAt",
        "fcm",
        "likes",
        "dislikes",
        "last_login",
        "is_online",
        "personalWalletBalance",
        "companyWalletBalance",
        "expiration_time",
      ],
      include: [
        {
          model: Role,
          as: "roles"
        },
      ]
    });
    return user ? user.toJSON() : null;
  }

  async getAllUser(id) {
    const user = await User.findOne({
      where: { id },
      attributes: [
        "id",
        "firstName",
        "lastName",
        "username",
        "email",
        "phoneNumber",
        "country_code",
        "gender",
        "country",
        "age",
        "profilePic",
        "description",
        "settings",
        "friendShip",
        "createdAt",
        "updatedAt",
        "fcm",
        "likes",
        "dislikes",
        "last_login",
        "is_online",
        "personalWalletBalance",
        "companyWalletBalance",
        "expiration_time",
      ],
      include: [
        {
          model: Role,
          as: "roles"
        },
      ]
    });
    return user ? user.toJSON() : null;
  }

  async getUserCounts(id) {
    const user = await User.findOne({
      where: { id },
      attributes: ["id", "likes", "dislikes"],
      include: [
        {
          model: Role,
          as: "roles"
        },
      ]
    });

    return user ? user.toJSON() : null;
  }

  async updateReactionCount(id, type, count, transaction) {
    return User.update({ [type]: count }, { where: { id }, transaction });
  }

  // Get multiple users by ID
  async getUsersById(userIds) {
    return User.findAll({
      where: {
        id: userIds,
      },
      include: [
        {
          model: Role,
          as: "roles"
        },
      ]
    });
  }

  // Get a user by email
  async getByEmail(email) {
    return User.findOne({ 
      where: { email },
      include: [
        {
          model: Role,
          as: "roles"
        },
      ]
    });
  }

  // Get a user by phoneNumber
  async getByPhoneNumber(country_code, phoneNumber) {
    return User.findOne({ 
      where: { country_code, phoneNumber },
      include: [
        {
          model: Role,
          as: "roles"
        },
      ]
    });
  }

  // Update a user
  async update(userId, updates) {
    const user = await this.getById(userId);
    if (!user) {
      throw new Error("User not found");
    }
    return user.update(updates);
  }

  // Delete a user
  async delete(userId) {
    const user = await this.getById(userId);
    if (!user) {
      throw new Error("User not found");
    }
    await Chat.destroy({
      where: {
        user2Id: userId,
      },
    });
    return user.destroy();
  }

  async updateResetToken(email, resetToken) {
    // Update the user's reset token in the database
    await User.update({ resetToken }, { where: { email } });
  }

  async getUserByResetToken(resetToken) {
    // Find a user by the reset token in the database
    return User.findOne({ 
      where: { resetToken },
      include: [
        {
          model: Role,
          as: "roles"
        },
      ]
    });
  }

  async updateUserPassword(email, newPassword) {
    // Update the user's password in the database
    await User.update(
      { password: newPassword, resetToken: null },
      { where: { email } }
    );
  }

  async getPaginatedUsers(page, limit, search, userId) {
    const offset = (page - 1) * limit;

    const where = search
      ? {
          [Op.or]: [
            { email: { [Op.like]: `%${search}%` } },
            { phoneNumber: { [Op.like]: `%${search}%` } },
            { name: { [Op.like]: `%${search}%` } },
          ],
        }
      : {};

    const users = await User.findAndCountAll({
      where,
      limit,
      offset,
      include: [
        {
          model: Role,
          as: "roles"
        },
      ]
    });

    const userIds = users.rows.map((user) => user.id);
    const friends = await Friends.findAll({
      where: {
        [Op.or]: [
          { userId: userIds, profileId: userId },
          { profileId: userIds, userId },
        ],
      },
      attributes: ["userId", "profileId", "type"],
    });

    const friendsMap = friends.reduce((acc, friend) => {
      if (friend.userId === userId) {
        acc[friend.profileId] = friend;
      } else {
        acc[friend.userId] = friend;
      }
      return acc;
    }, {});

    users.rows = users.rows.map((user) => {
      user = user.toJSON();
      user.friendship = friendsMap[user.id] || null;
      if (
        user.friendship &&
        user.friendship.type === "sent" &&
        user.friendship.profileId === userId
      ) {
        user.friendship.type = "received";
      }
      return user;
    });

    return {
      total: users.count,
      totalPages: Math.ceil(users.count / limit),
      currentPage: page,
      users: users.rows,
    };
  }

  async getUsersByPhoneNumbers(phoneNumbers) {
    const phoneNumbersArray = phoneNumbers.map(
      (phoneNumber) => phoneNumber.phone
    );
    let users = await User.findAll({
      where: {
        phoneNumber: {
          [Op.in]: phoneNumbersArray,
        },
      },
      attributes: [
        "id",
        "name",
        "country_code",
        "email",
        "phoneNumber",
        "profilePic",
      ],
      include: [
        {
          model: Role,
          as: "roles"
        },
      ]
    });

    users = users.filter((user) => {
      const userPhoneNumber = {
        country: user.country_code,
        phone: user.phoneNumber,
      };
      return phoneNumbers.some(
        (phoneNumber) =>
          phoneNumber.country === userPhoneNumber.country &&
          phoneNumber.phone === userPhoneNumber.phone
      );
    });

    return {
      users: users,
    };
  }

  async updateUserEmailCode(id, otp) {
    return User.update({ otp }, { where: { id } });
  }

  async getUserOTPCode(id) {
    return User.findOne({ where: { id }, attributes: ["otp"] });
  }

  async updateUserProfileById(id, profileData) {
    return User.update(profileData, { where: { id } });
  }

  async getUserTags(user) {
    try {
      // Fetch user tags from the database
      const userTag = await UserTags.findOne({
        where: { userId: user.id },
      });

      // Check if user tags exist; return default values if not found
      if (!userTag) {
        return {
          message: "No tags found for this user",
          tags: "",
        };
      }

      // Return found tags
      return userTag;
    } catch (error) {
      console.error("Error fetching tags:", error);
      throw new Error("Error while fetching tags: " + error.message);
    }
  }
}

module.exports = UserRepository;