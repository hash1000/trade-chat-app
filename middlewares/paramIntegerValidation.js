const checkIntegerParam = (paramName) => (req, res, next) => {
  const paramValue = req.params[paramName]; // Extract parameter dynamically

  // Ensure the parameter exists and is a string
  if (!paramValue || typeof paramValue !== "string") {
    return res.status(400).json({ 
      error: `Invalid parameter: ${paramName}`,
      received: paramValue
    });
  }

  // Regular expression to check for integers (positive and negative)
  const integerRegex = /^-?\d+$/;
  
  if (!integerRegex.test(paramValue)) { // Now it's a string ✅
    return res.status(400).json({ 
      error: `Parameter ${paramName} must be an integer`,
      received: paramValue
    });
  }

  // Convert to Number and attach to request for later use
  req.parsedParams = req.parsedParams || {}; // Ensure object exists
  req.parsedParams[paramName] = parseInt(paramValue, 10);

  next();
};

module.exports = checkIntegerParam;
