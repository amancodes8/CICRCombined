const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const path = require('path');

const envPath = path.resolve(__dirname, '../config/env.js');
const tokenPath = path.resolve(__dirname, '../utils/generateToken.js');

const loadFreshTokenModule = () => {
  delete require.cache[envPath];
  delete require.cache[tokenPath];
  return require(tokenPath);
};

test('generateToken signs with issuer and audience', () => {
  process.env.JWT_SECRET = 'jwt-test-secret-value-123456789';
  process.env.JWT_ISSUER = 'cicr-tests';
  process.env.JWT_AUDIENCE = 'cicr-web';
  process.env.JWT_EXPIRES_IN = '1h';

  const generateToken = loadFreshTokenModule();
  const token = generateToken('507f1f77bcf86cd799439011');

  const decoded = jwt.verify(token, process.env.JWT_SECRET, {
    issuer: process.env.JWT_ISSUER,
    audience: process.env.JWT_AUDIENCE,
  });

  assert.equal(decoded.id, '507f1f77bcf86cd799439011');
});
