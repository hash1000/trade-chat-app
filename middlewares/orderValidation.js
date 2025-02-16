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
      if (existingOrder) {
        return Promise.reject('Order number must be unique.');
      }
    }),
  body('price').notEmpty().withMessage('Price is required.'),
  body('status').notEmpty().withMessage('Status is required.'),
  handleValidationErrors
];
