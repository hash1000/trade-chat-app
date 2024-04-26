const CompanyRepository = require('../repositories/CompanyRepository')

class CompanyService {
  constructor () {
    this.companyRepository = new CompanyRepository()
  }

  async getCompanyByUserId (userId) {
    return this.companyRepository.getCompanyByUserId(userId)
  }

  async updateCompanyProfile (userId, companyData) {
    return this.companyRepository.updateCompanyProfile(userId, companyData)
  }
}

module.exports = CompanyService
