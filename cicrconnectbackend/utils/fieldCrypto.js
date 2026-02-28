const crypto = require('crypto');

const ENC_PREFIX = 'enc:v1:';
let warnedFallback = false;
let warnedLegacyKeys = false;

const deriveKeyFromRaw = (rawValue) => {
  const raw = String(rawValue || '').trim();
  if (!raw) return null;
  if (/^[a-f0-9]{64}$/i.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  try {
    const fromBase64 = Buffer.from(raw, 'base64');
    if (fromBase64.length === 32) return fromBase64;
  } catch {
    // ignore
  }
  return crypto.createHash('sha256').update(raw).digest();
};

const derivePrimaryKey = () => {
  const raw = String(process.env.DATA_ENCRYPTION_KEY || '').trim();
  if (raw) {
    return deriveKeyFromRaw(raw);
  }

  const fallback = String(process.env.JWT_SECRET || '').trim();
  if (!fallback) return null;
  if (!warnedFallback) {
    warnedFallback = true;
    // eslint-disable-next-line no-console
    console.warn(
      '[encryption] DATA_ENCRYPTION_KEY not set. Falling back to a key derived from JWT_SECRET.'
    );
  }
  return deriveKeyFromRaw(`fallback:${fallback}`);
};

const deriveLegacyKeys = () => {
  const rawSources = [
    String(process.env.DATA_ENCRYPTION_OLD_KEYS || ''),
    String(process.env.DATA_ENCRYPTION_PREVIOUS_KEYS || ''),
  ]
    .map((v) => v.trim())
    .filter(Boolean);

  if (!rawSources.length) return [];
  if (!warnedLegacyKeys) {
    warnedLegacyKeys = true;
    // eslint-disable-next-line no-console
    console.warn('[encryption] Legacy encryption keys loaded for read/hash compatibility.');
  }

  const seen = new Set();
  const keys = [];
  for (const source of rawSources) {
    const parts = source
      .split(/[\n,;]/)
      .map((v) => v.trim())
      .filter(Boolean);
    for (const part of parts) {
      const key = deriveKeyFromRaw(part);
      if (!key) continue;
      const keyId = key.toString('hex');
      if (seen.has(keyId)) continue;
      seen.add(keyId);
      keys.push(key);
    }
  }
  return keys;
};

let cachedKeys = null;
const getAllKeys = () => {
  if (!cachedKeys) {
    const primary = derivePrimaryKey();
    const legacy = deriveLegacyKeys();
    const keys = [];
    if (primary) keys.push(primary);
    const seen = new Set(keys.map((key) => key.toString('hex')));
    for (const legacyKey of legacy) {
      const keyId = legacyKey.toString('hex');
      if (seen.has(keyId)) continue;
      seen.add(keyId);
      keys.push(legacyKey);
    }
    cachedKeys = keys;
  }
  return cachedKeys;
};

const getKey = () => {
  const keys = getAllKeys();
  return keys.length ? keys[0] : null;
};

const isEncryptionEnabled = () => Boolean(getKey());

const isEncryptedValue = (value) =>
  typeof value === 'string' && value.startsWith(ENC_PREFIX);

const encryptString = (value) => {
  if (value === null || value === undefined) return value;
  const raw = String(value);
  if (!raw) return raw;
  if (isEncryptedValue(raw)) return raw;
  const key = getKey();
  if (!key) return raw;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(raw, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
};

const decryptString = (value) => {
  if (value === null || value === undefined) return value;
  const raw = String(value);
  if (!isEncryptedValue(raw)) return raw;
  const keys = getAllKeys();
  if (!keys.length) return raw;

  const payload = raw.slice(ENC_PREFIX.length);
  const [ivHex, tagHex, dataHex] = payload.split(':');
  if (!ivHex || !tagHex || !dataHex) return raw;

  for (const key of keys) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
      decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(dataHex, 'hex')),
        decipher.final(),
      ]);
      return decrypted.toString('utf8');
    } catch {
      // Try next available key.
    }
  }
  return raw;
};

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const normalizeCollegeId = (value) => String(value || '').trim().toUpperCase();
const normalizePhone = (value) => String(value || '').replace(/\s+/g, '').trim();

const computeBlindIndex = (value, normalize = (v) => String(v || '').trim()) => {
  const normalized = normalize(value);
  if (!normalized) return '';
  const key = getKey();
  if (!key) return '';
  return crypto.createHmac('sha256', key).update(normalized).digest('hex');
};

const computeBlindIndexVariants = (value, normalize = (v) => String(v || '').trim()) => {
  const normalized = normalize(value);
  if (!normalized) return [];
  const keys = getAllKeys();
  if (!keys.length) return [];

  const seen = new Set();
  const hashes = [];
  for (const key of keys) {
    const hash = crypto.createHmac('sha256', key).update(normalized).digest('hex');
    if (seen.has(hash)) continue;
    seen.add(hash);
    hashes.push(hash);
  }
  return hashes;
};

module.exports = {
  ENC_PREFIX,
  isEncryptionEnabled,
  isEncryptedValue,
  encryptString,
  decryptString,
  computeBlindIndex,
  computeBlindIndexVariants,
  normalizeEmail,
  normalizeCollegeId,
  normalizePhone,
};
