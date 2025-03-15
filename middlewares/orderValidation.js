const { body, validationResult } = require('express-validator');
const Order = require('../models/order');

// Middleware to handle validation errors
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  next();
}

exports.createOrderValidator = [
  body('name').notEmpty().withMessage('Name is required.'),
  body('image').notEmpty().withMessage('Image is required.'),
  body('orderNo')
    .notEmpty().withMessage('Order number is required.')
    .custom(async (value) => {
      const existingOrder = await Order.findOne({ where: { orderNo: value } });
      console.log("existingOrder",existingOrder);
      if (existingOrder) {
        return Promise.reject('Order number must be unique.');
      }
    }),
  body('price').notEmpty().withMessage('Price is required.'),
  body('status').notEmpty().withMessage('Status is required.'),
  handleValidationErrors
];


exports.updateOrderAddressValidator = [  
  body('addressId').isInt({ min: 1 }).notEmpty().withMessage('addressId must be a positive integer'),
  body('companyName')
    .trim()
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Company name must be between 2 and 50 characters'),

  body('contactPerson')
    .trim()
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Contact person must be between 2 and 50 characters'),

  body('firstName')
    .trim()
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),

  body('middleName')
    .trim()
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Middle name must be between 2 and 50 characters'),

  body('country')
    .trim()
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Country name must be between 2 and 50 characters'),

  body('city')
    .trim()
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('City name must be between 2 and 50 characters'),

  body('postalCode')
    .trim()
    .optional()
    .isLength({ min: 2, max: 10 })
    .withMessage('Postal code must be between 2 and 10 characters'),

  body('street')
    .trim()
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Street name must be between 2 and 50 characters'),

  body('streetNumber')
    .trim()
    .optional()
    .isLength({ min: 1, max: 10 })
    .withMessage('Street number must be between 1 and 10 characters'),

  body('deliveryNote')
    .trim()
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Delivery note must be between 2 and 100 characters'),

  body('customsNumber')
    .trim()
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Customs number must be between 2 and 50 characters'),

  body('vatNumber')
    .trim()
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('VAT number must be between 2 and 50 characters'),
    handleValidationErrors
];


// exports.updateOrderValidator = [
//   body('name').notEmpty().withMessage('Name is required.'),
//   body('image').notEmpty().withMessage('Image is required.'),
//   body('price').notEmpty().withMessage('Price is required.').custom(status.includes(status)),
//   body('status').notEmpty().withMessage('Status is required.'),
//   handleValidationErrors
// ];
