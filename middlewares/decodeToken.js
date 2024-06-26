const jwt = require('jsonwebtoken')

// Authentication middleware
const decodeToken = async (req, res, next) => {
  // Get the JWT token from the request headers or cookies
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or invalid token' })
  }
  const token = authHeader.substring(7)

  // Verify the token
  try {
    const decoded = await jwt.verify(token, process.env.JWT_SECRET_KEY)
    const { userId, tokenVersion } = decoded
    // Token is valid, attach the decoded user information to the request object
    req.userId = userId
    req.tokenVersion = tokenVersion
  } catch (error) {
    console.error('Error during token verification:', error)
    req.userId = null
  }

  next()
}

module.exports = decodeToken
