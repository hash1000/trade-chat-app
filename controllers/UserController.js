const twilio = require("twilio");
// const { Vonage } = require("@vonage/server-sdk");
const jwt = require("jsonwebtoken");
const UserService = require("../services/UserService"); // Replace the path with the correct location of your UserService.js file
const CustomError = require("../errors/CustomError");
const UnauthorizedError = require("../errors/UnauthorizedError");
const EmailService = require("../services/EmailService");
const nodemailer = require("nodemailer");
const { decode, encode } = require("../middlewares/emailValidation.js");
const userService = new UserService();
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const { publicIdentity } = require("../utilities/userPrivacy");
const { verifyGoogleIdToken, InvalidGoogleTokenError } = require("../utilities/googleIdToken");
const { issueChatToken } = require("../utilities/chatToken");
const {
  OtpError,
  issueContactCode,
  checkContactCode,
  issueEmailCode,
  checkEmailCode,
  normalizeEmail,
} = require("../utilities/otpCodes");

const SMS_CODE_MINUTES = 5;
const EMAIL_CODE_MINUTES = 10;

// Checks the latest SMS code sent to this number and uses it up on success.
// Returns { ok: true } or { ok: false, reason }.
function matchSmsOtp(country_code, phoneNumber, otp) {
  return checkContactCode(`${country_code}${phoneNumber}`, otp);
}

// The "change email" code (verify-email-phone → make-primary) is kept per
// account + new address, in the same hashed store as SMS codes.
function emailChangeContact(userId, email) {
  return `email-change:${userId}:${normalizeEmail(email)}`;
}

class UserController {
  // Identity comes only from the Google-signed ID token, never from the
  // request body — otherwise anyone could post someone else's email and
  // receive their JWT.
  async googleSignIn(req, res) {
    try {
      let google;
      try {
        google = await verifyGoogleIdToken(req.body.idToken);
      } catch (err) {
        if (err instanceof InvalidGoogleTokenError) {
          return res.status(401).json({ message: "Invalid Google sign-in. Please try again." });
        }
        throw err;
      }
      const email = google.email.toLowerCase();
      const displayName = google.name || req.body.displayName || email.split("@")[0];
      const photoURL = google.picture || req.body.photoURL || null;

      const userData = {
        username: displayName,
        email,
        profilePic: photoURL,
        email_verified: true,
      };

      // Check if user exists
      let user = await userService.getUserByEmail(email);

      if (user) {
        // Always update profile with email_verified = true (and run is_completed check)
        user = await userService.updateUserProfile(user, {
          email_verified: true,
          profilePic: photoURL, // keep updated with Google photo
          username: displayName,
        });

        const token = jwt.sign(
          { userId: user.id, tokenVersion: user.tokenVersion },
          process.env.JWT_SECRET_KEY
        );

        return res.status(200).json({
          message: "User exists. Authentication successful.",
          token,
          user,
        });
      } else {
        // New Google user
        const newUser = await userService.createGoogleUser(userData);

        // Ensure profile completeness check runs at least once
        await userService.updateUserProfile(newUser, { email_verified: true });

        const token = jwt.sign(
          { userId: newUser.id, tokenVersion: newUser.tokenVersion },
          process.env.JWT_SECRET_KEY
        );

        return res.status(201).json({
          message: "A new user has been successfully created.",
          token,
          user: newUser,
        });
      }
    } catch (error) {
      console.error("Error during Google sign-in:", error);
      res.status(500).json({
        message: "An error occurred while processing Google sign-in.",
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
        fromLogin
      } = req.body;

      let userByPhoneNumber;
      if (country_code && phoneNumber) {
        userByPhoneNumber = await userService.getUserByPhoneNumber(
          country_code,
          phoneNumber
        );
      }

      const userByEmail = await userService.getUserByEmail(email);

      if (userByEmail) {
        // Signing up never signs into an existing account: that used to hand out
        // the account's token without any password. Existing users sign in, or
        // confirm an email code (verify-otp-email), which the app already does.
        return res.status(409).json({
          message: "User with this email already exists.",
        });
      } else if (userByEmail) {
        // Check if user exists but some required fields are missing
        if (
          userByEmail.firstName === null &&
          userByEmail.lastName === null &&
          userByEmail.country_code === null &&
          userByEmail.phoneNumber === null &&
          userByEmail.gender === null &&
          userByEmail.country === null &&
          userByEmail.age === null &&
          country_code &&
          phoneNumber &&
          email &&
          password &&
          firstName &&
          lastName &&
          gender &&
          country &&
          fromLogin &&
          age
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
            fromLogin,
            age,
          };

          if (username) googleUser.username = username;
          if (profilePic) googleUser.profilePic = profilePic;
          if (description) googleUser.description = description;
          if (settings) googleUser.settings = settings;
          if (fromLogin === 'EMAIL' ) userData.email_verified = true;

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
        // Create a new user if neither email nor phone number exists
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
          fromLogin,
          age,
        };

        if (profilePic) userData.profilePic = profilePic;
        if (description) userData.description = description;
        if (fromLogin === 'EMAIL' ) userData.email_verified = true;
        
        const newUser = await userService.createUser(userData);
        const token = jwt.sign(
          { userId: newUser.id, tokenVersion: newUser.tokenVersion },
          process.env.JWT_SECRET_KEY
        );

        return res.status(201).json({
          message: "Successfully created a new user with this email and phone number.",
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
          { userId: updateUser.id, tokenVersion: updateUser.tokenVersion },
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

        // console.log("user found by email:", user);
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
      } else if (country_code && phoneNumber && password) {
        // Login with phone number and password
        user = await userService.getUserByPhoneNumber(
          country_code,
          phoneNumber
        );
        const validatedUser = user
          ? await userService.verifyUserPassword(user, password)
          : null;
        if (!validatedUser) {
          return res
            .status(401)
            .json({ message: "Invalid phone number or password." });
        }
      } else if (country_code && phoneNumber) {
        // A phone number alone used to sign anyone in as that number's owner.
        // Phone sign-in without a password now goes through the SMS code
        // (send-otp-sms → verify-otp-sms with purpose "login"). Old app
        // builds still send only the number: tell them to update, no token.
        return res.status(426).json({
          code: "app_update_required",
          message: "Please update the app to sign in with your phone number.",
        });
      } else {
        return res.status(400).json({ message: "Invalid request parameters." });
      }

      if (user.disableAccount) {
        return res.status(403).json({ message: "Your account has been disabled." });
      }

      // Check if profile is incomplete
      // const requiredFields = [
      //   "firstName",
      //   "lastName",
      //   "username",
      //   // "country_code",
      //   // "phoneNumber",
      //   "gender",
      //   "country",
      //   "age",
      //   "profilePic",
      // ];

      // const missingFields = requiredFields.filter((field) => !user[field]);

      // if (missingFields.length > 0) {
      //   return res.json({
      //     message: "Your profile is not completed",
      //     missingFields,
      //   });
      // }

      const token = issueChatToken(user);

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
      if (!["VERIFICATION", "FORGET", "2FA"].includes(type)) {
        return res
          .status(400)
          .send({ Status: "Failure", Details: "Incorrect Type Provided" });
      }
      // New code: only its hash is stored; max 5 per hour per email.
      const now = new Date();
      let otp, otp_instance;
      try {
        const issued = await issueEmailCode(email, EMAIL_CODE_MINUTES);
        otp = issued.code;
        otp_instance = { id: issued.id };
      } catch (e) {
        if (e instanceof OtpError) {
          return res.status(e.status).send({ Status: "Failure", Details: e.message });
        }
        throw e;
      }

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
      console.log("Encoded details:", encoded);
      // Choose message template according to type requested
      let email_message, email_subject;
      if (type === "VERIFICATION") {
        const {
          message,
          subject_mail,
        } = require("../templates/email/email_verification");
        email_message = message(otp);
        email_subject = subject_mail;
        console.log("Using verification template");
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
        port: 465,
        secure: true,
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

      user = await userService.getUserByEmail(check);
      if (user && user.disableAccount) {
        return res.status(403).json({ message: "Your account has been disabled." });
      }

      // Hash compare, max 5 wrong tries, one-time. When no account exists yet
      // (sign-up), the app reads the message below as "code OK, continue to
      // sign-up", so the code is checked but not used up, as before.
      const result = await checkEmailCode(obj.otp_id, check, otp, { consume: !!user });
      if (!result.ok) {
        return res.status(400).send({ Status: "Failure", Details: result.reason });
      }
      if (!user) {
        return res
          .status(400)
          .json({ message: "User with this email dose not exist" });
      }

      token = issueChatToken(user);
      await userService.updateUserProfile(user, {
        email_verified: true,
      });
      return res.status(200).send({
        Status: "Success",
        Details: "OTP Matched",
        Check: check,
        token: token,
      });
    } catch (err) {
      console.log(err);
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
      const templates = {
        VERIFICATION: (code) => `Your verification code is ${code}. It expires in ${SMS_CODE_MINUTES} minutes. Please don't share this code. Nasko.China`,
        FORGET: (code) => `Your password reset code is ${code}. It expires in ${SMS_CODE_MINUTES} minutes.`,
        "2FA": (code) => `Your 2FA code is ${code}. It expires in ${SMS_CODE_MINUTES} minutes.`,
      };
      if (!templates[type]) {
        return res
          .status(400)
          .send({ Status: "Failure", Details: "Incorrect Type Provided" });
      }

      // New code: only its hash is stored, the previous code stops working,
      // max 5 codes per hour per number.
      let otp;
      try {
        otp = await issueContactCode(fullPhoneNumber, "phoneNumber", SMS_CODE_MINUTES);
      } catch (e) {
        if (e instanceof OtpError) {
          return res.status(e.status).send({ Status: "Failure", Details: e.message });
        }
        throw e;
      }
      const sms_message = templates[type](otp);

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

  // Verify SMS OTP.
  // With purpose "login" this is the phone sign-in: a correct code for an
  // existing account returns the normal token (same shape as /auth/login).
  // Without it (sign-up, phone change) it only checks the code, as before,
  // and never returns a token.
  async verifySmsOtp(req, res) {
    try {
      const { country_code, phoneNumber, otp, purpose } = req.body;

      if (!country_code || !phoneNumber || !otp) {
        return res.status(400).send({
          Status: "Failure",
          Details: "Country code, phone number, or OTP not provided",
        });
      }

      const phoneOwner = await userService.getUserByPhoneNumber(country_code, phoneNumber);

      if (purpose === "login") {
        // Checked before the code, so a code is not used up for nothing.
        if (!phoneOwner) {
          return res.status(404).send({
            Status: "Failure",
            Details: "No account uses this phone number.",
          });
        }
        if (phoneOwner.disableAccount) {
          return res.status(403).json({ message: "Your account has been disabled." });
        }
      }

      const check = await checkContactCode(`${country_code}${phoneNumber}`, otp);
      if (!check.ok) {
        return res.status(400).send({ Status: "Failure", Details: check.reason });
      }

      // A correct SMS code verifies that phone number for the account using it.
      if (phoneOwner) {
        phoneOwner.phoneNumber_verified = true;
        await phoneOwner.save();
      }

      if (purpose === "login") {
        return res.status(200).send({
          Status: "Success",
          Details: "OTP verified successfully",
          message: "Login successful.",
          token: issueChatToken(phoneOwner),
          user: phoneOwner,
        });
      }

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
      // Only the account owner (or a platform admin) may delete an account.
      const isAdmin = (req.user.roles || []).some((r) => r.name === "admin");
      if (String(req.user.id) !== String(userId) && !isAdmin) {
        return res.status(403).json({ message: "You can only delete your own account." });
      }
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
    // `otp` is optional (the website sends it): with it the new number is checked
    // and saved as verified in one step; without it this behaves as before.
    const { email, country_code, phoneNumber, otp } = req.body;
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
          let verified = false;
          if (otp) {
            const check = await matchSmsOtp(country_code, phoneNumber, otp);
            if (!check.ok) {
              return res.status(400).json({ message: check.reason });
            }
            verified = true;
          }
          userData = {
            country_code,
            phoneNumber,
          };
          updateData = await userService.updatePhoneNumber(user, userData);
          // A new number is only "verified" when its code was confirmed here.
          updateData.phoneNumber_verified = verified;
          await updateData.save();
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
          // Invalidate tokens issued under the old email on every other session
          await userService.updateTokenVersion(updateData);
        }
      }

      if (!updateData) {
        return res.status(500).json({ message: "User Not Exist" });
      }

      const response = { message: "User exists.", updateData: updateData };
      if (email) {
        // Re-issue a valid token for this session since its tokenVersion just changed
        response.token = jwt.sign(
          { userId: updateData.id, tokenVersion: updateData.tokenVersion },
          process.env.JWT_SECRET_KEY
        );
      }
      return res.status(200).json(response);
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

      // Public route: reveal only what the app needs (email, username, name, photo),
      // never phone, settings / payment code, push token or balances.
      return res.status(200).json({ message: "User exists.", user: publicIdentity(user) });
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

      // Verify the password. 400, not 401 "Invalid credentials": the app signs
      // the user out on that 401 message, and a wrong current password while
      // changing it must not end their session.
      const validatedUser = await userService.verifyUserPassword(
        user,
        password
      );
      if (!validatedUser) {
        return res.status(400).json({ message: "Current password is incorrect." });
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

  async adminUpdateUserEmail(req, res) {
    const { id } = req.params;
    const { email } = req.body;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({ message: "A valid email is required." });
    }

    try {
      const targetUser = await userService.getUserById(id);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found." });
      }

      const userCheck = await userService.getUserByEmail(email);
      if (userCheck) {
        return res
          .status(401)
          .json({ message: "Invalid Email Already Exist." });
      }

      const updateData = await userService.updateEmail(targetUser, { email });
      // Invalidate tokens issued under the old email on every session of this user
      await userService.updateTokenVersion(updateData);

      return res
        .status(200)
        .json({ message: "User email updated.", updateData });
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ message: "An internal server error occurred." });
    }
  }

  async adminResetUserPassword(req, res) {
    const { email, newPassword } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }
    if (!newPassword || newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "New password must be at least 6 characters." });
    }

    try {
      const targetUser = await userService.getUserByEmail(email);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found." });
      }

      const updatedUser = await userService.updateUserPassword(
        targetUser.id,
        newPassword
      );
      // Invalidate tokens issued under the old password on every session of this user
      await userService.updateTokenVersion(updatedUser);

      return res
        .status(200)
        .json({ message: "User password has been reset." });
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ message: "An internal server error occurred." });
    }
  }

  async setDisableAccount(req, res) {
    try {
      const { id } = req.params;
      const { disableAccount } = req.body;

      if (typeof disableAccount !== "boolean") {
        return res
          .status(400)
          .json({ message: "disableAccount must be true or false." });
      }

      const user = await userService.setDisableAccount(id, disableAccount);
      return res.status(200).json({
        message: disableAccount
          ? "Account has been disabled."
          : "Account has been enabled.",
        user,
      });
    } catch (error) {
      console.error("Error updating disableAccount:", error);
      if (error instanceof CustomError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to update account status." });
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
      if (req.userId ) {
        userId = req.userId;
        const userById = await userService.getUserById(userId);
        // if (userById.tokenVersion !== req.tokenVersion) {
        //   throw new UnauthorizedError("Unauthorized");
        // }
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
        rating,
        settings,
        profilePic,
        password,
        description,
        appVersion,
      } = req.body;
      // email_verified is deliberately not taken from the body: it is only set
      // by verify-otp-email / verify-email-phone, never by the client.
      
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
            password,
            settings,
            description,
            rating,
            appVersion,
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
          password,
          settings,
          description,
            rating,
          appVersion,
        });
        res.json({ user: updatedUser });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  // Registers the device's push address: `jpushRegistrationId` (JPush) and/or
  // `fcmToken` (FCM, until Firebase is removed). Only the fields sent are changed.
  async updateFCM(req, res) {
    try {
      const { fcmToken, jpushRegistrationId } = req.body;
      let updatedUser = req.user; // Assuming you have an authentication middleware to attach the user object to the request
      if (jpushRegistrationId !== undefined) {
        updatedUser = await userService.updateJPushRegistrationId(updatedUser, jpushRegistrationId);
      }
      if (fcmToken !== undefined) {
        updatedUser = await userService.updateToken(updatedUser, fcmToken);
      }
      res.json({ user: updatedUser });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  // Clears the device's FCM token and JPush id so a logged-out device stops receiving push
  // notifications. The JWT itself stays valid (tokenVersion check is disabled
  // in authenticate) — the app must also discard its stored token locally.
  async logout(req, res) {
    try {
      const user = req.user;
      // The website has no push token of its own; `fcm` belongs to the phone
      // app, so a web sign-out ({ device: "web" }) must leave it alone.
      if (req.body?.device !== "web") {
        await userService.updateToken(user, null);
        await userService.updateJPushRegistrationId(user, null);
      }
      res.json({ success: true, message: "Logged out successfully." });
    } catch (error) {
      console.error("logout error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  async verifyEmailOrPhone(req, res) {
    try {
      const { phone, email } = req.body;
      const user = req.user; // Assuming you have an authentication middleware to attach the user object to the request
      if (phone) {
        // This branch never answered (the old SMS provider was removed), so the
        // request just hung. Phone codes are sent by send-otp-sms.
        return res.status(400).json({
          message: "Phone codes are sent by /auth/send-otp-sms.",
        });
      } else if (email) {
        // check if any other user has the email
        const userByEmail = await userService.getUserByEmail(email);
        if (userByEmail) {
          return res
            .status(409)
            .json({ message: "Email already in use" });
        }
        // 6-digit code, stored only as a hash (no longer in users.otp)
        let code;
        try {
          code = await issueContactCode(emailChangeContact(user.id, email), "email", EMAIL_CODE_MINUTES);
        } catch (e) {
          if (e instanceof OtpError) return res.status(e.status).json({ message: e.message });
          throw e;
        }
        await EmailService.sendEmailCode(email, user.name, code);
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
        if (!otp) {
          return res.status(401).json({ message: "Invalid code" });
        }
        const check = await checkContactCode(emailChangeContact(user.id, email), otp);
        if (!check.ok) {
          return res.status(401).json({ message: check.reason });
        }
        // The code proved the new address belongs to this person.
        await userService.updateUserProfileById(user.id, { email, email_verified: true });
        const updatedUser = await userService.getUserById(user.id);

        res.json({ updatedUser });
      } else if (phone) {
        // This branch never answered (the old SMS provider was removed), so the
        // request just hung. Phone changes go through update-email-phoneNumber.
        return res.status(400).json({
          message: "Phone changes use /auth/update-email-phoneNumber with an SMS code.",
        });
      } else {
        return res.status(400).json({ message: "Provide email or phone." });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
}

module.exports = UserController;
