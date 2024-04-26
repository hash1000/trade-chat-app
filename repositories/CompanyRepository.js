const Company = require('../models/company')

class CompanyRepository {
  async getCompanyByUserId (userId) {
    return Company.findOne({ where: { userId } })
  }

  async updateCompanyProfile (userId, companyData) {
    // Check if the company exists
    const existingCompany = await Company.findOne({ where: { userId } })

    if (existingCompany) {
      // Update the existing company
      return await Company.update(companyData, {
        where: { userId },
        returning: true
      })
    } else {
      // Create a new company
      return await Company.create({
        userId,
        ...companyData
      })
    }
  }
}

module.exports = CompanyRepository
