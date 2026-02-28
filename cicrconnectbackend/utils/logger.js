const isProd = String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';

const sanitizeMeta = (meta = {}) => {
  const safe = { ...meta };
  if (safe.authorization) safe.authorization = '[redacted]';
  if (safe.password) safe.password = '[redacted]';
  if (safe.token) safe.token = '[redacted]';
  if (safe.jwt) safe.jwt = '[redacted]';
  return safe;
};

const write = (level, message, meta = {}) => {
  const payload = {
    ts: new Date().toISOString(),
    level,
    message: String(message || ''),
    ...sanitizeMeta(meta),
  };
  // Keep output parseable for log aggregation tools.
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(payload));
};

const logger = {
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta),
  debug: (message, meta) => {
    if (!isProd) write('debug', message, meta);
  },
};

module.exports = logger;
