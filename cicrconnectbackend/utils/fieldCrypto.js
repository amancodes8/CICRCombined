const crypto = require('crypto');

const ENC_PREFIX = 'enc:v1:';
let warnedFallback = false;

const deriveKey = () => {
  const raw = String(process.env.DATA_ENCRYPTION_KEY || '').trim();
  if (raw) {
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
  return crypto.createHash('sha256').update(`fallback:${fallback}`).digest();
};

let cachedKey = null;
const getKey = () => {
  if (!cachedKey) {
    cachedKey = deriveKey();
  }
  return cachedKey;
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
  const key = getKey();
  if (!key) return raw;

  try {
    const payload = raw.slice(ENC_PREFIX.length);
    const [ivHex, tagHex, dataHex] = payload.split(':');
    if (!ivHex || !tagHex || !dataHex) return raw;

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return raw;
  }
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

module.exports = {
  ENC_PREFIX,
  isEncryptionEnabled,
  isEncryptedValue,
  encryptString,
  decryptString,
  computeBlindIndex,
  normalizeEmail,
  normalizeCollegeId,
  normalizePhone,
};

