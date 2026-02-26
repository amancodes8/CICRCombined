const User = require('../models/User');
const InviteCode = require('../models/InviteCode');
const generateToken = require('../utils/generateToken');
const sendEmail = require('../utils/sendEmail');
const crypto = require('crypto');

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const normalizeCollegeId = (value) => String(value || '').trim().toUpperCase();

const normalizeHandle = (value) => {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      const u = new URL(raw);
      const path = u.pathname.replace(/^\/+|\/+$/g, '');
      return path.split('/')[0] || '';
    } catch {
      return raw.replace(/^@+/, '');
    }
  }

  return raw.replace(/^@+/, '');
};

const registerUser = async (req, res) => {
  const { name, email, password, collegeId, inviteCode, joinedAt } = req.body;
  const normalizedName = String(name || '').trim();
  const normalizedEmail = normalizeEmail(email);
  const normalizedCollegeId = normalizeCollegeId(collegeId);
  const normalizedInviteCode = String(inviteCode || '').trim().toUpperCase();

  if (!normalizedName || !normalizedEmail || !password || !normalizedCollegeId || !normalizedInviteCode) {
    return res.status(400).json({ message: 'All fields required' });
  }

  const userExists = await User.findOne({ $or: [{ email: normalizedEmail }, { collegeId: normalizedCollegeId }] });
  if (userExists) {
    return res.status(400).json({ message: 'User already exists' });
  }

  const code = await InviteCode.findOne({ code: normalizedInviteCode });
  if (!code || code.isUsed || code.expiresAt < new Date()) {
    return res.status(400).json({ message: 'Invalid invite code' });
  }

  await User.create({
    name: normalizedName,
    email: normalizedEmail,
    password,
    collegeId: normalizedCollegeId,
    joinedAt: joinedAt ? new Date(joinedAt) : undefined,
    isVerified: false,
    approvalStatus: 'Pending',
  });

  code.isUsed = true;
  await code.save();

  res.status(201).json({
    success: true,
    message: 'Registration successful. Your account is pending admin approval.'
  });
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = normalizeEmail(email);

  const user = await User.findOne({ email: normalizedEmail });
  if (!user || !(await user.matchPassword(password))) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const approval = String(user.approvalStatus || '').trim().toLowerCase();

  if (approval === 'rejected') {
    return res.status(403).json({ message: 'Your registration has been rejected. Contact admin.' });
  }

  const isApproved = user.isVerified || approval === 'approved';
  if (!isApproved) {
    return res.status(401).json({ message: 'Account pending admin approval' });
  }

  res.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    warningCount: user.warningCount || 0,
    hasUnreadWarning: !!user.hasUnreadWarning,
    token: generateToken(user._id),
  });
};

const verifyEmail = async (req, res) => {
  return res.status(410).json({
    success: false,
    message: 'Email verification is no longer used. Please wait for admin approval.',
  });
};

const resetPasswordWithCode = async (req, res) => {
  const { collegeId, resetCode, newPassword } = req.body;
  const normalizedCollegeId = normalizeCollegeId(collegeId);

  if (!normalizedCollegeId || !resetCode || !newPassword) {
    return res.status(400).json({ message: 'College ID, reset code, and new password are required' });
  }

  if (String(newPassword).length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  const hashedCode = crypto.createHash('sha256').update(String(resetCode)).digest('hex');

  const user = await User.findOne({
    collegeId: normalizedCollegeId,
    passwordResetOtp: hashedCode,
    passwordResetOtpExpires: { $gt: Date.now() },
  });

  if (!user) {
    return res.status(400).json({ message: 'Invalid or expired reset code' });
  }

  user.password = newPassword;
  user.passwordResetOtp = undefined;
  user.passwordResetOtpExpires = undefined;
  await user.save();

  return res.json({ success: true, message: 'Password changed successfully. Please sign in.' });
};

const changePassword = async (req, res) => {
  const currentPassword = String(req.body.currentPassword || '');
  const newPassword = String(req.body.newPassword || '');

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current password and new password are required.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters.' });
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({ message: 'New password must be different from current password.' });
  }

  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const matches = await user.matchPassword(currentPassword);
  if (!matches) {
    return res.status(400).json({ message: 'Current password is incorrect.' });
  }

  user.password = newPassword;
  user.passwordResetOtp = undefined;
  user.passwordResetOtpExpires = undefined;
  await user.save();

  return res.json({ success: true, message: 'Password updated successfully.' });
};

const sendPasswordResetOtp = async (req, res) => {
  const { email, collegeId } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const normalizedCollegeId = normalizeCollegeId(collegeId);

  if (!normalizedEmail || !normalizedCollegeId) {
    return res.status(400).json({ message: 'Email and college ID are required' });
  }

  const user = await User.findOne({ email: normalizedEmail, collegeId: normalizedCollegeId });
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found with provided email and college ID' });
  }

  const otp = `${Math.floor(100000 + Math.random() * 900000)}`;
  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

  user.passwordResetOtp = hashedOtp;
  user.passwordResetOtpExpires = Date.now() + 10 * 60 * 1000;
  await user.save({ validateBeforeSave: false });

  await sendEmail({
    email: user.email,
    subject: 'CICR Password Reset OTP',
    message: `
      <p>Your password reset OTP is:</p>
      <h2 style="letter-spacing: 4px;">${otp}</h2>
      <p>This OTP is valid for 10 minutes.</p>
    `,
  });

  res.json({ success: true, message: 'OTP sent to your email.' });
};

const resetPasswordWithOtp = async (req, res) => {
  const { email, collegeId, otp, newPassword } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const normalizedCollegeId = normalizeCollegeId(collegeId);

  if (!normalizedEmail || !normalizedCollegeId || !otp || !newPassword) {
    return res.status(400).json({ message: 'Email, college ID, OTP, and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  const hashedOtp = crypto.createHash('sha256').update(String(otp)).digest('hex');

  const user = await User.findOne({
    email: normalizedEmail,
    collegeId: normalizedCollegeId,
    passwordResetOtp: hashedOtp,
    passwordResetOtpExpires: { $gt: Date.now() },
  });

  if (!user) {
    return res.status(400).json({ message: 'Invalid or expired OTP' });
  }

  user.password = newPassword;
  user.passwordResetOtp = undefined;
  user.passwordResetOtpExpires = undefined;
  await user.save();

  res.json({ success: true, message: 'Password changed successfully. Please log in.' });
};

const getMe = async (req, res) => {
  const user = await User.findById(req.user.id)
    .select('-password')
    .populate('warnings.issuedBy', 'name role');

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  res.json(user);
};

const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'name')) {
      const name = String(req.body.name || '').trim();
      if (!name) {
        return res.status(400).json({ message: 'Name is required.' });
      }
      user.name = name;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'phone')) {
      user.phone = String(req.body.phone || '').trim();
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'year')) {
      const rawYear = String(req.body.year ?? '').trim();
      if (!rawYear) {
        user.year = undefined;
      } else {
        const parsedYear = Number(rawYear);
        if (!Number.isFinite(parsedYear) || parsedYear < 1 || parsedYear > 6) {
          return res.status(400).json({ message: 'Year must be a number between 1 and 6.' });
        }
        user.year = parsedYear;
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'branch')) {
      user.branch = String(req.body.branch || '').trim().toUpperCase();
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'batch')) {
      user.batch = String(req.body.batch || '').trim();
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'joinedAt')) {
      const rawJoinedAt = req.body.joinedAt;
      if (!rawJoinedAt) {
        user.joinedAt = user.joinedAt || Date.now();
      } else {
        const parsedDate = new Date(rawJoinedAt);
        if (Number.isNaN(parsedDate.getTime())) {
          return res.status(400).json({ message: 'Invalid joined date.' });
        }
        user.joinedAt = parsedDate;
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'projectIdeas')) {
      user.projectIdeas = Array.isArray(req.body.projectIdeas)
        ? req.body.projectIdeas.map((v) => String(v || '').trim()).filter(Boolean)
        : user.projectIdeas;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'bio')) {
      user.bio = String(req.body.bio || '').trim();
    }

    if (Array.isArray(req.body.achievements)) {
      user.achievements = req.body.achievements.map((v) => String(v || '').trim()).filter(Boolean);
    }

    if (Array.isArray(req.body.skills)) {
      user.skills = req.body.skills.map((v) => String(v || '').trim()).filter(Boolean);
    }

    user.social = {
      linkedin: String(req.body.social?.linkedin ?? user.social?.linkedin ?? '').trim(),
      github: String(req.body.social?.github ?? user.social?.github ?? '').trim(),
      portfolio: String(req.body.social?.portfolio ?? user.social?.portfolio ?? '').trim(),
      instagram: normalizeHandle(req.body.social?.instagram ?? user.social?.instagram ?? ''),
      facebook: normalizeHandle(req.body.social?.facebook ?? user.social?.facebook ?? ''),
    };

    const updatedUser = await user.save();
    const userResponse = updatedUser.toObject();
    delete userResponse.password;

    return res.json(userResponse);
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Unable to update profile.' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  verifyEmail,
  resetPasswordWithCode,
  sendPasswordResetOtp,
  resetPasswordWithOtp,
  changePassword,
  getMe,
  updateProfile,
};
