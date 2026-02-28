const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { env } = require('../config/env');
const logger = require('../utils/logger');

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

      const decoded = jwt.verify(token, env.jwt.secret, {
        issuer: env.jwt.issuer,
        audience: env.jwt.audience,
      });
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        return res.status(401).json({ message: 'User not found' });
      }

      const approval = String(req.user.approvalStatus || '').trim().toLowerCase();
      const isApproved = req.user.isVerified || approval === 'approved';

      if (approval === 'rejected') {
        return res.status(403).json({ message: 'Your registration has been rejected. Contact admin.' });
      }

      // SECONDARY SECURITY: Block routes if account is not admin-approved
      if (!isApproved) {
        return res.status(403).json({ message: 'Your account is pending admin approval' });
      }

      next();
    } catch (error) {
      logger.warn('jwt_verify_failed', {
        requestId: req.requestId,
        error: error.message,
        path: req.originalUrl,
      });
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
