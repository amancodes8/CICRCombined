const crypto = require('crypto');
const logger = require('../utils/logger');

const requestId = (req, res, next) => {
  const incoming = String(req.headers['x-request-id'] || '').trim();
  const id = incoming || crypto.randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
};

const requestLogger = (req, res, next) => {
  const startNs = process.hrtime.bigint();
  res.on('finish', () => {
    const endNs = process.hrtime.bigint();
    const durationMs = Number(endNs - startNs) / 1e6;
    logger.info('http_request', {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      userId: req.user?._id ? String(req.user._id) : null,
      ip: req.ip,
    });
  });
  next();
};

module.exports = {
  requestId,
  requestLogger,
};
