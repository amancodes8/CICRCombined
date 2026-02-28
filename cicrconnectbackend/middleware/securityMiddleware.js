const WINDOW_CACHE_LIMIT = 5000;

const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  // API must be consumable by frontend hosted on different origin.
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none';");

  const isHttps = req.secure || String(req.headers['x-forwarded-proto'] || '').includes('https');
  if (isHttps || process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
};

const buildRateLimiter = ({ windowMs, max, keyGenerator, name }) => {
  const buckets = new Map();
  const getKey = typeof keyGenerator === 'function' ? keyGenerator : (req) => req.ip || 'unknown';

  return (req, res, next) => {
    const now = Date.now();
    const key = `${name}:${getKey(req)}`;
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    existing.count += 1;
    buckets.set(key, existing);

    if (existing.count > max) {
      const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        message: 'Too many requests. Please slow down and try again shortly.',
      });
    }

    if (buckets.size > WINDOW_CACHE_LIMIT) {
      for (const [entryKey, entry] of buckets.entries()) {
        if (!entry || entry.resetAt <= now) buckets.delete(entryKey);
      }
    }

    return next();
  };
};

const authLimiter = buildRateLimiter({
  name: 'auth',
  windowMs: 15 * 60 * 1000,
  max: 30,
});

const passwordLimiter = buildRateLimiter({
  name: 'password',
  windowMs: 10 * 60 * 1000,
  max: 12,
});

const applicationLimiter = buildRateLimiter({
  name: 'application',
  windowMs: 60 * 60 * 1000,
  max: 16,
});

const communicationLimiter = buildRateLimiter({
  name: 'communication',
  windowMs: 60 * 1000,
  max: 80,
  keyGenerator: (req) => req.user?._id || req.ip || 'unknown',
});

module.exports = {
  securityHeaders,
  buildRateLimiter,
  authLimiter,
  passwordLimiter,
  applicationLimiter,
  communicationLimiter,
};
