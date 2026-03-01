const test = require('node:test');
const assert = require('node:assert/strict');

// Re-declare the helpers from server.js to unit-test CORS origin logic in isolation.
const isVercelOrigin = (origin) => {
  try {
    const parsed = new URL(origin);
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
};

const isLocalhostOrigin = (origin) => {
  try {
    const parsed = new URL(origin);
    return ['localhost', '127.0.0.1'].includes(parsed.hostname);
  } catch {
    return false;
  }
};

test('isLocalhostOrigin allows localhost origins', () => {
  assert.equal(isLocalhostOrigin('http://localhost:8081'), true);
  assert.equal(isLocalhostOrigin('http://localhost:3000'), true);
  assert.equal(isLocalhostOrigin('http://localhost:5173'), true);
  assert.equal(isLocalhostOrigin('http://127.0.0.1:8081'), true);
  assert.equal(isLocalhostOrigin('https://localhost:443'), true);
});

test('isLocalhostOrigin rejects non-localhost origins', () => {
  assert.equal(isLocalhostOrigin('https://example.com'), false);
  assert.equal(isLocalhostOrigin('https://evil-localhost.com'), false);
  assert.equal(isLocalhostOrigin('https://cicrconnect.vercel.app'), false);
  assert.equal(isLocalhostOrigin('not-a-url'), false);
});

test('isVercelOrigin still works correctly', () => {
  assert.equal(isVercelOrigin('https://cicrconnect.vercel.app'), true);
  assert.equal(isVercelOrigin('https://preview-123.vercel.app'), true);
  assert.equal(isVercelOrigin('http://fake.vercel.app'), false);
  assert.equal(isVercelOrigin('https://example.com'), false);
});
