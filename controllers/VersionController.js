const VersionService = require('../services/VersionService');
const versionService = new VersionService();
const nodemailer = require('nodemailer');
const User = require('../models/user'); // Make sure you import your User model properly
const { subject_mail, message } = require('../templates/email/email_version_update'); // Adjust the path if needed

class VersionController {
  // GET all versions
  async getAll(req, res) {
    try {
      const versions = await versionService.getAll();
      return res.json({ success: true, data: versions });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // Add new version
  async add(req, res) {
    try {
      const { version } = req.body;
      const newVersion = await versionService.create(version);
      return res.status(201).json({ success: true, data: newVersion });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // Update version
  async update(req, res) {
    try {
      const { versionId } = req.params;
      const { version } = req.body; // Extract version from request body

      // Update version using version service
      const updated = await versionService.update(versionId, version);

      // If no version was updated
      if (updated.success === false) {
        return res.status(404).json({ success: false, message: 'Version not found' });
      }

      // Respond immediately to the user after the version update
      res.json({ success: true, message: 'Version updated successfully' });

      // Proceed to send emails asynchronously in the background
      const email_message = message(version); // Pass the dynamic version to the message function
      await this.sendVersionUpdateEmails(email_message); // Send email with the dynamic message

    } catch (error) {
      console.error('Error in update process:', error);
      return res.status(500).json({
        success: false,
        message: "Error updating version or sending emails: " + error.message,
      });
    }
  }

  // Send version update emails to all users
  async sendVersionUpdateEmails(email_message) {
    try {
      // Retrieve all user emails efficiently using 'attributes'
      const users = await User.findAll({
        attributes: ["email"], // Only fetch the email field
      });

      // Create nodemailer transporter
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_ADDRESS,
          pass: process.env.EMAIL_PASSWORD,
        },
      });

      // Prepare email content
      const email_subject = subject_mail;

      // Loop through all users and send email
      const failedEmails = [];
      for (const user of users) {
        const mailOptions = {
          from: `"Nasko China" <${process.env.EMAIL_ADDRESS}>`,
          to: user.email , // Send to actual user email
          subject: email_subject,
          html: email_message, // Use the dynamic email content
        };
        try {
          await transporter.sendMail(mailOptions);
          console.log(`Email sent to: ${user.email}`);
        } catch (err) {
          console.error(`Error sending email to ${user.email}:`, err);
          failedEmails.push(user.email);
        }
      }

      // Handle failed email attempts
      if (failedEmails.length > 0) {
        console.error(`Failed to send emails to: ${failedEmails.join(", ")}`);
      } else {
        console.log("All emails sent successfully");
      }
    } catch (err) {
      console.error('Error in email sending:', err);
    }
  }

  // Remove version
  async remove(req, res) {
    try {
      const { versionId } = req.params;

      const deleted = await versionService.remove(versionId);

      if (!deleted) {
        return res.status(404).json({ success: false, message: 'Version not found' });
      }

      return res.json({ success: true, message: 'Version deleted successfully' });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = VersionController;
