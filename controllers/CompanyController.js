const CompanyService = require('../services/CompanyService')
const companyService = new CompanyService()
class CompanyController {
  async getCompanyProfile (req, res) {
    const { id } = req.user
    try {
      const company = await companyService.getCompanyByUserId(id)
      res.json(company ?? {})
    } catch (error) {
      res.status(500).json({ message: 'Failed to retrieve company profile' })
    }
  }

  async updateCompanyProfile (req, res) {
    const { id } = req.user
    const companyData = req.body
    try {
      await companyService.updateCompanyProfile(id, companyData)
      res.json({ message: 'Company profile updated successfully' })
    } catch (error) {
      res.status(500).json({ message: 'Failed to update company profile' })
    }
  }
}

module.exports = CompanyController
