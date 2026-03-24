const User = require('../models/User');
const InviteCode = require('../models/InviteCode');
const AdminAction = require('../models/AdminAction');
const AuditLog = require('../models/AuditLog');
const sendEmail = require('../utils/sendEmail');
const { createNotifications } = require('../utils/notificationService');
const { logAudit } = require('../utils/auditLogger');
const crypto = require('crypto');

const REQUIRED_ADMIN_APPROVALS = 3;
const INVITE_CODE_TTL_MS = 24 * 60 * 60 * 1000;
const INVITE_CODE_MAX_USES_LIMIT = 100;
const TEMP_ACCESS_MIN_HOURS = 1;
const TEMP_ACCESS_MAX_HOURS = 168;
const TEMP_ACCESS_ALLOWED_SECTIONS = [
  'dashboard',
  'projects',
  'meetings',
  'events',
  'learning',
  'programs',
  'community',
  'inventory',
  'profile',
  'guidelines',
];

const resolveFrontendUrl = () => {
  const raw = String(process.env.FRONTEND_URL || '').trim();
  if (!raw) return 'https://cicrconnect.vercel.app';
  return raw.split(',').map((v) => v.trim()).filter(Boolean)[0] || 'https://cicrconnect.vercel.app';
};

const normalizeInviteCode = (value) => String(value || '').trim().toUpperCase();

const normalizeInviteMaxUses = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return null;
  if (parsed < 1 || parsed > INVITE_CODE_MAX_USES_LIMIT) return null;
  return parsed;
};

const readInviteUsage = (record = {}) => {
  const maxUsesRaw = Number(record.maxUses);
  const maxUses = Number.isInteger(maxUsesRaw) && maxUsesRaw > 0
    ? Math.min(maxUsesRaw, INVITE_CODE_MAX_USES_LIMIT)
    : 1;

  const currentUsesRaw = Number(record.currentUses);
  const fallbackCurrentUses = record.isUsed ? maxUses : 0;
  const currentUses = Number.isInteger(currentUsesRaw) && currentUsesRaw >= 0
    ? Math.min(currentUsesRaw, maxUses)
    : fallbackCurrentUses;

  return {
    maxUses,
    currentUses,
    remainingUses: Math.max(maxUses - currentUses, 0),
  };
};

const isInviteExpired = (record) => {
  const expiresAt = record?.expiresAt ? new Date(record.expiresAt) : null;
  if (!expiresAt || Number.isNaN(expiresAt.getTime())) return false;
  return expiresAt.getTime() <= Date.now();
};

const ensureAdminApprover = (req, res) => {
  if (req.user?.role !== 'Admin') {
    res.status(403).json({ success: false, message: 'Only Admin accounts can approve admin demotion/deletion actions' });
    return false;
  }
  return true;
};

const addApprovalIfMissing = (action, approverId) => {
  const alreadyApproved = action.approvals.some((id) => String(id) === String(approverId));
  if (!alreadyApproved) {
    action.approvals.push(approverId);
  }
  return !alreadyApproved;
};

const canExecuteAdminAction = (action) => action.approvals.length >= REQUIRED_ADMIN_APPROVALS;

const isSelfTarget = (req, targetUser) => {
  const actorIds = new Set(
    [req.user?._id, req.user?.id]
      .filter(Boolean)
      .map((value) => String(value))
  );
  const targetId = String(targetUser?._id || '');
  if (targetId && actorIds.has(targetId)) return true;

  const actorEmail = String(req.user?.email || '').trim().toLowerCase();
  const targetEmail = String(targetUser?.email || '').trim().toLowerCase();
  if (actorEmail && targetEmail && actorEmail === targetEmail) return true;

  const actorCollegeId = String(req.user?.collegeId || '').trim().toUpperCase();
  const targetCollegeId = String(targetUser?.collegeId || '').trim().toUpperCase();
  if (actorCollegeId && targetCollegeId && actorCollegeId === targetCollegeId) return true;

  return false;
};

const normalizeAllowedSections = (sections) => {
  if (!Array.isArray(sections)) return [];
  return Array.from(
    new Set(
      sections
        .map((value) => String(value || '').trim().toLowerCase())
        .filter((value) => TEMP_ACCESS_ALLOWED_SECTIONS.includes(value))
    )
  );
};

const normalizeTemporaryAccessHours = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.round(parsed);
  if (rounded < TEMP_ACCESS_MIN_HOURS || rounded > TEMP_ACCESS_MAX_HOURS) return null;
  return rounded;
};

const summarizeTemporaryAccess = (user = {}) => {
  const pass = user?.temporaryAccess || {};
  const expiresAtRaw = pass.expiresAt ? new Date(pass.expiresAt) : null;
  const expiresAt = expiresAtRaw && !Number.isNaN(expiresAtRaw.getTime()) ? expiresAtRaw : null;
  const isActive = Boolean(pass.enabled) && Boolean(expiresAt) && expiresAt.getTime() > Date.now();
  const remainingMinutes = isActive
    ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 60000))
    : 0;

  return {
    enabled: Boolean(pass.enabled),
    isActive,
    mode: String(pass.mode || 'read-only').toLowerCase() === 'read-only' ? 'read-only' : 'read-only',
    grantedAt: pass.grantedAt || null,
    expiresAt,
    remainingMinutes,
    grantedBy: pass.grantedBy || null,
    revokedAt: pass.revokedAt || null,
    revokedBy: pass.revokedBy || null,
    revokeReason: String(pass.revokeReason || '').trim(),
    restrictions: {
      readOnly: pass?.restrictions?.readOnly !== false,
      allowedSections: normalizeAllowedSections(pass?.restrictions?.allowedSections),
      writeOperationsBlocked: true,
      adminBlocked: true,
    },
  };
};

/**
 * @desc    Generate a new invitation code
 */
exports.generateInviteCode = async (req, res) => {
  try {
    const requestedMaxUses = normalizeInviteMaxUses(req.body?.maxUses);
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'maxUses') && requestedMaxUses === null) {
      return res.status(400).json({
        success: false,
        message: `maxUses must be an integer between 1 and ${INVITE_CODE_MAX_USES_LIMIT}`,
      });
    }

    const maxUses = requestedMaxUses || 1;
    const expiresAt = new Date(Date.now() + INVITE_CODE_TTL_MS);

    let newCode = null;
    let attempts = 0;
    while (!newCode && attempts < 6) {
      attempts += 1;
      const codeString = crypto.randomBytes(4).toString('hex').toUpperCase();
      try {
        newCode = await InviteCode.create({
          code: codeString,
          createdBy: req.user.id,
          maxUses,
          currentUses: 0,
          isUsed: false,
          expiresAt,
        });
      } catch (err) {
        if (err?.code !== 11000) throw err;
      }
    }

    if (!newCode) {
      return res.status(500).json({
        success: false,
        message: 'Could not generate a unique invite code. Try again.',
      });
    }

    const usage = readInviteUsage(newCode);

    await logAudit({
      actor: req.user.id,
      action: 'ADMIN_INVITE_CODE_GENERATED',
      entityType: 'InviteCode',
      entityId: newCode._id,
      after: {
        code: newCode.code,
        maxUses: usage.maxUses,
        currentUses: usage.currentUses,
        expiresAt: newCode.expiresAt,
      },
      req,
    });

    res.status(201).json({
      success: true,
      message: 'Invite code created successfully',
      code: newCode.code,
      maxUses: usage.maxUses,
      currentUses: usage.currentUses,
      remainingUses: usage.remainingUses,
      expiresAt: newCode.expiresAt,
    });
  } catch (err) {
    console.error("❌ generateInviteCode error:", err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Send Invite Code to User Email
 */
exports.sendInviteEmail = async (req, res) => {
  const { email, inviteCode } = req.body;
  const normalizedInviteCode = normalizeInviteCode(inviteCode);

  if (!email || !normalizedInviteCode) {
    return res.status(400).json({
      success: false,
      message: 'Email and Invite Code are required',
    });
  }

  try {
    const codeRecord = await InviteCode.findOne({ code: normalizedInviteCode });
    if (!codeRecord) {
      return res.status(404).json({
        success: false,
        message: 'Invite code not found',
      });
    }

    if (isInviteExpired(codeRecord)) {
      return res.status(410).json({
        success: false,
        message: 'Invite code expired. Generate a new code.',
      });
    }

    const usage = readInviteUsage(codeRecord);
    if (usage.remainingUses <= 0) {
      if (!codeRecord.isUsed) {
        codeRecord.isUsed = true;
        await codeRecord.save({ validateBeforeSave: false });
      }
      return res.status(410).json({
        success: false,
        message: 'Invite code usage limit reached. Generate a new code.',
      });
    }

    // ✅ Use deployed frontend URL (NOT localhost)
    const frontendUrl = resolveFrontendUrl();
    const registerLink = `${frontendUrl}/login`;
    const expiryLabel = new Date(codeRecord.expiresAt).toLocaleString();

    const emailMessage = `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
        <h2 style="color: #2563eb;">Lab Invitation</h2>
        <p>You've been invited to join <strong>CICR Connect</strong>.</p>
        <p>Use this code during registration:</p>

        <div style="background: #f8fafc; border: 2px dashed #cbd5e1; padding: 16px; text-align: center; margin: 20px 0;">
          <span style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${normalizedInviteCode}</span>
        </div>

        <p>Register here:</p>
        <a href="${registerLink}" style="display:inline-block;padding:10px 15px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;">
          Open CICR Portal
        </a>

        <p style="margin-top:16px;font-size:13px;color:#1f2937;">
          Usage remaining: <strong>${usage.remainingUses}</strong> of <strong>${usage.maxUses}</strong><br />
          Expires on: <strong>${expiryLabel}</strong>
        </p>

        <p style="margin-top:16px;font-size:12px;color:gray;">
          If you didn't request this invite, you can ignore this email.
        </p>
      </div>
    `;

   
    try {
      await sendEmail({
        email,
        subject: 'CICR Connect Invitation',
        message: emailMessage,
      });

      await logAudit({
        actor: req.user.id,
        action: 'ADMIN_INVITE_EMAIL_SENT',
        entityType: 'InviteCode',
        entityId: codeRecord._id,
        after: {
          email,
          code: normalizedInviteCode,
          emailSent: true,
          remainingUses: usage.remainingUses,
        },
        req,
      });

      return res.status(200).json({
        success: true,
        message: `Invite sent to ${email}`,
        emailSent: true,
        remainingUses: usage.remainingUses,
        maxUses: usage.maxUses,
        expiresAt: codeRecord.expiresAt,
      });
    } catch (emailErr) {
      console.error("❌ Email failed (but invite code valid):", emailErr.message);

      return res.status(200).json({
        success: true,
        message: `Invite code is valid ✅ but email failed ❌. Try again later.`,
        emailSent: false,
        emailError: emailErr.message,
        emailCode: emailErr.code || null,
      });
    }
  } catch (err) {
    console.error("🔥 sendInviteEmail controller error:", err);

    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: err.message,
    });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-password').sort({ createdAt: -1 });
    const normalized = users.map((user) => {
      const plain = user.toObject();
      if (!plain.approvalStatus) {
        plain.approvalStatus = plain.isVerified ? 'Approved' : 'Pending';
      }
      plain.temporaryAccess = summarizeTemporaryAccess(plain);
      return plain;
    });
    res.json(normalized);
  } catch (err) {
    console.error("❌ getAllUsers error:", err.message);
    res.status(500).send('Server error');
  }
};

exports.getTemporaryAccessUsers = async (req, res) => {
  try {
    const rows = await User.find({ 'temporaryAccess.enabled': true })
      .select('-password')
      .populate('temporaryAccess.grantedBy', 'name role')
      .populate('temporaryAccess.revokedBy', 'name role')
      .sort({ 'temporaryAccess.expiresAt': 1, updatedAt: -1 });

    const result = rows.map((user) => {
      const plain = user.toObject();
      return {
        _id: plain._id,
        name: plain.name,
        email: plain.email,
        collegeId: plain.collegeId,
        role: plain.role,
        approvalStatus: plain.approvalStatus,
        isVerified: plain.isVerified,
        temporaryAccess: summarizeTemporaryAccess(plain),
      };
    });

    return res.json(result);
  } catch (err) {
    console.error('❌ getTemporaryAccessUsers error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.grantTemporaryAccess = async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const approval = String(targetUser.approvalStatus || '').trim().toLowerCase();
    const isApproved = targetUser.isVerified || approval === 'approved';
    if (isApproved) {
      return res.status(400).json({
        success: false,
        message: 'This user is already approved and does not need temporary access.',
      });
    }

    const hours = normalizeTemporaryAccessHours(req.body?.hours);
    if (hours === null) {
      return res.status(400).json({
        success: false,
        message: `hours must be between ${TEMP_ACCESS_MIN_HOURS} and ${TEMP_ACCESS_MAX_HOURS}`,
      });
    }

    const mode = String(req.body?.mode || 'read-only').trim().toLowerCase();
    if (mode !== 'read-only') {
      return res.status(400).json({
        success: false,
        message: 'Only read-only temporary access mode is supported.',
      });
    }

    const allowedSections = normalizeAllowedSections(req.body?.restrictions?.allowedSections);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + hours * 60 * 60 * 1000);

    const before = summarizeTemporaryAccess(targetUser);
    targetUser.temporaryAccess = {
      enabled: true,
      mode: 'read-only',
      grantedAt: now,
      expiresAt,
      grantedBy: req.user.id,
      revokedAt: null,
      revokedBy: null,
      revokeReason: '',
      restrictions: {
        readOnly: true,
        allowedSections,
      },
    };
    await targetUser.save({ validateBeforeSave: false });

    await createNotifications({
      userIds: [targetUser._id],
      title: 'Temporary Dashboard Access Enabled',
      message: `Admin granted you read-only dashboard access for ${hours} hour(s).`,
      type: 'warning',
      link: '/dashboard',
      meta: { mode: 'read-only', expiresAt },
      createdBy: req.user.id,
    });

    const after = summarizeTemporaryAccess(targetUser);
    await logAudit({
      actor: req.user.id,
      action: 'TEMP_ACCESS_GRANTED',
      entityType: 'User',
      entityId: targetUser._id,
      before,
      after,
      req,
    });

    return res.json({
      success: true,
      message: `Temporary access enabled for ${hours} hour(s).`,
      user: {
        _id: targetUser._id,
        name: targetUser.name,
        email: targetUser.email,
        collegeId: targetUser.collegeId,
        temporaryAccess: after,
      },
    });
  } catch (err) {
    console.error('❌ grantTemporaryAccess error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.revokeTemporaryAccess = async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const before = summarizeTemporaryAccess(targetUser);
    if (!before.enabled) {
      return res.status(400).json({ success: false, message: 'No temporary access is currently enabled.' });
    }

    const reason = String(req.body?.reason || '').trim().slice(0, 240);
    targetUser.temporaryAccess = {
      ...(targetUser.temporaryAccess || {}),
      enabled: false,
      revokedAt: new Date(),
      revokedBy: req.user.id,
      revokeReason: reason,
      restrictions: {
        readOnly: true,
        allowedSections: normalizeAllowedSections(targetUser?.temporaryAccess?.restrictions?.allowedSections),
      },
    };
    await targetUser.save({ validateBeforeSave: false });

    await createNotifications({
      userIds: [targetUser._id],
      title: 'Temporary Dashboard Access Revoked',
      message: 'Admin revoked your temporary dashboard access.',
      type: 'warning',
      link: '/login',
      meta: { reason: reason || undefined },
      createdBy: req.user.id,
    });

    const after = summarizeTemporaryAccess(targetUser);
    await logAudit({
      actor: req.user.id,
      action: 'TEMP_ACCESS_REVOKED',
      entityType: 'User',
      entityId: targetUser._id,
      before,
      after,
      req,
    });

    return res.json({
      success: true,
      message: 'Temporary access revoked successfully.',
      user: {
        _id: targetUser._id,
        name: targetUser.name,
        email: targetUser.email,
        collegeId: targetUser.collegeId,
        temporaryAccess: after,
      },
    });
  } catch (err) {
    console.error('❌ revokeTemporaryAccess error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Prevent self-deletion from admin panel.
    if (isSelfTarget(req, targetUser)) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
    }

    // Admin deletion requires multi-admin approval.
    if (targetUser.role === 'Admin') {
      if (!ensureAdminApprover(req, res)) return;

      let action = await AdminAction.findOne({
        type: 'ADMIN_DELETE',
        targetUser: targetUser._id,
        status: 'Pending',
      });

      if (!action) {
        action = new AdminAction({
          type: 'ADMIN_DELETE',
          targetUser: targetUser._id,
          requestedBy: req.user.id,
          approvals: [],
          status: 'Pending',
        });
      }

      addApprovalIfMissing(action, req.user.id);

      if (!canExecuteAdminAction(action)) {
        await action.save();
        await logAudit({
          actor: req.user.id,
          action: 'ADMIN_DELETE_PENDING_APPROVAL',
          entityType: 'AdminAction',
          entityId: action._id,
          after: {
            targetUser: String(targetUser._id),
            approvals: action.approvals.length,
          },
          req,
        });
        return res.status(202).json({
          success: true,
          requiresApproval: true,
          actionId: action._id,
          message: `Admin deletion pending approvals (${action.approvals.length}/${REQUIRED_ADMIN_APPROVALS})`,
        });
      }

      action.status = 'Executed';
      action.executedAt = new Date();
      await action.save();
      const before = {
        _id: targetUser._id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
      };
      await targetUser.deleteOne();
      await logAudit({
        actor: req.user.id,
        action: 'ADMIN_ACCOUNT_DELETED',
        entityType: 'User',
        entityId: before._id,
        before,
        req,
      });
      return res.json({ success: true, message: 'Admin account deleted after required approvals' });
    }

    const before = {
      _id: targetUser._id,
      name: targetUser.name,
      email: targetUser.email,
      role: targetUser.role,
    };
    await targetUser.deleteOne();
    await logAudit({
      actor: req.user.id,
      action: 'USER_DELETED_BY_ADMIN',
      entityType: 'User',
      entityId: before._id,
      before,
      req,
    });
    res.json({ success: true, message: 'User removed' });
  } catch (err) {
    console.error("❌ deleteUser error:", err.message);
    res.status(500).send('Server error');
  }
};

exports.updateUserByAdmin = async (req, res) => {
  try {
    const payload = { ...req.body };
    const normalizeApprovalStatus = (value) => {
      const v = String(value || '').trim().toLowerCase();
      if (!v) return null;
      if (v === 'approved') return 'Approved';
      if (v === 'pending') return 'Pending';
      if (v === 'rejected') return 'Rejected';
      return null;
    };

    if (Object.prototype.hasOwnProperty.call(payload, 'approvalStatus')) {
      const normalized = normalizeApprovalStatus(payload.approvalStatus);
      if (!normalized) {
        return res.status(400).json({ success: false, message: 'Invalid approvalStatus value' });
      }
      payload.approvalStatus = normalized;
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'isVerified')) {
      payload.approvalStatus = payload.isVerified ? 'Approved' : 'Pending';
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'idCardEnabled')) {
      if (typeof payload.idCardEnabled !== 'boolean') {
        return res.status(400).json({ success: false, message: 'idCardEnabled must be a boolean' });
      }
    }

    if (payload.approvalStatus === 'Approved') {
      payload.isVerified = true;
    } else if (payload.approvalStatus === 'Pending' || payload.approvalStatus === 'Rejected') {
      payload.isVerified = false;
    }

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const before = {
      _id: targetUser._id,
      role: targetUser.role,
      approvalStatus: targetUser.approvalStatus,
      isVerified: targetUser.isVerified,
      idCardEnabled: Boolean(targetUser.idCardEnabled),
    };

    if (
      isSelfTarget(req, targetUser) &&
      Object.prototype.hasOwnProperty.call(payload, 'role') &&
      payload.role !== targetUser.role
    ) {
      return res.status(400).json({ success: false, message: 'You cannot change your own role from admin panel' });
    }

    const isAdminDemotion = targetUser.role === 'Admin' && payload.role && payload.role !== 'Admin';
    if (isAdminDemotion) {
      if (!ensureAdminApprover(req, res)) return;

      let action = await AdminAction.findOne({
        type: 'ADMIN_ROLE_CHANGE',
        targetUser: targetUser._id,
        status: 'Pending',
        'payload.newRole': payload.role,
      });

      if (!action) {
        action = new AdminAction({
          type: 'ADMIN_ROLE_CHANGE',
          targetUser: targetUser._id,
          requestedBy: req.user.id,
          approvals: [],
          payload: { newRole: payload.role },
          status: 'Pending',
        });
      }

      addApprovalIfMissing(action, req.user.id);

      if (!canExecuteAdminAction(action)) {
        await action.save();
        await logAudit({
          actor: req.user.id,
          action: 'ADMIN_ROLE_CHANGE_PENDING_APPROVAL',
          entityType: 'AdminAction',
          entityId: action._id,
          after: {
            targetUser: String(targetUser._id),
            newRole: payload.role,
            approvals: action.approvals.length,
          },
          req,
        });
        return res.status(202).json({
          success: true,
          requiresApproval: true,
          actionId: action._id,
          message: `Admin demotion pending approvals (${action.approvals.length}/${REQUIRED_ADMIN_APPROVALS})`,
        });
      }

      action.status = 'Executed';
      action.executedAt = new Date();
      await action.save();

      const demoted = await User.findByIdAndUpdate(
        req.params.id,
        { role: payload.role },
        { new: true }
      );
      await logAudit({
        actor: req.user.id,
        action: 'ADMIN_ROLE_CHANGED',
        entityType: 'User',
        entityId: demoted?._id || req.params.id,
        before,
        after: { role: demoted?.role },
        req,
      });
      return res.json({
        success: true,
        user: demoted,
        message: 'Admin demoted after required approvals',
      });
    }

    const updatedUser = await User.findByIdAndUpdate(req.params.id, payload, { new: true });
    await logAudit({
      actor: req.user.id,
      action: 'USER_UPDATED_BY_ADMIN',
      entityType: 'User',
      entityId: updatedUser?._id || req.params.id,
      before,
      after: {
        role: updatedUser?.role,
        approvalStatus: updatedUser?.approvalStatus,
        isVerified: updatedUser?.isVerified,
        idCardEnabled: Boolean(updatedUser?.idCardEnabled),
      },
      meta: { changedFields: Object.keys(payload) },
      req,
    });
    if (updatedUser && String(updatedUser._id) !== String(req.user.id)) {
      await createNotifications({
        userIds: [updatedUser._id],
        title: 'Account Status Updated',
        message: 'Your role/profile approval status was updated by admin.',
        type: 'info',
        link: '/profile',
        meta: { role: updatedUser.role, approvalStatus: updatedUser.approvalStatus },
        createdBy: req.user.id,
      });
    }
    res.json({ success: true, user: updatedUser });
  } catch (err) {
    console.error("❌ updateUserByAdmin error:", err.message);
    res.status(500).send('Server error');
  }
};

exports.getPendingAdminActions = async (req, res) => {
  try {
    const actions = await AdminAction.find({ status: 'Pending' })
      .populate('targetUser', 'name email role collegeId')
      .populate('requestedBy', 'name role')
      .populate('approvals', 'name role')
      .sort({ createdAt: -1 });
    return res.json(actions);
  } catch (err) {
    console.error("❌ getPendingAdminActions error:", err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.approveAdminAction = async (req, res) => {
  try {
    if (!ensureAdminApprover(req, res)) return;

    const action = await AdminAction.findById(req.params.actionId);
    if (!action || action.status !== 'Pending') {
      return res.status(404).json({ success: false, message: 'Pending action not found' });
    }

    const targetUser = await User.findById(action.targetUser);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Target user not found' });
    }

    addApprovalIfMissing(action, req.user.id);

    if (!canExecuteAdminAction(action)) {
      await action.save();
      await logAudit({
        actor: req.user.id,
        action: 'ADMIN_ACTION_APPROVAL_RECORDED',
        entityType: 'AdminAction',
        entityId: action._id,
        after: { approvals: action.approvals.length, type: action.type },
        req,
      });
      return res.json({
        success: true,
        requiresApproval: true,
        message: `Approval recorded (${action.approvals.length}/${REQUIRED_ADMIN_APPROVALS})`,
        action,
      });
    }

    if (action.type === 'ADMIN_DELETE') {
      await targetUser.deleteOne();
    } else if (action.type === 'ADMIN_ROLE_CHANGE') {
      targetUser.role = action.payload?.newRole || targetUser.role;
      await targetUser.save();
    }

    action.status = 'Executed';
    action.executedAt = new Date();
    await action.save();

    await logAudit({
      actor: req.user.id,
      action: 'ADMIN_ACTION_EXECUTED',
      entityType: 'AdminAction',
      entityId: action._id,
      after: { type: action.type, targetUser: String(action.targetUser) },
      req,
    });

    return res.json({
      success: true,
      message: 'Action executed after required approvals',
      action,
    });
  } catch (err) {
    console.error("❌ approveAdminAction error:", err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.generatePasswordResetCode = async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const resetCode = `${Math.floor(100000 + Math.random() * 900000)}`;
    const hashed = crypto.createHash('sha256').update(resetCode).digest('hex');

    targetUser.passwordResetOtp = hashed;
    targetUser.passwordResetOtpExpires = Date.now() + 15 * 60 * 1000;
    await targetUser.save({ validateBeforeSave: false });

    await createNotifications({
      userIds: [targetUser._id],
      title: 'Password Reset Code Generated',
      message: 'Admin generated a temporary reset code for your account.',
      type: 'warning',
      link: '/login',
      meta: { validForMinutes: 15 },
      createdBy: req.user.id,
    });

    await logAudit({
      actor: req.user.id,
      action: 'PASSWORD_RESET_CODE_GENERATED',
      entityType: 'User',
      entityId: targetUser._id,
      after: { validForMinutes: 15 },
      req,
    });

    return res.json({
      success: true,
      resetCode,
      validForMinutes: 15,
      user: {
        _id: targetUser._id,
        name: targetUser.name,
        collegeId: targetUser.collegeId,
      },
    });
  } catch (err) {
    console.error('❌ generatePasswordResetCode error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getAuditLogs = async (req, res) => {
  try {
    const limitRaw = Number(req.query.limit || 120);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 10), 300) : 120;
    const action = String(req.query.action || '').trim();

    const query = {};
    if (action) {
      query.action = action;
    }

    const logs = await AuditLog.find(query)
      .populate('actor', 'name role collegeId year')
      .sort({ createdAt: -1 })
      .limit(limit);

    return res.json(logs);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
