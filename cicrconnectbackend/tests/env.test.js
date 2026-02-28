const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const modulePath = path.resolve(__dirname, '../config/env.js');
const ORIGINAL_ENV = { ...process.env };

const loadFreshEnv = () => {
  delete require.cache[modulePath];
  return require(modulePath);
};

test.after(() => {
  process.env = { ...ORIGINAL_ENV };
});

test('env validation fails without required secrets', () => {
  process.env = {
    ...ORIGINAL_ENV,
  };
  delete process.env.MONGO_URI;
  delete process.env.JWT_SECRET;
  delete process.env.DATA_ENCRYPTION_KEY;

  const { validateEnv } = loadFreshEnv();
  const result = validateEnv({ throwOnError: false });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((entry) => entry.includes('MONGO_URI')));
  assert.ok(result.errors.some((entry) => entry.includes('JWT_SECRET')));
});

test('env validation passes with secure minimum values', () => {
  process.env = {
    ...ORIGINAL_ENV,
    MONGO_URI: 'mongodb://localhost:27017/cicr_test',
    JWT_SECRET: 'super-secret-value-with-length-123456',
    DATA_ENCRYPTION_KEY: 'encryption-key-1234567890',
    FRONTEND_URL: 'http://localhost:5173',
  };
  const { validateEnv, env } = loadFreshEnv();
  const result = validateEnv({ throwOnError: false });

  assert.equal(result.ok, true);
  assert.equal(env.jwt.issuer, process.env.JWT_ISSUER || 'cicr-connect');
});
