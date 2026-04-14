const crypto = require("crypto");

// Generate 8-digit random number securely
function generateRandomDigits(length = 8) {
  const bytes = crypto.randomBytes(length);
  let digits = "";

  for (let i = 0; i < length; i++) {
    digits += bytes[i] % 10; // convert to 0-9
  }

  return digits;
}

// Luhn Algorithm to calculate check digit
function calculateLuhnDigit(number) {
  let sum = 0;
  let shouldDouble = true;

  // start from right
  for (let i = number.length - 1; i >= 0; i--) {
    let digit = parseInt(number[i]);

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return (10 - (sum % 10)) % 10;
}

// Generate Wallet Account Number
function generateWalletAccountNumber(currencyCount) {
  const PP = "39"; // Fixed prefix
  const T = currencyCount; // Currency-specific part
  const R = generateRandomDigits(8); // 8 random digits

  // Combine into base with dashes
  const base = PP + "-" + T + "-" + R;

  // Calculate the Luhn check digit
  const D = calculateLuhnDigit(base.replace(/-/g, '')); // Remove dashes before calculation

  // Return the full account number with the check digit and dashes
  return base + "-" + D;
}

module.exports = {
  generateWalletAccountNumber
};