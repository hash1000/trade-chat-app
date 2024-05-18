const { Vonage } = require("@vonage/server-sdk");
const jwt = require("jsonwebtoken");
const UserService = require("../services/UserService"); // Replace the path with the correct location of your UserService.js file
const CustomError = require("../errors/CustomError");
const UnauthorizedError = require("../errors/UnauthorizedError");
const EmailService = require("../services/EmailService");
const userService = new UserService();

class UserController {
  async googleSignIn(req, res) {
    const { displayName, email, phoneNumber, photoURL } = req.body;
    try {
      const userData = {
        username: displayName,
        email,
        phoneNumber,
        photoURL,
      };
      const newUser = await userService.createGoogleUser(userData);
      const token = jwt.sign(
        { userId: newUser.id, tokenVersion: 0 },
        process.env.JWT_SECRET_KEY
      );

      return res.json({
        message: "Successfully created a new user with this email and number",
        token,
        user: newUser,
      });
    } catch (error) {
      console.error("Error during sign up:", error);
      res.status(500).json({ message: "Failed to verify sign up Data" });
    }
  }

  async signup(req, res) {
    try {
      const { phoneNumber, country_code } = req.body;
      const user = await admin.auth().createUser({
        phoneNumber: country_code + phoneNumber,
      });

      res.json({ message: `OTP sent to ${phoneNumber}`, user });
    } catch (error) {
      console.error("Error during sign up:", error);
      res.status(500).json({ message: "Sign up failed" });
    }
  }

  async GoogleProfile(req, res) {
    try {
      const {
        country_code,
        phoneNumber,
        email,
        password,
        username,
        firstName,
        lastName,
        gender,
        country,
        age,
        profilePic,
        description,
      } = req.body;

      const userByEmail = await userService.getUserByEmail(email);
      const userData = {
        password,
        phoneNumber,
        country_code,
        username,
        firstName,
        lastName,
        gender,
        country,
        age,
      };
      if (profilePic) {
        userData.profilePic = profilePic;
      }
      if (description) {
        userData.description = description;
      }

      const updateUser = await userService.updateGoogleUser(
        userByEmail,
        userData
      );
      const token = jwt.sign(
        { userId: updateUser.id, tokenVersion: 0 },
        process.env.JWT_SECRET_KEY
      );

      return res.json({
        message: "Successfully created a new user with this email and number",
        token,
        user: updateUser,
      });
    } catch (error) {
      console.error("Error during Google profile update", error);
      res.status(500).json({ message: "Failed to update Google profile " });
    }
  }

  async verify(req, res) {
    try {
      const {
        country_code,
        phoneNumber,
        email,
        password,
        username,
        firstName,
        lastName,
        gender,
        country,
        age,
        profilePic,
        description,
      } = req.body;

      // Check if the user already exists with the provided phone number
      const userByPhoneNumber = await userService.getUserByPhoneNumber(
        country_code,
        phoneNumber
      );
      // Check if the user already exists with the provided email
      const userByEmail = await userService.getUserByEmail(email);

      if (
        userByPhoneNumber &&
        userByEmail &&
        userByPhoneNumber.id === userByEmail.id
      ) {
        await userService.updateTokenVersion(userByPhoneNumber);
        const token = jwt.sign(
          {
            userId: userByPhoneNumber.id,
            tokenVersion: userByPhoneNumber.tokenVersion,
          },
          process.env.JWT_SECRET_KEY
        );
        return res.status(400).json({
          message: "User with this email and number already exists",
          token,
          user: userByPhoneNumber,
        });
      } else if (userByEmail && userByEmail.email === email) {
        return res
          .status(400)
          .json({ message: "User with this email already exists" });
      } else if (
        userByPhoneNumber &&
        userByPhoneNumber.phoneNumber === phoneNumber
      ) {
        return res
          .status(400)
          .json({ message: "User with this Number already exists" });
      } else {
        const userData = {
          email,
          password,
          phoneNumber,
          country_code,
          username,
          firstName,
          lastName,
          gender,
          country,
          age,
        };

        if (profilePic) {
          userData.profilePic = profilePic;
        }
        if (description) {
          userData.description = description;
        }

        const newUser = await userService.createUser(userData);
        const token = jwt.sign(
          { userId: newUser.id, tokenVersion: 0 },
          process.env.JWT_SECRET_KEY
        );

        return res.json({
          message: "Successfully created a new user with this email and number",
          token,
          user: newUser,
        });
      }
    } catch (error) {
      console.error("Error during sign up:", error);
      res.status(500).json({ message: "Failed to verify OTP" });
    }
  }

  async login(req, res) {
    try {
      const { email, password, country_code, phoneNumber } = req.body;
      let user = null;
      console.log(email, password, country_code, phoneNumber);
      if (email && password) {
        // Login with email and password
        user = await userService.getUserByEmail(email);

        if (!user) {
          return res.status(401).json({ message: "Invalid credentials" });
        }

        const validatedUser = await userService.verifyUserPassword(
          user,
          password
        );
        if (!validatedUser) {
          return res.status(401).json({ message: "Invalid credentials" });
        }

        await userService.updateTokenVersion(validatedUser);
      } else if (country_code && phoneNumber) {
        // Login with country code and phone number
        user = await userService.getUserByPhoneNumber(
          country_code,
          phoneNumber
        );
        if (!user) {
          return res.status(401).json({ message: "Invalid credentials" });
        }
      } else {
        return res.status(400).json({ message: "Invalid request parameters" });
      }

      await userService.updateTokenVersion(user);
      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, tokenVersion: user.tokenVersion },
        process.env.JWT_SECRET_KEY
      );

      // Respond with the token and user data
      return res.json({ token, user });
    } catch (error) {
      console.error("Error during login:", error);
      return res.status(500).json({ message: "Login failed" });
    }
  }

  async changePassword(req, res) {
    try {
      const { email, password, newPassword } = req.body;

      // Check if the user exists
      const user = await userService.getUserByEmail(email);
      console.log("user>>", user);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Verify the password
      const validatedUser = await userService.verifyUserPassword(
        user,
        password
      );
      if (!validatedUser) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const updateduser = await userService.updateUserPassword(
        user.id,
        newPassword
      );
      const token = jwt.sign(
        { userId: updateduser.id, tokenVersion: updateduser.tokenVersion },
        process.env.JWT_SECRET_KEY
      );
      // Respond with the token and user data
      return res.json({ token, updateduser });
    } catch (error) {
      console.error("Error during login:", error);
      res.status(500).json({ message: "Login failed" });
    }
  }

  async createAdmin(req, res) {
    try {
      const { email } = req.body;

      // Check if the user exists
      const user = await userService.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const updatedUser = await userService.updateUserProfile(user, {
        role: "admin",
      });
      return res.json({ user: updatedUser });
    } catch (error) {
      console.error("Error during login:", error);
      res.status(500).json({ message: "Login failed" });
    }
  }

  async getUser(req, res) {
    res.json({ user: req.user });
  }

  async getUsers(req, res) {
    try {
      const { page = 1, limit = 10, search } = req.query;

      const products = await userService.getPaginatedUsers(
        page,
        limit,
        search,
        req.user.id
      );

      return res.json(products);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to list user" });
    }
  }

  async getUsersById(req, res) {
    try {
      const { userIds } = req.body;

      const users = await userService.getUsersByIds(userIds);

      return res.json(users);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to list users" });
    }
  }

  async getUsersByPhoneNumbers(req, res) {
    try {
      const { phoneNumbers } = req.body;

      const users = await userService.getUsersByPhoneNumbers(phoneNumbers);

      return res.json(users);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to list user" });
    }
  }

  async forgotPassword(req, res) {
    const { email } = req.body;

    try {
      await userService.sendPasswordResetEmail(email);
      return res.json({ message: "Password reset email sent successfully" });
    } catch (error) {
      console.error(error);
      if (error instanceof CustomError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      res.status(500).json({
        message: "An error occurred while sending the password reset email",
      });
    }
  }

  async resetPassword(req, res) {
    const { resetToken, password } = req.body;
    let userId = null;
    try {
      if (req.userId && req.tokenVersion) {
        userId = req.userId;
        const userById = await userService.getUserById(userId);
        if (userById.tokenVersion !== req.tokenVersion) {
          throw new UnauthorizedError("Unauthorized");
        }
      } else if (resetToken) {
        const userByToken = await userService.getUserByResetToken(resetToken);
        if (!userByToken) {
          throw new UnauthorizedError("Unauthorized");
        }
        userId = userByToken.id;
      }
      if (userId) {
        const user = await userService.updateUserPassword(userId, password);
        const token = jwt.sign(
          { userId: user.id, tokenVersion: user.tokenVersion },
          process.env.JWT_SECRET_KEY
        );
        // Respond with the token and user data
        return res.json({ token, user });
      } else {
        throw new UnauthorizedError("Password reset failed");
      }
    } catch (error) {
      console.log(error);
      if (error instanceof UnauthorizedError) {
        res.status(error.statusCode).json({ message: error.message });
      }
      throw error;
    }
  }

  async updateUser(req, res) {
    try {
      const { name, profilePic = null, settings = null } = req.body;
      const user = req.user; // Assuming you have an authentication middleware to attach the user object to the request
      const updatedUser = await userService.updateUserProfile(user, {
        name,
        profilePic,
        settings,
      });
      res.json({ user: updatedUser });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  async updateFCM(req, res) {
    try {
      const { fcmToken } = req.body;
      const user = req.user; // Assuming you have an authentication middleware to attach the user object to the request
      const updatedUser = await userService.updateToken(user, fcmToken);
      res.json({ user: updatedUser });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  async verifyEmailOrPhone(req, res) {
    try {
      const { phone, email } = req.body;
      const user = req.user; // Assuming you have an authentication middleware to attach the user object to the request
      const vonage = new Vonage({
        apiKey: "70c5b3e3",
        apiSecret: "sMo8UULGWO94oeuY",
      });
      if (phone) {
        const { country_code, phoneNumber } = phone;
        // check if any other user has the phone number
        const userByPhone = await userService.getUserByPhoneNumber(
          country_code,
          phoneNumber
        );
        if (userByPhone) {
          return res
            .status(409)
            .json({ message: "Phone number already in use" });
        }
        vonage.verify
          .start({
            number: `${country_code}${phoneNumber}`,
            brand: "QRM Trade Chat",
          })
          .then(async (resp) => {
            console.log(resp.request_id);
            // Respond with the token and user data
            await userService.updateUserEmailCode(user.id, resp.request_id);
            res.json({ message: "SMS OTP Sent.", request_id: resp.request_id });
          })
          .catch((err) => {
            res.status(500).json({ message: "Filed to send OTP" });
          });
      } else if (email) {
        // check if any other user has the phone number
        const userByEmail = await userService.getUserByEmail(email);
        if (userByEmail) {
          return res
            .status(409)
            .json({ message: "Email already in use", error: err });
        }
        // generate random 4 digit code
        const code = Math.floor(1000 + Math.random() * 9000);
        // send email
        await EmailService.sendEmailCode(email, user.name, code);
        await userService.updateUserEmailCode(user.id, code);
        res.json({ message: "Email OTP Sent." });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  async makePrimary(req, res) {
    try {
      const { otp, email, phone } = req.body;
      const user = req.user; // Assuming you have an authentication middleware to attach the user object to the request
      if (email) {
        const userByEmail = await userService.getUserByEmail(email);
        if (userByEmail) {
          return res.status(409).json({ message: "Email already in use" });
        }
        const { otp: userByEmailCode } = await userService.getUserOTPCode(
          user.id
        );
        if (!userByEmailCode) {
          return res.status(401).json({ message: "Invalid code" });
        }
        if (userByEmailCode !== otp) {
          return res.status(401).json({ message: "Invalid code" });
        }
        await userService.updateUserProfileById(user.id, { email });
        const updatedUser = await userService.getUserById(user.id);

        res.json({ updatedUser });
      } else if (phone) {
        const { country_code, phoneNumber } = phone;
        // check if any other user has the phone number
        const userByPhone = await userService.getUserByPhoneNumber(
          country_code,
          phoneNumber
        );
        if (userByPhone) {
          return res
            .status(409)
            .json({ message: "Phone number already in use" });
        }
        const vonage = new Vonage({
          apiKey: "70c5b3e3",
          apiSecret: "sMo8UULGWO94oeuY",
        });

        const { otp: request_id } = await userService.getUserOTPCode(user.id);
        vonage.verify
          .check(request_id, otp)
          .then(async (resp) => {
            await userService.updateUserProfileById(user.id, {
              country_code,
              phoneNumber,
            });
            const updatedUser = await userService.getUserById(user.id);
            res.json({ updatedUser });
          })
          .catch((err) => {
            res.status(500).json({ message: "Filed to verify OTP" });
          });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
}

module.exports = UserController;
