const test = require('node:test');
const assert = require('node:assert/strict');
const { buildRateLimiter } = require('../middleware/securityMiddleware');

const createMockRes = () => {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
};

test('rate limiter blocks after max requests', async () => {
  const limiter = buildRateLimiter({
    name: 'test',
    windowMs: 60 * 1000,
    max: 2,
    keyGenerator: () => 'same-user',
  });

  const runCall = () =>
    new Promise((resolve) => {
      const req = { ip: '127.0.0.1' };
      const res = createMockRes();
      limiter(req, res, () => resolve({ nextCalled: true, res }));
      if (res.statusCode !== 200) resolve({ nextCalled: false, res });
    });

  const first = await runCall();
  assert.equal(first.nextCalled, true);
  const second = await runCall();
  assert.equal(second.nextCalled, true);
  const third = await runCall();
  assert.equal(third.nextCalled, false);
  assert.equal(third.res.statusCode, 429);
  assert.equal(typeof third.res.headers['Retry-After'], 'string');
});
