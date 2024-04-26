const RequestRepository = require('../repositories/RequestRepository')

class RequestService {
  constructor () {
    this.requestRepository = new RequestRepository()
  }

  async createNewVerification (phoneNumber) {
    return await this.requestRepository.createVerificationRequest(phoneNumber)
  };

  async verify (requestId, code) {
    return await this.requestRepository.verifyVerificationRequest(requestId, code)
  };
};

module.exports = RequestService
