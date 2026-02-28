const parseInteger = (value, fallback, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const normalizeCsv = (value) =>
  String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const env = {
  nodeEnv: String(process.env.NODE_ENV || 'development').trim().toLowerCase(),
  port: parseInteger(process.env.PORT, 4000, { min: 1, max: 65535 }),
  mongoUri: String(process.env.MONGO_URI || '').trim(),
  frontendUrls: normalizeCsv(process.env.FRONTEND_URL),
  jwt: {
    secret: String(process.env.JWT_SECRET || '').trim(),
    expiresIn: String(process.env.JWT_EXPIRES_IN || '30d').trim(),
    issuer: String(process.env.JWT_ISSUER || 'cicr-connect').trim(),
    audience: String(process.env.JWT_AUDIENCE || 'cicr-connect-client').trim(),
  },
  auth: {
    maxFailedAttempts: parseInteger(process.env.AUTH_MAX_FAILED_ATTEMPTS, 6, { min: 3, max: 25 }),
    lockMinutes: parseInteger(process.env.AUTH_LOCK_MINUTES, 20, { min: 5, max: 120 }),
  },
  app: {
    requestBodyLimitKb: parseInteger(process.env.REQUEST_BODY_LIMIT_KB, 200, { min: 64, max: 2048 }),
    healthDetailEnabled: String(process.env.HEALTH_DETAIL_ENABLED || '').trim().toLowerCase() === 'true',
  },
};

const validateEnv = ({ throwOnError = true } = {}) => {
  const errors = [];
  const warnings = [];

  if (!env.mongoUri) {
    errors.push('MONGO_URI is required.');
  }
  if (!env.jwt.secret) {
    errors.push('JWT_SECRET is required.');
  } else if (env.jwt.secret.length < 24) {
    warnings.push('JWT_SECRET should be at least 24 characters for production security.');
  }

  if (!process.env.DATA_ENCRYPTION_KEY && !process.env.JWT_SECRET) {
    errors.push('Set DATA_ENCRYPTION_KEY (preferred) or JWT_SECRET for encryption fallback.');
  }
  if (!process.env.DATA_ENCRYPTION_KEY) {
    warnings.push('DATA_ENCRYPTION_KEY is not set. Fallback encryption key derived from JWT_SECRET is less safe.');
  }

  if (!env.frontendUrls.length) {
    warnings.push('FRONTEND_URL is not set. CORS will rely on default origins and Vercel preview matching.');
  }

  if (throwOnError && errors.length) {
    const err = new Error(`Environment validation failed: ${errors.join(' ')}`);
    err.validationErrors = errors;
    err.validationWarnings = warnings;
    throw err;
  }

  return { ok: errors.length === 0, errors, warnings, env };
};

module.exports = {
  env,
  validateEnv,
};
