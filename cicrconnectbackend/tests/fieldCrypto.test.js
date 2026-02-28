const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const modulePath = path.resolve(__dirname, '../utils/fieldCrypto.js');

const loadFresh = () => {
  delete require.cache[modulePath];
  return require(modulePath);
};

test('fieldCrypto encrypt/decrypt roundtrip', () => {
  process.env.DATA_ENCRYPTION_KEY = 'test-key-for-roundtrip-123456';
  const cryptoLib = loadFresh();
  const encrypted = cryptoLib.encryptString('sensitive@email.com');
  assert.ok(encrypted.startsWith(cryptoLib.ENC_PREFIX));
  const decrypted = cryptoLib.decryptString(encrypted);
  assert.equal(decrypted, 'sensitive@email.com');
});

test('fieldCrypto blind index variants include active key hash', () => {
  process.env.DATA_ENCRYPTION_KEY = 'active-key-123';
  process.env.DATA_ENCRYPTION_OLD_KEYS = 'legacy-key-1,legacy-key-2';
  const cryptoLib = loadFresh();

  const primaryHash = cryptoLib.computeBlindIndex('A@B.COM', cryptoLib.normalizeEmail);
  const variants = cryptoLib.computeBlindIndexVariants('A@B.COM', cryptoLib.normalizeEmail);

  assert.ok(Array.isArray(variants));
  assert.ok(variants.length >= 1);
  assert.ok(variants.includes(primaryHash));
});
