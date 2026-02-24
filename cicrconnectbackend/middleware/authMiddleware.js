const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * @desc Protect routes - ensures user is logged in with valid JWT
 */
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];

      if (!token || token === 'undefined' || token === 'null') {
        return res.status(401).json({ message: 'Not authorized, invalid token' });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        return res.status(401).json({ message: 'User not found' });
      }

      // SECONDARY SECURITY: Block routes if account is not admin-approved
      if (!req.user.isVerified) {
        return res.status(403).json({ message: 'Your account is pending admin approval' });
      }

      next();
    } catch (error) {
      console.error("JWT Error:", error.message);
      res.status(401).json({ message: 'Session expired or invalid' });
    }
  } else {
    res.status(401).json({ message: 'No token provided' });
  }
};

/**
 * @desc Authorize roles - restricts access based on User Role
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `User role (${req.user?.role}) is not authorized to access this route` 
      });
    }
    next();
  };
};

module.exports = { protect, authorize };
