const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { env } = require('../config/env');
const logger = require('../utils/logger');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const TEMP_ACCESS_MUTATION_ALLOWLIST = [
  '/api/auth/logout',
];

const normalizeAllowedSections = (sections) => {
  if (!Array.isArray(sections)) return [];
  return sections
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 20);
};

const getTemporaryAccessState = (user) => {
  const pass = user?.temporaryAccess || {};
  const expiresAtRaw = pass.expiresAt ? new Date(pass.expiresAt) : null;
  const expiresAt = expiresAtRaw && !Number.isNaN(expiresAtRaw.getTime()) ? expiresAtRaw : null;
  const isActive = Boolean(pass.enabled) && Boolean(expiresAt) && expiresAt.getTime() > Date.now();
  const remainingMinutes = isActive
    ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 60000))
    : 0;

  return {
    isActive,
    mode: String(pass.mode || 'read-only').toLowerCase() === 'read-only' ? 'read-only' : 'read-only',
    expiresAt,
    grantedAt: pass.grantedAt || null,
    remainingMinutes,
    restrictions: {
      readOnly: pass?.restrictions?.readOnly !== false,
      allowedSections: normalizeAllowedSections(pass?.restrictions?.allowedSections),
    },
  };
};

const isMutationBlockedForTemporaryAccess = (req) => {
  const method = String(req.method || '').toUpperCase();
  if (SAFE_METHODS.has(method)) return false;

  const path = String(req.originalUrl || req.path || '').toLowerCase();
  return !TEMP_ACCESS_MUTATION_ALLOWLIST.some((allowedPath) => path.startsWith(allowedPath));
};

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
      const temporaryAccessState = getTemporaryAccessState(req.user);
      const isTemporarySession = !isApproved && temporaryAccessState.isActive;

      req.user.temporaryAccessContext = {
        ...temporaryAccessState,
        isTemporarySession,
      };

      if (approval === 'rejected') {
        return res.status(403).json({ message: 'Your registration has been rejected. Contact admin.' });
      }

      // SECONDARY SECURITY: Block routes if account is not admin-approved
      if (!isApproved && !isTemporarySession) {
        return res.status(403).json({
          code: 'ACCOUNT_PENDING_APPROVAL',
          message: 'Your account is pending admin approval',
        });
      }

      if (isTemporarySession && isMutationBlockedForTemporaryAccess(req)) {
        return res.status(403).json({
          code: 'TEMPORARY_ACCESS_RESTRICTED',
          message: 'Temporary access is active in read-only mode. Ask admin for full approval.',
          temporaryAccess: {
            mode: temporaryAccessState.mode,
            expiresAt: temporaryAccessState.expiresAt,
            remainingMinutes: temporaryAccessState.remainingMinutes,
          },
        });
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
