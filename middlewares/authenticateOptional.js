const jwt = require('jsonwebtoken')
const UserService = require('../services/UserService')

// Like authenticate, but never rejects — attaches req.user when a valid
// Bearer token is present, otherwise just calls next() for anonymous access.
const authenticateOptional = async (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next()
  }
  const token = authHeader.substring(7)
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY)
    const { userId } = decoded
    const userService = new UserService()
    const user = await userService.getUserById(userId)
    if (user) {
      req.user = user
    }
  } catch (error) {
    // invalid/expired token — proceed as anonymous rather than blocking
  }
  next()
}

module.exports = authenticateOptional
