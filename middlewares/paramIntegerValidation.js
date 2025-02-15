const checkIntegerParam = (req, res, next) => {
  const { addressId } = req.params; // Extract parameter

  // Ensure the parameter exists and is a string
  if (!addressId || typeof addressId !== "string") {
    return res.status(400).json({ 
      error: "Invalid parameter",
      received: addressId
    });
  }

  // Regular expression to check for integers (positive and negative)
  const integerRegex = /^-?\d+$/;
  
  if (!integerRegex.test(addressId)) { // Now it's a string ✅
    return res.status(400).json({ 
      error: "Parameter must be an integer",
      received: addressId
    });
  }

  // Convert to Number and attach to request for later use
  req.parsedParam = parseInt(addressId, 10);
  next();
};

module.exports = checkIntegerParam;
