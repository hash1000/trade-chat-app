const express = require('express')
const router = express.Router()

const CompanyController = require('../controllers/CompanyController')
const authMiddleware = require('../middlewares/authenticate')
const { updateCompanyProfileValidationRules } = require('../middlewares/companyValidation')
const companyController = new CompanyController()

// Define the route handlers
router.get('/', authMiddleware, companyController.getCompanyProfile.bind(companyController))
router.post('/', authMiddleware, updateCompanyProfileValidationRules, companyController.updateCompanyProfile.bind(companyController))

module.exports = router
