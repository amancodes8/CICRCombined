const {
  encryptString,
  decryptString,
  computeBlindIndex,
  computeBlindIndexVariants,
  isEncryptedValue,
} = require('./fieldCrypto');

const getRawValue = (doc, path) => doc.get(path, null, { getters: false, virtuals: false });

const setValue = (doc, path, value) => {
  doc.set(path, value, { strict: false });
};

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);

const encryptDeep = (value) => {
  if (Array.isArray(value)) return value.map((item) => encryptDeep(item));
  if (value === null || value === undefined || value === '') return value;
  if (typeof value !== 'string') return value;
  if (isEncryptedValue(value)) return value;
  return encryptString(value);
};

const decryptDeep = (value) => {
  if (Array.isArray(value)) return value.map((item) => decryptDeep(item));
  if (value === null || value === undefined || value === '') return value;
  if (typeof value !== 'string') return value;
  return decryptString(value);
};

const resolveHashSourceValue = (value) => {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string' && isEncryptedValue(value)) {
    return decryptString(value);
  }
  return value;
};

const encryptPathOnDoc = (doc, path, force = false) => {
  const raw = getRawValue(doc, path);
  if (raw === null || raw === undefined || raw === '') return;
  const hasStringContent = Array.isArray(raw)
    ? raw.some((item) => typeof item === 'string' && item !== '')
    : typeof raw === 'string';
  if (!hasStringContent) return;
  if (!force && !doc.isNew && !doc.isModified(path)) return;
  setValue(doc, path, encryptDeep(raw));
};

const updateHashOnDoc = (doc, hashConfig, force = false) => {
  const sourceRaw = doc.get(hashConfig.source, null, { getters: true, virtuals: false });
  if (!force && !doc.isNew && !doc.isModified(hashConfig.source)) return;
  const blindIndex = computeBlindIndex(resolveHashSourceValue(sourceRaw), hashConfig.normalize);
  setValue(doc, hashConfig.target, blindIndex || undefined);
};

const getUpdateValue = (update, path) => {
  if (hasOwn(update, path)) return update[path];
  if (hasOwn(update.$set || {}, path)) return update.$set[path];
  return undefined;
};

const setUpdateValue = (update, path, value) => {
  if (hasOwn(update, path)) {
    update[path] = value;
    return;
  }
  update.$set = update.$set || {};
  update.$set[path] = value;
};

const transformUpdatePayload = (update, encryptedPaths, hashConfigs) => {
  if (!update || Array.isArray(update)) return update;
  const next = { ...update };

  for (const hashConfig of hashConfigs) {
    const sourceValue = getUpdateValue(next, hashConfig.source);
    if (sourceValue === undefined) continue;
    const blindIndex = computeBlindIndex(resolveHashSourceValue(sourceValue), hashConfig.normalize);
    setUpdateValue(next, hashConfig.target, blindIndex || undefined);
  }

  for (const path of encryptedPaths) {
    const current = getUpdateValue(next, path);
    if (current === undefined || current === null || current === '') continue;
    setUpdateValue(next, path, encryptDeep(current));
  }

  return next;
};

const applyModelEncryption = (schema, config = {}) => {
  const encryptedPaths = Array.isArray(config.encryptedPaths) ? config.encryptedPaths : [];
  const hashConfigs = Array.isArray(config.hashes) ? config.hashes : [];

  for (const path of encryptedPaths) {
    const schemaPath = schema.path(path);
    if (!schemaPath) continue;
    schemaPath.get((value) => decryptDeep(value));
  }

  schema.set('toJSON', { getters: true, virtuals: false });
  schema.set('toObject', { getters: true, virtuals: false });

  schema.pre('save', function onSave(next) {
    for (const hashConfig of hashConfigs) {
      updateHashOnDoc(this, hashConfig);
    }
    for (const path of encryptedPaths) {
      encryptPathOnDoc(this, path);
    }
    next();
  });

  const updateMiddleware = function updateHook(next) {
    const update = this.getUpdate();
    const nextUpdate = transformUpdatePayload(update, encryptedPaths, hashConfigs);
    if (nextUpdate) {
      this.setUpdate(nextUpdate);
    }
    next();
  };

  schema.pre('findOneAndUpdate', updateMiddleware);
  schema.pre('updateOne', updateMiddleware);
  schema.pre('updateMany', updateMiddleware);

  schema.methods.encryptLegacyConfiguredFields = function encryptLegacyConfiguredFields() {
    for (const hashConfig of hashConfigs) {
      const before = getRawValue(this, hashConfig.target);
      updateHashOnDoc(this, hashConfig, true);
      const after = getRawValue(this, hashConfig.target);
      if (before !== after) {
        this.markModified(hashConfig.target);
      }
    }
    for (const path of encryptedPaths) {
      const before = getRawValue(this, path);
      encryptPathOnDoc(this, path, true);
      const after = getRawValue(this, path);
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        this.markModified(path);
      }
    }
  };

  schema.statics.encryptForStorage = (value) => encryptString(value);
  schema.statics.decryptFromStorage = (value) => decryptString(value);
  schema.statics.computeBlindIndex = (value, normalize) => computeBlindIndex(value, normalize);
  schema.statics.computeBlindIndexVariants = (value, normalize) =>
    computeBlindIndexVariants(value, normalize);
};

module.exports = { applyModelEncryption };
