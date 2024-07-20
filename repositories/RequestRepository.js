const Request = require('../models/request')
const { Op } = require('sequelize')
class RequestRepository {
  // create a new verification request
  async createVerificationRequest(phoneNumber) {
    try {
      // Check if a request with the same phoneNumber was made within the last 2 minutes
      const existingRequest = await Request.findOne({
        where: {
          phoneNumber,
          createdAt: {
            [Op.gte]: new Date(new Date() - 2 * 60 * 1000), // 2 minutes ago
          },
        },
      });

      if (existingRequest) {
        throw new Error('Duplicate request within 2 minutes');
      }

      // Generate a 4-digit verification code
      const code = Math.floor(1000 + Math.random() * 9000);

      // Create a new verification request and save it in the database
      const request = await Request.create({
        phoneNumber,
        code,
      });

      return request;
    } catch (error) {
      throw new Error('Error creating verification request: ' + error.message);
    }
  }

  // verify a verification request
  async verifyVerificationRequest(requestId, code) {
    try {
      const request = await Request.findByPk(requestId);

      if (!request) {
        throw new Error('Verification request not found');
      }

      if (request.code !== code) {
        throw new Error('Verification code does not match');
      }

      return request;
    } catch (error) {
      throw new Error('Error verifying verification request: ' + error.message);
    }
  }

}

module.exports = RequestRepository
