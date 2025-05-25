const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const UserRepository = require("../repositories/UserRepository"); // Replace the path with the correct location of your UserRepository.js file
const CustomError = require("../errors/CustomError");
const ChatRepository = require("../repositories/ChatRepository");
const PaymentService = require("./PaymentService");
const UserFavouriteRepository = require("../repositories/UserFavouriteRepository");
const UserTags = require("../models/userTags");
const UserRole = require("../models/userRole");
const { User, Role } = require("../models");
const sequelize = require("../config/database");
const userRepository = new UserRepository();
const chat = new ChatRepository();
const payment = new PaymentService();
const UserFavourite = new UserFavouriteRepository();

class UserService {
  async createUser(userData) {
    let transaction;
    try {
      transaction = await sequelize.transaction();
      const { password, ...data } = userData;
      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = await userRepository.create(
        {
          password: hashedPassword,
          ...data,
        },
        { transaction }
      );

      await userRepository.assignRoleToUser(newUser.id, "user", transaction);

      await transaction.commit();
      return newUser;
    } catch (error) {
      if (transaction) await transaction.rollback();
      console.error("Error in createUser:", error);
      throw new CustomError(`Failed to create user: ${error.message}`, 500);
    }
  }

  async updateGoogleUser(user, userData) {
    try {
      // Update user properties
      if (userData.password) {
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        user.password = hashedPassword;
      }
      if (userData.phoneNumber) {
        user.phoneNumber = userData.phoneNumber;
      }
      if (userData.country_code) {
        user.country_code = userData.country_code;
      }
      if (userData.username) {
        user.username = userData.username;
      }
      if (userData.firstName) {
        user.firstName = userData.firstName;
      }
      if (userData.lastName) {
        user.lastName = userData.lastName;
      }
      if (userData.gender) {
        user.gender = userData.gender;
      }
      if (userData.settings) {
        user.settings = userData.settings;
      }
      if (userData.country) {
        user.country = userData.country;
      }
      if (userData.age) {
        user.age = userData.age;
      }
      if (userData.profilePic) {
        user.profilePic = userData.profilePic;
      }
      if (userData.description) {
        user.description = userData.description;
      }

      await user.save();

      return user;
    } catch (error) {
      throw new Error(`Failed to update google user profile: ${error.message}`);
    }
  }

  async createGoogleUser(userData) {
    let transaction;
    try {
      transaction = await sequelize.transaction();
      const { password, ...data } = userData;
      const newUser = await userRepository.create(
        {
          password: "",
          ...data,
        },
        { transaction }
      );
      await userRepository.assignRoleToUser(newUser.id, "user", transaction);

      // Commit the transaction
      await transaction.commit();
      return newUser;
    } catch (error) {
      if (transaction) await transaction.rollback();
      throw new Error("Failed to create user");
    }
  }

  async updateUserProfile(user, profileData, requesteeUser) {
    try {
      if (profileData.phoneNumber) {
        user.phoneNumber = profileData.phoneNumber;
      }
      if (profileData.country_code) {
        user.country_code = profileData.country_code;
      }
      if (profileData.username) {
        user.username = profileData.username;
      }
      if (profileData.firstName) {
        user.firstName = profileData.firstName;
      }
      if (profileData.lastName) {
        user.lastName = profileData.lastName;
      }
      if (profileData.gender) {
        user.gender = profileData.gender;
      }
      if (profileData.country) {
        user.country = profileData.country;
      }
      if (profileData.age) {
        user.age = profileData.age;
      }
      if (profileData.role) {
        user.role = profileData.role;
      }
      if (profileData.settings) {
        // Check if tags exist in the incoming data or user settings
        if (profileData.settings.tags || user.settings?.tags?.length > 0) {
          // Fetch the existing UserTags entry
          let userTag = await UserTags.findOne({
            where: { userId: user.id },
          });

          let tagArr = ""; // Array to hold all tags

          const existingTags = user.settings?.tags || "";
          const incomingTags = profileData.settings.tags || "";

          tagArr = existingTags + "," + incomingTags;

          const repeatedArr = tagArr.split(","); // string to array seperated with ,

          tagArr = repeatedArr
            .filter(function (value, index, self) {
              return self.indexOf(value) === index;
            })
            .join(",");
          // Combine tags from profileData and existing user settings
          // tagArr.push(...incomingTags, ...existingTags);

          // Remove duplicates
          // tagArr = [...new Set(tagArr)];

          // Save or update the UserTags table
          if (userTag) {
            await userTag.update(
              {
                tags: tagArr,
                updatedAt: new Date(),
              },
              {
                where: {
                  userId: user.id,
                },
              }
            );
          } else {
            await UserTags.create({
              userId: user.id,
              tags: tagArr,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }

          // Update user settings with merged tags
          //dectructure only which has more key value in object
          user.settings = {
            ...user.settings, // Keep existing settings
            ...profileData.settings, // Update with profileData settings
            tags: tagArr, // Set updated tags
          };

          // Save the updated user object (ensure you have a save method for the user entity)
          await user.save();
        }
      }

      if (profileData.profilePic) {
        user.profilePic = profileData.profilePic;
      }
      if (profileData.description) {
        user.description = profileData.description;
      }
      // Save both user and requesteeUser
      await user.save(); // Save the main user

      return user;
    } catch (error) {
      throw new Error(`Failed to update user profile: ${error.message}`);
    }
  }

  async updateUserRole(user, roleName) {
    try {
      // Check if the role exists
      const role = await Role.findOne({ where: { name: roleName } });
      if (!role) {
        throw new Error("Role not found");
      }

      // Check if the user already has this role
      const existingUserRole = await UserRole.findOne({
        where: { userId: user.id, roleId: role.id },
      });
      if (existingUserRole) {
        return { message: "User already has this role", user };
      }
      // Update the user's role
      await UserRole.update(
        {
          roleId: role.id,
        },
        {
          where: {
            userId: user.id,
          },
        }
      );

      // Fetch the updated user with their roles
      const updatedUser = await User.findByPk(user.id, {
        include: [
          {
            model: Role,
            as: "roles",
          },
        ],
      });
      return { message: "Role assigned successfully", user: updatedUser };
    } catch (error) {
      throw new Error(`Error updating roles: ${error.message}`);
    }
  }

  async getUserWithRoles(userId) {
    return User.findByPk(userId, {
      include: [
        {
          model: Role,
          through: { attributes: [] },
          attributes: ["name"],
        },
      ],
    });
  }

  async updatePhoneNumber(user, userData) {
    try {
      // Update user properties
      if (userData.phoneNumber) {
        user.phoneNumber = userData.phoneNumber;
      }
      if (userData.country_code) {
        user.country_code = userData.country_code;
      }
      await user.save();

      return user;
    } catch (error) {
      throw new Error(`Failed to update  user phoneNumber: ${error.message}`);
    }
  }
  async updateEmail(user, userData) {
    try {
      // Update user properties
      if (userData.email) {
        user.email = userData.email;
      }
      await user.save();

      return user;
    } catch (error) {
      throw new Error(`Failed to update  user phoneNumber: ${error.message}`);
    }
  }

  async updateUserStatus(userId, status) {
    const user = await userRepository.getById(userId);
    if (user) {
      user.is_online = status;
      return await user.save();
    }
  }

  async getUserById(userId) {
    return await userRepository.getById(userId);
  }

  async getUserByEmail(email) {
    // Call the UserRepository to get a user by email
    return userRepository.getByEmail(email);
  }
  // delete User
  async deleteUser(userId) {
    // Call the UserRepository to get a user by email
    await payment.cancelPaymentRelation(userId, userId);
    await UserFavourite.cancelUserFavourite(userId, userId);
    await chat.cancelInvite(userId, userId);
    return userRepository.delete(userId);
  }

  async getUserByPhoneNumber(country_code, phoneNumber) {
    // Call the UserRepository to get a user by email
    return userRepository.getByPhoneNumber(country_code, phoneNumber);
  }

  async getUserByResetToken(resetToken) {
    // Call the UserRepository to get a user by reset token
    return userRepository.getUserByResetToken(resetToken);
  }

  async verifyUserPassword(user, password) {
    try {
      // Compare the password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (isPasswordValid) {
        // Password is valid, return the user
        return user;
      } else {
        throw new Error("Invalid password");
      }
    } catch (error) {
      // Handle any errors
      throw new Error("Failed to login");
    }
  }

  async sendPasswordResetEmail(email) {
    // Check if the email exists in the database
    const user = await userRepository.getByEmail(email);
    if (!user) {
      throw new Error("User not found");
    }
    if (user.resetToken) {
      throw new CustomError("Reset token already exists", 409);
    }
    // Generate a password reset token
    const resetToken = crypto.randomBytes(20).toString("hex");

    // Save the reset token to the user's record in the database
    await userRepository.updateResetToken(email, resetToken);

    // Send the password reset email to the user's email address
    // TODO: send email
  }

  async updateTokenVersion(user) {
    try {
      user.tokenVersion += 1;
      await user.save();
    } catch (error) {
      throw new Error(`Failed to update token version: ${error.message}`);
    }
  }

  async getAllProfileUsers() {
    try {
      const users = await userRepository.findAll({
        attributes: [
          "id",
          "firstName",
          "lastName",
          "username",
          "email",
          "phoneNumber",
          "country_code",
          "profilePic",
          "settings",
          "createdAt",
          "updatedAt",
          "likes",
          "dislikes",
          "last_login",
        ],
      });
      return users.map((user) => user.toJSON());
    } catch (error) {
      throw new Error("Error while fetching users: " + error.message);
    }
  }

  async updateUserPassword(userId, newPassword) {
    try {
      const user = await userRepository.getById(userId);
      if (!user) {
        throw new Error("User not found");
      }
      user.password = await bcrypt.hash(newPassword, 10);
      user.tokenVersion += 1;
      user.resetToken = null;
      return await user.save();
    } catch (error) {
      throw new Error(`Failed to update user password: ${error.message}`);
    }
  }

  async getPaginatedUsers(page, limit, search, userId) {
    return userRepository.getPaginatedUsers(page, limit, search, userId);
  }

  async getUsersByPhoneNumbers(phoneNumbers) {
    return userRepository.getUsersByPhoneNumbers(phoneNumbers);
  }

  async getUsersByIds(userIds) {
    return userRepository.getUsersById(userIds);
  }

  async updateUserProfileById(id, profileData) {
    const user = {};

    if (profileData.name) {
      user.name = profileData.name;
    }
    if (profileData.profilePic) {
      user.profilePic = profileData.profilePic;
    }

    if (profileData.settings) {
      user.settings = profileData.settings;
    }

    if (profileData.email) {
      user.email = profileData.email;
    }

    if (profileData.phoneNumber) {
      user.phoneNumber = profileData.phoneNumber;
    }

    if (profileData.country_code) {
      user.country_code = profileData.country_code;
    }

    return userRepository.updateUserProfileById(id, user);
  }

  async updateToken(user, fcmToken) {
    // Update the profile fields
    user.fcm = fcmToken;

    // Save the updated user
    await user.save();

    return user;
  }

  async updateUserEmailCode(id, emailCode) {
    return userRepository.updateUserEmailCode(id, emailCode);
  }

  async getUserOTPCode(id) {
    return userRepository.getUserOTPCode(id);
  }
}

module.exports = UserService;
