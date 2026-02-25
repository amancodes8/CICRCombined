const User = require('../models/User');
const InviteCode = require('../models/InviteCode');
const AdminAction = require('../models/AdminAction');
const AuditLog = require('../models/AuditLog');
const sendEmail = require('../utils/sendEmail');
const { createNotifications } = require('../utils/notificationService');
const { logAudit } = require('../utils/auditLogger');
const crypto = require('crypto');

const REQUIRED_ADMIN_APPROVALS = 3;
const resolveFrontendUrl = () => {
  const raw = String(process.env.FRONTEND_URL || '').trim();
  if (!raw) return 'https://cicrconnect.vercel.app';
  return raw.split(',').map((v) => v.trim()).filter(Boolean)[0] || 'https://cicrconnect.vercel.app';
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

/**
 * @desc    Generate a new invitation code
 */
exports.generateInviteCode = async (req, res) => {
  try {
    const codeString = crypto.randomBytes(4).toString('hex').toUpperCase();

    const newCode = new InviteCode({
      code: codeString,
      createdBy: req.user.id, // Matches your Schema
    });

    await newCode.save();

    await logAudit({
      actor: req.user.id,
      action: 'ADMIN_INVITE_CODE_GENERATED',
      entityType: 'InviteCode',
      entityId: newCode._id,
      after: { code: newCode.code, isUsed: newCode.isUsed },
      req,
    });

    res.status(201).json({
      success: true,
      message: 'Invite code created successfully',
      code: newCode.code,
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

  if (!email || !inviteCode) {
    return res.status(400).json({
      success: false,
      message: 'Email and Invite Code are required',
    });
  }

  try {
    // ✅ find unused invite code
    const codeRecord = await InviteCode.findOne({ code: inviteCode, isUsed: false });

    if (!codeRecord) {
      const exists = await InviteCode.findOne({ code: inviteCode });

      return res.status(404).json({
        success: false,
        message: exists?.isUsed ? 'Invite code already used' : 'Invite code not found',
      });
    }

    // ✅ Use deployed frontend URL (NOT localhost)
    const frontendUrl = resolveFrontendUrl();
    const registerLink = `${frontendUrl}/login`;

    const emailMessage = `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
        <h2 style="color: #2563eb;">Lab Invitation</h2>
        <p>You've been invited to join <strong>CICR Connect</strong>.</p>
        <p>Use this code during registration:</p>

        <div style="background: #f8fafc; border: 2px dashed #cbd5e1; padding: 16px; text-align: center; margin: 20px 0;">
          <span style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${inviteCode}</span>
        </div>

        <p>Register here:</p>
        <a href="${registerLink}" style="display:inline-block;padding:10px 15px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;">
          Open CICR Portal
        </a>

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
        after: { email, code: inviteCode, emailSent: true },
        req,
      });

      return res.status(200).json({
        success: true,
        message: `Invite sent to ${email}`,
        emailSent: true,
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
      return plain;
    });
    res.json(normalized);
  } catch (err) {
    console.error("❌ getAllUsers error:", err.message);
    res.status(500).send('Server error');
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Prevent self-deletion from admin panel.
    if (String(targetUser._id) === String(req.user.id)) {
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
    };

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
      .populate('actor', 'name role collegeId')
      .sort({ createdAt: -1 })
      .limit(limit);

    return res.json(logs);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
