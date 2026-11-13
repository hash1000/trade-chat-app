const jwt = require("jsonwebtoken");

// The one place a Chat QRM sign-in token is made. Same payload as before
// ({ userId, tokenVersion }), so every token already issued keeps working.
// Step 1 (QRM ID) moves the remaining jwt.sign calls in UserController here.
function issueChatToken(user) {
  return jwt.sign(
    { userId: user.id, tokenVersion: user.tokenVersion },
    process.env.JWT_SECRET_KEY
  );
}

module.exports = { issueChatToken };
