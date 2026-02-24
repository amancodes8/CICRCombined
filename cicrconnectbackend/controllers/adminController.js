const User = require('../models/User');
const InviteCode = require('../models/InviteCode');
const sendEmail = require('../utils/sendEmail');
const crypto = require('crypto');

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
    const frontendUrl = process.env.FRONTEND_URL || "https://frontend-cicr25.vercel.app";
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
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'User removed' });
  } catch (err) {
    console.error("❌ deleteUser error:", err.message);
    res.status(500).send('Server error');
  }
};

exports.updateUserByAdmin = async (req, res) => {
  try {
    const payload = { ...req.body };

    if (Object.prototype.hasOwnProperty.call(payload, 'isVerified')) {
      payload.approvalStatus = payload.isVerified ? 'Approved' : 'Pending';
    }

    if (payload.approvalStatus === 'Approved') {
      payload.isVerified = true;
    } else if (payload.approvalStatus === 'Pending' || payload.approvalStatus === 'Rejected') {
      payload.isVerified = false;
    }

    const updatedUser = await User.findByIdAndUpdate(req.params.id, payload, { new: true });
    res.json({ success: true, user: updatedUser });
  } catch (err) {
    console.error("❌ updateUserByAdmin error:", err.message);
    res.status(500).send('Server error');
  }
};
