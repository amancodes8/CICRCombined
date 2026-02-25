const AuditLog = require('../models/AuditLog');

const clip = (value, max = 2000) => {
  const str = JSON.stringify(value);
  if (!str || str.length <= max) return value;
  return { clipped: true, preview: str.slice(0, max) };
};

const logAudit = async ({
  actor,
  action,
  entityType,
  entityId,
  before = null,
  after = null,
  meta = null,
  req = null,
}) => {
  try {
    if (!actor || !action || !entityType) return;
    await AuditLog.create({
      actor,
      action,
      entityType,
      entityId: entityId ? String(entityId) : '',
      before: clip(before),
      after: clip(after),
      meta: clip(meta),
      ip: String(req?.ip || ''),
      userAgent: String(req?.get?.('user-agent') || ''),
    });
  } catch (err) {
    // Audit logging must never break primary flows.
    console.error('audit log failed:', err.message);
  }
};

module.exports = { logAudit };
