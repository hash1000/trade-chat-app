const twilio = require("twilio");
const { Vonage } = require("@vonage/server-sdk");
const jwt = require("jsonwebtoken");
const UserService = require("../services/UserService"); // Replace the path with the correct location of your UserService.js file
const CustomError = require("../errors/CustomError");
const UnauthorizedError = require("../errors/UnauthorizedError");
const EmailService = require("../services/EmailService");
const OTP = require("../models/otp.js");
const EmailOtp = require("../models/email_otp.js");
var otpGenerator = require("otp-generator");
const AddMinutesToDate = require("../utilities/addMinutesToDate");
const nodemailer = require("nodemailer");
const { decode, encode } = require("../middlewares/emailValidation.js");
const dates = require("../utilities/verifyDates.js");
const userService = new UserService();
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

class UserController {
  async googleSignIn(req, res) {
    const { displayName, email, photoURL } = req.body;

    try {
      const userData = {
        username: displayName,
        email,
        photoURL,
      };

      // Check if the user already exists with the provided email
      const userByEmail = await userService.getUserByEmail(email);
      if (userByEmail) {
        await userService.updateTokenVersion(userByEmail);
        const token = jwt.sign(
          {
            userId: userByEmail.id,
            tokenVersion: userByEmail.tokenVersion,
          },
          process.env.JWT_SECRET_KEY
        );
        return res.status(200).json({
          message:
            "A user with this email already exists. Authentication successful.",
          token,
          user: userByEmail,
        });
      } else {
        const newUser = await userService.createGoogleUser(userData);
        const token = jwt.sign(
          { userId: newUser.id, tokenVersion: 0 },
          process.env.JWT_SECRET_KEY
        );

        return res.status(201).json({
          message:
            "A new user has been successfully created with this email and phone number.",
          token,
          user: newUser,
        });
      }
    } catch (error) {
      console.error("Error during Google sign-in:", error);
      res.status(500).json({
        message: "An error occurred while processing the sign-up data.",
      });
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
        settings,
        age,
        profilePic,
        description,
      } = req.body;

      const userByPhoneNumber = await userService.getUserByPhoneNumber(
        country_code,
        phoneNumber
      );
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
        return res.status(200).json({
          message:
            "User with this email and phone number already exists. Authentication successful.",
          token,
          user: userByPhoneNumber,
        });
      } else if (userByEmail) {
        if (
          (userByEmail &&
            userByEmail.firstName === null &&
            userByEmail.lastName === null &&
            userByEmail.country_code === null &&
            userByEmail.phoneNumber === null &&
            userByEmail.gender === null &&
            userByEmail.country === null &&
            userByEmail.age === null &&
            country_code,
          phoneNumber,
          email,
          password,
          firstName,
          lastName,
          gender,
          country,
          age)
        ) {
          let googleUser = {
            country_code,
            phoneNumber,
            email,
            password,
            firstName,
            lastName,
            gender,
            country,
            age,
          };
          if (username) {
            googleUser.username = username;
          }
          if (profilePic) {
            googleUser.profilePic = profilePic;
          }
          if (description) {
            googleUser.description = description;
          }
          if (settings) {
            googleUser.settings = settings;
          }
          req.body.googleUser = googleUser;
          return this.GoogleProfile(req, res);
        } else {
          return res.status(409).json({
            message: "User with this email already exists.",
            User: userByEmail,
          });
        }
      } else if (userByPhoneNumber) {
        return res
          .status(409)
          .json({ message: "User with this phone number already exists." });
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
          settings,
          country,
          age,
        };

        if (profilePic) userData.profilePic = profilePic;
        if (description) userData.description = description;
        if (settings) userData.settings = settings;

        const newUser = await userService.createUser(userData);
        const token = jwt.sign(
          { userId: newUser.id, tokenVersion: 0 },
          process.env.JWT_SECRET_KEY
        );

        return res.status(201).json({
          message:
            "Successfully created a new user with this email and phone number.",
          token,
          user: newUser,
        });
      }
    } catch (error) {
      console.error("Error during verification:", error);
      res.status(500).json({ message: "Failed to verify user." });
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
        settings,
        country,
        age,
        profilePic,
        description,
      } = req.body;
      const userByEmail = await userService.getUserByEmail(email);
      if (!userByEmail) {
        return res.status(404).json({ message: "User not found" });
      }
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
      const userByPhoneNumber = await userService.getUserByPhoneNumber(
        country_code,
        phoneNumber
      );
      if (userByPhoneNumber) {
        return res
          .status(409)
          .json({ message: "A user with this phone number already exists." });
      } else {
        if (profilePic) userData.profilePic = profilePic;
        if (description) userData.description = description;
        if (settings) userData.settings = settings;

        const updateUser = await userService.updateGoogleUser(
          userByEmail,
          userData
        );
        const token = jwt.sign(
          { userId: updateUser.id, tokenVersion: 0 },
          process.env.JWT_SECRET_KEY
        );

        return res.json({
          message: "User profile updated successfully",
          token,
          user: updateUser,
        });
      }
    } catch (error) {
      console.error("Error during Google profile update:", error);
      res.status(500).json({ message: "Failed to update Google profile" });
    }
  }

  async login(req, res) {
    try {
      const { email, password, country_code, phoneNumber } = req.body;
      let user = null;
      if (email && password) {
        // Login with email and password
        user = await userService.getUserByEmail(email);
        if (!user) {
          return res
            .status(401)
            .json({ message: "Invalid email or password." });
        }

        const validatedUser = await userService.verifyUserPassword(
          user,
          password
        );
        if (!validatedUser) {
          return res
            .status(401)
            .json({ message: "Invalid email or password." });
        }
      } else if (country_code && phoneNumber) {
        // Login with country code and phone number
        user = await userService.getUserByPhoneNumber(
          country_code,
          phoneNumber
        );
        if (!user) {
          return res.status(401).json({ message: "Invalid phone number." });
        }
      } else {
        return res.status(400).json({ message: "Invalid request parameters." });
      }

      await userService.updateTokenVersion(user);
      const token = jwt.sign(
        { userId: user.id, tokenVersion: user.tokenVersion },
        process.env.JWT_SECRET_KEY
      );

      return res.json({
        message: "Login successful.",
        token,
        user,
      });
    } catch (error) {
      console.error("Error during login:", error);
      return res.status(500).json({ message: "Login failed." });
    }
  }

  async emailOtp(req, res) {
    try {
      const { email, type } = req.body;

      if (!email) {
        return res
          .status(400)
          .send({ Status: "Failure", Details: "Email not provided" });
      }

      if (!type) {
        return res
          .status(400)
          .send({ Status: "Failure", Details: "Type not provided" });
      }
      // Generate OTP
      const otp = otpGenerator.generate(6, {
        digits: true,
        lowerCaseAlphabets: false,
        upperCaseAlphabets: false,
        specialChars: false,
      });
      const now = new Date();
      const expiration_time = AddMinutesToDate(now, 10);

      // Create OTP instance in DB
      const otp_instance = await EmailOtp.create({
        otp: otp,
        expiration_time: expiration_time,
      });

      // Create details object containing the email and otp id
      const details = {
        timestamp: now,
        check: email,
        success: true,
        message: "OTP sent to user",
        otp_id: otp_instance.id,
      };

      // Encrypt the details object
      const encoded = await encode(JSON.stringify(details));

      // Choose message template according to type requested
      let email_message, email_subject;
      if (type === "VERIFICATION") {
        const {
          message,
          subject_mail,
        } = require("../templates/email/email_verification");
        email_message = message(otp);
        email_subject = subject_mail;
      } else if (type === "FORGET") {
        const {
          message,
          subject_mail,
        } = require("../templates/email/email_forget");
        email_message = message(otp);
        email_subject = subject_mail;
      } else if (type === "2FA") {
        const {
          message,
          subject_mail,
        } = require("../templates/email/email_2FA");
        email_message = message(otp);
        email_subject = subject_mail;
      } else {
        return res
          .status(400)
          .send({ Status: "Failure", Details: "Incorrect Type Provided" });
      }

      // Create nodemailer transporter
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_ADDRESS,
          pass: process.env.EMAIL_PASSWORD,
        },
      });

      const mailOptions = {
        from: `"Nasko China" <${process.env.EMAIL_ADDRESS}>`,
        to: email,
        subject: email_subject,
        html: email_message, // Ensure the email content is sent as HTML
      };

      await transporter.verify();

      // Send Email
      transporter.sendMail(mailOptions, (err, info) => {
        if (err) {
          console.error("Error sending email:", err);
          return res
            .status(400)
            .send({ Status: "Failure", Details: err.message });
        } else {
          console.log("Email sent successfully:", info);
          return res.send({ Status: "Success", Details: encoded });
        }
      });
    } catch (err) {
      console.error("Error in emailOtp function:", err);
      return res.status(400).send({ Status: "Failure", Details: err.message });
    }
  }
  
  
  async verifyEmailOtp(req, res) {
    try {
      var currentdate = new Date();
      const { verification_key, otp, check } = req.body;

      if (!verification_key) {
        const response = {
          Status: "Failure",
          Details: "Verification Key not provided",
        };
        return res.status(400).send(response);
      }
      if (!otp) {
        const response = { Status: "Failure", Details: "OTP not Provided" };
        return res.status(400).send(response);
      }
      if (!check) {
        const response = { Status: "Failure", Details: "Check not Provided" };
        return res.status(400).send(response);
      }

      let decoded;
      let user, token;

      //Check if verification key is altered or not and store it in variable decoded after decryption
      try {
        decoded = await decode(verification_key);
      } catch (err) {
        const response = { Status: "Failure", Details: "verification Failed" };
        return res.status(400).send(response);
      }
      var obj = JSON.parse(decoded);
      const check_obj = obj.check;

      // Check if the OTP was meant for the same email or phone number for which it is being verified
      if (check_obj != check) {
        const response = {
          Status: "Failure",
          Details: "OTP was not sent to this particular email or phone number",
        };
        return res.status(400).send(response);
      }

      const otp_instance = await EmailOtp.findOne({ where: { id: obj.otp_id } });
      //Check if OTP is available in the DB
      if (otp_instance != null) {
        //Check if OTP is already used or not
        if (otp_instance.verified != true) {
          //Check if OTP is expired or not
          if (dates.compare(otp_instance.expiration_time, currentdate) == 1) {
            //Check if OTP is equal to the OTP in the DB
            if (otp === otp_instance.otp) {
              user = await userService.getUserByEmail(check);
              if (!user) {
                return res
                  .status(400)
                  .json({ message: "User with this email dose not exist" });
              } else {
                await userService.updateTokenVersion(user);
                token = jwt.sign(
                  { userId: user.id, tokenVersion: user.tokenVersion },
                  process.env.JWT_SECRET_KEY
                );
              }
              otp_instance.verified = true;
              otp_instance.save();
              const response = {
                Status: "Success",
                Details: "OTP Matched",
                Check: check,
                token: token,
              };
              return res.status(200).send(response);
            } else {
              const response = {
                Status: "Failure",
                Details: "OTP NOT Matched",
              };
              return res.status(400).send(response);
            }
          } else {
            const response = { Status: "Failure", Details: "OTP Expired" };
            return res.status(400).send(response);
          }
        } else {
          const response = { Status: "Failure", Details: "OTP Already Used" };
          return res.status(400).send(response);
        }
      } else {
        const response = { Status: "Failure", Details: "Bad Request" };
        return res.status(400).send(response);
      }
    } catch (err) {
      console.log(err)
      const response = { Status: "Failure", Details: err.message };
      return res.status(400).send(response);
    }
  }
  // Send OTP function
  async smsOtp(req, res) {
    try {
      const { country_code, phoneNumber, type } = req.body;

      if (!country_code || !phoneNumber || !type) {
        return res.status(400).send({
          Status: "Failure",
          Details: "Country code, phone number, or type not provided",
        });
      }

      const fullPhoneNumber = `${country_code}${phoneNumber}`;
      const otp = otpGenerator.generate(6, {
        digits: true,
        lowerCaseAlphabets: false,
        upperCaseAlphabets: false,
        specialChars: false,
      });
      const expiration_time = AddMinutesToDate(new Date(), 10);

      let otpInstance = await OTP.findOne({
        where: { contact: fullPhoneNumber },
      });
      if (!otpInstance) {
        otpInstance = await OTP.create({
          contact: fullPhoneNumber,
          otp: [otp], // Store as stringified array
          expiration_time,
          contact_type: "phoneNumber",
          verified: false,
        });
      } else {
        if (!otpInstance.otp && otp) {
          await OTP.update({ otp: [otp] }, { where: { id: otpInstance.id } });
        } else {
          const otpArray = JSON.parse(otpInstance.otp);
          otpArray.push(otp); // Add new OTP
          otpInstance.otp = otpArray; // Convert array back to string
          otpInstance.expiration_time = expiration_time;
          await otpInstance.save();
        }
      }

      let sms_message;
      switch (type) {
        case "VERIFICATION":
          sms_message = `Your verification code is ${otp}.please dont share this code Nasko.China`;
          break;
        case "FORGET":
          sms_message = `Your password reset code is ${otp}. It will expire in 10 minutes.`;
          break;
        case "2FA":
          sms_message = `Your 2FA code is ${otp}. It will expire in 10 minutes.`;
          break;
        default:
          return res
            .status(400)
            .send({ Status: "Failure", Details: "Incorrect Type Provided" });
      }

      // Uncomment to send SMS via Twilio or another service
      await client.messages.create({
        body: sms_message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: fullPhoneNumber,
      });

      return res.send({
        Status: "Success",
        Details: "OTP sent successfully",
      });
    } catch (err) {
      console.error("Error in sendOtp function:", err);
      return res.status(400).send({ Status: "Failure", Details: err.message });
    }
  }

  // Verify SMS OTP
  async verifySmsOtp(req, res) {
    try {
      const { country_code, phoneNumber, otp } = req.body;

      if (!country_code || !phoneNumber || !otp) {
        return res.status(400).send({
          Status: "Failure",
          Details: "Country code, phone number, or OTP not provided",
        });
      }

      const fullPhoneNumber = `${country_code}${phoneNumber}`;

      const otpInstance = await OTP.findOne({
        where: { contact: fullPhoneNumber },
      });

      if (!otpInstance) {
        return res.status(400).send({
          Status: "Failure",
          Details: "OTP not found",
        });
      }

      if (!otpInstance.otp && otp) {
        return res.status(400).send({
          Status: "Failure",
          Details: "OTP is already in used",
        });
      }
      const otpArray = JSON.parse(otpInstance.otp); // Parse the OTP field

      if (otpArray.length === 0) {
        return res.status(400).send({
          Status: "Failure",
          Details: "No OTP available for verification",
        });
      }

      const latestOtp = otpArray[otpArray.length - 1]; // Get the latest OTP

      if (otp !== latestOtp) {
        return res.status(400).send({
          Status: "Failure",
          Details: "OTP did not match",
        });
      }

      if (new Date() > new Date(otpInstance.expiration_time)) {
        return res.status(400).send({
          Status: "Failure",
          Details: "OTP has expired",
        });
      }

      // Mark as verified and clear OTPs
      otpInstance.verified = true;
      otpInstance.otp = null; // Clear the OTP array
      await otpInstance.save(); // Persist changes

      return res.status(200).send({
        Status: "Success",
        Details: "OTP verified successfully",
      });
    } catch (err) {
      console.error("Error in verifySmsOtp function:", err);
      return res.status(400).send({ Status: "Failure", Details: err.message });
    }
  }

  async userDelete(req, res) {
    const { userId } = req.params;
    try {
      // Attempt to delete the user
      const user = await userService.deleteUser(userId);

      // If user is not found, respond with an error
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Respond with success message
      return res
        .status(200)
        .json({ message: "User deleted successfully", user });
    } catch (error) {
      // Handle unexpected errors
      return res
        .status(500)
        .json({ message: "An error occurred", error: error.message });
    }
  }


  async updateUserEmailOrPhoneNumber(req, res) {
    const { email, country_code, phoneNumber } = req.body;
    const user = req.user;
    const { dataValues } = req.user;
    // Validate payload
    if (email && (country_code || phoneNumber)) {
      return res
        .status(400)
        .json({ message: "Provide either email or phone number, not both." });
    }
    let updateData;
    let userData;
    let userCheck;
    try {
      if (country_code && phoneNumber) {
        if (dataValues.phoneNumber === phoneNumber) {
          return res
            .status(500)
            .json({ message: "You Enter previous Phone Number Exist" });
        }
        userCheck = await userService.getUserByPhoneNumber(
          country_code,
          phoneNumber
        );
        if (userCheck) {
          return res
            .status(401)
            .json({ message: " phone number Already Exist." });
        } else {
          userData = {
            country_code,
            phoneNumber,
          };
          updateData = await userService.updatePhoneNumber(user, userData);
        }
      } else if (email) {
        userCheck = await userService.getUserByEmail(email);
        if (userCheck) {
          return res
            .status(401)
            .json({ message: "Invalid Email Already Exist." });
        } else {
          userData = {
            email,
          };
          updateData = await userService.updateEmail(user, userData);
        }
      }

      if (!updateData) {
        return res.status(500).json({ message: "User Not Exist" });
      }
      return res
        .status(200)
        .json({ message: "User exists.", updateData: updateData });
    } catch (error) {
      // Log the error and send a generic error message
      console.error(error);
      return res
        .status(500)
        .json({ message: "An internal server error occurred." });
    }
  }

  async getUserByEmailOrPhoneNumber(req, res) {
    const { email, country_code, phoneNumber } = req.body;

    // Validate payload
    if (email && (country_code || phoneNumber)) {
      return res
        .status(400)
        .json({ message: "Provide either email or phone number, not both." });
    }
    let user;
    try {
      if (country_code && phoneNumber) {
        user = await userService.getUserByPhoneNumber(
          country_code,
          phoneNumber
        );
      } else if (email) {
        user = await userService.getUserByEmail(email);
      }

      if (!user) {
        return res.status(200).json({ message: "User Not Exist" });
      }

      return res.status(200).json({ message: "User exists.", user: user });
    } catch (error) {
      // Log the error and send a generic error message
      console.error(error);
      return res
        .status(500)
        .json({ message: "An internal server error occurred." });
    }
  }

  async changePassword(req, res) {
    try {
      const { email, password, newPassword } = req.body;

      // Check if the user exists
      const user = await userService.getUserByEmail(email);
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
      console.error("Please Enter correct credential :", error);
      res.status(500).json({ message: "Please Enter correct credential" });
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
      const {
        country_code,
        phoneNumber,
        username,
        firstName,
        country,
        lastName,
        gender,
        age,
        settings,
        profilePic,
        description,
      } = req.body;
      const user = req.user;
      if (country_code && phoneNumber) {
        const userByPhoneNumber = await userService.getUserByPhoneNumber(
          country_code,
          phoneNumber
        );
        if (userByPhoneNumber) {
          return res.status(409).json({
            message:
              "A user with this phone number already exists. Try with another Phone Number",
          });
        } else {
          const updatedUser = await userService.updateUserProfile(user, {
            country_code,
            phoneNumber,
            username,
            firstName,
            country,
            lastName,
            gender,
            age,
            profilePic,
            settings,
            description,
          });
          res.json({ user: updatedUser });
        }
      } else {
        const updatedUser = await userService.updateUserProfile(user, {
          username,
          firstName,
          country,
          lastName,
          gender,
          age,
          profilePic,
          settings,
          description,
        });
        res.json({ user: updatedUser });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
  async updateUserRole(req, res) {
    try {
      const { role, requesteeId } = req.body;
      const requesteeUser = await userService.getUserById(requesteeId);
      if (requesteeUser) {
        const updatedUser = await userService.updateUserProfile(requesteeUser, {
          role: role.toLowerCase(),
        });
        res.json({ user: updatedUser });
      } else {
        return res.status(404).json({ message: "User not found" });
      }
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
